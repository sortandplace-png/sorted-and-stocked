// components/RetailerDefaultContext.tsx
// SS-448 per-property ruling: which retailer LEADS the cart action is a
// property-level fact (properties.default_retailer, migration 166), read
// once in the property layout and provided here so OrderLink's seven
// mounts don't each grow a fetch. Anything rendering outside a property
// layout falls back to plain Amazon-first -- the SS-448 default.
//
// SS-463: default_retailer is now text[] (migration 234), not a
// '+'-delimited scalar -- so this context now carries the array straight
// through rather than re-encoding it into a hand-rolled union type.
// OrderLink is the only place that interprets it (which retailer leads);
// this file does no interpretation of its own.
'use client';

import { createContext, useContext } from 'react';

export type RetailerDefault = string[];

const RetailerDefaultContext = createContext<RetailerDefault>(['amazon']);

export function RetailerDefaultProvider({
  value,
  children,
}: {
  value: string[] | null | undefined;
  children: React.ReactNode;
}) {
  const normalized: RetailerDefault = value && value.length > 0 ? value : ['amazon'];
  return <RetailerDefaultContext.Provider value={normalized}>{children}</RetailerDefaultContext.Provider>;
}

export function useRetailerDefault(): RetailerDefault {
  return useContext(RetailerDefaultContext);
}
