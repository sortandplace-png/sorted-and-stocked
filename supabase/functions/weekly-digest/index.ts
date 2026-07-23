// supabase/functions/weekly-digest/index.ts
// "The Sunday Sort" -- weekly summary email, approved mockup faithfully
// adapted to real email-safe HTML: the mockup's flexbox/CSS-custom-property
// layout doesn't render reliably in Gmail/Outlook, so this uses inline
// styles and table-based rows for the parts that need them, same
// constraint the previous version of this function already worked under.
// Sent to each property's owner(s) AND manager(s) via Resend. Manually
// invocable; the recurring schedule is a separate migration and stays off
// by default -- same standing hold Racquel already gave this feature
// ("stay off until baseline usage stabilizes"), not silently overridden here.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_FROM = 'Sorted & Stocked <digest@sortandplace.com>';
const INK = '#171512';
const PAPER = '#FAF7F2';
const STONE = '#F1ECE2';
const LINE = '#DED5C4';
const GOLD = '#C5A46D';
const MUTED = '#8C8373';

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmtShort(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

type DigestData = {
  propertyName: string;
  weekStart: string;
  weekEnd: string;
  meals: { plan_date: string; name: string; name_es: string | null }[];
  lowStock: { name: string; current_qty: number; min_qty: number }[];
  newRecipes: { name: string }[];
  handoverCount: number;
  tasksCompletedCount: number;
};

function buildHtml(d: DigestData) {
  const mealsByDate: Record<string, typeof d.meals> = {};
  for (const m of d.meals) (mealsByDate[m.plan_date] ??= []).push(m);
  const mealDays = Object.entries(mealsByDate).sort(([a], [b]) => (a < b ? -1 : 1));

  const mealRows = mealDays.length
    ? mealDays
        .map(([date, entries]) => {
          const day = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
          const names = entries.map((e) => escapeHtml(e.name)).join(', ');
          return `<tr><td style="padding:9px 0;border-top:1px solid ${STONE};font-size:12.5px;font-weight:800;color:${MUTED};text-transform:uppercase;letter-spacing:0.04em;width:60px;">${day}</td><td style="padding:9px 0;border-top:1px solid ${STONE};font-size:16px;font-family:Georgia,serif;color:${INK};text-align:right;">${names}</td></tr>`;
        })
        .join('')
    : `<tr><td colspan="2" style="padding:12px 0;color:${MUTED};font-size:13px;">Nothing planned yet this week.</td></tr>`;

  const stockRows = d.lowStock.length
    ? d.lowStock
        .map(
          (i) =>
            `<tr><td style="padding:8px 0;border-top:1px solid ${STONE};font-size:13.5px;font-weight:700;color:${INK};">${escapeHtml(i.name)}</td><td style="padding:8px 0;border-top:1px solid ${STONE};font-size:11.5px;color:${MUTED};font-weight:700;text-align:right;">${i.current_qty} left</td></tr>`
        )
        .join('')
    : `<tr><td style="padding:8px 0;color:${MUTED};font-size:13px;">Nothing running low this week.</td></tr>`;

  const newThisWeekBlock =
    d.newRecipes.length > 0
      ? `<tr><td style="padding-top:22px;">
          <p style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;font-weight:800;color:${INK};border-bottom:1px solid ${LINE};padding-bottom:10px;margin:0 0 16px;">New This Week</p>
          <p style="background:${STONE};border-left:3px solid ${GOLD};border-radius:4px;padding:14px 16px;font-size:13px;line-height:1.5;color:${INK};margin:0;">
            <b>${d.newRecipes.length} new recipe${d.newRecipes.length === 1 ? '' : 's'}</b> ${d.newRecipes.length === 1 ? 'was' : 'were'} added to your rotation this week: ${d.newRecipes.map((r) => escapeHtml(r.name)).join(', ')}.
          </p>
        </td></tr>`
      : '';

  const activityParts: string[] = [];
  if (d.handoverCount > 0) activityParts.push(`${d.handoverCount} shift handover note${d.handoverCount === 1 ? '' : 's'} logged`);
  if (d.tasksCompletedCount > 0) activityParts.push(`${d.tasksCompletedCount} task${d.tasksCompletedCount === 1 ? '' : 's'} completed`);
  const activityLine = activityParts.length > 0 ? activityParts.join(' · ') + ' this week.' : 'No staff activity logged this week.';

  return `
  <div style="background:#DDD6C8;padding:28px 0;font-family:Georgia,serif;">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:${PAPER};border-collapse:collapse;">
    <tr><td style="background:${INK};padding:34px 30px 28px;text-align:center;">
      <table role="presentation" align="center" style="margin:0 auto 14px;"><tr><td style="width:48px;height:48px;border-radius:11px;background:${GOLD};text-align:center;vertical-align:middle;font-size:20px;">🏠</td></tr></table>
      <p style="font-family:Georgia,serif;font-weight:700;font-size:26px;color:${PAPER};margin:0;">The Sunday Sort</p>
      <p style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${GOLD};font-weight:700;margin:8px 0 0;">${escapeHtml(d.propertyName)} · Week of ${fmtShort(new Date(`${d.weekStart}T00:00:00Z`))}</p>
    </td></tr>

    <tr><td style="padding:26px 30px 6px;font-size:17px;color:${INK};">Good Shabbos — here's where things stand for the week ahead.</td></tr>

    <tr><td style="padding:22px 30px;">
      <table role="presentation" width="100%"><tr>
        <td width="33%" style="background:${STONE};border-radius:6px;padding:14px 8px;text-align:center;"><p style="font-family:Georgia,serif;font-weight:700;font-size:26px;color:${INK};margin:0;">${d.meals.length}</p><p style="font-size:9.5px;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};font-weight:700;margin:6px 0 0;">Meals Planned</p></td>
        <td width="4"></td>
        <td width="33%" style="background:${STONE};border-radius:6px;padding:14px 8px;text-align:center;"><p style="font-family:Georgia,serif;font-weight:700;font-size:26px;color:${INK};margin:0;">${d.lowStock.length}</p><p style="font-size:9.5px;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};font-weight:700;margin:6px 0 0;">Low Stock</p></td>
        <td width="4"></td>
        <td width="33%" style="background:${STONE};border-radius:6px;padding:14px 8px;text-align:center;"><p style="font-family:Georgia,serif;font-weight:700;font-size:26px;color:${INK};margin:0;">${d.handoverCount + d.tasksCompletedCount}</p><p style="font-size:9.5px;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};font-weight:700;margin:6px 0 0;">Staff Notes</p></td>
      </tr></table>
    </td></tr>

    <tr><td style="padding:0 30px 22px;">
      <p style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;font-weight:800;color:${INK};border-bottom:1px solid ${LINE};padding-bottom:10px;margin:0 0 4px;">This Week's Meals</p>
      <table role="presentation" width="100%">${mealRows}</table>
    </td></tr>

    <tr><td style="padding:0 30px 22px;">
      <p style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;font-weight:800;color:${INK};border-bottom:1px solid ${LINE};padding-bottom:10px;margin:0 0 4px;">Needs Restocking</p>
      <table role="presentation" width="100%">${stockRows}</table>
    </td></tr>

    <table role="presentation" width="100%">${newThisWeekBlock}</table>

    <tr><td style="padding:0 30px 30px;">
      <p style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;font-weight:800;color:${INK};border-bottom:1px solid ${LINE};padding-bottom:10px;margin:0 0 12px;">Staff Activity</p>
      <p style="font-size:13.5px;line-height:1.6;color:${INK};margin:0;">${activityLine}</p>
    </td></tr>

    <tr><td style="padding:26px 30px 32px;text-align:center;border-top:1px solid ${LINE};">
      <a href="https://sortandplace.com" style="display:inline-block;background:${INK};color:${PAPER};font-weight:700;font-size:13px;padding:13px 28px;border-radius:5px;text-decoration:none;margin-bottom:16px;">Open Sorted &amp; Stocked</a>
      <p style="font-size:11.5px;color:${MUTED};margin:16px 0 0;">You're receiving this because you manage ${escapeHtml(d.propertyName)} on Sorted &amp; Stocked.</p>
    </td></tr>
  </table>
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
    // Manual test sends shouldn't have to wait for a genuinely quiet week to
    // suppress itself -- lets a real test confirm the template even when
    // the property has zero activity.
    const force = body.force === true;
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
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoIso = sevenDaysAgo.toISOString();

    const { data: mealRows } = await supabase
      .from('meal_plan_entries')
      .select('plan_date, recipes(name, name_es)')
      .eq('property_id', propertyId)
      .gte('plan_date', weekStart)
      .lte('plan_date', weekEnd)
      .not('recipe_id', 'is', null);
    const meals = (mealRows ?? [])
      .filter((r: any) => r.recipes)
      .map((r: any) => ({ plan_date: r.plan_date, name: r.recipes.name, name_es: r.recipes.name_es }));

    const { data: lowStockRows } = await supabase
      .from('inventory_items')
      .select('name, current_qty, min_qty, last_counted_at')
      .eq('property_id', propertyId);
    const lowStock = (lowStockRows ?? []).filter((i) => i.last_counted_at !== null && i.current_qty < i.min_qty);

    const { data: newRecipeRows } = await supabase
      .from('recipes')
      .select('name, created_at, recipe_property_links!inner(property_id)')
      .eq('recipe_property_links.property_id', propertyId)
      .gte('created_at', sevenDaysAgoIso);
    const newRecipes = (newRecipeRows ?? []).map((r: any) => ({ name: r.name }));

    const { count: handoverCount } = await supabase
      .from('shift_handovers')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .gte('created_at', sevenDaysAgoIso);

    const { count: tasksCompletedCount } = await supabase
      .from('staff_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .gte('completed_at', sevenDaysAgoIso);

    // "Zero real activity" per Racquel's own framing (0 meals planned) --
    // a property with nothing on the calendar yet gets skipped rather than
    // a feeling-empty email, everything else (stock/recipes/staff notes)
    // can legitimately be quiet in a normal week without meaning "skip this."
    const hasActivity = meals.length > 0;
    if (!force && !hasActivity) {
      return new Response(
        JSON.stringify({ status: 'skipped -- zero meals planned this week', propertyId, propertyName: property.name }),
        { status: 200 }
      );
    }

    const { data: recipients } = await supabase
      .from('property_members')
      .select('user_id, role')
      .eq('property_id', propertyId)
      .in('role', ['owner', 'manager']);

    const recipientEmails: string[] = [];
    for (const r of recipients ?? []) {
      const { data: authUser } = await supabase.auth.admin.getUserById(r.user_id);
      if (authUser?.user?.email) recipientEmails.push(authUser.user.email);
    }

    const html = buildHtml({
      propertyName: property.name,
      weekStart,
      weekEnd,
      meals,
      lowStock,
      newRecipes,
      handoverCount: handoverCount ?? 0,
      tasksCompletedCount: tasksCompletedCount ?? 0,
    });

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          status: 'RESEND_API_KEY not configured -- email not sent',
          wouldSendTo: recipientEmails,
          mealsCount: meals.length,
          lowStockCount: lowStock.length,
          newRecipesCount: newRecipes.length,
          handoverCount: handoverCount ?? 0,
          tasksCompletedCount: tasksCompletedCount ?? 0,
          htmlPreview: html,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (recipientEmails.length === 0) {
      return new Response(JSON.stringify({ status: 'no owner/manager email found, nothing sent' }), { status: 200 });
    }

    const sendResults = [];
    for (const email of recipientEmails) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: email,
          subject: `The Sunday Sort — ${property.name} (Week of ${fmtShort(new Date(`${weekStart}T00:00:00Z`))})`,
          html,
        }),
      });
      sendResults.push({ email, ok: res.ok, status: res.status });
    }

    return new Response(
      JSON.stringify({
        status: 'sent',
        sendResults,
        mealsCount: meals.length,
        lowStockCount: lowStock.length,
        newRecipesCount: newRecipes.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
    });
  }
});
