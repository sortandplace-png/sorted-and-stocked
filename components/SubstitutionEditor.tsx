'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { updateRecipeSubstitution } from '@/app/recipes/actions';
import { createClient } from '@/lib/supabase/client';

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
  const [currentUserName, setCurrentUserName] = useState('Someone');
  const t = useTranslations('recipeCards.substitutions');
  const tc = useTranslations('common');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      setCurrentUserName(profile?.full_name || user.email || 'Someone');
    });
  }, []);

  const isDirty = notes.trim() !== initialNotes.trim();
  const CHARACTER_LIMIT = 2000;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    startTransition(async () => {
      const result = await updateRecipeSubstitution({
        recipeId,
        notes: notes.trim(),
        updatedBy: currentUserName,
      });

      if (result.success) {
        setStatus({ type: 'success', message: t('savedToast') });
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus({ type: 'error', message: result.error || t('errorToast') });
      }
    });
  };

  const handleClear = () => {
    if (confirm(t('clearConfirm'))) {
      setNotes('');
    }
  };

  return (
    <div className="bg-white rounded-xl2 shadow-sm shadow-charcoal/5 p-5">
      <h3 className="font-display text-lg text-charcoal mb-1">{t('title')}</h3>
      <p className="text-xs text-charcoal/50 mb-2">{t('description')}</p>

      <form onSubmit={handleSave} className="space-y-2">
        <div className="relative">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, CHARACTER_LIMIT))}
            disabled={isPending}
            rows={5}
            placeholder={t('placeholder')}
            className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-xl p-3 text-sm text-charcoal disabled:opacity-60 resize-y"
          />
          <div className="absolute bottom-2 right-3 text-[10px] text-charcoal/30">
            {notes.length} / {CHARACTER_LIMIT}
          </div>
        </div>

        {(lastUpdatedAt || lastUpdatedBy) && (
          <div className="text-[11px] text-charcoal/40 flex justify-between items-center bg-cream px-3 py-1.5 rounded-lg">
            <span>{t('lastModified', { date: lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleDateString() : 'N/A' })}</span>
            <span>{t('by', { name: lastUpdatedBy || 'System' })}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div>
            {notes.trim().length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                disabled={isPending}
                className="text-xs text-rust hover:text-rust/80 font-medium disabled:opacity-50"
              >
                {t('clearAll')}
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {isDirty && !isPending && (
              <button
                type="button"
                onClick={() => setNotes(initialNotes)}
                className="text-sm text-charcoal/50 hover:text-charcoal px-3 py-1.5"
              >
                {tc('revert')}
              </button>
            )}
            <button
              type="submit"
              disabled={!isDirty || isPending}
              className="text-sm font-medium bg-gold-dark text-white px-4 py-1.5 rounded-full disabled:opacity-40"
            >
              {isPending ? tc('saving') : tc('save')}
            </button>
          </div>
        </div>
      </form>

      {status && (
        <div
          className={`mt-3 text-xs font-medium py-2 px-3 rounded-lg ${
            status.type === 'success' ? 'bg-sage/10 text-sage' : 'bg-rust/10 text-rust'
          }`}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}
