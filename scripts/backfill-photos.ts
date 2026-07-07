#!/usr/bin/env node
// scripts/backfill-photos.ts
// Automated photo + reorder link backfill for 80 food & household items
// Reads 80_ITEMS_PHOTO_BACKFILL_PAYLOAD.json and fetches product data from Amazon/Walmart

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

interface BackfillItem {
  inventory_item_id: string;
  name: string;
  category: string;
  search_queries: {
    amazon?: string;
    walmart?: string;
    instacart?: string;
  };
  preferred_supplier: string;
  notes?: string;
}

interface BackfillPayload {
  metadata: {
    date: string;
    total_items: number;
    food_items: number;
    household_items: number;
    confidence_level: string;
  };
  food_items: BackfillItem[];
  household_items: BackfillItem[];
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables. Ensure .env.local has NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Mock product data fetcher — in production, integrate with actual APIs
 * For now, uses URL patterns to generate realistic Amazon/Walmart links
 */
async function fetchProductData(
  item: BackfillItem
): Promise<{ photo_url: string | null; reorder_link: string | null }> {
  const supplierKey = item.preferred_supplier.toLowerCase() as keyof typeof item.search_queries;
  const searchTerm = item.search_queries[supplierKey];

  if (!searchTerm) {
    console.log(`⚠️  No search query for ${item.preferred_supplier} — skipping`);
    return { photo_url: null, reorder_link: null };
  }

  try {
    if (item.preferred_supplier.toLowerCase() === 'amazon') {
      return await fetchAmazonProduct(searchTerm, item.name);
    } else if (item.preferred_supplier.toLowerCase() === 'walmart') {
      return await fetchWalmartProduct(searchTerm, item.name);
    } else if (item.preferred_supplier.toLowerCase() === 'local') {
      console.log(`ℹ️  ${item.name}: Local sourcing (produce/perishable) — skipping`);
      return { photo_url: null, reorder_link: null };
    }
  } catch (error) {
    console.error(`❌ Error fetching ${item.name}:`, error);
  }

  return { photo_url: null, reorder_link: null };
}

/**
 * Generate Amazon product link from search term
 * In production, this would call Amazon Product Advertising API
 */
async function fetchAmazonProduct(
  searchTerm: string,
  itemName: string
): Promise<{ photo_url: string | null; reorder_link: string | null }> {
  // Encode search term for Amazon
  const encodedSearch = encodeURIComponent(searchTerm);
  const reorderLink = `https://www.amazon.com/s?k=${encodedSearch}`;

  console.log(`✅ ${itemName}: Amazon → ${reorderLink}`);

  // Photo URL would come from API; using placeholder for now
  return {
    photo_url: null, // Would be populated from API
    reorder_link: reorderLink,
  };
}

/**
 * Generate Walmart product link from search term
 * In production, this would call Walmart API
 */
async function fetchWalmartProduct(
  searchTerm: string,
  itemName: string
): Promise<{ photo_url: string | null; reorder_link: string | null }> {
  const encodedSearch = encodeURIComponent(searchTerm);
  const reorderLink = `https://www.walmart.com/search?q=${encodedSearch}`;

  console.log(`✅ ${itemName}: Walmart → ${reorderLink}`);

  return {
    photo_url: null,
    reorder_link: reorderLink,
  };
}

/**
 * Look up inventory item by name to get actual UUID
 */
async function lookupInventoryItemByName(itemName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id')
    .ilike('item_name', `%${itemName}%`)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data.id;
}

/**
 * Update inventory item with photo_url and reorder_link
 */
async function updateInventoryItem(
  inventoryItemId: string,
  photoUrl: string | null,
  reorderLink: string | null,
  itemName: string
): Promise<boolean> {
  // If ID doesn't look like a UUID, try to look it up by name
  if (!inventoryItemId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    const realId = await lookupInventoryItemByName(itemName);
    if (!realId) {
      console.log(`   ⚠️  Could not find inventory item in database`);
      return false;
    }
    inventoryItemId = realId;
  }

  const updateData: Record<string, string | null> = {};

  if (reorderLink) {
    updateData.reorder_link = reorderLink;
  }
  if (photoUrl) {
    updateData.photo_url = photoUrl;
  }

  if (Object.keys(updateData).length === 0) {
    return false; // No update needed
  }

  const { error } = await supabase
    .from('inventory_items')
    .update(updateData)
    .eq('id', inventoryItemId);

  if (error) {
    console.error(`❌ Database update error for ${itemName}:`, error.message);
    return false;
  }

  return true;
}

/**
 * Main backfill loop
 */
async function runBackfill() {
  console.log('🚀 Starting photo + reorder link backfill...\n');

  // Load payload
  const payloadPath = path.join(process.cwd(), '80_ITEMS_PHOTO_BACKFILL_PAYLOAD.json');

  if (!fs.existsSync(payloadPath)) {
    console.error(`❌ Payload file not found: ${payloadPath}`);
    process.exit(1);
  }

  const payload: BackfillPayload = JSON.parse(fs.readFileSync(payloadPath, 'utf-8'));
  const allItems = [...payload.food_items, ...payload.household_items];

  console.log(`📦 Processing ${allItems.length} items...\n`);

  let successCount = 0;
  let skipCount = 0;

  for (const item of allItems) {
    console.log(`📍 Processing: ${item.name}`);

    const { photo_url, reorder_link } = await fetchProductData(item);

    if (photo_url || reorder_link) {
      const updated = await updateInventoryItem(item.inventory_item_id, photo_url, reorder_link, item.name);
      if (updated) {
        successCount++;
        console.log(`   ✅ Updated in database\n`);
      } else {
        console.log(`   ⚠️  No changes to persist\n`);
      }
    } else {
      skipCount++;
      console.log(`   ⏭️  Skipped\n`);
    }

    // Rate limiting: 500ms between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n📊 Backfill Complete:`);
  console.log(`   ✅ Updated: ${successCount} items`);
  console.log(`   ⏭️  Skipped: ${skipCount} items`);
  console.log(`   📦 Total: ${allItems.length} items`);
}

runBackfill().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
