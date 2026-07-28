// components/ui/StatRow.tsx
// The four-up stat strip. Values are rendered as given -- formatting and
// translation stay with the caller, which knows the locale.
import Pin from '@/components/ui/Pin';

export type Stat = { label: string; value: React.ReactNode };

export default function StatRow({ stats, className = '' }: { stats: Stat[]; className?: string }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}>
      {stats.map((s, i) => (
        <div key={i} className="relative bg-card border border-cardBorder rounded-xl2 shadow-card p-4">
          <Pin size="sm" />
          <p className="text-[12px] text-dusk">{s.label}</p>
          <p className="font-display text-[24px] text-denim leading-tight mt-0.5">{s.value}</p>
        </div>
      ))}
    </div>
  );
}
