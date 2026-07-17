// components/auth/AuthErrorBox.tsx
export default function AuthErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg px-3.5 py-2.5 text-[13px] leading-snug"
      style={{
        background: 'rgba(192,80,77,.07)',
        border: '1px solid rgba(192,80,77,.22)',
        borderLeft: '3px solid #C0504D',
        color: '#C0504D',
      }}
    >
      {children}
    </div>
  );
}
