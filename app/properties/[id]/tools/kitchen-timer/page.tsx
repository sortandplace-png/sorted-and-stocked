// app/properties/[id]/tools/kitchen-timer/page.tsx
// Deliberately ungated (chosen, not an oversight, per the route-gating pass
// that added a server-side check to every other previously-open tools/*
// route): zero persistence, zero mutation -- these timers exist only in
// component state -- and every role already reaches the identical
// KitchenTimerClient with no restriction via the floating widget on the
// Recipes page. Gating the standalone route here would make it reachable
// from one surface but not another for the exact same component.
import KitchenTimerClient from '@/components/KitchenTimerClient';

export default async function KitchenTimerPage() {
  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-4">Kitchen Timer</h1>
      <KitchenTimerClient />
    </div>
  );
}
