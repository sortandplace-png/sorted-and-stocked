import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type UserRole = 'owner' | 'manager' | 'staff' | 'viewer';

export function usePropertyRole(propertyId: string) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('property_users')
        .select('role')
        .eq('property_id', propertyId)
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setRole(data.role as UserRole);
      }
      setLoading(false);
    };

    fetchRole();
  }, [propertyId]);

  const hasPermission = (action: string, resource: string): boolean => {
    if (!role) return false;

    const permissions: Record<UserRole, { action: string; resource: string }[]> = {
      owner: [
        { action: 'create', resource: 'inventory_items' },
        { action: 'update', resource: 'inventory_items' },
        { action: 'delete', resource: 'inventory_items' },
        { action: 'create', resource: 'shopping_lists' },
        { action: 'manage', resource: 'users' },
        { action: 'manage', resource: 'property_settings' },
        { action: 'view', resource: 'analytics' },
        { action: 'activate', resource: 'shabbos_mode' }
      ],
      manager: [
        { action: 'create', resource: 'inventory_items' },
        { action: 'update', resource: 'inventory_items' },
        { action: 'create', resource: 'shopping_lists' },
        { action: 'view', resource: 'analytics' },
        { action: 'activate', resource: 'shabbos_mode' }
      ],
      staff: [
        { action: 'create', resource: 'inventory_items' },
        { action: 'update', resource: 'inventory_items' },
        { action: 'create', resource: 'shopping_list_items' },
        { action: 'update', resource: 'shopping_list_items' }
      ],
      viewer: [
        { action: 'view', resource: 'inventory_items' },
        { action: 'view', resource: 'shopping_lists' }
      ]
    };

    return permissions[role]?.some(
      p => p.action === action && p.resource === resource
    ) ?? false;
  };

  return { role, loading, hasPermission };
}
