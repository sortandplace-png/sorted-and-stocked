// components/auth/AuthOrDivider.tsx
export default function AuthOrDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 -mt-0.5">
      <div className="flex-1 h-px bg-cardBorder" />
      <span className="font-interDisplay text-[12px] text-dusk tracking-[0.04em] shrink-0">{label}</span>
      <div className="flex-1 h-px bg-cardBorder" />
    </div>
  );
}
