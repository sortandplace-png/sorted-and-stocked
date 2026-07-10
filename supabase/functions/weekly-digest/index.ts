// supabase/functions/weekly-digest/index.ts
//
// Weekly summary email: upcoming week's meal plan, any inventory at/under
// min_qty, and open staff tasks. Sent to each property's owner(s) via
// Resend. Built and manually invocable now; the recurring schedule is
// intentionally NOT activated (see migration 061) -- Racquel asked for this
// to stay off until baseline usage stabilizes.
//
// Real caveat, not a bug: this property's inventory is currently all
// current_qty = 0 / min_qty = 0 (confirmed live, July 2026) -- the low-stock
// section will legitimately say "nothing low" until real quantity tracking
// starts. An empty low-stock section is the correct, honest output today.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_FROM = 'Sorted & Stocked <digest@sortandplace.com>';

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildHtml(opts: {
  propertyName: string;
  weekStart: string;
  weekEnd: string;
  meals: { plan_date: string; course: string; name: string; name_es: string | null }[];
  lowStock: { name: string; current_qty: number; min_qty: number }[];
  openTasks: { title: string; priority: string | null }[];
}) {
  const mealsByDate: Record<string, typeof opts.meals> = {};
  for (const m of opts.meals) (mealsByDate[m.plan_date] ??= []).push(m);

  const mealsHtml = Object.entries(mealsByDate)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(
      ([date, entries]) => `
        <tr>
          <td style="padding:8px 0;font-weight:600;color:#2B2B2B;">${date}</td>
          <td style="padding:8px 0;color:#2B2B2B;">
            ${entries
              .map((e) => `${escapeHtml(e.name)}${e.name_es ? ` / <em>${escapeHtml(e.name_es)}</em>` : ''}`)
              .join('<br/>')}
          </td>
        </tr>`
    )
    .join('');

  const lowStockHtml =
    opts.lowStock.length === 0
      ? `<p style="color:#2B2B2B99;">Nothing low this week. / Nada bajo esta semana.</p>`
      : `<ul style="padding-left:18px;color:#2B2B2B;">${opts.lowStock
          .map((i) => `<li>${escapeHtml(i.name)} — ${i.current_qty}/${i.min_qty}</li>`)
          .join('')}</ul>`;

  const tasksHtml =
    opts.openTasks.length === 0
      ? `<p style="color:#2B2B2B99;">No open tasks. / Sin tareas pendientes.</p>`
      : `<ul style="padding-left:18px;color:#2B2B2B;">${opts.openTasks
          .map((t) => `<li>${escapeHtml(t.title)}${t.priority ? ` (${escapeHtml(t.priority)})` : ''}</li>`)
          .join('')}</ul>`;

  return `
  <div style="font-family:Georgia,serif;background:#FAF7F2;padding:24px;max-width:600px;margin:0 auto;">
    <h1 style="color:#2B2B2B;font-size:22px;">Sorted &amp; Stocked — Weekly Digest</h1>
    <p style="color:#2B2B2B99;font-size:13px;">
      ${escapeHtml(opts.propertyName)} · ${opts.weekStart} – ${opts.weekEnd}
    </p>

    <h2 style="color:#8A6E42;font-size:16px;margin-top:24px;">This Week's Meals / Comidas de esta semana</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">${mealsHtml || '<tr><td style="color:#2B2B2B99;">No meals planned yet. / Sin comidas planificadas.</td></tr>'}</table>

    <h2 style="color:#8A6E42;font-size:16px;margin-top:24px;">Running Low / Nivel bajo</h2>
    ${lowStockHtml}

    <h2 style="color:#8A6E42;font-size:16px;margin-top:24px;">Open Tasks / Tareas pendientes</h2>
    ${tasksHtml}
  </div>`;
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const body = await req.json().catch(() => ({}));
    const propertyId = body.propertyId as string | undefined;
    if (!propertyId) {
      return new Response(JSON.stringify({ error: 'propertyId required in request body' }), { status: 400 });
    }

    const { data: property } = await supabase.from('properties').select('name').eq('id', propertyId).single();
    if (!property) {
      return new Response(JSON.stringify({ error: 'property not found' }), { status: 404 });
    }

    const today = new Date();
    const weekStart = fmtDate(today);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 6);
    const weekEnd = fmtDate(endDate);

    const { data: mealRows } = await supabase
      .from('meal_plan_entries')
      .select('plan_date, course, recipes(name, name_es)')
      .eq('property_id', propertyId)
      .gte('plan_date', weekStart)
      .lte('plan_date', weekEnd)
      .not('recipe_id', 'is', null);

    const meals = (mealRows ?? [])
      .filter((r: any) => r.recipes)
      .map((r: any) => ({
        plan_date: r.plan_date,
        course: r.course,
        name: r.recipes.name,
        name_es: r.recipes.name_es,
      }));

    const { data: lowStockRows } = await supabase
      .from('inventory_items')
      .select('name, current_qty, min_qty')
      .eq('property_id', propertyId);
    // filter() in JS, not a query filter -- current_qty/min_qty comparisons
    // between two columns aren't expressible as a simple Supabase filter.
    // Strictly "<", matching InventoryClient.tsx's real low-stock badge --
    // this property's data has every item at current_qty = min_qty = 0
    // right now, so "<=" would flag all 697 items as a false positive
    // (confirmed live, caught in an earlier pass of this same session).
    const lowStock = (lowStockRows ?? []).filter((i) => i.current_qty < i.min_qty);

    const { data: taskRows } = await supabase
      .from('staff_tasks')
      .select('title, priority')
      .eq('property_id', propertyId)
      .eq('status', 'open');

    const { data: owners } = await supabase
      .from('property_members')
      .select('user_id')
      .eq('property_id', propertyId)
      .eq('role', 'owner');

    const ownerEmails: string[] = [];
    for (const o of owners ?? []) {
      const { data: authUser } = await supabase.auth.admin.getUserById(o.user_id);
      if (authUser?.user?.email) ownerEmails.push(authUser.user.email);
    }

    const html = buildHtml({
      propertyName: property.name,
      weekStart,
      weekEnd,
      meals,
      lowStock,
      openTasks: taskRows ?? [],
    });

    if (!resendApiKey) {
      // Built and testable end-to-end except the actual send -- report
      // what WOULD have been sent rather than silently no-op-ing.
      return new Response(
        JSON.stringify({
          status: 'RESEND_API_KEY not configured -- email not sent',
          wouldSendTo: ownerEmails,
          mealsCount: meals.length,
          lowStockCount: lowStock.length,
          openTasksCount: (taskRows ?? []).length,
          htmlPreview: html,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (ownerEmails.length === 0) {
      return new Response(JSON.stringify({ status: 'no owner email found, nothing sent' }), { status: 200 });
    }

    const sendResults = [];
    for (const email of ownerEmails) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: email,
          subject: `Weekly Digest — ${property.name} (${weekStart} to ${weekEnd})`,
          html,
        }),
      });
      sendResults.push({ email, ok: res.ok, status: res.status });
    }

    return new Response(
      JSON.stringify({ status: 'sent', sendResults, mealsCount: meals.length, lowStockCount: lowStock.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
    });
  }
});
