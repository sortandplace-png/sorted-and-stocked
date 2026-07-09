// hooks/useDraftAutosave.ts
// Autosaves in-progress form state to `form_drafts` so closing the tab or
// losing connection mid-entry doesn't cost the user their draft. Debounced
// (not per-keystroke), scoped per user + form_type + property.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const DEBOUNCE_MS = 1500;

export function useDraftAutosave<T>({
  propertyId,
  formType,
  isEmpty,
}: {
  propertyId: string;
  formType: string;
  isEmpty: (data: T) => boolean;
}) {
  const supabase = createClient();
  const [existingDraft, setExistingDraft] = useState<T | null>(null);
  const resolvedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      userIdRef.current = user.id;

      const { data } = await supabase
        .from('form_drafts')
        .select('draft_data')
        .eq('property_id', propertyId)
        .eq('user_id', user.id)
        .eq('form_type', formType)
        .maybeSingle();

      if (cancelled) return;
      if (data?.draft_data) {
        setExistingDraft(data.draft_data as T);
      } else {
        resolvedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, formType]);

  const resumeDraft = useCallback((): T | null => {
    resolvedRef.current = true;
    const draft = existingDraft;
    setExistingDraft(null);
    return draft;
  }, [existingDraft]);

  const discardDraft = useCallback(async () => {
    resolvedRef.current = true;
    setExistingDraft(null);
    const uid = userIdRef.current;
    if (!uid) return;
    await supabase
      .from('form_drafts')
      .delete()
      .eq('property_id', propertyId)
      .eq('user_id', uid)
      .eq('form_type', formType);
  }, [propertyId, formType, supabase]);

  const clearDraft = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const uid = userIdRef.current;
    if (!uid) return;
    await supabase
      .from('form_drafts')
      .delete()
      .eq('property_id', propertyId)
      .eq('user_id', uid)
      .eq('form_type', formType);
  }, [propertyId, formType, supabase]);

  // Called on every form-state change; skips writes until the resume/discard
  // prompt (if any) has been resolved, so it never clobbers an unread draft.
  const queueSave = useCallback(
    (data: T) => {
      if (!resolvedRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        const uid = userIdRef.current;
        if (!uid) return;
        if (isEmpty(data)) {
          await supabase
            .from('form_drafts')
            .delete()
            .eq('property_id', propertyId)
            .eq('user_id', uid)
            .eq('form_type', formType);
          return;
        }
        await supabase.from('form_drafts').upsert(
          {
            property_id: propertyId,
            user_id: uid,
            form_type: formType,
            draft_data: data,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'property_id,user_id,form_type' }
        );
      }, DEBOUNCE_MS);
    },
    [propertyId, formType, isEmpty, supabase]
  );

  return { existingDraft, resumeDraft, discardDraft, clearDraft, queueSave };
}
