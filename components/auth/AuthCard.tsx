// components/auth/AuthCard.tsx
export default function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-card border border-cardBorder rounded-[20px] px-10 py-11 w-full max-w-[420px]"
      style={{ boxShadow: '0 16px 40px rgba(90,120,150,.09), 0 2px 10px rgba(90,120,150,.05)' }}
    >
      {children}
    </div>
  );
}
