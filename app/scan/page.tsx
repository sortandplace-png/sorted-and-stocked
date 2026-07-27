// app/scan/page.tsx
// This route used to be a standalone prototype scanner that wrote directly to
// inventory_items with a HARDCODED Strauss property_id. With Lax live as a
// separate client, every scan from here wrote into the wrong household -- a
// real cross-tenant data bug, not a cosmetic one.
//
// It cannot be "scoped to the active property" in place, because a root-level
// /scan has no property context at all. The real, property-scoped scanner
// already exists at /properties/[id]/scan (ScanClient), so this redirects to
// the property picker rather than keeping a second, unscoped implementation
// alive. Removing it also drops ~190 lines that built their own Supabase
// client instead of using lib/supabase/client and surfaced errors via alert().
//
// The only inbound link was app/staff/page.tsx, which is itself not linked
// from anywhere in the app.
import { redirect } from 'next/navigation';

export default function ScanPage() {
  redirect('/properties');
}
