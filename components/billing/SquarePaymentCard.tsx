// components/billing/SquarePaymentCard.tsx
// SS-017: restyle of the existing Square billing section already live in
// SettingsClient.tsx (properties.square_payment_link + the send-via-
// email/sms flow, migration 118) -- purely presentational, all state and
// the actual save/send calls stay owned by the parent. Nothing here talks
// to Square's API; an owner/manager still creates the link themselves in
// their own Square Dashboard and pastes it in, same as before.
//
// Not rendered: an "amount due" or "payment terms" figure. The detailed
// spec for this card asked for both, but neither exists anywhere in this
// app's data model -- square_payment_link is just a URL, there's no
// invoice/amount/terms table behind it. Inventing one would be exactly
// the "separate payment engine" this was explicitly scoped to NOT be, so
// this shows what's real (the link itself, who it went to, when) and
// leaves that gap for a real answer rather than fabricating figures.
'use client';

import Pin from '@/components/PinAccent';

export default function SquarePaymentCard({
  squarePaymentLink,
  onLinkChange,
  savingLink,
  onSaveLink,
  lastSentAt,
  lastSentVia,
  sendChannel,
  onSendChannelChange,
  sendingPaymentLink,
  onSendPaymentLink,
}: {
  squarePaymentLink: string;
  onLinkChange: (value: string) => void;
  savingLink: boolean;
  onSaveLink: () => void;
  lastSentAt: string | null;
  lastSentVia: string | null;
  sendChannel: 'email' | 'sms';
  onSendChannelChange: (channel: 'email' | 'sms') => void;
  sendingPaymentLink: boolean;
  onSendPaymentLink: () => void;
}) {
  const hasLink = squarePaymentLink.trim().length > 0;

  return (
    <div className="relative bg-card rounded-xl3 border border-cardBorder shadow-card overflow-hidden">
      <Pin size="sm" />
      <div className="bg-denim text-white text-[10px] font-semibold tracking-[0.17em] uppercase py-[11px] px-5">
        Client Billing &amp; Invoicing
      </div>

      <div className="p-4 space-y-3">
        {hasLink ? (
          <a
            href={squarePaymentLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-2.5 rounded-xl2 bg-denim text-white text-sm font-medium text-center"
          >
            Pay via Square
          </a>
        ) : (
          <p className="text-xs text-dusk">
            No payment link on file yet -- paste one below to enable the button here and the send options.
          </p>
        )}

        <div>
          <label className="text-xs font-medium text-dusk mb-1 block">Square payment link</label>
          <input
            type="url"
            value={squarePaymentLink}
            onChange={(e) => onLinkChange(e.target.value)}
            placeholder="https://square.link/…"
            className="w-full border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-full px-4 py-2 bg-mist text-sm text-denim"
          />
          <p className="text-xs text-dusk mt-1">
            Create this in your own Square Dashboard, then paste it here -- nothing is generated automatically.
          </p>
        </div>
        <button
          onClick={onSaveLink}
          disabled={savingLink}
          className="w-full py-2 rounded-full bg-mist text-denim text-sm font-medium disabled:opacity-40"
        >
          {savingLink ? 'Saving…' : 'Save link'}
        </button>

        {hasLink && (
          <div className="pt-3 border-t border-cardBorder space-y-2">
            {lastSentAt && (
              <p className="text-xs text-dusk">
                Last sent via {lastSentVia} on {new Date(lastSentAt).toLocaleDateString()}.
              </p>
            )}
            <div className="flex rounded-full bg-mist p-1">
              <button
                onClick={() => onSendChannelChange('email')}
                className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  sendChannel === 'email' ? 'bg-card text-denim shadow-sm' : 'text-dusk'
                }`}
              >
                Email
              </button>
              <button
                onClick={() => onSendChannelChange('sms')}
                className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  sendChannel === 'sms' ? 'bg-card text-denim shadow-sm' : 'text-dusk'
                }`}
              >
                Text
              </button>
            </div>
            <button
              onClick={onSendPaymentLink}
              disabled={sendingPaymentLink}
              className="w-full py-2 rounded-full bg-denim text-white text-sm font-medium disabled:opacity-40"
            >
              {sendingPaymentLink ? 'Sending…' : `Send payment link via ${sendChannel === 'email' ? 'email' : 'text'}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
