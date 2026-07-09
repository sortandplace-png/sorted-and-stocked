// app/properties/[id]/tools/kitchen-timer/page.tsx
import KitchenTimerClient from '@/components/KitchenTimerClient';

export default async function KitchenTimerPage() {
  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-4">Kitchen Timer</h1>
      <KitchenTimerClient />
    </div>
  );
}
