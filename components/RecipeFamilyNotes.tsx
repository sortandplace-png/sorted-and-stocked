// components/RecipeFamilyNotes.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import Avatar from '@/components/Avatar';
import { Bold, Italic, List, Link as LinkIcon } from 'lucide-react';

type Person = { id: string; name: string };
type NoteRow = { person_id: string; notes: string; updated_by: string | null; updated_at: string; editor_name: string | null };

// Renders a narrow markdown subset (bold/italic/list items/links only) as
// real React nodes, never raw HTML -- there is no dangerouslySetInnerHTML
// anywhere in this path, so there's no stored-HTML XSS surface regardless
// of what ends up in `notes`. Links are only rendered as real <a> tags when
// the URL is http(s); anything else (javascript:, data:, etc.) renders as
// plain bracketed text instead.
function renderNoteMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const isListItem = line.startsWith('- ');
    const content = isListItem ? line.slice(2) : line;
    const inline = renderInline(content, `${i}`);
    if (isListItem) {
      return (
        <li key={i} className="ml-4 list-disc">
          {inline}
        </li>
      );
    }
    return (
      <p key={i} className={line.trim() === '' ? 'h-2' : ''}>
        {inline}
      </p>
    );
  });
}

function renderInline(text: string, keyPrefix: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Matches **bold**, *italic*, or [label](url), leftmost first.
  const pattern = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[1]) {
      parts.push(<strong key={`${keyPrefix}-${i++}`}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={`${keyPrefix}-${i++}`}>{match[4]}</em>);
    } else if (match[5]) {
      const url = match[7];
      if (/^https?:\/\//i.test(url)) {
        parts.push(
          <a key={`${keyPrefix}-${i++}`} href={url} target="_blank" rel="noreferrer" className="text-gold-dark underline">
            {match[6]}
          </a>
        );
      } else {
        parts.push(`[${match[6]}](${url})`);
      }
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export default function RecipeFamilyNotes({ recipeId, propertyId }: { recipeId: string; propertyId: string }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [notesByPerson, setNotesByPerson] = useState<Record<string, NoteRow>>({});
  const [activePersonId, setActivePersonId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const showToast = useToast();
  const t = useTranslations('recipeCards.familyNotes');
  const tc = useTranslations('common');
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const [{ data: peopleRows }, { data: noteRows }] = await Promise.all([
        supabase
          .from('household_people')
          .select('id, name')
          .eq('property_id', propertyId)
          .eq('active', true)
          .order('name'),
        supabase
          .from('recipe_family_notes')
          .select('person_id, notes, updated_by, updated_at, profiles(full_name)')
          .eq('recipe_id', recipeId),
      ]);
      const peopleList = peopleRows ?? [];
      setPeople(peopleList);
      const byPerson: Record<string, NoteRow> = {};
      for (const row of noteRows ?? []) {
        byPerson[row.person_id] = {
          person_id: row.person_id,
          notes: row.notes,
          updated_by: row.updated_by,
          updated_at: row.updated_at,
          editor_name: (row.profiles as unknown as { full_name: string | null } | null)?.full_name ?? null,
        };
      }
      setNotesByPerson(byPerson);
      if (peopleList.length > 0) {
        setActivePersonId(peopleList[0].id);
        setDraft(byPerson[peopleList[0].id]?.notes ?? '');
        setSaved(byPerson[peopleList[0].id]?.notes ?? '');
      }
      setLoading(false);
    })();
  }, [recipeId, propertyId, supabase]);

  function selectPerson(id: string) {
    setActivePersonId(id);
    const existing = notesByPerson[id]?.notes ?? '';
    setDraft(existing);
    setSaved(existing);
  }

  function wrapSelection(before: string, after: string = before) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value } = el;
    const selected = value.slice(selectionStart, selectionEnd);
    const next = value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd);
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selectionStart + before.length, selectionStart + before.length + selected.length);
    });
  }

  function insertListItem() {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, value } = el;
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const next = value.slice(0, lineStart) + '- ' + value.slice(lineStart);
    setDraft(next);
    requestAnimationFrame(() => el.focus());
  }

  function insertLink() {
    const url = window.prompt(t('linkPrompt'));
    if (!url || !/^https?:\/\//i.test(url)) {
      if (url) showToast(t('linkInvalid'), { variant: 'error' });
      return;
    }
    wrapSelection('[', `](${url})`);
  }

  const isDirty = draft !== saved;

  async function handleSave() {
    if (!activePersonId) return;
    setIsPending(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // A per-person note row may not exist yet on first save -- upsert
    // handles both create and update in one call, keyed on the table's
    // (recipe_id, person_id) unique constraint. This write isn't routed
    // through resilientUpdate/resilientInsert since the offline queue
    // (lib/offline-queue.ts) only models insert/update/delete, not upsert;
    // acceptable here since this is a lower-stakes convenience note, not
    // core inventory data.
    const { error } = await supabase.from('recipe_family_notes').upsert(
      {
        recipe_id: recipeId,
        person_id: activePersonId,
        notes: draft,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'recipe_id,person_id' }
    );

    setIsPending(false);

    if (error) {
      showToast(t('errorToast'), { variant: 'error' });
      return;
    }

    setSaved(draft);
    const { data: profile } = user
      ? await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      : { data: null };
    setNotesByPerson((prev) => ({
      ...prev,
      [activePersonId]: {
        person_id: activePersonId,
        notes: draft,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
        editor_name: profile?.full_name ?? null,
      },
    }));
    showToast(t('savedToast'), { variant: 'success' });
  }

  if (loading) return null;

  const activeNote = activePersonId ? notesByPerson[activePersonId] : null;

  return (
    <div className="bg-white rounded-xl2 shadow-sm shadow-charcoal/5 p-5 print:hidden">
      <h3 className="font-display text-lg text-charcoal mb-1">{t('title')}</h3>
      <p className="text-xs text-charcoal/50 mb-3">{t('description')}</p>

      {people.length === 0 ? (
        <p className="text-sm text-charcoal/40">{t('noPeople')}</p>
      ) : (
        <>
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {people.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPerson(p.id)}
                className={`flex flex-col items-center gap-1 shrink-0 ${activePersonId === p.id ? '' : 'opacity-50'}`}
              >
                <Avatar fullName={p.name} size="sm" />
                <span className="text-[10px] text-charcoal max-w-[4rem] truncate">{p.name}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 mb-1.5 border border-gold-light/50 rounded-t-xl px-2 py-1 bg-cream/40">
            <button type="button" onClick={() => wrapSelection('**')} title={t('bold')} className="p-1.5 rounded hover:bg-gold-light/30">
              <Bold size={14} />
            </button>
            <button type="button" onClick={() => wrapSelection('*')} title={t('italic')} className="p-1.5 rounded hover:bg-gold-light/30">
              <Italic size={14} />
            </button>
            <button type="button" onClick={insertListItem} title={t('list')} className="p-1.5 rounded hover:bg-gold-light/30">
              <List size={14} />
            </button>
            <button type="button" onClick={insertLink} title={t('link')} className="p-1.5 rounded hover:bg-gold-light/30">
              <LinkIcon size={14} />
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={isPending}
            rows={3}
            placeholder={t('placeholder')}
            className="w-full border border-gold-light/60 border-t-0 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-b-xl p-3 text-sm text-charcoal disabled:opacity-60 resize-y"
          />

          {draft.trim() && (
            <div className="mt-2 text-xs text-charcoal/70 bg-cream px-3 py-2 rounded-lg">{renderNoteMarkdown(draft)}</div>
          )}

          {activeNote?.updated_at && !isDirty && (
            <p className="mt-1.5 text-[11px] text-charcoal/40">
              {t('lastEdited', {
                name: activeNote.editor_name ?? tc('unknown'),
                time: new Date(activeNote.updated_at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                }),
              })}
            </p>
          )}

          <div className="flex justify-end gap-2 mt-2">
            {isDirty && !isPending && (
              <button onClick={() => setDraft(saved)} className="text-sm text-charcoal/50 hover:text-charcoal px-3 py-1.5">
                {tc('revert')}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!isDirty || isPending}
              className="text-sm font-medium bg-gold-dark text-white px-4 py-1.5 rounded-full disabled:opacity-40"
            >
              {isPending ? tc('saving') : tc('save')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
