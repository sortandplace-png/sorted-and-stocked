// components/SopPosterBulkUpload.tsx
// Racquel 31 Jul: 37 poster images named after their procedures
// (Basement_steps_cleaning_procedure.jpg, HVAC_return_vent_filter_swap.png,
// ...). The single-poster path (SopPosterUpload) is one SOP at a time --
// open card, edit, pick file, crop -- which is the wrong shape for a batch
// of 37. This takes a multi-file drop, proposes a filename -> task_en match
// for every file, and ONLY writes after she has reviewed the mapping --
// matching is a guess, and a poster on the wrong procedure is worse than no
// poster.
//
// Matching: filename and task_en are both tokenized (underscores/hyphens to
// spaces, lowercased, punctuation dropped) and filler words that appear in
// filenames but not in task names -- "cleaning", "procedure" and friends --
// are removed from BOTH sides before Jaccard-scoring the token sets. Both
// languages are matched, so a Spanish-named file finds its SOP too.
//
// Upload runs sequentially, not Promise.all(37) -- phone uploads on
// household wifi stall out in parallel, and a partial batch with a clear
// "failed at file 23" beats 37 racing requests. No PhotoCropper here: these
// are pre-made posters, not phone photos needing framing; compression alone
// matches what the single path stores.
'use client';

import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { compressImageToBlob } from '@/lib/compress-image';
import { signSopPosters } from '@/lib/sop-posters';
import type { Sop } from '@/components/SopLibraryClient';

type PosterPatch = Partial<{
  expected_appearance_url: string | null;
  posterThumbUrl: string | null;
  posterDetailUrl: string | null;
  posterFullUrl: string | null;
}>;

type Row = {
  file: File;
  previewUrl: string;
  /** Selected sop id, '' = no selection (skipped unless she picks one). */
  sopId: string;
  /** True when the proposal came from matching rather than her own pick --
   *  shown as a hint so reviewed-and-changed rows read differently from
   *  untouched guesses. */
  autoMatched: boolean;
  skip: boolean;
};

// Words that carry no identity: they appear in poster FILENAMES as suffixes
// ("..._cleaning_procedure") and in task names as connectives. Removed from
// both sides so their presence or absence never decides a match.
const STOPWORDS = new Set([
  'cleaning', 'procedure', 'procedures', 'the', 'a', 'an', 'of', 'and', 'for',
  'to', 'in', 'on', 'with', 'de', 'del', 'la', 'el', 'los', 'las', 'y',
]);

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, '') // extension, when s is a filename
      .replace(/[_\-]+/g, ' ')
      .replace(/[^a-z0-9áéíóúüñ ]+/gi, ' ')
      .split(/\s+/)
      .filter((w) => w && !STOPWORDS.has(w))
  );
}

function overlap(file: Set<string>, task: Set<string>): { jaccard: number; containment: number } {
  if (file.size === 0 || task.size === 0) return { jaccard: 0, containment: 0 };
  let inter = 0;
  for (const w of file) if (task.has(w)) inter++;
  return {
    jaccard: inter / (file.size + task.size - inter),
    // How much of the FILENAME the task explains. Poster filenames are
    // usually a shortened form of the task name ("Basement_steps_..." for
    // "Basement Steps & Mechanical Area Floor"), so symmetric Jaccard alone
    // under-scores real matches whenever the task name is the longer one.
    containment: inter / file.size,
  };
}

/** Best sop for a filename, or null when nothing clears the bar. Exported
 *  for the match logic to be testable without mounting the component. */
export function matchSop(
  filename: string,
  sops: Pick<Sop, 'id' | 'task_en' | 'task_es'>[]
): { sopId: string; score: number } | null {
  const fileTokens = tokens(filename);
  let best: { sopId: string; score: number; jaccard: number } | null = null;
  for (const s of sops) {
    for (const name of [s.task_en, s.task_es]) {
      const { jaccard, containment } = overlap(fileTokens, tokens(name));
      // Accept either shape of match: every meaningful filename word appears
      // in the task name (two words minimum, or "Basement.jpg" would match
      // half the library), or at least half of the combined vocabulary
      // lines up. Jaccard breaks containment ties toward the SHORTEST task
      // that explains the filename, not the longest.
      const qualifies = (containment >= 0.999 && fileTokens.size >= 2) || jaccard >= 0.5;
      if (!qualifies) continue;
      const score = containment + jaccard; // containment dominates, jaccard tiebreaks
      if (!best || score > best.score) best = { sopId: s.id, score, jaccard };
    }
  }
  return best ? { sopId: best.sopId, score: best.score } : null;
}

