// components/marketing/FaqList.tsx
// Native <details>/<summary> rather than a React-state accordion -- the
// disclosure behavior comes free from the browser, so this stays a server
// component with zero client JS. Every answer is real DOM text regardless
// of whether a crawler executes JavaScript, which matters more here than
// on any other page: this is the one page whose entire content IS the
// crawlable text.
import Pin from '@/components/PinAccent';

export default function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="space-y-3">
      {items.map(({ q, a }) => (
        <details
          key={q}
          className="group relative bg-card border border-cardBorder rounded-2xl shadow-card overflow-hidden"
        >
          <Pin size="sm" />
          <summary className="cursor-pointer list-none px-6 py-5 font-display font-bold text-lg text-denim flex items-center justify-between gap-4">
            {q}
            <span className="text-brass text-xl shrink-0 transition-transform group-open:rotate-45" aria-hidden="true">
              +
            </span>
          </summary>
          <p className="px-6 pb-5 text-sm text-dusk leading-relaxed">{a}</p>
        </details>
      ))}
    </div>
  );
}
