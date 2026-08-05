// lib/subscribe-emails.ts
// SS-672. The two emails a subscriber receives, EN and ES, written
// together rather than English now and Spanish later. locale has been a
// NOT NULL column on email_subscribers since the table was created, and a
// list that stores a reader's language and then writes to them in English
// anyway is worse than one that never asked.
//
// NO DASHES in any copy in this file. Not em, not en. Racquel's standing
// rule for anything a reader sees on a marketing surface, and an email is
// the most marketing-facing surface there is. The CI check added for
// SS-666 covers components/ and app/; this file is lib/, so the rule is
// held here by hand and by the test that greps it.
//
// Plain inline-styled HTML, no framework. Every other Resend send in this
// codebase does the same, and email clients punish anything cleverer.

/**
 * The GATED printables, SS-686. These live in the private 'printables'
 * bucket and are reachable only through /api/download/<slug> with a signed
 * token. They are NOT in public/downloads, and must never be put there:
 * a file in public/ is served before any route or session runs, so putting
 * one back would silently ungate it with nothing to catch the mistake.
 *
 * SLUGS AND FILENAMES ARE LOAD-BEARING. The slug is signed into the
 * download token, so renaming one invalidates every link already sitting
 * in somebody's inbox. The filename is the object key in the bucket.
 *
 * ONLY THE TWO CLEAN FILES SHIP. Racquel's ruling, 5 Aug. Held out with
 * their defects recorded, because the reason each is missing is the thing
 * a future reader needs, not the fact of it:
 *   shabbos-prep      design brief printed on the artwork, the banned
 *                     phrase "stress free preparation", an em dash in the
 *                     subtitle, and it claims 8.5x11 on a 4.53x5.87 page.
 *                     SS-685.
 *   pantry-hierarchy  gibberish strip along the bottom edge, and
 *                     "INTERACTIVE FILL IN" is false: there is no text
 *                     layer, so there are no form fields. SS-687.
 *   erev-shabbos      not built. Blocked on a Rav review of the blech line
 *                     plus two false product claims.
 * Adding one back here is a two line change once its defect closes, and
 * the email, the route and the build check all pick it up from this array.
 */
export const GATED_PRINTABLES = [
  {
    slug: 'reset-day',
    file: 'reset-day.pdf',
    en: 'The Reset Day',
    es: 'El día de reinicio',
  },
  {
    slug: 'training-staff',
    file: 'training-staff.pdf',
    en: 'Training Staff',
    es: 'Capacitación del personal',
  },
] as const;

export type GatedPrintable = (typeof GATED_PRINTABLES)[number];

export type SubscribeLocale = 'en' | 'es';

/** Narrows anything stored or posted to the two locales the table allows. */
export function asSubscribeLocale(value: unknown): SubscribeLocale {
  return value === 'es' ? 'es' : 'en';
}

export type BuiltEmail = { subject: string; html: string; text: string };

const BRAND = 'Sorted &amp; Stocked';

// One shell for both emails so they cannot drift apart visually.
function shell(bodyHtml: string, footerHtml: string): string {
  return [
    '<div style="margin:0;padding:24px;background:#f6f4f0;">',
    '<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e6e1d8;border-radius:14px;padding:28px 26px;',
    'font-family:Georgia,\'Times New Roman\',serif;color:#2e4a62;line-height:1.55;">',
    bodyHtml,
    '<div style="margin-top:26px;padding-top:16px;border-top:1px solid #e6e1d8;',
    'font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#8a8378;">',
    footerHtml,
    '</div>',
    '</div>',
    '</div>',
  ].join('');
}

function button(href: string, label: string): string {
  return (
    `<a href="${href}" style="display:inline-block;background:#2e4a62;color:#ffffff;` +
    `text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;` +
    `font-weight:bold;padding:12px 22px;border-radius:10px;">${label}</a>`
  );
}

