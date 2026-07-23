// lib/email-template.ts
// Shared visual shell for Next.js-side transactional emails (invite emails,
// future ones sent from API routes). The weekly-digest Edge Function can't
// import this directly (it runs on Deno, this app runs on Node), so it
// keeps its own copy of the same wrapper markup/colors -- "reuse the
// pattern" across those two runtimes means "keep them visually identical,"
// not a literal shared module.
// SS-200: mist page wash behind a bordered card panel, matching how the
// app itself composes bg-mist page backgrounds with bg-card foreground
// surfaces -- not a color invented for email alone.
export function emailShell(title: string, bodyHtml: string) {
  return `
  <div style="font-family:Georgia,serif;background:#E8EEF6;padding:24px;">
    <div style="background:#FFFEFC;border:1px solid #E8DDD0;border-radius:16px;padding:24px;max-width:600px;margin:0 auto;">
      <h1 style="color:#2E4A62;font-size:22px;">${title}</h1>
      ${bodyHtml}
    </div>
  </div>`;
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
