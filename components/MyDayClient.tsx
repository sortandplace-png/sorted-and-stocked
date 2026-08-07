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
import ClockInOutButton from '@/components/ClockInOutButton';
import TeamOnShiftBar from '@/components/TeamOnShiftBar';
import KitchenOpsToolModal from '@/components/KitchenOpsToolModal';
import { Camera, ShoppingCart, Timer, Info, PlayCircle, BookOpen, Package } from 'lucide-react';
import Tile from '@/components/ui/Tile';
import ReadTimestamp from '@/components/ui/ReadTimestamp';
import { routes } from '@/lib/app-routes';

type DutyTask = { id: string; taskEn: string; taskEs: string; completed: boolean };
type DutyArea = { areaEn: string; areaEs: string; tasks: DutyTask[] };
type AdHocTask = { id: string; title: string; due_date: string | null; priority: string | null };

export default function MyDayClient({
  propertyId,
  staffNote,
  isStaff,
  hasRosterKey,
  dutyAreas,
  adHocTasks = [],
  todayStr,
  readAt,
  photolessCount = 0,
}: {
  propertyId: string;
  staffNote: string | null;
  isStaff: boolean;
  hasRosterKey: boolean;
  dutyAreas: DutyArea[];
  adHocTasks?: AdHocTask[];
  todayStr: string;
  /** SS-857: server-stamped the same request as dutyAreas/adHocTasks above. */
  readAt: string;
  /** SS-869 part 3: live count feeding the Photo Worklist entry point. Always
   *  0 for staff -- the page itself is manager-gated. */
  photolessCount?: number;
}) {
  const t = useTranslations('myDay');
  const tTraining = useTranslations('training');
  const [showCapture, setShowCapture] = useState(false);
  const [showKitchenTimer, setShowKitchenTimer] = useState(false);

  return (
    <div className="bg-mist min-h-screen p-4 lg:p-6">
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-display text-denim mb-1">My Day</h1>
      <p className="text-sm text-dusk mb-1">
        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>
      <ReadTimestamp readAt={readAt} className="text-[11px] text-dusk mb-1" />

      {/* SS-869 part 3: "this shouldn't be a drop down" -- work someone
          does with a phone in their hand should not be buried two taps
          inside the Staff menu. Hidden at zero, and never shown to staff
          (the worklist page itself is manager-gated; photolessCount is
          always 0 for them, so this reads as "not offered" either way). */}
      {photolessCount > 0 && (
        <Link
          href={`/properties/${propertyId}/tools/photo-worklist`}
          className="flex items-center gap-2.5 bg-mist border border-brass/30 rounded-xl2 px-4 py-2.5 mb-4 text-sm font-medium text-denim hover:border-brass/60 transition-colors"
        >
          <Camera size={16} className="text-brass shrink-0" aria-hidden="true" />
          Photos needed: {photolessCount}
        </Link>
      )}

      {/* SS-285. Top of the page and on its own line, because starting and
          ending a shift is the first and last thing done here and should
          never be hunted for. Renders nothing until it knows the current
          state, so it can't flash the wrong label. */}
      {/* Who else is in the house right now. Sits under the clock control
          because it's the same question in two halves -- am I on, and who
          else is. Renders nothing when nobody is clocked in. */}
      <TeamOnShiftBar propertyId={propertyId} />

      {/* SP_06 is the video about THIS page, so it belongs on this page --
          linked to the Training series rather than embedded, so there's one
          player and one place the videos live. */}
      <Link
        // Was /tools/training, which is the documented redirect stub -- so
        // every staff visit took a needless hop. app-routes returns the
        // real destination, which is exactly the rule that file states.
        href={routes.training(propertyId)}
        // SS-306: denim, not brass. Brass on a link is the same violation
        // D-01 keeps catching -- and SS-150 already set the precedent for
        // links in the staff area: denim, Inter, underline on hover only.
        className="inline-flex items-center gap-1.5 text-xs font-medium text-denim underline-offset-2 hover:underline mb-4"
      >
        <PlayCircle size={13} strokeWidth={1.75} aria-hidden="true" />
        {tTraining('watchMyDayVideo')}
      </Link>

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
      {/* SS-250/SS-306: these three were hand-rolled copies of the same
          markup, three times over, with the pin and the eyebrow re-declared
          in each. They are the shared Tile now -- migrated, not rewritten,
          and nothing was deleted (R21). The Time Clock joins them as a
          fourth card instead of a pill floating above the grid. */}
      {/* Six tiles, one grid. 2 across on a phone, 3 from tablet up -- six
          divides evenly by both, so there is no orphan tile stranded on a
          row of its own at any breakpoint.

          Handbook and Inventory carry pin={false}: they are pure signposts,
          and the dot marks a card that holds or does something. Same
          precedent as Dashboard Quick Actions. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-[14px] mb-6">
        <Tile
          centered
          onClick={() => setShowCapture(true)}
          eyebrow={t('captureTile')}
          label={t('captureTile')}
          subtitle={t('captureSubtitle')}
          icon={<Camera size={28} className="text-denim" aria-hidden="true" />}
        />
        <Tile
          centered
          href={`/properties/${propertyId}/shopping-list`}
          eyebrow={t('shoppingTile')}
          label={t('shoppingTile')}
          subtitle={t('shoppingSubtitle')}
          icon={<ShoppingCart size={28} className="text-denim" aria-hidden="true" />}
        />
        <Tile
          centered
          onClick={() => setShowKitchenTimer(true)}
          eyebrow={t('timerTile')}
          label={t('timerTile')}
          subtitle={t('timerSubtitle')}
          icon={<Timer size={28} className="text-denim" aria-hidden="true" />}
        />
        <Tile
          centered
          pin={false}
          href={routes.handbook(propertyId)}
          eyebrow={t('handbookTile')}
          label={t('handbookTile')}
          subtitle={t('handbookSubtitle')}
          icon={<BookOpen size={28} className="text-denim" aria-hidden="true" />}
        />
        <Tile
          centered
          pin={false}
          href={routes.inventory(propertyId)}
          eyebrow={t('inventoryTile')}
          label={t('inventoryTile')}
          subtitle={t('inventorySubtitle')}
          icon={<Package size={28} className="text-denim" aria-hidden="true" />}
        />
        <ClockInOutButton propertyId={propertyId} />
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
              {/* ONE Task Center ruling: staff_tasks is the ad-hoc one-off
                  lane and also flows into My Day. Server-filtered to rows
                  assigned to THIS viewer and not done -- an unassigned
                  ad-hoc task never appears here, same rule as the
                  canonical assignment path above. Read-only list: status
                  changes stay in the Task Center flow that owns them. */}
              {adHocTasks.length > 0 && (
                <div className="mt-4 pt-3 border-t border-cardBorder/60">
                  <p className="text-[10px] tracking-[0.14em] uppercase font-semibold text-brass mb-2">
                    {t('adHocTasks')}
                  </p>
                  <ul className="space-y-1.5">
                    {adHocTasks.map((task) => (
                      <li key={task.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-denim min-w-0 truncate">{task.title}</span>
                        <span className="text-xs text-dusk shrink-0">
                          {task.due_date
                            ? new Date(`${task.due_date}T00:00:00`).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })
                            : ''}
                          {task.priority === 'high' ? ' · !' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
