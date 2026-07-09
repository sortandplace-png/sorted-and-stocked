// components/LocalFoodDirectoryClient.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SkeletonList } from '@/components/Skeleton';

type Restaurant = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  category: string | null;
  hashgacha: string | null;
  hashgacha_confirmed: boolean | null;
  website: string | null;
  hours: string | null;
  delivery_available: boolean | null;
  rating: number | null;
};

export default function LocalFoodDirectoryClient({ propertyId }: { propertyId: string }) {
  const supabase = createClient();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('local_food_directory')
      .select(
        'id, name, phone, whatsapp, address, city, category, hashgacha, hashgacha_confirmed, website, hours, delivery_available, rating'
      )
      .eq('property_id', propertyId)
      .order('name')
      .then(({ data }) => {
        setRestaurants(data ?? []);
        setLoading(false);
      });
  }, [propertyId, supabase]);

  const categories = useMemo(
    () => [...new Set(restaurants.map((r) => r.category).filter(Boolean))] as string[],
    [restaurants]
  );

  const filtered = restaurants.filter((r) => {
    const q = search.trim().toLowerCase();
    if (q && !r.name.toLowerCase().includes(q)) return false;
    if (categoryFilter && r.category !== categoryFilter) return false;
    return true;
  });

  if (loading) return <SkeletonList />;

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Local Takeout Directory</h1>
      <p className="text-sm text-charcoal/50 mb-4">Restaurants and takeout near Lakewood, with hashgacha noted.</p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search restaurants…"
        className="w-full border border-gold-light/60 rounded-full px-4 py-2.5 bg-white mb-3 text-sm"
      />

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                categoryFilter === c ? 'bg-gold-dark text-white' : 'bg-white border border-gold-light/50 text-charcoal/60'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && <p className="text-sm text-charcoal/40 text-center py-8">No matches.</p>}

      <ul className="space-y-2">
        {filtered.map((r) => (
          <li key={r.id} className="bg-white rounded-xl shadow-sm shadow-charcoal/5 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm text-charcoal">{r.name}</p>
                {r.category && <p className="text-xs text-charcoal/50">{r.category}</p>}
              </div>
              {r.hashgacha ? (
                <span className="text-xs bg-sage/10 text-sage px-2 py-0.5 rounded-full shrink-0">
                  {r.hashgacha}
                  {r.hashgacha_confirmed ? '' : ' (unconfirmed)'}
                </span>
              ) : (
                <span className="text-xs bg-rust/10 text-rust px-2 py-0.5 rounded-full shrink-0">No hashgacha found</span>
              )}
            </div>
            {r.address && <p className="text-xs text-charcoal/50 mt-1">{r.address}</p>}
            {(r.hours || r.rating != null || r.delivery_available != null) && (
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {r.rating != null && (
                  <span className="text-xs text-charcoal/60">⭐ {r.rating.toFixed(1)}</span>
                )}
                {r.delivery_available != null && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      r.delivery_available ? 'bg-sage/10 text-sage' : 'bg-charcoal/5 text-charcoal/40'
                    }`}
                  >
                    {r.delivery_available ? 'Delivery available' : 'No delivery'}
                  </span>
                )}
                {r.hours && <span className="text-xs text-charcoal/50">{r.hours}</span>}
              </div>
            )}
            <div className="flex flex-wrap gap-3 mt-2 text-sm">
              {r.phone && (
                <a href={`tel:${r.phone}`} className="text-charcoal/70 hover:text-charcoal">
                  📞 {r.phone}
                </a>
              )}
              {r.whatsapp && (
                <a
                  href={`https://wa.me/${r.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-charcoal/70 hover:text-charcoal"
                >
                  💬 WhatsApp
                </a>
              )}
              {r.website && (
                <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-gold-dark hover:text-charcoal">
                  🔗 Website
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
