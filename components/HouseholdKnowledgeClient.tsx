// components/HouseholdKnowledgeClient.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientDelete } from '@/lib/resilient-write';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { useDraftAutosave } from '@/hooks/useDraftAutosave';

type Entry = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
};

type KnowledgeDraft = { question: string; answer: string; category: string };

const CATEGORIES = ['General', 'Kitchen', 'Guests', 'Maintenance', 'Shabbos/Yom Tov'];

export default function HouseholdKnowledgeClient({ propertyId }: { propertyId: string }) {
  const role = usePropertyRole();
  const supabase = createClient();
  const showToast = useToast();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [saving, setSaving] = useState(false);

  const { existingDraft, resumeDraft, discardDraft, clearDraft, queueSave } = useDraftAutosave<KnowledgeDraft>({
    propertyId,
    formType: 'household_knowledge',
    isEmpty: (d) => !d.question.trim() && !d.answer.trim(),
  });

  useEffect(() => {
    queueSave({ question, answer, category });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, answer, category]);

  function applyDraft(draft: KnowledgeDraft) {
    setQuestion(draft.question);
    setAnswer(draft.answer);
    setCategory(draft.category);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('household_knowledge')
      .select('id, question, answer, category')
      .eq('property_id', propertyId)
      .order('category')
      .order('question');
    setEntries(data ?? []);
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function addEntry() {
    if (!question.trim() || !answer.trim()) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const result = await resilientInsert(supabase, 'household_knowledge', {
      property_id: propertyId,
      question: question.trim(),
      answer: answer.trim(),
      category,
      created_by: user?.id ?? null,
    });
    setSaving(false);

    if (!result.ok) {
      showToast('Failed to save.', { variant: 'error' });
      return;
    }
    showToast(result.queued ? 'Saved — will sync when back online.' : 'Added.', { variant: 'success' });
    setQuestion('');
    setAnswer('');
    await clearDraft();
    load();
  }

  async function removeEntry(id: string) {
    const result = await resilientDelete(supabase, 'household_knowledge', { id });
    if (!result.ok) {
      showToast('Failed to delete.', { variant: 'error' });
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const filtered = entries.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return e.question.toLowerCase().includes(q) || e.answer.toLowerCase().includes(q);
  });

  const grouped = filtered.reduce<Record<string, Entry[]>>((acc, e) => {
    const cat = e.category || 'General';
    (acc[cat] ??= []).push(e);
    return acc;
  }, {});

  if (loading) return <SkeletonList />;

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Household Knowledge Base</h1>
      <p className="text-sm text-charcoal/50 mb-4">
        The answers staff and family keep asking for — where things are, how things are done.
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search questions and answers…"
        className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-full px-4 py-2.5 bg-white mb-4 text-sm"
      />

      {canManage(role) && existingDraft && (
        <div className="bg-gold-light/20 border border-gold-light rounded-2xl p-3 mb-4 text-sm">
          <p className="text-charcoal mb-2">You have an unsaved draft entry.</p>
          <div className="flex gap-2">
            <button
              onClick={() => applyDraft(resumeDraft() as KnowledgeDraft)}
              className="flex-1 py-2 rounded-full bg-charcoal text-cream font-medium text-xs"
            >
              Resume draft
            </button>
            <button
              onClick={() => discardDraft()}
              className="flex-1 py-2 rounded-full bg-cream border border-charcoal/30 text-charcoal text-xs"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {canManage(role) && (
        <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 mb-6 space-y-2">
          <h2 className="font-display text-lg text-charcoal mb-1">Add an entry</h2>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Question (e.g. Where are the extra folding chairs?)"
            className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
          />
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Answer"
            rows={2}
            className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm bg-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            onClick={addEntry}
            disabled={saving || !question.trim() || !answer.trim()}
            className="w-full py-2.5 rounded-full bg-charcoal text-cream font-medium disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Add entry'}
          </button>
        </div>
      )}

      {Object.keys(grouped).length === 0 && (
        <p className="text-sm text-charcoal/40 text-center py-8">
          {entries.length === 0
            ? canManage(role)
              ? 'No entries yet — use the form above to add your first Q&A.'
              : 'No entries yet. Ask a manager to add one.'
            : 'No matches.'}
        </p>
      )}

      <div className="space-y-6">
        {Object.entries(grouped).map(([cat, catEntries]) => (
          <div key={cat}>
            <h3 className="text-xs font-medium uppercase tracking-wider text-gold-dark mb-2">{cat}</h3>
            <ul className="space-y-2">
              {catEntries.map((entry) => (
                <li key={entry.id} className="bg-white rounded-xl shadow-sm shadow-charcoal/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm text-charcoal">{entry.question}</p>
                    {canManage(role) && (
                      <button
                        onClick={() => removeEntry(entry.id)}
                        className="text-xs text-charcoal/30 hover:text-rust shrink-0"
                        aria-label="Delete entry"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-charcoal/70 mt-1">{entry.answer}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
