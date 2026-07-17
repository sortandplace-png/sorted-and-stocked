// components/auth/AuthLayout.tsx
// Shared shell for all four entry-flow screens (Welcome/Sign In/Sign Up/
// Forgot Password) -- linen background, centered column. `wide` drops the
// top padding for the Welcome screen, which centers its own content
// vertically instead of sitting near the top like the three form screens.
export default function AuthLayout({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`min-h-screen bg-linen flex flex-col items-center justify-start px-6 pb-[60px] ${wide ? 'pt-0' : 'pt-[72px]'}`}>
      {children}
    </div>
  );
}
