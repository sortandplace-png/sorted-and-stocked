// components/ConsoleTestFlightCard.tsx
// SS-436 both-yes ruling (2 Aug, b): the TestFlight invite, reachable
// from the console -- emphatic yes. Sits in PEOPLE beside the
// invite-by-email card. The link is lib/testflight.ts's single source
// (shared with the homepage hero and the invite email), so it can never
// drift. Copy + share actions; "beta" appears nowhere, per the standing
// homepage brief. English-only (SS-436 carve-out).
'use client';

import { useState } from 'react';
import { TESTFLIGHT_URL } from '@/lib/testflight';
import { useToast } from '@/components/Toast';

export default function ConsoleTestFlightCard() {
  const showToast = useToast();
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(TESTFLIGHT_URL);
      setCopied(true);
      showToast('TestFlight link copied.', { variant: 'success' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Could not copy. Long-press the link instead.', { variant: 'error' });
    }
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Sorted & Stocked', url: TESTFLIGHT_URL });
      } catch {
        // Share sheet dismissed -- not an error.
      }
    } else {
      copyLink();
    }
  }

  return (
    <div className="border border-cardBorder rounded-xl2 bg-card p-4 space-y-2.5">
      <div>
        <p className="text-sm font-medium text-denim">iPhone app invite</p>
        <p className="text-xs text-dusk">
          The install link for the iPhone app. Same link the invite email carries. iPhone only, requires the
          TestFlight app.
        </p>
      </div>
      <a
        href={TESTFLIGHT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-xs text-denim underline underline-offset-2 break-all"
      >
        {TESTFLIGHT_URL}
      </a>
      <div className="flex gap-2">
        <button
          onClick={copyLink}
          className="text-xs font-medium text-white bg-denim px-4 py-2 rounded-full"
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <button
          onClick={shareLink}
          className="text-xs font-medium text-denim border border-brass/30 bg-mist px-4 py-2 rounded-full"
        >
          Share
        </button>
      </div>
    </div>
  );
}
