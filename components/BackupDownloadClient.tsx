// components/BackupDownloadClient.tsx
// SS-092. One button, one action: fetch the zip, hand it to the browser as
// a real file download. No preview, no table-by-table picker -- the whole
// point of a "no recovery path" backup is that it is simple enough nobody
// has to think about it before something has already gone wrong.
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import BackLink from '@/components/ui/BackLink';

export default function BackupDownloadClient({ propertyId }: { propertyId: string }) {
  const t = useTranslations('backup');
  const [status, setStatus] = useState<'idle' | 'downloading' | 'error'>('idle');

  async function download() {
    setStatus('downloading');
    try {
      const res = await fetch(`/api/tools/backup?propertyId=${encodeURIComponent(propertyId)}`);
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Backup failed.');

      // Read the real filename off the response rather than inventing one
      // client-side -- the API route names it with the property name and
      // today's date, and duplicating that logic here would be a second
      // place for the two to drift apart.
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? t('fallbackFilename');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <BackLink fallbackHref={`/properties/${propertyId}/dashboard`} />
      <h1 className="text-2xl font-display text-denim mb-1">{t('title')}</h1>
      <p className="text-sm text-dusk mb-5">{t('subtitle')}</p>

      <div className="bg-card border border-cardBorder rounded-xl3 shadow-card p-5">
        <p className="text-sm text-denim mb-4">{t('body')}</p>
        <button
          onClick={download}
          disabled={status === 'downloading'}
          className="w-full py-3 rounded-full bg-denim text-white font-medium disabled:opacity-40"
        >
          {status === 'downloading' ? t('preparing') : t('downloadButton')}
        </button>
        {status === 'error' && <p className="text-xs text-rust mt-3 text-center">{t('error')}</p>}
      </div>
    </div>
  );
}
