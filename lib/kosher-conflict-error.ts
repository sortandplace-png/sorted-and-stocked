// lib/kosher-conflict-error.ts
// enforce_recipe_kosher_type (BEFORE INSERT OR UPDATE ON recipe_ingredients)
// raises a real Postgres exception when a linked inventory item's kosher_type
// conflicts with its recipe's (e.g. a Dairy item on a Meat recipe). The raw
// message is technically accurate but references the item by UUID and reads
// like a database error, not something to show a real person. This turns it
// into the friendly version wherever recipe_ingredients gets an
// inventory_item_id set -- the one thing the trigger doesn't provide is
// which specific item name was rejected, so callers pass that in themselves
// (they already know it; it's whatever they were trying to link).
const PATTERN = /recipe is (\w+) but ingredient \([^)]*\) is (\w+)/i;

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function friendlyKosherConflictMessage(rawMessage: string, itemName: string): string | null {
  const match = PATTERN.exec(rawMessage);
  if (!match) return null;
  const [, recipeType, itemType] = match;
  return `Can't add ${itemName} to this recipe: it's ${capitalize(itemType)} and this recipe is ${capitalize(recipeType)}.`;
}
