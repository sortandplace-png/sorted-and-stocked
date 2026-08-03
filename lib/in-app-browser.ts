// lib/in-app-browser.ts — SS-562.
// Google blocks OAuth inside embedded webviews by policy, so the sign-in
// button must hand off to a real browser rather than attempt OAuth in
// place. This module answers one question: is this page running inside an
// in-app browser (WhatsApp, Instagram, Facebook, a WKWebView...)?
//
// FAIL OPEN, NOT CLOSED (spec rule): if detection is uncertain, return
// false and show the normal Google path. A false positive hides a working
// path; a false negative just reproduces today's behaviour.
//
// One deliberate deviation from the spec's literal snippet, in service of
// its own fail-open rule: the spec's third Android clause, read literally,
// also matches real non-Chrome Android browsers (Firefox for Android
// carries neither "Chrome" nor "wv"), which would show the breakout notice
// inside a browser where OAuth works — a false positive by the spec's own
// definition. Implemented as the two genuine Android WebView signatures
// instead: the modern "wv" token, and the legacy "Version/x.y ... Chrome"
// prefix that real Chrome never sends.

export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';

  // Explicit in-app browser signatures.
  const named = /FBAN|FBAV|Instagram|Line\/|Twitter|WhatsApp|Snapchat|LinkedInApp|MicroMessenger|GSA\//i;
  if (named.test(ua)) return true;

  // iOS WKWebView without Safari: an embedded view, not the browser.
  const iOS = /iPhone|iPad|iPod/i.test(ua);
  if (iOS && !/Safari/i.test(ua)) return true;

  // Android WebView: the modern "wv" token, or the legacy
  // Version/x.y-before-Chrome signature that real Chrome never sends.
  if (/Android/i.test(ua) && (/\bwv\b/i.test(ua) || /Version\/[\d.]+.*Chrome/i.test(ua))) {
    return true;
  }

  return false;
}

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

// The URL staff arrive at from a WhatsApp link — the spec pins the app
// hostname rather than deriving it, since this handoff exists for exactly
// that entry path. ?via=external marks the breakout hop.
export const BREAKOUT_TARGET = 'https://app.sortandplace.com/login?via=external';

// Android: an intent URL hands off to Chrome directly — a real one-tap fix.
export const ANDROID_INTENT_URL =
  'intent://app.sortandplace.com/login?via=external#Intent;scheme=https;package=com.android.chrome;end';
