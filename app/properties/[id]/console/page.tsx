// app/properties/[id]/console/page.tsx
// SS-436, Racquel's architectural ruling: "team/ settings/ tasks ... all
// should work off 1 page and only on lax". Team, Settings and the Task
// Center stop being three destinations and become ONE operator console,
// existing only where feature_flags.operator_console is true (Lax today).
//
// REOPENED 2 Aug (on-device inspection; her defects are the spec):
// 1. Names: "Unnamed" is banned -- display falls back to email (profiles.
//    email, synced by migration 174; admin lookup no longer needed here).
// 2. Slots render as compact fixed-size tiles (StaffSlotsEditor rework).
// 3. SCOPING: this is a single-house console. Cross-house content (members
//    per residence) moved OUT of the mid-page PEOPLE flow into its own
//    clearly-labeled fold at the END, collapsed by default.
// 4. ORDERING: the Task Center is the console's reason to exist -- WORK is
//    the FIRST section. Implemented order (for her approval): WORK ->
//    PEOPLE -> CONFIGURATION -> ACROSS THE HOUSES (fold). House lists
//    inside stay alphabetical (SS-459 rule 2).
// 5. Per-house tiles say the house -- short property name ("Low", "Main"),
//    never a concatenated label.
// 6. Members grouped by role; duplicate-looking rows (Racquel's two owner
//    accounts share a full_name) are disambiguated by the email line under
//    each name, so nothing looks like an unexplained duplicate.
// Re-close rule: this row returns to resolved ONLY on her screenshot
// approval (SS-444 governance) -- code here is "built", never "resolved".
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DutyRosterClient from '@/components/DutyRosterClient';
import SettingsClient from '@/components/SettingsClient';
import StaffHouseSlotsPanel from '@/components/StaffHouseSlotsPanel';
import CollapsibleCard from '@/components/CollapsibleCard';
import ModuleFlagsEditor from '@/components/ModuleFlagsEditor';
import ConsoleInviteCard from '@/components/ConsoleInviteCard';
import ConsoleTestFlightCard from '@/components/ConsoleTestFlightCard';
import ConsoleAlertReplies from '@/components/ConsoleAlertReplies';
import ConsoleLeadsCard from '@/components/ConsoleLeadsCard';
import { isOperatorConsole } from '@/lib/module-flags';
import { getOperatorProperties } from '@/lib/operator-properties';

export const metadata = {
  title: 'Operator Console — Sorted & Stocked',
};

function SectionStrip({ label }: { label: string }) {
  return (
    <div className="bg-denim text-white text-[10px] font-semibold tracking-[0.17em] uppercase py-[11px] px-5 rounded-t-xl3">
      {label}
    </div>
  );
}

// SS-567. The console sections are anchor targets now, so the index below the
// title can jump to them and so search can deep-link "task center" straight
// here. scroll-mt clears the sticky app header plus the nav bar under it;
// without it the anchor lands with the heading hidden behind the chrome,
// which reads as the jump not having worked.
const SECTIONS = [
  { id: 'task-center', label: 'Work' },
  { id: 'people', label: 'People' },
  { id: 'configuration', label: 'Configuration' },
] as const;

