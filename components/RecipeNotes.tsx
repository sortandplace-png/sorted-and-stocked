// components/RecipeNotes.tsx
// Distinct from RecipeFamilyNotes (family-authored, "things only the
// family would know") -- this is real cooking information extracted from
// the original recipe import (freeze-ahead instructions, yields, embedded
// sub-recipes), sourced from recipes.notes. Compact and read-only: this
// isn't a new authoring surface, just a real place for content that used
// to be stuck in instructions_en to actually be seen. Renders nothing when
// empty, so recipes with no extracted notes don't show a dead card.
export default function RecipeNotes({ notes }: { notes: string | null }) {
  // Same literal token lib/recipe-provenance.ts's classifyProvenance()
  // checks for -- an internal placeholder from the recipe import batch,
  // never real content. Showing it verbatim reads as a real note to
  // anyone viewing the recipe, staff included.
  if (!notes || !notes.trim() || notes === 'placeholder-fill-batch2') return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
      <h2 className="font-display text-lg text-denim mb-2">Notes</h2>
      <p className="text-sm text-dusk whitespace-pre-wrap">{notes}</p>
    </div>
  );
}
