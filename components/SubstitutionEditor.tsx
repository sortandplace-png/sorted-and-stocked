'use client';

import React, { useState, useTransition } from 'react';
import { updateRecipeSubstitution } from '@/app/recipes/actions';

interface SubstitutionEditorProps {
  recipeId: string;
  initialNotes?: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: Date;
}

export default function SubstitutionEditor({
  recipeId,
  initialNotes = '',
  lastUpdatedBy,
  lastUpdatedAt
}: SubstitutionEditorProps) {
  const [notes, setNotes] = useState<string>(initialNotes);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isDirty = notes.trim() !== initialNotes.trim();
  const CHARACTER_LIMIT = 2000;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    startTransition(async () => {
      const result = await updateRecipeSubstitution({
        recipeId,
        notes: notes.trim(),
        updatedBy: 'Manager On Duty', // Wire this up to your native Auth session context
      });

      if (result.success) {
        setStatus({ type: 'success', message: 'Substitutions saved successfully.' });
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus({ type: 'error', message: result.error || 'An unexpected error occurred.' });
      }
    });
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to permanently clear all substitution notes for this recipe?')) {
      setNotes('');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl mx-auto text-white shadow-xl">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold tracking-tight">Recipe Substitution Editor</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Provide manual backup ingredient options when live inventory mapping falls short.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="relative">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, CHARACTER_LIMIT))}
            disabled={isPending}
            rows={5}
            placeholder="Example: If heavy cream is low, swap with whole milk + 1 tbsp unsalted butter from main pantry fridge..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm font-sans focus:outline-none focus:border-amber-500 text-slate-200 placeholder-slate-600 transition disabled:opacity-60 resize-y"
          />
          <div className="absolute bottom-3 right-3 text-[10px] font-mono text-slate-500">
            {notes.length} / {CHARACTER_LIMIT}
          </div>
        </div>

        {/* Audit Metadata Trail */}
        {(lastUpdatedAt || lastUpdatedBy) && (
          <div className="text-[11px] font-mono text-slate-500 flex justify-between items-center bg-slate-950/50 px-3 py-1.5 rounded-lg border border-slate-800/40">
            <span>Last modified: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleDateString() : 'N/A'}</span>
            <span>By: {lastUpdatedBy || 'System'}</span>
          </div>
        )}

        {/* Action Tray */}
        <div className="flex items-center justify-between pt-2">
          <div>
            {notes.trim().length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                disabled={isPending}
                className="text-xs text-rose-400 hover:text-rose-300 font-medium transition active:scale-95 disabled:opacity-50"
              >
                Clear/Reset All
              </button>
            )}
          </div>

          <div className="flex gap-3">
            {isDirty && !isPending && (
              <button
                type="button"
                onClick={() => setNotes(initialNotes)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm font-medium transition active:scale-95"
              >
                Revert Changes
              </button>
            )}
            <button
              type="submit"
              disabled={!isDirty || isPending}
              className={`px-5 py-2 rounded-xl text-sm font-bold transition active:scale-95 flex items-center gap-2 ${
                !isDirty || isPending
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60'
                  : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
              }`}
            >
              {isPending ? 'Saving...' : 'Save Substitutions'}
            </button>
          </div>
        </div>
      </form>

      {/* Alert Banner */}
      {status && (
        <div className={`mt-4 text-xs font-medium py-2 px-3 rounded-lg border transition-all animate-fade-in ${
          status.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          {status.message}
        </div>
      )}
    </div>
  );
}
