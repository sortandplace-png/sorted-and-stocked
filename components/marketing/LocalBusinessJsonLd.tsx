// components/marketing/LocalBusinessJsonLd.tsx
// Schema.org LocalBusiness, emitted verbatim as supplied.
//
// Rendered from a server component so the script tag is in the HTML the
// crawler receives. Googlebot does execute JS, but structured data added
// after hydration is read less reliably than markup present on first
// response -- and this exists solely to be read by a crawler.
//
// One object, one place: every marketing page renders this same component
// rather than repeating the literal, so the phone number and address cannot
// drift between pages and disagree with each other.
const LOCAL_BUSINESS = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Sort + Place',
  // telephone removed on the SS-454/SS-434 zero-numbers ruling. Known NAP
  // tradeoff, accepted: a LocalBusiness schema without a phone weakens
  // Google's name/address/phone consistency signal for local ranking --
  // but a schema number the visible site never shows is itself the NAP
  // inconsistency SS-434 flagged. Email is the public contact channel.
  email: 'SortandPlace@gmail.com',
  url: 'https://sortandplace.com',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Lakewood',
    addressRegion: 'NJ',
  },
  areaServed: ['Lakewood NJ', 'Ocean County NJ'],
};

export default function LocalBusinessJsonLd() {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify of a literal we control -- no user input reaches this,
      // and the values contain no characters needing script-context escaping.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(LOCAL_BUSINESS) }}
    />
  );
}
