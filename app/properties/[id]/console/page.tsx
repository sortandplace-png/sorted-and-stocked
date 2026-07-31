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

  return (
    <div className="bg-linen min-h-screen">
      <div className="max-w-[1240px] mx-auto px-4 py-6 space-y-8">
        <div>
          <h1 className="font-display text-[34px] font-normal text-denim">
            Operator Console <span className="text-dusk text-xl">· Consola del Operador</span>
          </h1>
          <p className="text-[13px] text-dusk">
            People, configuration and work — one page. · Personal, configuración y trabajo — una página.
          </p>
        </div>

        {/* PEOPLE -- the slots, who is in each. Invite-by-email still lives
            on the Staff page and is linked rather than duplicated (SS-425's
            fold-in is the follow-on, not silently absorbed here). */}
        <section className="rounded-xl3 border border-cardBorder shadow-card overflow-hidden bg-card">
          <SectionStrip label="People · Personal" />
          <div className="p-5 space-y-4">
            <StaffSlotsEditor propertyId={id} initialSlots={slots ?? []} />
            <p className="text-[12px] text-dusk">
              <Link
                href={`/properties/${id}/staff`}
                className="text-denim underline underline-offset-2"
              >
                Invite someone by email · Invitar por correo →
              </Link>
            </p>
          </div>
        </section>

        {/* CONFIGURATION -- the Settings sections, unchanged, composed. */}
        <section className="rounded-xl3 border border-cardBorder shadow-card overflow-hidden bg-card">
          <SectionStrip label="Configuration · Configuración" />
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
          <SectionStrip label="Work · Trabajo" />
          <div className="p-5">
            <DutyRosterClient propertyId={id} properties={properties} />
          </div>
        </section>
      </div>
    </div>
  );
}
