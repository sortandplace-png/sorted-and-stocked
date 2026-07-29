// lib/app-routes.ts
// One place that knows where things live.
//
// Built because the Staff Handbook is about to turn ~10 plain-text navigation
// phrases into real links, in two languages, and four of those destinations
// move under SS-156. Without this, that merge means editing every call site
// twice and getting one of them wrong.
//
// TWO RULES FOR THIS FILE:
//
// 1. Return the DESTINATION, never a redirect stub. A link that takes a hop
//    is a link that can rot silently when the stub is eventually retired.
// 2. When a route moves, change it HERE and nowhere else. That is the entire
//    point -- if you find yourself editing a route string in a component,
//    the route belongs in this file instead.

/** Every route is property-scoped unless noted. */
export const routes = {
  dashboard: (propertyId: string) => `/properties/${propertyId}/dashboard`,

  // --- Staff surfaces -------------------------------------------------------
  myDay: (propertyId: string) => `/properties/${propertyId}/my-day`,
  handbook: (propertyId: string) => `/properties/${propertyId}/staff/handbook`,
  team: (propertyId: string) => `/properties/${propertyId}/staff`,

  // SS-156: Task Center, the Duty Roster, the SOP Library and the old
  // /tools/duty-roster table all merge into /staff/tasks. When that lands,
  // change these four lines and nothing else. Today they point at the live
  // destinations, not the stubs those will become.
  taskCenter: (propertyId: string) => `/properties/${propertyId}/tools/tasks`,
  dutyRoster: (propertyId: string) => `/properties/${propertyId}/staff/duty-roster`,
  // The SOP Library is the Handbook's Procedures tab now. Rule 1 of this
  // file: return the DESTINATION, never a redirect stub -- /staff/sops
  // still works but costs a hop, so nothing internal should point at it.
  // Pass a sopId to open that procedure directly.
  sops: (propertyId: string, sopId?: string) =>
    `/properties/${propertyId}/staff/handbook?tab=procedures${sopId ? `&sop=${sopId}` : ''}`,
  training: (propertyId: string) => `/properties/${propertyId}/staff/training`,

  // --- Shop -----------------------------------------------------------------
  shoppingList: (propertyId: string) => `/properties/${propertyId}/shopping-list`,
  inventory: (propertyId: string) => `/properties/${propertyId}/inventory`,

  // --- Plan -----------------------------------------------------------------
  recipes: (propertyId: string) => `/properties/${propertyId}/recipes`,
  mealPlan: (propertyId: string) => `/properties/${propertyId}/meal-plan`,

  // --- Reference ------------------------------------------------------------
  // The tile is TITLED "House Manual" but the slug is still knowledge-base --
  // SS-214's naming split. /tools/house-manual DOES NOT EXIST; linking to it
  // would have shipped a 404 inside the handbook. When SS-214 settles the name
  // and the route is renamed, this line changes and the old path becomes a
  // stub (R21).
  houseManual: (propertyId: string) => `/properties/${propertyId}/tools/knowledge-base`,
  tools: (propertyId: string) => `/properties/${propertyId}/tools`,

  // Property-scoped deliberately: /help renders outside app/properties/[id]/
  // and therefore has no app header, which is what stranded people (SS-126).
  help: (propertyId: string) => `/properties/${propertyId}/help`,

  // --- Cross-property (no propertyId) ---------------------------------------
  procurement: () => '/procurement',
  propertyPicker: () => '/properties',
} as const;

export type RouteKey = keyof typeof routes;
