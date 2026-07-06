// components/PropertyRoleContext.tsx
'use client';

import { createContext, useContext } from 'react';

export type PropertyRole = 'owner' | 'manager' | 'staff';

const PropertyRoleContext = createContext<PropertyRole | null>(null);

export function PropertyRoleProvider({
  role,
  children,
}: {
  role: PropertyRole;
  children: React.ReactNode;
}) {
  return <PropertyRoleContext.Provider value={role}>{children}</PropertyRoleContext.Provider>;
}

// Throws if used outside the provider — a missing role check should fail
// loudly during development, not silently show owner-level UI to everyone.
export function usePropertyRole(): PropertyRole {
  const role = useContext(PropertyRoleContext);
  if (!role) throw new Error('usePropertyRole() must be used within PropertyRoleProvider');
  return role;
}

export function canManage(role: PropertyRole): boolean {
  return role === 'owner' || role === 'manager';
}
