// app/properties/[id]/console/page.tsx
// SS-436, Racquel's architectural ruling: "team/ settings/ tasks ... all
// should work off 1 page and only on lax". Team, Settings and the Task
// Center stop being three destinations and become ONE operator console,
// existing only where feature_flags.operator_console is true (Lax today).
// The three are one workflow -- Settings defines the slots, Team puts
// people in them, Tasks assigns work to them -- and splitting them is why
// 16 slots sat empty while 900+ tasks sat unassigned.
//
// V1 composes the three existing, individually-verified surfaces under
// Concept B section strips: PEOPLE (staff slots + who is in each; the
// invite-by-email flow itself still lives on /staff and is linked, not
// duplicated -- folding it in is the SS-425 half still to come),
// CONFIGURATION (the Settings sections), WORK (the cross-house Task Center
// ruled in SS-410 -- every task across every house, filtered by house).
// Server-side gate, not a hidden nav tile (SS-381).
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DutyRosterClient from '@/components/DutyRosterClient';
import SettingsClient from '@/components/SettingsClient';
import StaffSlotsEditor from '@/components/StaffSlotsEditor';
import ModuleFlagsEditor from '@/components/ModuleFlagsEditor';
import ConsoleInviteCard from '@/components/ConsoleInviteCard';
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

  const { data: slots } = await supabase
    .from('staff_slots')
    .select('id, slot_number, label_en, label_es, active, user_id')
    .eq('property_id', id)
    .order('sort_order');

  // Members per residence (SS-436 PM ruling: "Team page NOT needed --
  // fold members per residence into console"). Read-only roster here;
  // role changes/offboarding stay on /staff, which remains reachable for
  // client houses.
  const { data: memberRows } = await supabase
    .from('property_members')
    .select('property_id, role, profiles(full_name)')
    .in('property_id', properties.map((p) => p.id));
  const membersByProperty = properties.map((p) => ({
    ...p,
    members: (memberRows ?? [])
      .filter((m) => m.property_id === p.id)
      .map((m) => ({
        name: ((m.profiles as unknown as { full_name: string | null } | null)?.full_name ?? 'Unnamed') as string,
        role: m.role as string,
      }))
      .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name)),
  }));

  return (
    <div className="bg-linen min-h-screen">
      <div className="max-w-[1240px] mx-auto px-4 py-6 space-y-8">
        {/* SS-436 PM ruling 1: the operator console carries NO Spanish --
            an explicit carve-out from R19 for this owner-only surface. The
            bilingual labels V1 shipped with are gone on that ruling. */}
        <div>
          <h1 className="font-display text-[34px] font-normal text-denim">Operator Console</h1>
          <p className="text-[13px] text-dusk">People, configuration and work. One page.</p>
        </div>

        {/* PEOPLE -- slots, who is in each, the whole team per residence
            (Team-page fold, PM ruling 3), and the invite form itself
            (SS-425 fold-in; no more link out to /staff). */}
        <section className="rounded-xl3 border border-cardBorder shadow-card overflow-hidden bg-card">
          <SectionStrip label="People" />
          <div className="p-5 space-y-5">
            <StaffSlotsEditor propertyId={id} initialSlots={slots ?? []} />

            <div>
              <p className="text-sm font-medium text-denim mb-2">Members per residence</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {membersByProperty.map((p) => (
                  <div key={p.id} className="border border-cardBorder rounded-xl2 bg-card px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brass mb-1.5">{p.label}</p>
                    {p.members.length === 0 ? (
                      <p className="text-xs text-dusk">No members yet.</p>
                    ) : (
                      <ul className="space-y-0.5">
                        {p.members.map((m, i) => (
                          <li key={`${m.name}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-denim min-w-0 truncate">{m.name}</span>
                            <span className="text-xs text-dusk shrink-0">{m.role}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-dusk mt-1.5">
                Role changes and offboarding stay on the{' '}
                <Link href={`/properties/${id}/staff`} className="text-denim underline underline-offset-2">
                  Team page
                </Link>
                .
              </p>
            </div>

            <ConsoleInviteCard properties={properties} defaultPropertyId={id} />
          </div>
        </section>

        {/* CONFIGURATION -- the per-house module switches (their first and
            only UI, SS-429's largest recorded gap) above the Settings
            sections, unchanged, composed. */}
        <section className="rounded-xl3 border border-cardBorder shadow-card overflow-hidden bg-card">
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
            />
          </div>
        </section>

        {/* WORK -- the cross-house Task Center (SS-410 ruling): every task
            across every house the operator manages, filtered by house. */}
        <section className="rounded-xl3 border border-cardBorder shadow-card overflow-hidden bg-card">
          <SectionStrip label="Work" />
          <div className="p-5">
            <DutyRosterClient propertyId={id} properties={properties} />
          </div>
        </section>
      </div>
    </div>
  );
}
