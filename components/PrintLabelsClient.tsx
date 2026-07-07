// components/PrintLabelsClient.tsx
// Requires: npm install jspdf qrcode
// Rebuilt per direct feedback: labels are now per INVENTORY ITEM (with photo),
// not per storage location. Layout: Avery 22807 (20 labels/sheet, 4x5 grid of 2"×2" squares).
'use client';

import { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';

type Item = {
  id: string;
  name: string;
  qr_code: string;
  photo_url: string | null;
};

const AVERY_22807 = {
  cols: 4,
  rows: 5,
  labelWidth: 2,
  labelHeight: 2,
  marginLeft: 0.25,
  marginTop: 0.5,
  colGap: 0,
  rowGap: 0,
};

// Plain Drive "file/.../view" links can't be embedded as images. Drive's
// thumbnail endpoint can be hotlinked as an <img> src, so it's treated as
// valid here — but note this PDF path uses fetch() to pull the bytes for
// jsPDF, which is more CORS-restrictive than a plain <img> tag. It may
// still silently skip the photo (see loadImageAsDataUrl's catch below)
// even for a URL this function accepts.
function isDirectImageUrl(url: string) {
  if (url.includes('drive.google.com/thumbnail')) return true;
  return /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url) && !url.includes('drive.google.com');
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    // CORS-blocked or unreachable — skip the photo for this one label
    // rather than failing the whole PDF.
    return null;
  }
}

export default function PrintLabelsClient({ propertyId }: { propertyId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showToast = useToast();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase
      .from('inventory_items')
      .select('id, name, qr_code, photo_url')
      .eq('property_id', propertyId)
      .order('name')
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setError(fetchError.message);
          setLoading(false);
          return;
        }
        setItems(data ?? []);
        setSelected(new Set((data ?? []).map((i) => i.id)));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll(value: boolean) {
    setSelected(value ? new Set(items.map((i) => i.id)) : new Set());
  }

  async function generatePdf() {
    setGenerating(true);
    setError(null);
    try {
      const toPrint = items.filter((i) => selected.has(i.id));
      const doc = new jsPDF({ unit: 'in', format: 'letter' });
      const t = AVERY_22807;
      const perPage = t.cols * t.rows;

      for (let i = 0; i < toPrint.length; i++) {
        const item = toPrint[i];
        const posOnPage = i % perPage;
        if (i > 0 && posOnPage === 0) doc.addPage();

        const col = posOnPage % t.cols;
        const row = Math.floor(posOnPage / t.cols);
        const x = t.marginLeft + col * (t.labelWidth + t.colGap);
        const y = t.marginTop + row * (t.labelHeight + t.rowGap);

        const qrDataUrl = await QRCode.toDataURL(item.qr_code, { margin: 0 });
        const qrSize = 0.6;

        // Square label layout: photo at top-center, QR at bottom-left, name at bottom-right
        let photoData: string | null = null;
        if (item.photo_url && isDirectImageUrl(item.photo_url)) {
          photoData = await loadImageAsDataUrl(item.photo_url);
        }

        // Photo at top center (0.8" × 0.8")
        if (photoData) {
          const photoSize = 0.8;
          const photoCenterX = x + (t.labelWidth - photoSize) / 2;
          doc.addImage(photoData, photoCenterX, y + 0.1, photoSize, photoSize);
        }

        // QR code at bottom-left
        doc.addImage(qrDataUrl, 'PNG', x + 0.08, y + t.labelHeight - qrSize - 0.08, qrSize, qrSize);

        // Item name at bottom-right of QR
        doc.setFontSize(7);
        doc.setTextColor(0);
        const nameX = x + qrSize + 0.18;
        const nameY = y + t.labelHeight - 0.3;
        doc.text(item.name, nameX, nameY, { maxWidth: t.labelWidth - qrSize - 0.3 });

        // Human-readable code below name — a fallback for when a QR won't scan
        doc.setFontSize(4.5);
        doc.setTextColor(150);
        doc.text(item.qr_code, nameX, y + t.labelHeight - 0.08, {
          maxWidth: t.labelWidth - qrSize - 0.3,
        });
        doc.setTextColor(0);
      }

      doc.save(`item-labels-${propertyId}.pdf`);
      showToast(`Generated ${toPrint.length} label${toPrint.length === 1 ? '' : 's'}.`, {
        variant: 'success',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate PDF.';
      setError(message);
      showToast('Failed to generate PDF.', { variant: 'error' });
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <SkeletonList rows={5} />;

  const photoCount = items.filter((i) => i.photo_url && isDirectImageUrl(i.photo_url)).length;

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-aubergine mb-1">Print Item Labels</h1>
      <p className="text-sm text-ink/50 mb-1">
        Avery 22807 (2"×2" squares) · 20 labels per sheet · one label per item, with photo where available.
      </p>
      {items.length > 0 && (
        <p className="text-xs text-ink/40 mb-4">
          {photoCount} of {items.length} items have a usable photo — the rest print QR + name only.
        </p>
      )}

      {error && (
        <p className="text-sm text-rust bg-rust/10 rounded-xl px-3 py-2 mb-3">{error}</p>
      )}

      <div className="flex justify-end gap-3 mb-2 text-xs">
        <button onClick={() => selectAll(true)} className="text-aubergine underline">
          Select all
        </button>
        <button onClick={() => selectAll(false)} className="text-aubergine underline">
          Clear
        </button>
      </div>

      <ul className="divide-y divide-gold-light/30 rounded-2xl bg-white shadow-sm shadow-aubergine/5 mb-4 overflow-hidden max-h-[50vh] overflow-y-auto">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={() => toggle(item.id)}
              className="h-5 w-5 accent-aubergine rounded"
            />
            <span className="flex-1 text-ink truncate">{item.name}</span>
            {item.photo_url && isDirectImageUrl(item.photo_url) && (
              <span className="text-xs text-sage">📷</span>
            )}
          </li>
        ))}
      </ul>

      {items.length === 0 && (
        <p className="text-sm text-ink/40 text-center mt-8">
          No items yet — add some in Inventory first.
        </p>
      )}

      <button
        onClick={generatePdf}
        disabled={generating || selected.size === 0}
        className="w-full py-3 rounded-full bg-aubergine text-cream font-medium disabled:opacity-40"
      >
        {generating ? 'Generating…' : `Generate PDF (${selected.size} labels)`}
      </button>
    </div>
  );
}
