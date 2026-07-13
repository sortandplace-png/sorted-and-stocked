// components/RecipeFamilyNotes.tsx
// Was a per-person notes system keyed on recipe_family_notes.person_id --
// blocked on zero recipes for every household until someone first set up
// household members under Guest & Family Taste Memory, which none of them
// had done. Switched to recipes.family_notes -- a plain text column already
// in the schema, unused -- one general note per recipe, no setup required.
'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { updateRecipeFamilyNotes } from '@/app/recipes/actions';
import { useToast } from '@/components/Toast';
import { Bold, Italic, List, Link as LinkIcon } from 'lucide-react';

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

export default function RecipeFamilyNotes({
  recipeId,
  initialNotes,
}: {
  recipeId: string;
  initialNotes: string | null;
}) {
  const [draft, setDraft] = useState(initialNotes ?? '');
  const [saved, setSaved] = useState(initialNotes ?? '');
  const [isPending, setIsPending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const showToast = useToast();
  const t = useTranslations('recipeCards.familyNotes');
  const tc = useTranslations('common');

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
    setIsPending(true);
    const result = await updateRecipeFamilyNotes({ recipeId, notes: draft });
    setIsPending(false);

    if (!result.success) {
      showToast(t('errorToast'), { variant: 'error' });
      return;
    }

    setSaved(draft);
    showToast(t('savedToast'), { variant: 'success' });
  }

  return (
    <div className="bg-white rounded-xl2 shadow-sm shadow-charcoal/5 p-5 print:hidden">
      <h3 className="font-display text-lg text-charcoal mb-1">{t('title')}</h3>
      <p className="text-xs text-charcoal/50 mb-3">{t('description')}</p>

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
    </div>
  );
}
