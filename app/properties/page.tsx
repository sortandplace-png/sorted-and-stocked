// app/properties/page.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LogoutButton from '@/components/LogoutButton';
import { LogoMark } from '@/components/Logo';

export default async function PropertiesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already redirects unauthenticated users to /login, but this
  // guards the page if it's ever reached directly (e.g. during dev).
  if (!user) redirect('/login');

  const { data: memberships, error } = await supabase
    .from('property_members')
    .select('role, properties(id, name)')
    .eq('user_id', user.id);

  // Single-property households shouldn't have to pick — skip straight in.
  if (memberships && memberships.length === 1 && memberships[0].properties) {
    redirect(`/properties/${(memberships[0].properties as any).id}/inventory`);
  }

  return (
    <div className="min-h-screen bg-cream px-6 pt-12">
      <div className="max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <LogoMark className="w-8 h-8" />
            <h1 className="font-display text-2xl text-charcoal">Your properties</h1>
          </div>
          <LogoutButton variant="light" />
        </div>

        {error && <p className="text-sm text-rust mb-4">{error.message}</p>}

        {memberships && memberships.length > 0 ? (
          <ul className="space-y-2 mb-6">
            {memberships.map((m) => {
              const property = m.properties as unknown as { id: string; name: string } | null;
              if (!property) return null;
              return (
                <li key={property.id}>
                  <Link
                    href={`/properties/${property.id}/inventory`}
                    className="flex items-center justify-between bg-white rounded-2xl shadow-sm shadow-charcoal/5 px-4 py-3 hover:bg-gold-light/15 transition-colors"
                  >
                    <span className="text-charcoal">{property.name}</span>
                    <span className="text-xs text-charcoal/50 capitalize">{m.role}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-charcoal/40 mb-6">
            You're not part of any property yet.
          </p>
        )}

        {memberships && memberships.length > 1 && (
          <Link
            href="/procurement"
            className="block text-center py-2.5 rounded-full bg-gold-light/40 text-charcoal text-sm font-medium mb-2"
          >
            🛒 Shop for multiple properties at once
          </Link>
        )}

        <Link
          href="/properties/new"
          className="block text-center py-2.5 rounded-full border border-charcoal/30 text-charcoal text-sm font-medium"
        >
          + Add a property
        </Link>
      </div>
    </div>
  );
}
