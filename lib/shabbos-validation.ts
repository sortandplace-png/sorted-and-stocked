/**
 * Shabbos & Yom Tov validation utilities
 *
 * Ensures recipes marked is_shabbos_only=true are only assigned to:
 * 1. Friday or Saturday (dow 5 or 6), OR
 * 2. Yom Tov dates (via Hebcal API)
 */

export type HebcalItem = {
  title: string;
  date: string;
  category?: string;
  yomtov?: boolean;
};

/**
 * Fetch Yom Tov dates for a given date range from Hebcal API
 * @param startDate YYYY-MM-DD format
 * @param endDate YYYY-MM-DD format
 * @returns Set of Yom Tov date strings (YYYY-MM-DD)
 */
export async function getYomTovDates(
  startDate: string,
  endDate: string
): Promise<Set<string>> {
  const yomTovSet = new Set<string>();

  try {
    const url = new URL('https://www.hebcal.com/hebcal');
    url.searchParams.set('cfg', 'json');
    url.searchParams.set('v', '1');
    url.searchParams.set('maj', 'on'); // Major holidays
    url.searchParams.set('min', 'off');
    url.searchParams.set('mod', 'off');
    url.searchParams.set('mf', 'on'); // Minor fasts
    url.searchParams.set('ss', 'off');
    url.searchParams.set('nx', 'off');
    url.searchParams.set('start', startDate);
    url.searchParams.set('end', endDate);

    const response = await fetch(url.toString());
    const data = (await response.json()) as { items?: HebcalItem[] };

    (data.items || []).forEach((item) => {
      if (item.yomtov || item.category === 'fast') {
        yomTovSet.add(item.date.slice(0, 10));
      }
    });
  } catch (error) {
    console.error('Failed to fetch Yom Tov dates:', error);
    // Return empty set on error - caller should handle gracefully
  }

  return yomTovSet;
}

/**
 * Check if a date is appropriate for a Shabbos-only recipe
 * @param dateStr YYYY-MM-DD format
 * @param yomTovDates Set of Yom Tov date strings
 * @returns true if date is Friday, Saturday, or Yom Tov
 */
export function isShabbosAppropriate(
  dateStr: string,
  yomTovDates: Set<string>
): boolean {
  const date = new Date(dateStr + 'T00:00:00Z');
  const dow = date.getUTCDay();

  // Friday (5) or Saturday (6)
  if (dow === 5 || dow === 6) {
    return true;
  }

  // Yom Tov or fast day
  if (yomTovDates.has(dateStr)) {
    return true;
  }

  return false;
}

/**
 * Validate that a meal plan entry respects the is_shabbos_only constraint
 * @param entry Meal plan entry with plan_date
 * @param recipe Recipe with is_shabbos_only flag
 * @param yomTovDates Set of Yom Tov date strings
 * @returns Object with isValid flag and error message if invalid
 */
export function validateShabbosOnly(
  entry: { plan_date: string; custom_name?: string; recipe_id?: string },
  recipe: { id: string; name: string; is_shabbos_only?: boolean },
  yomTovDates: Set<string>
): { isValid: boolean; error?: string } {
  if (!recipe.is_shabbos_only) {
    return { isValid: true };
  }

  const isAppropriate = isShabbosAppropriate(entry.plan_date, yomTovDates);

  if (!isAppropriate) {
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
      new Date(entry.plan_date + 'T00:00:00Z').getUTCDay()
    ];

    return {
      isValid: false,
      error: `Recipe "${recipe.name}" is marked Shabbos-only but assigned to ${entry.plan_date} (${dayOfWeek}). ` +
        `Shabbos-only recipes can only appear on Friday, Saturday, or Yom Tov.`
    };
  }

  return { isValid: true };
}

/**
 * Validate multiple entries against Shabbos constraint
 * @param entries Array of meal plan entries
 * @param recipes Map of recipe ID to recipe object
 * @param yomTovDates Set of Yom Tov date strings
 * @returns Array of validation errors
 */
export function validateMealPlan(
  entries: Array<{ plan_date: string; recipe_id?: string; custom_name?: string }>,
  recipes: Map<string, any>,
  yomTovDates: Set<string>
): Array<{ entryId?: string; error: string }> {
  const errors: Array<{ entryId?: string; error: string }> = [];

  entries.forEach((entry) => {
    if (!entry.recipe_id) return;

    const recipe = recipes.get(entry.recipe_id);
    if (!recipe) return;

    const validation = validateShabbosOnly(entry, recipe, yomTovDates);
    if (!validation.isValid) {
      errors.push({
        error: validation.error || 'Unknown validation error'
      });
    }
  });

  return errors;
}

/**
 * Filter recipes to only include those appropriate for a given date
 * (used when assigning recipes to meal slots during rotation generation)
 * @param recipes Array of recipes to filter
 * @param dateStr Target plan_date (YYYY-MM-DD)
 * @param yomTovDates Set of Yom Tov date strings
 * @returns Filtered array of appropriate recipes
 */
export function filterRecipesByDate(
  recipes: Array<{ id: string; name: string; is_shabbos_only?: boolean }>,
  dateStr: string,
  yomTovDates: Set<string>
): Array<{ id: string; name: string; is_shabbos_only?: boolean }> {
  const isAppropriate = isShabbosAppropriate(dateStr, yomTovDates);

  return recipes.filter((recipe) => {
    if (recipe.is_shabbos_only) {
      return isAppropriate; // Only include if the date is Shabbos-appropriate
    }
    return true; // Regular recipes can appear any day
  });
}
