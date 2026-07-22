// components/StaffOnboardingModal.tsx
// Shown once to a new Staff-role user on their first sign-in. Kashrut tag
// colors/icons here deliberately match the REAL live app (rust/dairy/sage,
// Square/Triangle/Circle -- same as KASHRUT_INFO on the Home dashboard),
// not the bold saturated mockup palette -- the whole point of this screen
// is teaching someone to recognize the tags they're about to actually see,
// so it needs to match reality, not a still-unapproved visual direction.
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Calendar, Scan, Plus, ShoppingCart, Square, Triangle, Circle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type LiveExample = { name: string; kosherType: 'Meat' | 'Dairy' | 'Parve' };

const KASH_STYLE = {
  Fleishig: { bg: 'bg-rust', Icon: Square },
  Milchig: { bg: 'bg-dairy', Icon: Triangle },
  Parve: { bg: 'bg-sage', Icon: Circle },
} as const;

function kashKey(kosherType: string): keyof typeof KASH_STYLE {
  if (kosherType === 'Meat') return 'Fleishig';
  if (kosherType === 'Dairy') return 'Milchig';
  return 'Parve';
}

export default function StaffOnboardingModal({
  propertyId,
  propertyName,
  userId,
}: {
  propertyId: string;
  propertyName: string;
  userId: string;
}) {
  const [open, setOpen] = useState(true);
  const [screen, setScreen] = useState(1);
  const [example, setExample] = useState<LiveExample | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const t = useTranslations('staffOnboarding');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('recipes')
        .select('name, kosher_type, recipe_property_links!inner(property_id)')
        .eq('recipe_property_links.property_id', propertyId)
        .not('kosher_type', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setExample({ name: data.name, kosherType: data.kosher_type });
    })();
  }, [propertyId, supabase]);

  async function markSeen() {
    await supabase.from('profiles').update({ staff_onboarding_seen_at: new Date().toISOString() }).eq('id', userId);
  }

  async function finish() {
    await markSeen();
    setOpen(false);
    // Staff land on My Day, not the Owner/Manager Dashboard -- confirmed
    // via the real post-login redirect logic in app/properties/page.tsx.
    router.push(`/properties/${propertyId}/my-day`);
  }

  async function skip() {
    await markSeen();
    setOpen(false);
  }

  if (!open) return null;

  const total = 4;

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] bg-linen rounded-2xl shadow-xl min-h-[600px] flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col px-7 pt-9 pb-2">
          {screen === 1 && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-denim flex items-center justify-center overflow-hidden">
                <svg viewBox="0 0 100 100" className="w-10 h-10">
                  <rect x="64" y="14" width="9" height="27" fill="#C5A46D" />
                  <polygon points="50,8 92,44 8,44" fill="#C5A46D" />
                  <rect x="20" y="44" width="60" height="45" fill="#C5A46D" />
                  <text
                    x="50"
                    y="76"
                    textAnchor="middle"
                    fontFamily="var(--font-display)"
                    fontWeight="700"
                    fontSize="19"
                    fill="#FAF7F2"
                  >
                    S<tspan fontStyle="italic">&amp;</tspan>S
                  </text>
                </svg>
              </div>
              <h1 className="font-display font-bold text-[26px] text-center text-denim leading-tight mb-3">
                {t('screen1Headline')}
              </h1>
              <p className="text-center text-sm text-dusk leading-relaxed max-w-[280px] mx-auto">
                {t('screen1Sub', { propertyName })}
              </p>
            </>
          )}

          {screen === 2 && (
            <>
              <p className="text-center text-[10.5px] tracking-widest uppercase font-bold text-brass mb-4">
                {t('screen2Eyebrow')}
              </p>
              <h1 className="font-display font-bold text-xl text-center text-denim mb-3">{t('screen2Headline')}</h1>
              <p className="text-center text-sm text-dusk leading-relaxed mb-5">{t('screen2Sub')}</p>
              {(['Fleishig', 'Milchig', 'Parve'] as const).map((k) => {
                const { bg, Icon } = KASH_STYLE[k];
                const label = k === 'Fleishig' ? t('screen2Fleishig') : k === 'Milchig' ? t('screen2Milchig') : t('screen2Parve');
                return (
                  <div key={k} className="flex items-center gap-3 bg-white rounded-xl p-3.5 mb-2.5 shadow-sm shadow-charcoal/5">
                    <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase text-white shrink-0 ${bg}`}>
                      <Icon className="w-2.5 h-2.5" fill="currentColor" aria-hidden="true" />
                      {k}
                    </span>
                    <span className="text-sm text-dusk">{label}</span>
                  </div>
                );
              })}
              {example && (
                <div className="mt-4 p-3.5 border border-cardBorder rounded-xl">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-dusk mb-1.5">{t('screen2Example')}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-denim">{example.name}</span>
                    {(() => {
                      const k = kashKey(example.kosherType);
                      const { bg, Icon } = KASH_STYLE[k];
                      return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase text-white ${bg}`}>
                          <Icon className="w-2 h-2" fill="currentColor" aria-hidden="true" />
                          {k}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              )}
            </>
          )}

          {screen === 3 && (
            <>
              <p className="text-center text-[10.5px] tracking-widest uppercase font-bold text-brass mb-4">
                {t('screen3Eyebrow')}
              </p>
              <h1 className="font-display font-bold text-xl text-center text-denim mb-3">{t('screen3Headline')}</h1>
              <p className="text-center text-sm text-dusk leading-relaxed mb-5">{t('screen3Sub')}</p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { Icon: Calendar, label: 'Meal Plan' },
                  { Icon: Scan, label: 'Scan Item' },
                  { Icon: Plus, label: 'Add Recipe' },
                  { Icon: ShoppingCart, label: 'Shopping List' },
                ].map(({ Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-2 bg-white rounded-xl p-4 text-center shadow-sm shadow-charcoal/5">
                    <Icon size={20} className="text-brass" aria-hidden="true" />
                    <span className="text-xs font-bold text-denim">{label}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {screen === 4 && (
            <>
              <p className="text-center text-[10.5px] tracking-widest uppercase font-bold text-brass mb-4">
                {t('screen4Eyebrow')}
              </p>
              <h1 className="font-display font-bold text-xl text-center text-denim mb-5 leading-tight">
                {t('screen4Headline', { propertyName })}
              </h1>
              {[
                { title: t('screen4Check1Title'), body: t('screen4Check1Body') },
                { title: t('screen4Check2Title'), body: t('screen4Check2Body') },
                { title: t('screen4Check3Title'), body: t('screen4Check3Body') },
              ].map((c, i) => (
                <div key={i} className="flex gap-3 py-2.5 border-t border-cardBorder first:border-t-0">
                  <span className="font-display font-bold text-brass shrink-0">{i + 1}</span>
                  <div>
                    <p className="text-sm font-bold text-denim">{c.title}</p>
                    <p className="text-xs text-dusk">{c.body}</p>
                  </div>
                </div>
              ))}
              <div className="flex-1" />
              <button
                onClick={finish}
                className="w-full mt-6 py-3 rounded-full bg-denim text-white text-sm font-bold"
              >
                {t('finish')}
              </button>
            </>
          )}
        </div>

        <div className="flex justify-center gap-1.5 pt-3">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i + 1 === screen ? 'w-[18px] bg-denim' : 'w-1.5 bg-linen'}`}
            />
          ))}
        </div>

        {screen < 4 && (
          <div className="flex items-center justify-between px-7 py-5">
            <button onClick={skip} className="text-xs text-dusk underline">
              {t('skip')}
            </button>
            <div className="flex items-center gap-4">
              {screen > 1 && (
                <button onClick={() => setScreen((s) => s - 1)} className="text-sm font-medium text-dusk">
                  {t('back')}
                </button>
              )}
              <button
                onClick={() => setScreen((s) => s + 1)}
                className="px-6 py-2.5 rounded-full bg-denim text-white text-sm font-bold"
              >
                {t('next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
