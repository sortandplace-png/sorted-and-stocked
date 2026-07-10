import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useShelfAuditor(initialItems: any[], onComplete: () => void) {
  const [items, setItems] = useState(initialItems);
  const [currentIndex, setCurrentIndex] = useState(0);
  const supabase = createClient();

  const activeItem = items[currentIndex];

  const auditCurrentItem = async (status: 'VERIFIED' | 'DEPLETED') => {
    if (!activeItem) return;

    const currentTimestamp = new Date().toISOString();

    if (status === 'VERIFIED') {
      // Confirm stock count matches reality
      await supabase
        .from('inventory_items')
        .update({ last_counted_at: currentTimestamp })
        .eq('id', activeItem.id);
    } else {
      // Mark down to zero and trigger shopping list entry
      await supabase
        .from('inventory_items')
        .update({ current_qty: 0, last_counted_at: currentTimestamp })
        .eq('id', activeItem.id);

      // Add to shopping list if it's a staple. Supabase's query builder is
      // thenable but not a real Promise instance, so .catch() chained
      // directly on it doesn't type-check -- try/catch around the await
      // is the correct equivalent, same "if RPC fails, just continue"
      // behavior.
      try {
        await supabase.rpc('add_staple_to_shopping_list', {
          p_shopping_list_id: activeItem.shopping_list_id,
          p_staple_id: activeItem.id
        });
      } catch {
        // If RPC fails (not a staple), just continue
      }
    }

    // Advance to next item or complete
    if (currentIndex + 1 >= items.length) {
      onComplete();
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  return {
    activeItem,
    progressText: `${currentIndex + 1} of ${items.length}`,
    percentComplete: items.length > 0 ? Math.round(((currentIndex + 1) / items.length) * 100) : 0,
    confirmStock: () => auditCurrentItem('VERIFIED'),
    flagEmpty: () => auditCurrentItem('DEPLETED')
  };
}