function SectionIndex() {
  return (
    <nav aria-label="Console sections" className="flex flex-wrap items-center gap-2">
      {SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="text-[12px] font-medium text-denim border border-cardBorder bg-card px-3.5 py-1.5 rounded-full hover:border-brass/50 transition-colors"
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

const ROLE_ORDER = ['owner', 'manager', 'staff'] as const;

export default async function OperatorConsolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('property_members')
    .select('role, properties(feature_flags)')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }
  const flags = (membership.properties as unknown as { feature_flags: Record<string, unknown> | null } | null)
    ?.feature_flags;
  if (!isOperatorConsole(flags)) {
    redirect(`/properties/${id}/dashboard`);
  }

  const properties = await getOperatorProperties(supabase, user.id);

  const { data: profile } = await supabase
    .from('profiles')
    .select('phone_number, sms_opt_in')
    .eq('id', user.id)
    .maybeSingle();

  // SS-824: every operator house's slots, not just this one -- Staff Slots
  // becomes a tile-per-house picker (like the sign-in property picker)
  // instead of only ever showing whichever house the console happens to be
  // viewing.
  const { data: slots } = await supabase
    .from('staff_slots')
    .select('id, property_id, slot_number, label_en, label_es, active, user_id')
    .in('property_id', properties.map((p) => p.id))
    .order('sort_order');

  // Short house names for the cross-house fold (defect 5: tiles say "Low",
  // "Main" -- the household-prefixed labels stay on surfaces that need
  // them, not here). Reused for the new Staff Slots house tiles, same rule.
  const { data: propNames } = await supabase
    .from('properties')
    .select('id, name')
    .in('id', properties.map((p) => p.id));
  const shortName = new Map((propNames ?? []).map((p) => [p.id as string, p.name as string]));

  // Members per residence -- cross-house content, so it lives in the fold
  // at the END (defect 3). profiles.email (migration 174) makes the
  // email fallback a plain join; "Unnamed" is banned (defect 1). Also the
  // SS-243 picker's candidate list and the SS-824 contact-info source
  // (phone_number added here rather than a second query per house).
  const { data: memberRows } = await supabase
    .from('property_members')
    .select('property_id, user_id, role, profiles(full_name, email, phone_number)')
    .in('property_id', properties.map((p) => p.id))
    // SS-627: RLS grants a manager read access to every row on a property
    // they belong to, active or not -- an offboarded person would still
    // show up here (and in the SS-243 slot picker) without this filter.
    .eq('active', true);

  type MemberEntry = { name: string; email: string | null; role: string };
  const membersByProperty = [...properties]
    .sort((a, b) => (shortName.get(a.id) ?? '').localeCompare(shortName.get(b.id) ?? ''))
    .map((p) => {
      const members: MemberEntry[] = (memberRows ?? [])
        .filter((m) => m.property_id === p.id)
        .map((m) => {
          const prof = m.profiles as unknown as { full_name: string | null; email: string | null } | null;
          return {
            name: (prof?.full_name?.trim() || prof?.email || '(no account details)') as string,
            email: prof?.email ?? null,
            role: m.role as string,
          };
        });
      const byRole = ROLE_ORDER.map((role) => ({
        role,
        members: members
          .filter((m) => m.role === role)
          .sort((a, b) => a.name.localeCompare(b.name) || (a.email ?? '').localeCompare(b.email ?? '')),
      })).filter((g) => g.members.length > 0);
      // Same display name appearing twice in one house (Racquel's personal
      // + business logins) -> show the email line on both so neither reads
      // as an unexplained duplicate (defect 6).
      const nameCounts = new Map<string, number>();
      for (const m of members) nameCounts.set(m.name, (nameCounts.get(m.name) ?? 0) + 1);
      return { id: p.id, name: shortName.get(p.id) ?? '', byRole, nameCounts };
    });

  // Names for the slot tiles (defect 2: a linked slot shows the person,
  // from their own account -- never a seeded name).
  const slotUserIds = (slots ?? []).map((s) => s.user_id).filter((v): v is string => !!v);
  const assignedNames: Record<string, string> = {};
  const contactByUserId: Record<string, { phone: string | null; email: string | null }> = {};
  if (slotUserIds.length > 0) {
    const { data: slotProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone_number')
      .in('id', slotUserIds);
    for (const p of slotProfiles ?? []) {
      assignedNames[p.id] = (p.full_name?.trim() || p.email || '') as string;
      contactByUserId[p.id] = { phone: p.phone_number ?? null, email: p.email ?? null };
    }
  }

  // SS-824 Manager at a Glance: this-week worked minutes per (house,
  // linked person) -- same Monday-start-week, closed-shifts-only rule as
  // ClockInOutButton/ShiftHoursClient, so this can never disagree with
  // what the person themselves sees on My Day. Only queried for the
  // people actually linked into a slot right now; renders an honest empty
  // state for everyone else rather than a query nobody needed.
  const weekMinutesByProperty = new Map<string, Record<string, number>>();
  if (slotUserIds.length > 0) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);
    const { data: shiftRows } = await supabase
      .from('shifts')
      .select('property_id, user_id, clocked_in_at, clocked_out_at')
      .in('property_id', properties.map((p) => p.id))
      .in('user_id', slotUserIds)
      .gte('clocked_in_at', weekStart.toISOString())
      .not('clocked_out_at', 'is', null);
    for (const s of shiftRows ?? []) {
      const mins = Math.max(
        0,
        (new Date(s.clocked_out_at as string).getTime() - new Date(s.clocked_in_at as string).getTime()) / 60000
      );
      const forProperty = weekMinutesByProperty.get(s.property_id as string) ?? {};
      forProperty[s.user_id as string] = Math.round((forProperty[s.user_id as string] ?? 0) + mins);
      weekMinutesByProperty.set(s.property_id as string, forProperty);
    }
  }

  // SS-243's picker candidate list, per house -- reuses memberRows rather
  // than a second query.
  const membersForPicker = (propertyId: string) =>
    (memberRows ?? [])
      .filter((m) => m.property_id === propertyId)
      .map((m) => {
        const prof = m.profiles as unknown as { full_name: string | null; email: string | null } | null;
        return {
          user_id: m.user_id as string,
          name: (prof?.full_name?.trim() || prof?.email || '(no account details)') as string,
          role: m.role as string,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

  // SS-824's house-tile grid data -- alphabetical, same order as the
  // cross-house fold below it.
  const houseSlots = [...properties]
    .sort((a, b) => (shortName.get(a.id) ?? '').localeCompare(shortName.get(b.id) ?? ''))
    .map((p) => ({
      id: p.id,
      name: shortName.get(p.id) ?? '',
      slots: (slots ?? []).filter((s) => s.property_id === p.id),
      members: membersForPicker(p.id),
      assignedNames,
      weekMinutesByUser: weekMinutesByProperty.get(p.id) ?? {},
      contactByUserId,
    }));

  return (
    <div className="bg-linen min-h-screen">
      <div className="max-w-[1240px] mx-auto px-4 py-6 space-y-8">
        {/* SS-436 PM ruling 1: the operator console carries NO Spanish --
            an explicit carve-out from R19 for this owner-only surface. The
            bilingual labels V1 shipped with are gone on that ruling. */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-[34px] font-normal text-denim">Operator Console</h1>
            <p className="text-[13px] text-dusk">Work, people and configuration. One page.</p>
            <div className="mt-3">
              <SectionIndex />
            </div>
          </div>
          {/* Prominent register link (2 Aug spec) -- owner-only, matching
              the route's own gate; the Staff-sheet entry is the primary
              door, this is the console-side one. */}
          {membership.role === 'owner' && (
            <div className="flex items-center gap-2">
              {/* SS-430: the R18 clip queue -- owner-only like the route. */}
              <Link
                href={`/properties/${id}/staff/clip-review`}
                className="text-sm font-medium text-denim border border-brass/30 bg-mist px-5 py-2.5 rounded-full hover:bg-card transition-colors"
              >
                Clip Review
              </Link>
              <Link
                href={`/properties/${id}/register`}
                className="text-sm font-medium text-white bg-denim px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity"
              >
                Register →
              </Link>
            </div>
          )}
        </div>

        {/* WORK FIRST (reopen defect 4) -- the cross-house Task Center
            (SS-410 ruling) is the console's reason to exist.

            SS-567: the heading reads TASK CENTER, not "Work". Racquel typed
            those exact words looking for this and found nothing, so the
            section now carries the name she searched for. This is NOT the
            nav entry coming back -- SS-410 and SS-436 folded that
            deliberately and it stays folded. The page was always right; it
            was unfindable, which is a different bug with a different fix. */}
        <section
          id="task-center"
          className="scroll-mt-[124px] rounded-xl3 border border-cardBorder shadow-card overflow-hidden bg-card"
        >
          <SectionStrip label="Work" />
          <div className="p-5">
            <DutyRosterClient propertyId={id} properties={properties} />
          </div>
        </section>

        {/* PEOPLE -- every house's slots (SS-824 tile picker), plus the
            invite/TestFlight/replies flows. Cross-house membership content
            moved to the end fold. */}
        <section id="people" className="scroll-mt-[124px] rounded-xl3 border border-cardBorder shadow-card overflow-hidden bg-card">
          <SectionStrip label="People" />
          <div className="p-5 space-y-5">
            <StaffHouseSlotsPanel houses={houseSlots} defaultHouseId={id} />

            {/* SS-436 both-yes ruling (2 Aug): invite-by-email and the
                TestFlight invite side by side, alert replies below. SS-824:
                both are now collapsible blue tiles (SS-823 surface) instead
                of permanently-expanded cards that made the page never end. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CollapsibleCard
                cardId="console-invite-email"
                pinSize="sm"
                className="relative bg-mist rounded-xl2 border border-cardBorder p-4"
                header={<p className="text-sm font-medium text-denim pr-5">Invite by email</p>}
              >
                <div className="pt-3">
                  <ConsoleInviteCard properties={properties} defaultPropertyId={id} />
                </div>
              </CollapsibleCard>
              <CollapsibleCard
                cardId="console-invite-testflight"
                pinSize="sm"
                className="relative bg-mist rounded-xl2 border border-cardBorder p-4"
                header={<p className="text-sm font-medium text-denim pr-5">iPhone app invite</p>}
              >
                <div className="pt-3">
                  <ConsoleTestFlightCard />
                </div>
              </CollapsibleCard>
            </div>
            <ConsoleAlertReplies propertyIds={properties.map((p) => p.id)} />

            {/* Leads backup (2 Aug ruling): OWNER-only, default collapsed,
                unread badge -- out of her way until she wants it. */}
            {membership.role === 'owner' && <ConsoleLeadsCard />}
          </div>
        </section>

        {/* CONFIGURATION -- the per-house module switches above the
            Settings sections, unchanged, composed. */}
        <section id="configuration" className="scroll-mt-[124px] rounded-xl3 border border-cardBorder shadow-card overflow-hidden bg-card">
          <SectionStrip label="Configuration" />
          <div className="p-5 border-b border-cardBorder">
            <ModuleFlagsEditor properties={properties} />
          </div>
          <div className="py-2">
            <SettingsClient
              propertyId={id}
              role={membership.role}
              initialPhoneNumber={profile?.phone_number ?? ''}
              initialSmsOptIn={profile?.sms_opt_in ?? false}
              readAt={new Date().toISOString()}
            />
          </div>
        </section>

        {/* ACROSS THE HOUSES -- the one cross-house block, clearly labeled,
            LAST, collapsed by default (reopen defect 3). Tiles carry the
            short house name only (defect 5); members grouped by role with
            email disambiguation for same-name accounts (defects 1 + 6). */}
        <details className="rounded-xl3 border border-cardBorder shadow-card overflow-hidden bg-card">
          <summary className="cursor-pointer list-none">
            <SectionStrip label="Across the Houses — cross-house view" />
          </summary>
          <div className="p-5">
            <p className="text-sm font-medium text-denim mb-2">Members per residence</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {membersByProperty.map((p) => (
                <div key={p.id} className="border border-cardBorder rounded-xl2 bg-card px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brass mb-1.5">{p.name}</p>
                  {p.byRole.length === 0 ? (
                    <p className="text-xs text-dusk">No members yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {p.byRole.map((g) => (
                        <div key={g.role}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dusk">
                            {g.role === 'owner' ? 'Owners' : g.role === 'manager' ? 'Managers' : 'Staff'}
                          </p>
                          <ul className="space-y-0.5 mt-0.5">
                            {g.members.map((m, i) => (
                              <li key={`${m.email ?? m.name}-${i}`} className="text-sm">
                                <span className="text-denim">{m.name}</span>
                                {m.email && ((p.nameCounts.get(m.name) ?? 0) > 1 || m.name === m.email) && (
                                  <span className="block text-[11px] text-dusk">{m.email}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-dusk mt-1.5">
              Role changes, offboarding and member names live on the{' '}
              <Link href={`/properties/${id}/staff`} className="text-denim underline underline-offset-2">
                Team page
              </Link>
              .
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
