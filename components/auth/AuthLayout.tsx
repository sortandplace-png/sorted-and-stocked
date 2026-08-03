// components/auth/AuthLayout.tsx
// Shared shell for all four entry-flow screens (Welcome/Sign In/Sign Up/
// Forgot Password) -- linen background, centered column. `wide` drops the
// top padding for the Welcome screen, which centers its own content
// vertically instead of sitting near the top like the three form screens.
// SS-562 §4: min-h-[100dvh] rather than 100vh/min-h-screen -- dvh tracks
// the mobile browser's DYNAMIC viewport, so when an in-app browser's
// bottom toolbar eats ~120px the layout shrinks with it instead of pushing
// the submit button underneath the chrome. The safe-area inset keeps the
// bottom padding real on notched iPhones. The form stays in normal flow,
// so the button is always inside the scrollable area, never pinned.
export default function AuthLayout({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`min-h-[100dvh] bg-linen flex flex-col items-center justify-start px-6 pb-[calc(60px+env(safe-area-inset-bottom))] ${wide ? 'pt-0' : 'pt-[72px]'}`}>
      {children}
    </div>
  );
}
