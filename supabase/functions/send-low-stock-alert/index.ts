import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // PostgREST's .lt() takes a literal value, not a column reference --
    // .lt('current_qty', 'min_qty') was comparing current_qty against the
    // literal string "min_qty", not the min_qty column (same reason
    // weekly-digest's edge function does this comparison in JS instead of
    // as a query filter). Fetch and filter in JS, same real fix, plus
    // requiring last_counted_at -- current_qty defaults to 0 and hasn't
    // been physically counted for most items, so an uncounted 0 isn't a
    // real low-stock signal, just an unknown one.
    const { data: allItems, error } = await supabaseClient
      .from('inventory_items')
      .select(`
        id,
        name,
        current_qty,
        min_qty,
        unit,
        last_counted_at,
        properties ( name )
      `)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    const lowStockItems = (allItems ?? []).filter(
      (item) => item.last_counted_at !== null && item.current_qty < item.min_qty
    )

    if (lowStockItems.length === 0) {
      return new Response(JSON.stringify({ status: 'All stock levels nominal' }), {
        headers: { "Content-Type": "application/json" }
      })
    }

    // Format alert summary
    const alertSummary = lowStockItems.map(item =>
      `• [${item.properties?.name || 'Main'}] ${item.name}: ${item.current_qty}/${item.min_qty} ${item.unit || ''}`
    ).join('\n')

    // Get Twilio credentials
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID') ?? ''
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN') ?? ''
    const managerNumber = Deno.env.get('MANAGER_MOBILE_NUMBER') ?? ''
    const twilioNumber = Deno.env.get('TWILIO_NUMBER') ?? ''

    if (!accountSid || !authToken || !managerNumber || !twilioNumber) {
      return new Response(JSON.stringify({ warning: 'Twilio credentials not configured' }), {
        headers: { "Content-Type": "application/json" },
        status: 200
      })
    }

    // Send SMS via Twilio
    const smsResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(accountSid + ':' + authToken)}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: managerNumber,
          From: twilioNumber,
          Body: `🚨 Sorted & Stocked Alert:\n\nThe following staples are below par:\n${alertSummary}`
        }).toString()
      }
    )

    return new Response(JSON.stringify({
      dispatched: smsResponse.ok,
      itemsCount: lowStockItems.length,
      status: smsResponse.statusText
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
