// lib/subscribe-token.ts
// SERVER-ONLY. Signed, stateless tokens for the two links that leave in a
// subscriber email: confirm and unsubscribe (SS-672).
//
// Stateless on purpose. The alternative is a token column on
// email_subscribers, which means a write on every send, a second write on
// every click, and a nullable column that is meaningless for most rows.
// An HMAC over the address carries the same guarantee with no schema at
// all: only this server can mint a link, and the link cannot be edited to
// point at somebody else's address.
//
// The key is DERIVED from the service-role key rather than being it. The
// service-role key is already required for these routes to function, so
// deriving costs no new deployment step, and one HMAC of separation means
// a signing key that never equals a live database credential. Set
// SUBSCRIBE_TOKEN_SECRET to take it off that derivation entirely.
//
// Rotating either secret invalidates every unclicked confirm link in
// flight. That is the intended trade: those links are cheap to reissue
// (signing up again resends), and a token that outlives a key rotation is
// the thing you do not want.
import { createHmac, timingSafeEqual } from 'crypto';

// 'download' (SS-686) opens ONE gated printable for ONE subscriber. It is
// a third purpose on this same verifier rather than a second verifier,
// because the forged / expired / wrong-purpose rejections below are
// already the hard part and duplicating them is how the two copies drift.
export type TokenPurpose = 'confirm' | 'unsubscribe' | 'download';

// A confirmation link is an invitation, not a credential, but it should
// not stay live forever -- an address that signed up in March and clicks
// in December is better served by signing up again than by a link that
// silently still works. Unsubscribe NEVER expires: a dead unsubscribe link
// in an old email is how you become a spam complaint.
const CONFIRM_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// A download link lives in an email the reader keeps, so it outlives the
// confirmation link by a wide margin. It is still finite: an emailed link
// that works forever is one forwarded link away from being a public URL,
// which is the exact thing SS-686 exists to stop.
const DOWNLOAD_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function signingKey(): string {
  const explicit = process.env.SUBSCRIBE_TOKEN_SECRET;
  if (explicit) return explicit;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      'subscribe-token: neither SUBSCRIBE_TOKEN_SECRET nor SUPABASE_SERVICE_ROLE_KEY is set'
    );
  }
  return createHmac('sha256', serviceKey).update('sns-subscribe-token-v1').digest('hex');
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// e = email (confirm / unsubscribe). i = subscriber id and s = file slug
// (download). One shape, so one signature check covers all three purposes.
type Payload = { e?: string; i?: string; s?: string; p: TokenPurpose; t: number };

/**
 * Signature, purpose and expiry. Everything that decides whether a token
 * is real lives here exactly once; the exported verifiers below only read
 * fields out of an already-trusted payload.
 */
function verifyRaw(token: string, purpose: TokenPurpose): Payload | null {
  if (!token || typeof token !== 'string') return null;

  const dot = token.indexOf('.');
  if (dot < 1 || dot === token.length - 1) return null;

  const body = token.slice(0, dot);
  const provided = fromB64url(token.slice(dot + 1));
  const expected = createHmac('sha256', signingKey()).update(body).digest();

  // Length check first: timingSafeEqual throws on a length mismatch rather
  // than returning false.
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  let payload: Payload;
  try {
    payload = JSON.parse(fromB64url(body).toString('utf8'));
  } catch {
    return null;
  }

  // Purpose is inside the signed body, so an unsubscribe token cannot be
  // replayed against confirm, and neither can be replayed against a
  // download.
  if (payload.p !== purpose) return null;
  if (typeof payload.t !== 'number' || !Number.isFinite(payload.t)) return null;

  const ttl = purpose === 'confirm' ? CONFIRM_TTL_MS : purpose === 'download' ? DOWNLOAD_TTL_MS : null;
  if (ttl !== null && Date.now() - payload.t > ttl) return null;

  return payload;
}

export function signSubscribeToken(email: string, purpose: TokenPurpose): string {
  // The address is normalised into the payload, so a token minted for
  // "Reader@Example.com" verifies for the row stored as
  // "reader@example.com" and the two can never disagree.
  const payload: Payload = { e: email.trim().toLowerCase(), p: purpose, t: Date.now() };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac('sha256', signingKey()).update(body).digest());
  return `${body}.${sig}`;
}

/**
 * Returns the normalised address the token was minted for, or null if the
 * token is malformed, forged, for the wrong purpose, or expired. Callers
 * get one boolean-ish answer and cannot accidentally trust a payload whose
 * signature was never checked.
 */
export function verifySubscribeToken(token: string, purpose: TokenPurpose): string | null {
  const payload = verifyRaw(token, purpose);
  if (!payload) return null;
  if (typeof payload.e !== 'string' || !payload.e) return null;
  return payload.e;
}

/**
 * SS-686. Opens exactly one printable for exactly one subscriber.
 *
 * The slug is INSIDE the signed body, which is the whole reason a token
 * for reset-day cannot open training-staff: changing the slug in the URL
 * changes the body, and the signature no longer matches.
 */
export function signDownloadToken(subscriberId: string, slug: string): string {
  const payload: Payload = { i: subscriberId, s: slug, p: 'download', t: Date.now() };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac('sha256', signingKey()).update(body).digest());
  return `${body}.${sig}`;
}

/**
 * Returns the subscriber id the token was minted for, or null. The caller
 * passes the slug it is actually about to serve, and a token minted for a
 * different file is rejected here rather than in the route, so the check
 * cannot be forgotten at a call site.
 */
export function verifyDownloadToken(token: string, slug: string): string | null {
  const payload = verifyRaw(token, 'download');
  if (!payload) return null;
  if (typeof payload.i !== 'string' || !payload.i) return null;
  if (typeof payload.s !== 'string' || payload.s !== slug) return null;
  return payload.i;
}
