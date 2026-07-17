// components/auth/AuthSubmitButton.tsx
function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="rgba(255,255,255,.35)" strokeWidth="2" />
      <path d="M8 2.5A5.5 5.5 0 0 1 13.5 8" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function AuthSubmitButton({
  loading,
  loadingLabel,
  children,
}: {
  loading: boolean;
  loadingLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={`mt-1 w-full text-white font-interDisplay text-sm font-bold tracking-[0.06em] px-8 py-[15px] rounded-full flex items-center justify-center gap-2 transition-colors ${
        loading ? 'bg-[#A0BAD8] cursor-default' : 'bg-denimBlue hover:bg-[#5A7CAE] cursor-pointer'
      }`}
    >
      {loading && <Spinner />}
      {loading ? loadingLabel : children}
    </button>
  );
}
