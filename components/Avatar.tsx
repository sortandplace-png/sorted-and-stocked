// components/Avatar.tsx
// Photo avatar (profiles.avatar_url) when set, falling back to initials
// from full_name, then the first letter of email. Upload flow lives in
// HeaderAvatarUpload.tsx -- this component only handles display.
type AvatarSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-14 h-14 text-lg',
};

function getInitials(fullName: string | null | undefined, email: string | null | undefined): string {
  const name = fullName?.trim();
  if (name) {
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return words[0][0].toUpperCase();
  }
  const trimmedEmail = email?.trim();
  if (trimmedEmail) return trimmedEmail[0].toUpperCase();
  return '?';
}

export default function Avatar({
  fullName,
  email,
  photoUrl,
  size = 'md',
  className = '',
}: {
  fullName?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={fullName?.trim() || email || 'User avatar'}
        title={fullName?.trim() || email || undefined}
        className={`inline-flex rounded-full object-cover shrink-0 ${SIZE_CLASSES[size]} ${className}`}
      />
    );
  }
  const initials = getInitials(fullName, email);
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-gold-dark text-white font-display font-semibold shrink-0 ${SIZE_CLASSES[size]} ${className}`}
      aria-hidden="true"
      title={fullName?.trim() || email || undefined}
    >
      {initials}
    </span>
  );
}
