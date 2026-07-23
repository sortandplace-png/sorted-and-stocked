// components/ManagerDashboardClient.tsx
// PHASE 1 -- manager cross-property dashboard. Every read here goes through
// a SECURITY DEFINER RPC that (a) checks is_platform_manager() itself, as a
// second gate behind the page-level server check, and (b) writes a
// manager_access_log row -- so even if this component somehow rendered for
// someone unauthorized, the underlying data calls still refuse them.
'use client';

import { useEffect, useState } from 'react';
import {
  fetchManagerInventoryAggregate,
  fetchManagerRecipesAggregate,
  fetchLibraryInventoryItems,
  fetchLibraryRecipes,
  approveInventoryItemToLibrary,
  approveRecipeToLibrary,
  retireLibraryInventoryItem,
  retireLibraryRecipe,
  onboardPropertyFromLibrary,
  type ManagerCapturedInventoryItem,
  type ManagerCapturedRecipe,
  type LibraryInventoryItem,
  type LibraryRecipe,
} from '@/lib/api/manager';
import { useToast } from '@/components/Toast';

type Tab = 'inventory' | 'recipes' | 'library' | 'onboard';

export default function ManagerDashboardClient({ properties }: { properties: { id: string; name: string }[] }) {
  const [tab, setTab] = useState<Tab>('inventory');
  const [propertyFilter, setPropertyFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [inventoryRows, setInventoryRows] = useState<ManagerCapturedInventoryItem[]>([]);
  const [recipeRows, setRecipeRows] = useState<ManagerCapturedRecipe[]>([]);
  const [libraryInventory, setLibraryInventory] = useState<LibraryInventoryItem[]>([]);
  const [libraryRecipes, setLibraryRecipes] = useState<LibraryRecipe[]>([]);
  const [onboardTarget, setOnboardTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const showToast = useToast();

  async function load() {
    setLoading(true);
    try {
      if (tab === 'inventory') {
        setInventoryRows(await fetchManagerInventoryAggregate(propertyFilter || null, search.trim() || null));
      } else if (tab === 'recipes') {
        setRecipeRows(await fetchManagerRecipesAggregate(propertyFilter || null, search.trim() || null));
      } else if (tab === 'library') {
        const [inv, rec] = await Promise.all([fetchLibraryInventoryItems(), fetchLibraryRecipes()]);
        setLibraryInventory(inv);
        setLibraryRecipes(rec);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, propertyFilter]);

  async function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    load();
  }

  async function handleApproveInventory(id: string) {
    try {
      await approveInventoryItemToLibrary(id);
      showToast('Added to shared library.', { variant: 'success' });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to approve.', { variant: 'error' });
    }
  }

  async function handleApproveRecipe(id: string) {
    try {
      await approveRecipeToLibrary(id);
      showToast('Added to shared library.', { variant: 'success' });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to approve.', { variant: 'error' });
    }
  }

  async function handleRetireInventory(id: string) {
    try {
      await retireLibraryInventoryItem(id);
      showToast('Retired from library.', { variant: 'success' });
      load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to retire.', { variant: 'error' });
    }
  }

  async function handleRetireRecipe(id: string) {
    try {
      await retireLibraryRecipe(id);
      showToast('Retired from library.', { variant: 'success' });
      load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to retire.', { variant: 'error' });
    }
  }

  async function handleOnboard() {
    if (!onboardTarget) return;
    try {
      const result = await onboardPropertyFromLibrary(onboardTarget);
      showToast(
        `Copied ${result.inventory_items_copied} inventory items and ${result.recipes_copied} recipes.`,
        { variant: 'success' }
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to onboard.', { variant: 'error' });
    }
  }

  return (
    <div className="min-h-screen bg-linen text-denim p-6 max-w-5xl mx-auto">
      <h1 className="font-display text-2xl mb-1">Manager Platform</h1>
      <p className="text-xs text-dusk mb-6">
        Phase 1 -- not active until 074_manager_platform_phase1.sql is applied. Everything below is a preview of the
        UI, not live data.
      </p>

      <div className="flex gap-2 mb-6">
        {(['inventory', 'recipes', 'library', 'onboard'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              tab === t ? 'bg-gold text-denim' : 'bg-white border border-cardBorder text-dusk'
            }`}
          >
            {t === 'inventory' ? 'Inventory (all clients)' : t === 'recipes' ? 'Recipes (all clients)' : t === 'library' ? 'Shared Library' : 'Onboard New Client'}
          </button>
        ))}
      </div>

      {(tab === 'inventory' || tab === 'recipes') && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="border border-cardBorder rounded-full px-3 py-1.5 text-sm bg-white"
          >
            <option value="">All clients</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, e.g. Crest"
              className="border border-cardBorder rounded-full px-3 py-1.5 text-sm bg-white w-56"
            />
            <button type="submit" className="px-3 py-1.5 rounded-full text-sm bg-denim text-white">
              Search
            </button>
          </form>
        </div>
      )}

      {loading && <p className="text-sm text-dusk">Loading...</p>}

      {!loading && tab === 'inventory' && (
        <div className="space-y-2">
          {inventoryRows.map((row) => (
            <div
              key={row.captured_id}
              className="flex items-center justify-between gap-3 bg-white rounded-xl border border-cardBorder px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {row.name}
                  {row.source_deleted_at && <span className="text-rust text-xs ml-2">(removed by client)</span>}
                </p>
                <p className="text-xs text-dusk">
                  {row.property_name} · {row.category ?? 'Uncategorized'}
                </p>
              </div>
              <button
                onClick={() => handleApproveInventory(row.captured_id)}
                className="shrink-0 text-xs font-medium text-brass hover:text-denim"
              >
                Approve to library
              </button>
            </div>
          ))}
          {inventoryRows.length === 0 && <p className="text-sm text-dusk">No items match.</p>}
        </div>
      )}

      {!loading && tab === 'recipes' && (
        <div className="space-y-2">
          {recipeRows.map((row) => (
            <div
              key={row.captured_id}
              className="flex items-center justify-between gap-3 bg-white rounded-xl border border-cardBorder px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {row.name}
                  {row.source_deleted_at && <span className="text-rust text-xs ml-2">(removed by client)</span>}
                </p>
                <p className="text-xs text-dusk">
                  {row.property_name} · {row.course ?? 'Uncategorized'}
                </p>
              </div>
              <button
                onClick={() => handleApproveRecipe(row.captured_id)}
                className="shrink-0 text-xs font-medium text-brass hover:text-denim"
              >
                Approve to library
              </button>
            </div>
          ))}
          {recipeRows.length === 0 && <p className="text-sm text-dusk">No recipes match.</p>}
        </div>
      )}

      {!loading && tab === 'library' && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-lg mb-2">Inventory items ({libraryInventory.filter((i) => i.active).length} active)</h2>
            <div className="space-y-2">
              {libraryInventory.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-3 bg-white rounded-xl border border-cardBorder px-4 py-2.5 ${
                    !item.active ? 'opacity-50' : ''
                  }`}
                >
                  <p className="text-sm">{item.name}</p>
                  {item.active && (
                    <button
                      onClick={() => handleRetireInventory(item.id)}
                      className="text-xs text-dusk hover:text-rust"
                    >
                      Retire
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="font-display text-lg mb-2">Recipes ({libraryRecipes.filter((r) => r.active).length} active)</h2>
            <div className="space-y-2">
              {libraryRecipes.map((r) => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between gap-3 bg-white rounded-xl border border-cardBorder px-4 py-2.5 ${
                    !r.active ? 'opacity-50' : ''
                  }`}
                >
                  <p className="text-sm">{r.name}</p>
                  {r.active && (
                    <button onClick={() => handleRetireRecipe(r.id)} className="text-xs text-dusk hover:text-rust">
                      Retire
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'onboard' && (
        <div className="bg-white rounded-xl border border-cardBorder p-4 max-w-md space-y-3">
          <p className="text-sm text-dusk">
            Copies every active shared-library item into the selected property, one time. Editing the library
            afterward never touches properties already onboarded.
          </p>
          <select
            value={onboardTarget}
            onChange={(e) => setOnboardTarget(e.target.value)}
            className="w-full border border-cardBorder rounded-full px-3 py-1.5 text-sm bg-white"
          >
            <option value="">Choose a property...</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleOnboard}
            disabled={!onboardTarget}
            className="w-full bg-denim text-white rounded-full px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Copy library into this property
          </button>
        </div>
      )}
    </div>
  );
}
