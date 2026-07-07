'use client';

import MealPlanClient from '@/components/MealPlanClient';

interface MealPlanTabsProps {
  propertyId: string;
  initialEntries?: Array<{
    id: string;
    plan_date: string;
    meal_slot?: string;
    course?: string;
    recipes?: Array<{
      id: string;
      name: string;
      kosher_type?: string;
    }>;
    custom_name?: string;
  }>;
}

export default function MealPlanTabs({ propertyId, initialEntries = [] }: MealPlanTabsProps) {
  return (
    <div className="w-full">
      <MealPlanClient propertyId={propertyId} />
    </div>
  );
}
