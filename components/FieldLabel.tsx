// components/FieldLabel.tsx
// Shared static label for form fields that previously relied on placeholder
// text alone (which disappears once the user starts typing). Matches the
// style already used in InventoryClient.tsx's local FieldLabel.
export default function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-charcoal/60 mb-1">{children}</label>;
}
