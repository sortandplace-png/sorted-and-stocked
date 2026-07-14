// components/ToolModal.tsx
'use client';

import { X } from 'lucide-react';
import PhotoToolClient from '@/components/PhotoToolClient';
import IngredientScannerClient from '@/components/IngredientScannerClient';
import PantryZonesClient from '@/components/PantryZonesClient';
import BorrowedItemsClient from '@/components/BorrowedItemsClient';
import DuplicateIngredientsClient from '@/components/DuplicateIngredientsClient';
import PhotoReviewClient from '@/components/PhotoReviewClient';
import HouseholdKnowledgeClient from '@/components/HouseholdKnowledgeClient';
import HouseholdContactsClient from '@/components/HouseholdContactsClient';
import LocalFoodDirectoryClient from '@/components/LocalFoodDirectoryClient';
import HalachicCalendarClient from '@/components/HalachicCalendarClient';
import CapturePhotoClient from '@/components/CapturePhotoClient';
import LinkCapturedPhotosClient from '@/components/LinkCapturedPhotosClient';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';

export type ToolModalSlug =
  | 'price-scanner'
  | 'ingredient-scanner'
  | 'recipe-stealer'
  | 'pantry-zones'
  | 'borrowed-items'
  | 'duplicate-ingredients'
  | 'photo-review'
  | 'knowledge-base'
  | 'contacts'
  | 'takeout-directory'
  | 'halachic-calendar'
  | 'capture-photo'
  | 'link-captured-photos';

// Same modal shell as KitchenOpsToolModal (its own established, verified
// pattern) applied to the Scanners / Inventory Ops / Household groups --
// each of these already renders its own <h1>, so no second header here.
export default function ToolModal({
  slug,
  propertyId,
  onClose,
}: {
  slug: ToolModalSlug;
  propertyId: string;
  onClose: () => void;
}) {
  const role = usePropertyRole();

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-[2rem] sm:rounded-2xl max-h-[85vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center text-charcoal/50 hover:text-charcoal z-10"
        >
          <X size={20} strokeWidth={1.75} />
        </button>

        {slug === 'price-scanner' && (
          <PhotoToolClient
            propertyId={propertyId}
            title="Price Scanner"
            description="Photograph or type in a product to find a cheaper equivalent."
            apiRoute="/api/tools/price-scanner"
            actionLabel="Take or upload a photo"
            textPlaceholder="e.g. Heinz Tomato Ketchup 32oz"
          />
        )}
        {slug === 'recipe-stealer' && (
          <PhotoToolClient
            propertyId={propertyId}
            title="Recipe Scanner"
            description="Photograph or describe a dish to get a home-cookable version."
            apiRoute="/api/tools/recipe-stealer"
            actionLabel="Take or upload a photo of a dish"
            textPlaceholder="e.g. Cheesecake Factory's Louisiana chicken pasta"
          />
        )}
        {slug === 'ingredient-scanner' && <IngredientScannerClient propertyId={propertyId} />}
        {slug === 'pantry-zones' && <PantryZonesClient propertyId={propertyId} />}
        {slug === 'borrowed-items' && <BorrowedItemsClient propertyId={propertyId} />}
        {slug === 'duplicate-ingredients' && <DuplicateIngredientsClient propertyId={propertyId} />}
        {slug === 'photo-review' &&
          (canManage(role) ? (
            <PhotoReviewClient propertyId={propertyId} hideBackLink />
          ) : (
            <p className="p-5 text-sm text-charcoal/50">Only an owner or manager can use this tool.</p>
          ))}
        {slug === 'knowledge-base' && <HouseholdKnowledgeClient propertyId={propertyId} />}
        {slug === 'contacts' && <HouseholdContactsClient propertyId={propertyId} />}
        {slug === 'takeout-directory' && <LocalFoodDirectoryClient propertyId={propertyId} />}
        {slug === 'halachic-calendar' && <HalachicCalendarClient />}
        {slug === 'capture-photo' && <CapturePhotoClient propertyId={propertyId} />}
        {slug === 'link-captured-photos' &&
          (canManage(role) ? (
            <LinkCapturedPhotosClient propertyId={propertyId} />
          ) : (
            <p className="p-5 text-sm text-charcoal/50">Only an owner or manager can use this tool.</p>
          ))}
      </div>
    </div>
  );
}
