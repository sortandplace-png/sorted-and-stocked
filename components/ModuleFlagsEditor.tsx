// components/ModuleFlagsEditor.tsx
// SS-429/SS-436: the module feature_flags finally get a screen. This was
// the console's largest recorded gap: the operator's most-used setting
// (module_inventory/shopping/recipes/meal_plan/staff/tools per property)
// had NO UI anywhere, and every toggle to date was Claude writing jsonb
// directly at Racquel's verbal instruction.
//
// Operator surface: pick a house, flip its modules. Same read-then-merge
// feature_flags write SettingsClient/ShoppingRulesClient use, so no other
// flag on the property is ever blind-overwritten. Default-true convention
// preserved: an absent key renders ON, and turning a module on removes
// nothing (writes true). English-only on purpose (SS-436 carve-out).
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { MODULE_KEYS, isModuleEnabled, type ModuleKey } from '@/lib/module-flags';

const MODULE_LABELS: Record<ModuleKey, string> = {
  module_inventory: 'Inventory',
  module_shopping: 'Shopping',
  module_recipes: 'Recipes',
  module_meal_plan: 'Meal Plan',
  module_staff: 'Staff',
  module_tools: 'Tools',
};

export default function ModuleFlagsEditor({
  properties,
}: {
  properties: { id: string; label: string }[];
}) {
  const supabase = createClient();
  const showToast = useToast();

  const [selectedId, setSelectedId] = useState(properties[0]?.id ?? '');
  const [flags, setFlags] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<ModuleKey | null>(null);

  const load = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    const { data } = await supabase.from('properties').select('feature_flags').eq('id', selectedId).single();
    setFlags((data?.feature_flags ?? {}) as Record<string, unknown>);
    setLoading(false);
  }, [selectedId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(module: ModuleKey) {
    if (!flags) return;
    const next = !isModuleEnabled(flags, module);
    setSavingKey(module);
    // Re-read before writing -- the jsonb is shared by every flag on the
    // property and must never be blind-overwritten with stale state.
    const { data: current } = await supabase.from('properties').select('feature_flags').eq('id', selectedId).single();
    const merged = { ...((current?.feature_flags ?? {}) as Record<string, unknown>), [module]: next };
    const { error } = await supabase.from('properties').update({ feature_flags: merged }).eq('id', selectedId);
    setSavingKey(null);
    if (error) {
      showToast('Failed to save module setting.', { variant: 'error' });
      return;
    }
    setFlags(merged);
    showToast(`${MODULE_LABELS[module]} ${next ? 'on' : 'off'}.`, { variant: 'success' });
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-denim">Modules per house</p>
        <p className="text-xs text-dusk">
          Which areas of the app a house shows. A module switched off disappears from that house&rsquo;s nav and
          dashboard; its data is untouched.
        </p>
      </div>

      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        aria-label="Choose a house"
        className="w-full sm:w-auto border border-brass/30 bg-mist rounded-xl2 px-3 py-2 text-sm text-denim focus:outline-none focus:ring-2 focus:ring-brass/40"
      >
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      {loading ? (
        <p className="text-xs text-dusk">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MODULE_KEYS.map((module) => {
            const on = isModuleEnabled(flags, module);
            const busy = savingKey === module;
            return (
              <div
                key={module}
                className="flex items-center justify-between gap-3 border border-cardBorder rounded-xl2 px-4 py-2.5 bg-card"
              >
                <span className="text-sm text-denim">{MODULE_LABELS[module]}</span>
                <button
                  onClick={() => toggle(module)}
                  disabled={busy}
                  role="switch"
                  aria-checked={on}
                  aria-label={`Toggle ${MODULE_LABELS[module]}`}
                  className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
                    on ? 'bg-denim' : 'bg-mist border border-cardBorder'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      on ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
