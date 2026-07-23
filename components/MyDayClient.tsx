// components/MyDayClient.tsx
// Staff's dedicated landing page — built around what staff are actually
// permitted to do (view inventory/recipes/meal plans/shopping lists,
// update quantities, check off shopping list items, update their own task
// status). Owner/manager keep landing on the existing property-picker flow
// unchanged; only staff get routed here (see app/properties/page.tsx and
// app/dashboard/page.tsx).
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import ShiftHandoverClient, { CardHeader } from '@/components/ShiftHandoverClient';
import CollapsibleCard from '@/components/CollapsibleCard';
import StaffDutyChecklist from '@/components/StaffDutyChecklist';
import StaffTasksClient from '@/components/StaffTasksClient';
import ToolModal from '@/components/ToolModal';
import KitchenOpsToolModal from '@/components/KitchenOpsToolModal';
import { Camera, ShoppingCart, Timer, Info } from 'lucide-react';
import Pin from '@/components/PinAccent';

type DutyTask = { id: string; taskEn: string; taskEs: string; completed: boolean };
type DutyArea = { areaEn: string; areaEs: string; tasks: DutyTask[] };

export default function MyDayClient({
  propertyId,
  staffNote,
  isStaff,
  hasRosterKey,
  dutyAreas,
  todayStr,
}: {
  propertyId: string;
  staffNote: string | null;
  isStaff: boolean;
  hasRosterKey: boolean;
  dutyAreas: DutyArea[];
  todayStr: string;
}) {
  const t = useTranslations('myDay');
  const [showCapture, setShowCapture] = useState(false);
  const [showKitchenTimer, setShowKitchenTimer] = useState(false);

  return (
    <div className="bg-mist min-h-screen p-4 lg:p-6">
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-display text-denim mb-1">My Day</h1>
      <p className="text-sm text-dusk mb-4">
        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>

      {/* Calendar-driven staff notice -- plain, high-contrast, instructional
          copy for people who may not know the Jewish calendar at all, not a
          reflection/spiritual note (that's the separate Dashboard tip).
          Only rendered when calendar_content actually has a staff_note for
          today's resolved trigger_type (server-computed, general/omer
          always excluded) -- absent entirely otherwise, no empty-state box. */}
      {staffNote && (
        <div className="bg-denim text-white rounded-xl2 p-4 mb-5 flex gap-3 items-start">
          <Info size={18} className="text-brass shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brass mb-1">{t('staffNoteHeading')}</p>
            <p className="text-sm leading-relaxed">{staffNote}</p>
          </div>
        </div>
      )}

      {/* Today's Tasks, Capture, Shopping List, Kitchen Timer -- the whole
          staff home view. Capture and Kitchen Timer open as modals right
          here (same ToolModal every other simple tool uses) rather than
          navigating away, since both are quick, in-and-out actions.
          SS-179 tile formula (2026-07-20): was a plain flex row of compact
          icon+label buttons -- brought in line with the dashboard's own
          tile row (brass eyebrow, centered icon, display title, one-line
          subtitle, mist fill) rather than a one-off smaller pattern just
          for this page. */}
      <div className="grid grid-cols-3 gap-[14px] mb-6">
        <button
          onClick={() => setShowCapture(true)}
          className="relative flex flex-col items-center justify-center gap-[6px] rounded-xl2 bg-mist border border-brass/30 py-[14px] px-2 shadow-card hover:shadow-cardHover transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-denim"
        >
          <Pin size="sm" />
          <span className="text-[9px] tracking-[0.2em] uppercase font-semibold text-brass">{t('captureTile')}</span>
          <Camera size={28} className="text-denim" aria-hidden="true" />
          <span className="font-display font-normal text-sm text-denim text-center">{t('captureTile')}</span>
          <span className="text-[10px] text-dusk text-center">{t('captureSubtitle')}</span>
        </button>
        <Link
          href={`/properties/${propertyId}/shopping-list`}
          className="relative flex flex-col items-center justify-center gap-[6px] rounded-xl2 bg-mist border border-brass/30 py-[14px] px-2 shadow-card hover:shadow-cardHover transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-denim"
        >
          <Pin size="sm" />
          <span className="text-[9px] tracking-[0.2em] uppercase font-semibold text-brass">{t('shoppingTile')}</span>
          <ShoppingCart size={28} className="text-denim" aria-hidden="true" />
          <span className="font-display font-normal text-sm text-denim text-center">{t('shoppingTile')}</span>
          <span className="text-[10px] text-dusk text-center">{t('shoppingSubtitle')}</span>
        </Link>
        <button
          onClick={() => setShowKitchenTimer(true)}
          className="relative flex flex-col items-center justify-center gap-[6px] rounded-xl2 bg-mist border border-brass/30 py-[14px] px-2 shadow-card hover:shadow-cardHover transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-denim"
        >
          <Pin size="sm" />
          <span className="text-[9px] tracking-[0.2em] uppercase font-semibold text-brass">{t('timerTile')}</span>
          <Timer size={28} className="text-denim" aria-hidden="true" />
          <span className="font-display font-normal text-sm text-denim text-center">{t('timerTile')}</span>
          <span className="text-[10px] text-dusk text-center">{t('timerSubtitle')}</span>
        </button>
      </div>

      {showCapture && (
        <ToolModal slug="capture-photo" propertyId={propertyId} onClose={() => setShowCapture(false)} />
      )}
      {showKitchenTimer && (
        <KitchenOpsToolModal slug="kitchen-timer" propertyId={propertyId} onClose={() => setShowKitchenTimer(false)} />
      )}

      {/* Bento layout, same split Staff's own page uses for this identical
          ShiftHandoverClient instance (StaffClient.tsx): left column is
          today's actual work, right column is Handover. Stacks to one
          column below lg -- no room for a real 2-up grid on a phone
          screen, and the original single-column reading order (duty
          checklist, tasks, handover) is still correct there. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Recurring daily duty checklist (staff_duty_templates, grouped
              by area) -- distinct from the one-off assigned Today's Tasks
              list below it. Staff-only: owner/manager visiting this page
              directly see everything else here unchanged, just not this
              section. */}
          {isStaff && <StaffDutyChecklist areas={dutyAreas} hasRosterKey={hasRosterKey} todayStr={todayStr} />}

          {/* Real task library (master_tasks/task_assignments/
              task_completions), not the old freeform staff_tasks table --
              scope="mine" filters to what's assigned to the viewer and
              actually due, reusing the same data layer and mark-done flow
              as the manager-facing Task Center instead of a second,
              separately-maintained implementation. */}
          <CollapsibleCard
            cardId="myday-todays-tasks"
            pinSize="sm"
            className="relative bg-card rounded-xl3 border border-cardBorder shadow-card overflow-hidden"
            header={<CardHeader>Today's Tasks</CardHeader>}
          >
            <div className="p-4">
              <StaffTasksClient propertyId={propertyId} scope="mine" />
            </div>
          </CollapsibleCard>
        </div>

        <div>
          <ShiftHandoverClient propertyId={propertyId} layout="split" />
        </div>
      </div>
    </div>
    </div>
  );
}
