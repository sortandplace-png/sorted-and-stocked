// supabase/functions/send-borrowed-item-reminder/index.ts
// SS-266. One SMS, once, to whoever was chosen at log time -- for a
// borrowed/lent item still not marked returned 3 days after it went out.
//
// Same shape as send-low-stock-alert: fetch and filter in JS rather than
// push the date arithmetic into a PostgREST filter (that function's own
// comment already covers why .lt() can't compare two columns; here the
// comparison is against "3 days ago", computed once in JS, so the same
// reasoning applies to keep both functions doing this the same way).
//
// reminder_sent_at is what makes this idempotent under a DAILY cron. Without
// it, every run after day 3 would re-notify the same person again the next
// day, and the day after that, for as long as the item stays out -- a
// signal that is supposed to fire once turning into a growing nuisance.
// Marked regardless of whether the send itself succeeds: a permanently
// broken Twilio config should surface once in sms_log as a failure, not
// retry forever and paper over the fact that it never actually got fixed.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

    const { data: candidates, error } = await supabaseClient
      .from('borrowed_items')
      .select('id, property_id, item_name, direction, other_party, date_out, notify_user_id')
      .eq('returned', false)
      .is('reminder_sent_at', null)
      .not('notify_user_id', 'is', null)
      .lte('date_out', threeDaysAgo.slice(0, 10))

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    const due = candidates ?? []
    if (due.length === 0) {
      return new Response(JSON.stringify({ status: 'Nothing due' }), {
        headers: { "Content-Type": "application/json" }
      })
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID') ?? ''
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN') ?? ''
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER') ?? ''

    if (!accountSid || !authToken || !fromNumber) {
      return new Response(JSON.stringify({ warning: 'Twilio credentials not configured' }), {
        headers: { "Content-Type": "application/json" },
        status: 200
      })
    }

    const results: { id: string; status: string }[] = []

    for (const item of due) {
      // profiles is the same table property_members.user_id references
      // (confirmed against the schema, not assumed) -- notify_user_id
      // points there directly.
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('phone_number, sms_opt_in')
        .eq('id', item.notify_user_id)
        .maybeSingle()

      // Always mark attempted, even when skipped for consent/no-number --
      // otherwise a person who never opted in gets re-evaluated (and
      // logged as skipped) every single day this cron runs, for as long as
      // the item stays out.
      if (!profile?.phone_number || !profile.sms_opt_in) {
        await supabaseClient
          .from('borrowed_items')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', item.id)
        results.push({ id: item.id, status: 'skipped_no_consent' })
        continue
      }

      const direction = item.direction === 'borrowed_from' ? 'borrowed from' : 'lent to'
      const message =
        `Reminder: "${item.item_name}" was ${direction} ${item.other_party} on ${item.date_out} and is still not marked returned in Sorted & Stocked.`

      let status: 'sent' | 'failed' = 'sent'
      let smsError: string | null = null

      try {
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${btoa(accountSid + ':' + authToken)}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              To: profile.phone_number,
              From: fromNumber,
              Body: message
            }).toString()
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

      await supabaseClient.from('sms_log').insert({
        property_id: item.property_id,
        recipient_user_id: item.notify_user_id,
        phone_number: profile.phone_number,
        message,
        trigger: 'borrowed_item_reminder',
        status,
        error: smsError,
      })

      await supabaseClient
        .from('borrowed_items')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', item.id)

      results.push({ id: item.id, status })
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