const COPY = {
  confirm: {
    en: {
      subject: 'Confirm your email',
      heading: 'One click and you are on the list',
      body:
        'You asked for new posts from Sorted &amp; Stocked. Confirm the address so we know it is really yours.',
      cta: 'Confirm my email',
      tail: 'Nothing else is sent until you do. If you did not sign up, ignore this and nothing happens.',
    },
    es: {
      subject: 'Confirma tu correo',
      heading: 'Un clic y quedas en la lista',
      body:
        'Pediste recibir las publicaciones de Sorted &amp; Stocked. Confirma la dirección para saber que es tuya.',
      cta: 'Confirmar mi correo',
      tail: 'No se envía nada más hasta que lo hagas. Si no te registraste, ignora este mensaje y no pasa nada.',
    },
  },
  // Deliberately COUNT NEUTRAL. The first draft said "four printables"
  // and two of the four were pulled the same day for design defects, which
  // would have shipped a promise of four above a list of two. The set
  // changes as defects close; the copy must not have to change with it.
  welcome: {
    en: {
      subject: 'You are in. Here are your printables',
      heading: 'You are confirmed',
      body:
        'Thank you for confirming. Your printables are below, yours to keep, whether or not you ever read another word from us.',
      tail: 'New posts arrive when we publish them. No more than that.',
    },
    es: {
      subject: 'Ya estás dentro. Aquí tienes tus imprimibles',
      heading: 'Tu correo está confirmado',
      body:
        'Gracias por confirmar. Tus imprimibles están abajo, para guardar, leas o no otra palabra nuestra.',
      tail: 'Las publicaciones nuevas llegan cuando las publicamos. Nada más que eso.',
    },
  },
  unsubscribeLink: {
    en: 'Unsubscribe',
    es: 'Cancelar la suscripción',
  },
  sentTo: {
    en: 'Sent to',
    es: 'Enviado a',
  },
  downloadsHeading: {
    en: 'Your printables',
    es: 'Tus imprimibles',
  },
} as const;

function footer(locale: SubscribeLocale, email: string, unsubscribeUrl: string): string {
  return (
    `${COPY.sentTo[locale]} ${escapeHtml(email)}.<br />` +
    `<a href="${unsubscribeUrl}" style="color:#8a8378;text-decoration:underline;">` +
    `${COPY.unsubscribeLink[locale]}</a>`
  );
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The confirmation email. ONE link to click, per SS-672. The unsubscribe
 * link in the footer is not a second ask: it is the way out for somebody
 * whose address was typed in by a stranger, and it must be in both emails.
 */
export function buildConfirmationEmail(args: {
  locale: SubscribeLocale;
  email: string;
  confirmUrl: string;
  unsubscribeUrl: string;
}): BuiltEmail {
  const { locale, email, confirmUrl, unsubscribeUrl } = args;
  const c = COPY.confirm[locale];

  const html = shell(
    [
      `<p style="margin:0 0 6px;font-size:20px;font-weight:bold;">${c.heading}</p>`,
      `<p style="margin:0 0 22px;font-size:15px;">${c.body}</p>`,
      `<p style="margin:0 0 22px;">${button(confirmUrl, c.cta)}</p>`,
      `<p style="margin:0;font-size:13px;color:#6b6459;">${c.tail}</p>`,
    ].join(''),
    footer(locale, email, unsubscribeUrl)
  );

  const text = [
    c.heading,
    '',
    stripTags(c.body),
    '',
    confirmUrl,
    '',
    c.tail,
    '',
    `${COPY.unsubscribeLink[locale]}: ${unsubscribeUrl}`,
  ].join('\n');

  return { subject: c.subject, html, text };
}

/**
 * The welcome email, sent only after confirmed_at is set. This is the one
 * that carries the printables.
 *
 * `links` is passed in already signed rather than built here: minting a
 * download token needs the subscriber id and the signing key, and this
 * module is copy, not crypto. Keeping the two apart means the email can be
 * rendered in a test without a key in the environment.
 */
export function buildWelcomeEmail(args: {
  locale: SubscribeLocale;
  email: string;
  links: { label: string; href: string }[];
  unsubscribeUrl: string;
}): BuiltEmail {
  const { locale, email, links, unsubscribeUrl } = args;
  const c = COPY.welcome[locale];

  const items = links
    .map(
      (l) =>
        `<li style="margin:0 0 10px;">` +
        `<a href="${l.href}" style="color:#2e4a62;font-weight:bold;text-decoration:underline;">` +
        `${escapeHtml(l.label)}</a></li>`
    )
    .join('');

  const html = shell(
    [
      `<p style="margin:0 0 6px;font-size:20px;font-weight:bold;">${c.heading}</p>`,
      `<p style="margin:0 0 22px;font-size:15px;">${c.body}</p>`,
      `<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;`,
      `letter-spacing:.08em;text-transform:uppercase;color:#8a8378;">`,
      `${COPY.downloadsHeading[locale]}</p>`,
      `<ul style="margin:0 0 22px;padding-left:20px;font-size:15px;">${items}</ul>`,
      `<p style="margin:0;font-size:13px;color:#6b6459;">${c.tail}</p>`,
    ].join(''),
    footer(locale, email, unsubscribeUrl)
  );

  const text = [
    c.heading,
    '',
    stripTags(c.body),
    '',
    `${COPY.downloadsHeading[locale]}:`,
    ...links.map((l) => `  ${l.label}: ${l.href}`),
    '',
    c.tail,
    '',
    `${COPY.unsubscribeLink[locale]}: ${unsubscribeUrl}`,
  ].join('\n');

  return { subject: c.subject, html, text };
}

// The copy above carries a couple of HTML entities (&amp;) because it is
// written for the HTML body; the text/plain alternative needs them back as
// characters.
function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&');
}
