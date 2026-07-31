// app/properties/[id]/staff/card/page.tsx
// SS-411 follow-on: the printable staff card, in-app under the Staff area.
// Content is static and bilingual-inline (see StaffCardPrint.tsx), so
// there is nothing to fetch here beyond what the shared layout already
// gates (auth + membership).
import StaffCardPrint from '@/components/StaffCardPrint';

export const metadata = {
  title: 'Tarjeta del Personal · Staff Card — Sorted & Stocked',
};

export default function StaffCardPage() {
  return <StaffCardPrint />;
}
