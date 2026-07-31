// supabase/functions/send-late-clockin-alert/index.ts
// SS-449, phase 1. Runs every 15 minutes (pg_cron, migration 160). For each
// active shift_schedules row for today whose start_time is more than the
// 20-minute grace behind the New Jersey clock, where the person has not
// clocked in today (shifts.clocked_in_at -- the My Day Time Clock pill,
// SS-285, is the real clock-in path): one bilingual "Running late?" SMS
// (Twilio, sms_opt_in gated like every other send) and one email (Resend).
//
// late_clockin_alerts is what makes a 15-minute cron fire ONCE per person
// per day -- the row is written whatever the send outcome, same reasoning
// as send-borrowed-item-reminder's reminder_sent_at: a broken Twilio or
// Resend config should surface once in the statuses, not retry all day.
//
// Deliberate details:
//   - day_of_week is ISO 1=Mon..7=Sun (master_tasks' convention).
//   - 4-hour cap: if the cron was down all morning, an 8am shift does not
//     get a "running late?" at 4pm -- past 4 hours it is a different
//     conversation, and this alert is not it.
//   - No staff names anywhere in the message (R17); both languages in one
//     message (R19), not a per-person language guess.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const TZ = 'America/New_York'
const GRACE_MINUTES = 20
const STALE_CAP_MINUTES = 240

function nyNow(): { isoDow: number; minutes: number; dateStr: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false,
    weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const dowMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
  // Intl can emit "24" for midnight with hour12:false (hourCycle h24 quirk).
  const hour = Number(get('hour')) % 24
  return {
    isoDow: dowMap[get('weekday')] ?? 0,
    minutes: hour * 60 + Number(get('minute')),
    dateStr: `${get('year')}-${get('month')}-${get('day')}`,
  }
}

function startMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function displayTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { isoDow, minutes, dateStr } = nyNow()

    const { data: schedules, error } = await supabase
      .from('shift_schedules')
      .select('id, property_id, staff_user_id, start_time')
      .eq('active', true)
      .eq('day_of_week', isoDow)
      .not('staff_user_id', 'is', null)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    const due = (schedules ?? []).filter((s) => {
      const start = startMinutes(s.start_time)
      return minutes >= start + GRACE_MINUTES && minutes <= start + STALE_CAP_MINUTES
    })
    if (due.length === 0) {
      return new Response(JSON.stringify({ status: 'Nothing due' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Already handled today (whatever the outcome was).
    const { data: alerted } = await supabase
      .from('late_clockin_alerts')
      .select('schedule_id')
      .eq('alert_date', dateStr)
      .in('schedule_id', due.map((s) => s.id))
    const alreadyAlerted = new Set((alerted ?? []).map((a) => a.schedule_id))

    // UTC instant of local midnight = now minus minutes-since-local-midnight
    // (second precision is irrelevant against a 20-minute grace).
    const localMidnightUtc = new Date(Date.now() - minutes * 60000).toISOString()

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID') ?? ''
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN') ?? ''
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER') ?? ''
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''

    const results: { schedule_id: string; sms: string; email: string; manager?: string }[] = []

    for (const sched of due) {
      if (alreadyAlerted.has(sched.id)) continue

      // Any clock-in today at this property counts -- the point is "are
      // they here", not "were they punctual to the minute".
      const { data: shift } = await supabase
        .from('shifts')
        .select('id')
        .eq('property_id', sched.property_id)
        .eq('user_id', sched.staff_user_id)
        .gte('clocked_in_at', localMidnightUtc)
        .limit(1)
      if (shift && shift.length > 0) continue

      const { data: property } = await supabase
        .from('properties')
        .select('name')
        .eq('id', sched.property_id)
        .maybeSingle()
      const propertyName = property?.name ?? 'the house'
      const startDisplay = displayTime(sched.start_time)

      const messageEn = `Running late? Your ${propertyName} shift was scheduled for ${startDisplay}. Please clock in on My Day when you arrive, or let your manager know.`
      const messageEs = `¿Vas tarde? Tu turno en ${propertyName} estaba programado para las ${startDisplay}. Por favor marca tu entrada en Mi Día al llegar, o avisa a tu encargado.`
      const smsBody = `${messageEn}\n${messageEs}`

      // --- SMS (opt-in gated, logged to sms_log like every other send) ---
      let smsStatus = 'skipped_no_consent'
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone_number, sms_opt_in')
        .eq('id', sched.staff_user_id)
        .maybeSingle()

      if (profile?.phone_number && profile.sms_opt_in) {
        if (!accountSid || !authToken || !fromNumber) {
          smsStatus = 'skipped_not_configured'
        } else {
          let status: 'sent' | 'failed' = 'sent'
          let smsError: string | null = null
          try {
            const res = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Basic ${btoa(accountSid + ':' + authToken)}`,
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  To: profile.phone_number,
                  From: fromNumber,
                  Body: smsBody,
                }).toString(),
              }
            )
            if (!res.ok) {
              status = 'failed'
              smsError = `Twilio returned ${res.status}: ${await res.text()}`
            }
          } catch (err) {
            status = 'failed'
            smsError = err instanceof Error ? err.message : 'Unknown network error'
          }
          smsStatus = status
          await supabase.from('sms_log').insert({
            property_id: sched.property_id,
            recipient_user_id: sched.staff_user_id,
            phone_number: profile.phone_number,
            message: smsBody,
            trigger: 'late_clockin',
            status,
            error: smsError,
          })
        }
      }

      // --- Email (Resend, same raw-fetch convention as the invite flow) ---
      let emailStatus = 'skipped_no_email'
      const { data: userRes } = await supabase.auth.admin.getUserById(sched.staff_user_id)
      const email = userRes?.user?.email
      if (email) {
        if (!resendKey) {
          emailStatus = 'skipped_not_configured'
        } else {
          try {
            const res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'Sorted & Stocked <alerts@sortandplace.com>',
                to: email,
                subject: `Running late? / ¿Vas tarde? — ${propertyName}`,
                html: `<p>${messageEn}</p><p>${messageEs}</p>`,
              }),
            })
            emailStatus = res.ok ? 'sent' : `failed: Resend returned ${res.status}`
          } catch (err) {
            emailStatus = `failed: ${err instanceof Error ? err.message : 'network error'}`
          }
        }
      }

      // --- Manager copy (SS-449 ruling, 31 Jul): every late alert also
      // goes to the working account. English only -- the manager copy is
      // for Racquel's side, not the staff member. No staff name in it
      // (R17): the property + shift time identifies the schedule row.
      let managerStatus = 'skipped_not_configured'
      if (resendKey) {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Sorted & Stocked <alerts@sortandplace.com>',
              to: 'sortandplace@gmail.com',
              subject: `Late clock-in — ${propertyName}, ${startDisplay} shift`,
              html: `<p>The ${startDisplay} shift at ${propertyName} has no clock-in ${GRACE_MINUTES} minutes past start. The scheduled person was notified (SMS: ${smsStatus}, email: ${emailStatus}).</p>`,
            }),
          })
          managerStatus = res.ok ? 'sent' : `failed: Resend returned ${res.status}`
        } catch (err) {
          managerStatus = `failed: ${err instanceof Error ? err.message : 'network error'}`
        }
      }

      await supabase.from('late_clockin_alerts').insert({
        schedule_id: sched.id,
        alert_date: dateStr,
        sms_status: smsStatus,
        email_status: emailStatus,
      })
      results.push({ schedule_id: sched.id, sms: smsStatus, email: emailStatus, manager: managerStatus })
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 })
  }
})