export default function SopPosterBulkUpload({
  sops,
  onUpdated,
}: {
  sops: Sop[];
  onUpdated: (sopId: string, patch: PosterPatch) => void;
}) {
  const t = useTranslations('sopLibrary');
  const supabase = createClient();
  const showToast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const sopById = useMemo(() => new Map(sops.map((s) => [s.id, s])), [sops]);
  const sorted = useMemo(() => [...sops].sort((a, b) => a.task_en.localeCompare(b.task_en)), [sops]);

  function onFilesChosen(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: Row[] = Array.from(files).map((file) => {
      const match = matchSop(file.name, sops);
      return {
        file,
        previewUrl: URL.createObjectURL(file),
        sopId: match?.sopId ?? '',
        autoMatched: !!match,
        skip: false,
      };
    });
    setRows(next);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function closeReview() {
    rows.forEach((r) => URL.revokeObjectURL(r.previewUrl));
    setRows([]);
    setProgress(0);
  }

  function setRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch, ...(patch.sopId !== undefined ? { autoMatched: false } : {}) } : r)));
  }

  // Two files pointed at the same SOP is always a mistake -- one of them
  // would silently win. Block confirm until she resolves it.
  const duplicateSopIds = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows) if (!r.skip && r.sopId) seen.set(r.sopId, (seen.get(r.sopId) ?? 0) + 1);
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [rows]);

  const uploadable = rows.filter((r) => !r.skip && r.sopId);

  async function handleConfirm() {
    if (uploadable.length === 0 || duplicateSopIds.size > 0) return;
    setUploading(true);
    setProgress(0);
    let ok = 0;
    const failed: string[] = [];
    const written: { sopId: string; storedUrl: string }[] = [];
    for (const row of uploadable) {
      try {
        const compressed = await compressImageToBlob(row.file);
        // Same path shape and same stored-URL convention as SopPosterUpload
        // -- one format, whichever door the poster came in through.
        const path = `${row.sopId}-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('sop-posters')
          .upload(path, compressed, { contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('sop-posters').getPublicUrl(path);
        const { error: updateError } = await supabase
          .from('sop_library')
          .update({ expected_appearance_url: data.publicUrl })
          .eq('id', row.sopId);
        if (updateError) throw updateError;
        written.push({ sopId: row.sopId, storedUrl: data.publicUrl });
        ok++;
      } catch {
        failed.push(row.file.name);
      }
      setProgress((p) => p + 1);
    }
    // One signing pass for everything that landed, so the page shows the new
    // posters without a reload.
    try {
      const signed = await signSopPosters(supabase, written.map((w) => w.storedUrl));
      for (const w of written) {
        const urls = signed.get(w.storedUrl);
        onUpdated(w.sopId, {
          expected_appearance_url: w.storedUrl,
          posterThumbUrl: urls?.thumbUrl ?? null,
          posterDetailUrl: urls?.detailUrl ?? null,
          posterFullUrl: urls?.fullUrl ?? null,
        });
      }
    } catch {
      // Rows are written; only the live preview refresh failed. A reload
      // shows them -- not worth reporting the batch as failed over.
    }
    setUploading(false);
    if (failed.length === 0) {
      showToast(t('bulkDone', { count: ok }), { variant: 'success' });
      closeReview();
    } else {
      showToast(t('bulkPartial', { ok, failed: failed.length }), { variant: 'error' });
      // Keep only the failed rows on screen so retrying is one click, not a
      // re-pick of 37 files.
      setRows((prev) => prev.filter((r) => failed.includes(r.file.name)));
      setProgress(0);
    }
  }

  return (
    <div className="mb-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFilesChosen(e.target.files)}
      />

      {rows.length === 0 ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-denim border border-cardBorder rounded-full px-4 py-2"
        >
          <Upload size={14} strokeWidth={1.75} aria-hidden="true" />
          {t('bulkUpload')}
        </button>
      ) : (
        <div className="bg-card rounded-xl2 border border-cardBorder shadow-card p-3.5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-lg text-denim">{t('bulkTitle')}</h2>
              <p className="text-xs text-dusk">{t('bulkReviewHint')}</p>
            </div>
            <button
              type="button"
              onClick={closeReview}
              disabled={uploading}
              aria-label={t('cancel')}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-cardBorder text-dusk disabled:opacity-40"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>

          <ul className="space-y-2 max-h-[26rem] overflow-y-auto pr-1">
            {rows.map((row, i) => {
              const target = row.sopId ? sopById.get(row.sopId) : undefined;
              const isDuplicate = !!row.sopId && duplicateSopIds.has(row.sopId);
              return (
                <li
                  key={row.file.name + i}
                  className={`flex items-start gap-2.5 rounded-xl2 border p-2 ${row.skip ? 'opacity-50 border-cardBorder' : isDuplicate ? 'border-briar' : 'border-cardBorder'} bg-mist`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.previewUrl} alt="" className="w-14 h-14 object-contain rounded-lg bg-card border border-cardBorder shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs text-denim truncate font-medium" title={row.file.name}>
                      {row.file.name}
                    </p>
                    <select
                      value={row.sopId}
                      onChange={(e) => setRow(i, { sopId: e.target.value })}
                      disabled={row.skip || uploading}
                      aria-label={t('bulkPickTarget')}
                      className="w-full border border-cardBorder rounded-xl2 px-2 py-1.5 text-xs text-denim bg-card focus:border-brass focus:outline-none"
                    >
                      <option value="">{t('bulkNoMatch')}</option>
                      {sorted.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.sop_code ? `${s.sop_code} · ` : ''}
                          {s.task_en}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                      {!row.sopId && !row.skip && <span className="text-briar">{t('bulkNeedsPick')}</span>}
                      {isDuplicate && <span className="text-briar">{t('bulkConflict')}</span>}
                      {row.sopId && row.autoMatched && <span className="text-dusk">{t('bulkMatched')}</span>}
                      {target?.expected_appearance_url && !row.skip && (
                        <span className="text-brass">{t('bulkWillReplace')}</span>
                      )}
                      <label className="inline-flex items-center gap-1 text-dusk">
                        <input
                          type="checkbox"
                          checked={row.skip}
                          onChange={(e) => setRow(i, { skip: e.target.checked })}
                          disabled={uploading}
                          className="h-3.5 w-3.5 accent-brass rounded"
                        />
                        {t('bulkSkip')}
                      </label>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="py-2 px-4 rounded-full border border-cardBorder text-denim text-sm disabled:opacity-40"
            >
              {t('bulkRepick')}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={uploading || uploadable.length === 0 || duplicateSopIds.size > 0}
              className="flex-1 py-2 rounded-full bg-denim text-white text-sm font-medium disabled:opacity-40"
            >
              {uploading
                ? t('bulkUploading', { done: progress, total: uploadable.length })
                : t('bulkConfirm', { count: uploadable.length })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
