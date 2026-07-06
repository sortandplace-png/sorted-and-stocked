-- ============================================================================
-- FULL recipe replacement: all 180 real recipes from the Strauss Family
-- Recipes package (uploaded directly, not from Drive), with real bilingual
-- instructions, 1465 real ingredient rows, and 11 real matched dish photos
-- (copied into the app's own public/recipe-photos/ folder — no Drive link
-- issues, no CORS issues, these will just work).
--
-- This REPLACES the earlier 23-recipe partial import. Existing meal_plan_
-- entries keep working during the swap (their custom_name is real dish text
-- either way); a re-link pass at the end reconnects recipe_id where names
-- match, so the ones that had real ingredient links keep them.
-- ============================================================================

delete from public.recipes
where property_id = (select id from public.properties where name = 'Strauss' limit 1);

-- SF-001: Balsamic Chicken with Peppers & Onions
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Balsamic Chicken with Peppers & Onions', 6, 'protein', null, '[Meat] In a shallow baking dish, combine the flour, salt, pepper, onion powder, and garlic powder. Dredge the chicken in the flour mixture just to coat lightly. Shake off excess coating. | In a large skillet with 3-inch sides, heat 3 tablespoons of the olive oil and the margarine over high heat. Working in batches, brown the chicken on both sides, about 3 minutes per side. Remove chicken from skillet and set aside. | In the same large skillet, heat the remaining 2 tablespoons of olive oil over medium heat. Add the red pepper, yellow pepper, and red onions, and cook for 7 minutes. Add the garlic and stir until softened, about 1 minute. | In a small bowl, whisk the balsamic vinegar, soy sauce, brown sugar, salt, and pepper. Add the mixture to the vegetables and stir until it becomes a sauce. Continue cooking until the vegetables are soft and the balsamic sauce has reduced to a syrup, about 4 more minutes. Place the chicken back in the pan and coat with the sauce. Simmer until the chicken is cooked through, about 4 minutes. | Serve chicken topped with the onions and peppers and drizzled with the sauce. Garnish with fresh basil if desired.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('flour', '1', 'cup', 'Bakery / Dry'),
  ('1/2 kosher salt', '', 'teaspoon', 'Spices / Condiments'),
  ('1/4 ground black pepper', '', 'teaspoon', 'Produce'),
  ('1/2 onion powder', '', 'teaspoon', 'Produce'),
  ('1/2 garlic powder', '', 'teaspoon', 'Produce'),
  ('olive oil, divided', '5', 'tablespoons', 'Spices / Condiments'),
  ('margarine', '2', 'tablespoons', 'Pantry'),
  ('chicken cutlets, pounded or sliced thin', '12', '', 'Meat / Fish'),
  ('red peppers, sliced into strips', '3', '', 'Produce'),
  ('yellow peppers, sliced into strips', '2', '', 'Produce'),
  ('red onions, sliced into strips', '2', '', 'Produce'),
  ('garlic cloves, chopped', '3', '', 'Produce'),
  ('Fresh basil, for garnish (optional)', '', '', 'Pantry'),
  ('Balsamic Sauce:', '', '', 'Spices / Condiments'),
  ('balsamic vinegar', '1', 'cup', 'Spices / Condiments'),
  ('soy sauce', '2', 'tablespoons', 'Spices / Condiments'),
  ('light brown sugar', '4', 'tablespoons', 'Bakery / Dry'),
  ('kosher salt', '1', 'teaspoon', 'Spices / Condiments'),
  ('1/4 ground black pepper', '', 'teaspoon', 'Produce')
) as t(name, qty, unit, category);

-- SF-002: Go-To Marinade
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Go-To Marinade', 6, 'protein', null, '[Parve] Combine all ingredients. | Pour over steaks or cutlets. | Let marinate for at least 1 hour to tenderize. | Grill and enjoy.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1/2 barbecue sauce', '', 'cup', 'Spices / Condiments'),
  ('vinegar', '2', 'tablespoons', 'Spices / Condiments'),
  ('olive oil', '2', 'tablespoons', 'Spices / Condiments'),
  ('garlic powder', '1', 'teaspoon', 'Produce'),
  ('Italian seasoning', '1', 'teaspoon', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-003: Teriyaki Quinoa Chicken
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Teriyaki Quinoa Chicken', 6, 'protein', null, '[Meat] In a large nonstick frying pan with a lid, saute onion in oil until beginning to brown. | Add mushrooms and continue to saute until softened. Push vegetables to one side of the pan. | Add chicken in a single layer and sear on both sides. | Add remaining ingredients to the pan and bring to a boil. | Lower heat and simmer, covered, for 15 minutes, or until quinoa is cooked through. | Serve hot.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Oil, for sauteing', '', '', 'Spices / Condiments'),
  ('medium onion, diced', '1', '', 'Produce'),
  ('sliced baby bella mushrooms', '2', 'cups', 'Produce'),
  ('1 1/2 (680 g) chicken breast, cut into bite-sized pieces', '', 'lbs', 'Meat / Fish'),
  ('1/4 sesame teriyaki sauce', '', 'cup', 'Spices / Condiments'),
  ('1 1/2 water', '', 'cups', 'Pantry'),
  ('3/4 pre-checked quinoa', '', 'cup', 'Bakery / Dry'),
  ('1/2 salt, or to taste', '', 'teaspoon', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-004: Frosted Flake Chicken Nuggets with Popper Sauce
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Frosted Flake Chicken Nuggets with Popper Sauce', 6, 'protein', null, '[Meat] Dip the chicken into flour, then eggs, then crushed Frosted Flakes. | Fry until cooked through and crisp. | For the sauce, combine the brown sugar and hot sauce or buffalo sauce and bring to a boil. | If the sauce gets too thick, add a little water. | Season the eggs only with garlic powder, salt, and paprika. | Notes | The original source did not include exact chicken quantity or exact seasoning amounts.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Chicken nuggets or cut-up chicken pieces', '', '', 'Meat / Fish'),
  ('Flour', '', '', 'Bakery / Dry'),
  ('Eggs', '', '', 'Dairy / Eggs'),
  ('Crushed Frosted Flakes', '', '', 'Pantry'),
  ('For the egg mixture / seasoning:', '', '', 'Dairy / Eggs'),
  ('Garlic powder', '', '', 'Produce'),
  ('Salt', '', '', 'Spices / Condiments'),
  ('Paprika', '', '', 'Spices / Condiments'),
  ('Popper Sauce:', '', '', 'Spices / Condiments'),
  ('Brown sugar, about 1/2 to 1 cup', '', '', 'Bakery / Dry'),
  ('1/3 hot sauce or buffalo sauce', '', 'cup', 'Spices / Condiments'),
  ('A little water, as needed if the sauce gets too thick', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-005: Eileen's Sweet and Tangy Chicken
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Eileen''s Sweet and Tangy Chicken', 6, 'protein', null, '[Meat] Preheat oven to 350°F. Grease a roasting pan. | Place chicken into prepared pan. Season chicken lightly with spices. Spread mayonnaise over chicken. Sprinkle with cornflake crumbs to evenly cover. | Cover and bake on the center rack for 1 hour 20 minutes. | Meanwhile, prepare the sweet and tangy sauce: in a small bowl, combine sauce ingredients. | Remove pan from oven. Pour accumulated liquid into a small bowl. Allow liquid to cool, then discard it. | Pour sauce over chicken. Return pan to oven and bake uncovered for 20-30 minutes, until tender. | Notes | You can also use chicken bottoms that were separated into drumsticks and thighs.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('chicken bottoms', '8', '', 'Meat / Fish'),
  ('Sea salt, to taste', '', '', 'Spices / Condiments'),
  ('Garlic powder, to taste', '', '', 'Produce'),
  ('Onion powder, to taste', '', '', 'Produce'),
  ('Paprika, to taste', '', '', 'Spices / Condiments'),
  ('1/2 mayonnaise', '', 'cup', 'Spices / Condiments'),
  ('1/2 cornflake crumbs', '', 'cup', 'Bakery / Dry'),
  ('Sweet and Tangy Sauce:', '', '', 'Spices / Condiments'),
  ('duck sauce', '1', 'cup', 'Spices / Condiments'),
  ('1/2 honey', '', 'cup', 'Spices / Condiments'),
  ('yellow mustard', '3', 'tablespoons', 'Spices / Condiments'),
  ('low sodium soy sauce', '3', 'tablespoons', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-006: Chicken Cutlets With Tomato Saute
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Chicken Cutlets With Tomato Saute', 6, 'protein', null, '[Meat] Season the chicken with 1/2 teaspoon salt and 1/4 teaspoon pepper. Heat the oil in a large skillet over medium-high heat. | Working in 2 batches, cook the chicken until browned and cooked through, 2 to 3 minutes per side. Transfer to plates. | Add the tomatoes to the skillet and cook over medium-high heat, stirring occasionally, until they begin to burst, 2 to 3 minutes. | Add the wine and simmer until the liquid is reduced by half, 2 to 3 minutes. | Stir in the scallions and tarragon and serve with the chicken.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1 1/2 small chicken cutlets (8 to 12)', '', 'pounds', 'Meat / Fish'),
  ('Kosher salt and pepper', '', '', 'Produce'),
  ('olive oil', '2', 'tablespoons', 'Spices / Condiments'),
  ('1 1/2 grape or cherry tomatoes', '', 'pints', 'Produce'),
  ('3/4 dry white wine (such as Sauvignon Blanc)', '', 'cup', 'Pantry'),
  ('scallions, sliced', '4', '', 'Produce'),
  ('fresh tarragon leaves, chopped', '2', 'tablespoons', 'Pantry')
) as t(name, qty, unit, category);

-- SF-007: Quinoa Crusted Chicken Nuggets
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Quinoa Crusted Chicken Nuggets', 6, 'protein', null, '[Meat] Preheat oven to 425°F. | Coat a parchment-lined cookie sheet with cooking spray. | Combine flour with garlic powder, salt, and pepper in a shallow dish. | Beat the egg together with the soy sauce in a second dish. Place the cooked quinoa in a third dish. | Dredge the chicken in the flour mixture. Dip in the egg mixture, then dredge in the quinoa. | Arrange chicken in a single layer on the prepared pan. Coat chicken with cooking spray. | Bake at 425°F for 15 minutes or until done, turning once. | Combine mayonnaise and mustard in a small dish and serve with the nuggets.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1-2 skinless, boneless chicken breasts, cut into 1-inch pieces', '', 'lb', 'Meat / Fish'),
  ('1/4 kosher salt', '', 'teaspoon', 'Spices / Condiments'),
  ('1/4 freshly ground black pepper', '', 'teaspoon', 'Produce'),
  ('Cooking spray', '', '', 'Pantry'),
  ('1/4 flour', '', 'cup', 'Bakery / Dry'),
  ('3/4 garlic powder', '', 'teaspoon', 'Produce'),
  ('large egg', '1', '', 'Dairy / Eggs'),
  ('soy sauce, or coconut aminos', '1', 'tablespoon', 'Spices / Condiments'),
  ('1 1/2 cooked red quinoa, chilled', '', 'cups', 'Bakery / Dry'),
  ('Dipping Sauce:', '', '', 'Spices / Condiments'),
  ('mayonnaise', '3', 'tablespoons', 'Spices / Condiments'),
  ('mustard', '2', 'teaspoons', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-008: Meatballs
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Meatballs', 6, 'protein', null, '[Meat] Put all of the sauce ingredients into a large pot and turn it on a medium-low flame. | Mix the meat with the teriyaki sauce, garlic powder, and salt, then form small meatballs. | Drop the meatballs one by one into the sauce; you should get about 50 meatballs. | Keep on a medium-low flame, covered, for about 1 1/2 to 2 hours, stirring occasionally. Alternatively, place into a tin pan and bake in the oven.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Sauce:', '', '', 'Spices / Condiments'),
  ('(28 oz) can tomato sauce', '1', '', 'Produce'),
  ('1/4 jellied cranberry sauce', '', 'cup', 'Produce'),
  ('1/4 ketchup', '', 'cup', 'Spices / Condiments'),
  ('teriyaki sauce', '3', 'tablespoons', 'Spices / Condiments'),
  ('Meat mixture:', '', '', 'Pantry'),
  ('lean chopped meat', '2', 'lbs', 'Pantry'),
  ('teriyaki sauce', '2', 'tablespoons', 'Spices / Condiments'),
  ('garlic powder', '1', 'teaspoon', 'Produce'),
  ('1/3 pink salt', '', 'teaspoon', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-009: Montreal Salmon & Veggies
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Montreal Salmon & Veggies', 6, 'protein', null, '[Parve] Preheat oven to broil. | Drizzle olive oil into a 9 x 13-inch baking pan. Lay vegetables flat to cover the bottom of the pan. | Place salmon slices on top of vegetables. Coat salmon and vegetables with nonstick cooking spray; sprinkle with Montreal steak seasoning. | Broil for 12-15 minutes, until fish flakes easily with a fork.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1-2 olive oil', '', 'tablespoons', 'Spices / Condiments'),
  ('red onion, cut in rings', '1', '', 'Produce'),
  ('1/2 red pepper, cut into rounds', '', '', 'Produce'),
  ('1/2 yellow pepper, cut into rounds', '', '', 'Produce'),
  ('small zucchini, thinly sliced into rounds', '1', '', 'Produce'),
  ('portobello mushroom, sliced', '1', '', 'Produce'),
  ('1 1/2 salmon fillets', '', 'lb', 'Meat / Fish'),
  ('Montreal steak seasoning, for sprinkling', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-010: Really Good Chicken
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Really Good Chicken', 6, 'protein', null, '[Meat] Preheat oven to 350°F (175°C). Place onion slices on the bottom of a 9 x 13-inch (20 x 30 cm) baking pan. Add chicken pieces on top. | Mix together the rest of the ingredients in a small bowl, forming a paste. Smear all over chicken. | Cover with aluminum foil. Bake for 1 1/2 hours covered and 1/2 hour uncovered. After chicken is uncovered, baste once or twice in the middle. | Notes | For even more flavorful chicken, prepare it Thursday night, let it marinate in the fridge overnight, and bake the next morning.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('chicken bottoms, cut into eighths', '4', '', 'Meat / Fish'),
  ('large onion, sliced into half rounds', '1', '', 'Produce'),
  ('1/3 brown sugar (1/4 cup if you like it less sweet)', '', 'cup', 'Bakery / Dry'),
  ('2 1/2 olive oil', '', 'tablespoons', 'Spices / Condiments'),
  ('apple cider vinegar', '2', 'tablespoons', 'Produce'),
  ('Dijon mustard', '2', 'tablespoons', 'Spices / Condiments'),
  ('fresh lemon juice (2 tablespoons if you like it tangy)', '1', 'tablespoon', 'Produce'),
  ('1-2 garlic, minced', '', 'cloves', 'Produce'),
  ('seasoned salt', '1', 'teaspoon', 'Spices / Condiments'),
  ('1/4 black pepper, or to taste', '', 'teaspoon', 'Produce')
) as t(name, qty, unit, category);

-- SF-011: One-Pan Chicken and Rice
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'One-Pan Chicken and Rice', 6, 'protein', null, '[Meat] In a 9 x 13 pan, combine the rice, water, and onion soup mix. Stir. | Top with 4 pieces of chicken, on the bone, with the skin on. | Mix the sauce ingredients and paint the chicken with the sauce. | Sprinkle sesame seeds on top if desired. | Cover tightly with a 9 x 13 lid or tin foil. | Bake for 3 hours at 350°F.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('For the pan:', '', '', 'Pantry'),
  ('1 1/2 rice', '', 'cups', 'Bakery / Dry'),
  ('2 1/4 water', '', 'cups', 'Pantry'),
  ('1 1/2 onion soup mix', '', 'tablespoons', 'Produce'),
  ('pieces chicken, on the bone, skin on', '4', '', 'Meat / Fish'),
  ('Sauce:', '', '', 'Spices / Condiments'),
  ('1/4 ketchup', '', 'cup', 'Spices / Condiments'),
  ('brown sugar', '2', 'tablespoons', 'Bakery / Dry'),
  ('1/2 vinegar', '', 'teaspoon', 'Spices / Condiments'),
  ('soy sauce', '1', 'teaspoon', 'Spices / Condiments'),
  ('garlic cubes (or garlic powder)', '2', '', 'Produce'),
  ('Sesame seeds, optional', '', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-012: No Pot Creamy Ziti
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'No Pot Creamy Ziti', 6, 'protein', null, '[Dairy] Preheat oven to 350°F. | Add the pasta in an even layer to a 9 x 13-inch baking pan. | Add salt and sauce. Fill the jar with water, either 3/4 full to completely full, and add to the pan. | Add most of the cheese and mix to combine. Add more cheese on top, or mix all of it in. | Cover and bake for 90 minutes. | If you like it crisp, uncover and bake a little longer so the top browns, bubbles, and the noodles crisp up a bit.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1 9- x 13-inch pan', '', '', 'Pantry'),
  ('salt', '1', 'teaspoon', 'Spices / Condiments'),
  ('penne pasta (raw)', '1', 'pound', 'Bakery / Dry'),
  ('(26 ounce) jar pasta sauce', '1', '', 'Bakery / Dry'),
  ('3/4 to 1 (26 ounce) jar water (after emptying the sauce)', '', '', 'Spices / Condiments'),
  ('cheese (about 1 1/2 cups)', '12', 'ounces', 'Dairy / Eggs')
) as t(name, qty, unit, category);

-- SF-013: Italian Mini Meatballs & Peppers
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Italian Mini Meatballs & Peppers', 6, 'protein', null, '[Meat] Saute onion and peppers in oil for 20 minutes. | Mix ground meat with oregano, paprika, salt, pepper, garlic powder, onion powder, a pinch of chili flakes, and dried parsley. | Form mini meatballs and drop into the pan. | Cover and cook for 25 minutes. | Add some diced tomatoes if you want. | Serve over pasta or rice. | Notes | Exact quantities were not provided in the source.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Onion', '', '', 'Produce'),
  ('Peppers', '', '', 'Produce'),
  ('Oil', '', '', 'Spices / Condiments'),
  ('Ground meat', '', '', 'Meat / Fish'),
  ('Oregano', '', '', 'Spices / Condiments'),
  ('Paprika', '', '', 'Spices / Condiments'),
  ('Salt', '', '', 'Spices / Condiments'),
  ('Pepper', '', '', 'Produce'),
  ('Garlic powder', '', '', 'Produce'),
  ('Onion powder', '', '', 'Produce'),
  ('of chili flakes', '', 'Pinch', 'Pantry'),
  ('Dried parsley', '', '', 'Produce'),
  ('Diced tomatoes (optional)', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-014: Sandwich Steaks
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Sandwich Steaks', 6, 'protein', '/recipe-photos/sandwich-steaks.jpg', '[Parve] Bake at 275°F for 2.5 to 3 hours. | Notes | The attachment only showed a very short handwritten note and did not include additional ingredients or directions.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Bone Sukiyaki sauce — a lot', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-015: Chicken with Snap Peas
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Chicken with Snap Peas', 6, 'protein', null, '[Meat] Put the chicken in a bag with the flour and shake. | Make a sauce with the soy sauce, oil, salt, black pepper, garlic, and brown sugar. | Pour the sauce over the chicken in a pan. | Bake 1 hour covered. | Add scallions and snap peas and bake another 15 minutes uncovered.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Chicken cutlets, cut into strips', '', '', 'Meat / Fish'),
  ('1/2 flour', '', 'cup', 'Bakery / Dry'),
  ('1/2 soy sauce', '', 'cup', 'Spices / Condiments'),
  ('1/2 oil', '', 'cup', 'Spices / Condiments'),
  ('salt', '1', 'teaspoon', 'Spices / Condiments'),
  ('1/2 black pepper', '', 'teaspoon', 'Produce'),
  ('minced cloves garlic', '3', '', 'Produce'),
  ('1/2 brown sugar', '', 'cup', 'Bakery / Dry'),
  ('Scallions', '', '', 'Produce'),
  ('Snap peas', '', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-016: Oven-Baked Schnitzel
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Oven-Baked Schnitzel', 6, 'protein', null, '[Meat] Mix the oil with the cornflake crumbs and spices until the crumbs are very wet. | Coat the cutlets in the mixture. | Bake at 400°F (200°C) for 15 minutes. | Serve with couscous.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Oil', '', '', 'Spices / Condiments'),
  ('Cornflake crumbs', '', '', 'Bakery / Dry'),
  ('Spices of your choice', '', '', 'Spices / Condiments'),
  ('Cutlets', '', '', 'Meat / Fish')
) as t(name, qty, unit, category);

-- SF-017: Crock-Pot Chicken
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Crock-Pot Chicken', 6, 'protein', null, '[Meat] Sauté the diced onion and mushrooms and put them in a Crock-Pot. | Lay the chicken on the bone on top. | Cover the chicken with tomato sauce, some water, a little tomato paste, and Italian seasoning. | Cook until done. | Serve with mashed potatoes.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Diced onion', '', '', 'Produce'),
  ('Mushrooms', '', '', 'Produce'),
  ('Chicken on the bone', '', '', 'Meat / Fish'),
  ('Tomato sauce', '', '', 'Produce'),
  ('Water', '', '', 'Pantry'),
  ('Tomato paste', '', '', 'Produce'),
  ('Italian seasoning', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-018: Mexican Chicken Strips
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Mexican Chicken Strips', 6, 'protein', null, '[Meat] Sauté the onions and peppers. | Add the chicken strips and cook. | Add the fajita spice. | Serve in tortillas, wraps, pitas, or laffa.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Onions', '', '', 'Produce'),
  ('Peppers', '', '', 'Produce'),
  ('Chicken strips', '', '', 'Meat / Fish'),
  ('packet fajita spice', '1', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-019: Pulled Crock-Pot Chicken
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Pulled Crock-Pot Chicken', 6, 'protein', null, '[Meat] Place the chicken cutlets in a Crock-Pot with the barbecue sauce, ketchup, brown sugar, apple cider vinegar, and spices. | Cook on high for 3 to 4 hours or on low for 6 to 7 hours. | Pull the chicken. | Serve with coleslaw in buns.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Chicken cutlets', '', '', 'Meat / Fish'),
  ('Barbecue sauce', '', '', 'Spices / Condiments'),
  ('Ketchup', '', '', 'Spices / Condiments'),
  ('Brown sugar', '', '', 'Bakery / Dry'),
  ('A little apple cider vinegar', '', '', 'Produce'),
  ('Basic spices', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-020: Chicken Fettuccine
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Chicken Fettuccine', 6, 'protein', null, '[Meat] Stir-fry the chicken cutlets in oil with the garlic. | Mix together the hot water, onion soup mix, lemon juice, salt, black pepper, and flour. | Pour the sauce over the cooked chicken in the pan. | Bring to a boil and let simmer for a few minutes. | Mix the chicken and sauce with cooked fettuccine noodles.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Chicken cutlets', '', '', 'Meat / Fish'),
  ('Oil', '', '', 'Spices / Condiments'),
  ('minced cloves garlic', '2', '', 'Produce'),
  ('1 1/4 hot water', '', 'cups', 'Pantry'),
  ('onion soup mix', '1', 'tablespoon', 'Produce'),
  ('1/2 lemon juice', '', 'tablespoon', 'Produce'),
  ('1/2 salt', '', 'teaspoon', 'Spices / Condiments'),
  ('1/4 black pepper', '', 'teaspoon', 'Produce'),
  ('flour', '2', 'tablespoons', 'Bakery / Dry'),
  ('Cooked fettuccine noodles', '', '', 'Bakery / Dry')
) as t(name, qty, unit, category);

-- SF-021: Chicken and Veggie Stir-Fry
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Chicken and Veggie Stir-Fry', 6, 'protein', null, '[Meat] Coat the chicken cutlets in flour, stir-fry them, and set aside. | Fry the onions, broccoli, and mushrooms. | Mix together the flour, chicken stock, honey, soy sauce, and garlic. | Add the sauce to the vegetables in the pan. | Boil until thickened. | Add the chicken back to the pan. | Serve over rice or orzo.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Chicken cutlets', '', '', 'Meat / Fish'),
  ('Flour', '', '', 'Bakery / Dry'),
  ('Onions', '', '', 'Produce'),
  ('Broccoli', '', '', 'Produce'),
  ('Mushrooms', '', '', 'Produce'),
  ('A few tablespoons flour', '', '', 'Bakery / Dry'),
  ('chicken stock', '1', 'cup', 'Meat / Fish'),
  ('1/2 honey', '', 'cup', 'Spices / Condiments'),
  ('1/2 soy sauce', '', 'cup', 'Spices / Condiments'),
  ('minced cloves garlic', '2', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-022: Stir-Fried Chicken with Bow-Tie Noodles
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Stir-Fried Chicken with Bow-Tie Noodles', 6, 'protein', null, '[Meat] Sauté the garlic in the olive oil. | Add the chicken and cook. | Add the broccoli florets, scallions, and mushrooms. | Sprinkle the vegetables with the dried basil, salt, and pepper. | Add the chicken broth and stir to combine. | Cover and simmer 5 to 10 minutes, until the vegetables are tender. | Meanwhile, cook the bow-tie noodles, drain them, and add them to the skillet. | Toss gently and serve immediately. | Notes | Some text on the attachment was slightly cut off; this version reflects the readable content.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('minced clove garlic', '1', '', 'Produce'),
  ('1/2 olive oil', '', 'cup', 'Spices / Condiments'),
  ('1/2 to 1 lb boneless, skinless chicken, cut in chunks', '', '', 'Meat / Fish'),
  ('broccoli florets', '2', 'cups', 'Produce'),
  ('chopped scallions', '1', 'cup', 'Produce'),
  ('sliced mushrooms', '1', 'cup', 'Produce'),
  ('1/2 dried basil', '', 'teaspoon', 'Pantry'),
  ('1/2 salt', '', 'teaspoon', 'Spices / Condiments'),
  ('1/4 pepper', '', 'teaspoon', 'Produce'),
  ('chicken broth', '1', 'cup', 'Meat / Fish'),
  ('box bow-tie noodles', '1', '', 'Bakery / Dry')
) as t(name, qty, unit, category);

-- SF-023: Mommy's Chicken
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Mommy''s Chicken', 6, 'protein', null, '[Meat] Place the chicken bottoms in a pan. Arrange the potatoes next to and in between the chicken pieces. | Combine the sliced onion and the rest of the ingredients in a small bowl. Smear this mixture over the chicken and potatoes. | If preparing fresh, preheat oven to 350°F. Bake covered for 2 hours and then uncover and bake for 30 minutes until browned to your liking. | If freezing, defrost overnight in the refrigerator. In the morning, place in a 300°F oven and bake all day, covered. About an hour before serving, raise the temperature to 350°F and uncover. Bake until browned to your liking.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('chicken bottoms (or 1 chicken cut into eighths)', '4', '', 'Meat / Fish'),
  ('potatoes, scrubbed and quartered', '3', '', 'Produce'),
  ('onion, sliced into half moons', '1', '', 'Produce'),
  ('1/4 ketchup', '', 'cup', 'Spices / Condiments'),
  ('1/2 duck sauce', '', 'cup', 'Spices / Condiments'),
  ('paprika', '1', 'teaspoon', 'Spices / Condiments'),
  ('Salt and pepper to taste', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-024: One-Pan Maple Salmon Dinner
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'One-Pan Maple Salmon Dinner', 6, 'protein', null, '[Parve] Preheat the oven to 350°F. Line a cookie sheet with parchment paper. | Toss the red potatoes in 2 tablespoons olive oil and salt. Spread on one-third of the baking sheet and bake for 20 minutes. | Whisk together the maple syrup, soy sauce, and garlic for the salmon sauce. | After 20 minutes, remove the pan from the oven. Toss the green beans in 2 tablespoons olive oil and salt and place them on another end of the baking sheet. Place the salmon in the center. | Sprinkle the salmon with salt and pepper and brush with about 2 tablespoons sauce per slice. | Return the baking sheet to the oven for 20 minutes more. | To finish, broil on high for 5 minutes.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('(5 to 6 oz) slices salmon fillet', '4', '', 'Meat / Fish'),
  ('red baby potatoes, halved', '15', '', 'Produce'),
  ('green beans, trimmed', '2', 'lb', 'Pantry'),
  ('olive oil, divided', '4', 'tablespoons', 'Spices / Condiments'),
  ('Salt and pepper', '', '', 'Produce'),
  ('Sauce: 1/4 cup maple syrup', '', '', 'Spices / Condiments'),
  ('Sauce: 2 tablespoons soy sauce', '', '', 'Spices / Condiments'),
  ('Sauce: 1 clove garlic, crushed', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-025: Adventures with Pepper Steak
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Adventures with Pepper Steak', 6, 'protein', null, '[Meat] Pound the steak to make it soft. Cut the meat into cubes 1/4 inch thick. | Sprinkle the meat with the paprika, garlic powder, and onion powder. Let it stand for 2 minutes. | In a skillet, melt the margarine. Brown the meat in the margarine. Add the minced garlic and broth. Cover and allow the meat to simmer for 30 minutes. | Stir in the scallions, onion, and peppers. Cover and allow to simmer for an additional 15 minutes. | In a small bowl, whisk together the cornstarch, sugar, water, and soy sauce. Pour the cornstarch mixture onto the meat mixture and continue cooking until the sauce thickens, about 2 minutes. | Add the tomatoes and serve.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('shoulder steak', '1', 'pound', 'Pantry'),
  ('paprika', '3', 'tablespoons', 'Spices / Condiments'),
  ('garlic powder', '1', 'teaspoon', 'Produce'),
  ('onion powder', '1', 'teaspoon', 'Produce'),
  ('margarine', '2', 'tablespoons', 'Pantry'),
  ('garlic cloves, minced', '2', '', 'Produce'),
  ('beef or chicken broth', '2', 'cups', 'Meat / Fish'),
  ('sliced scallions', '1', 'cup', 'Produce'),
  ('large onion, thinly sliced', '1', '', 'Produce'),
  ('green pepper, thinly sliced', '1', '', 'Produce'),
  ('red pepper, thinly sliced', '1', '', 'Produce'),
  ('2 1/2 cornstarch', '', 'tablespoons', 'Pantry'),
  ('1/4 water', '', 'cup', 'Pantry'),
  ('1/2 soy sauce', '', 'cup', 'Spices / Condiments'),
  ('sugar', '1', 'teaspoon', 'Bakery / Dry'),
  ('large tomatoes', '2', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-026: False Fish
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'False Fish', 6, 'protein', null, '[Meat] Dice up the onion and carrot and place them in water; boil. | Add salt, pepper, garlic powder, and lots of paprika. | Blend 1 carrot and 1 onion. | Add the blended carrot and onion to the ground chicken with 1/2 cup water, the egg, breadcrumbs, salt, pepper, garlic powder, and paprika. | Make balls, drop them into the water, and simmer for 1 hour. | Notes | The attachment read like a texted recipe note, so quantities were only given where shown.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('For the broth: onion, carrot, water, salt, pepper, garlic powder, paprika (a lot)', '', '', 'Produce'),
  ('For the balls: white ground chicken', '', '', 'Meat / Fish'),
  ('carrot', '1', '', 'Produce'),
  ('onion', '1', '', 'Produce'),
  ('1/2 water', '', 'cup', 'Pantry'),
  ('egg', '1', '', 'Dairy / Eggs'),
  ('Breadcrumbs', '', '', 'Bakery / Dry'),
  ('Salt', '', '', 'Spices / Condiments'),
  ('Pepper', '', '', 'Produce'),
  ('Garlic powder', '', '', 'Produce'),
  ('Paprika', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-027: Coca-Cola Meatballs
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Coca-Cola Meatballs', 6, 'protein', null, '[Meat] Combine all of the meatball ingredients and form into balls. | In a saucepan, combine the sauce ingredients and bring to a boil. | Gently drop the balls into the simmering sauce and cook for 45 minutes. | Serve over spaghetti.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('spaghetti', '1', 'pound', 'Pantry'),
  ('Meatballs: 1 pound lean ground beef', '', '', 'Meat / Fish'),
  ('Meatballs: 1 small onion, chopped', '', '', 'Produce'),
  ('Meatballs: 1/4 cup ketchup', '', '', 'Spices / Condiments'),
  ('Meatballs: 2 eggs', '', '', 'Dairy / Eggs'),
  ('Meatballs: 2 garlic cloves', '', '', 'Produce'),
  ('Meatballs: 1/3 cup bread crumbs', '', '', 'Bakery / Dry'),
  ('Meatballs: 1/4 cup water', '', '', 'Pantry'),
  ('Sauce: 1 cup ketchup', '', '', 'Spices / Condiments'),
  ('Sauce: 1/4 teaspoon salt', '', '', 'Spices / Condiments'),
  ('Sauce: 1/8 teaspoon black pepper', '', '', 'Produce'),
  ('Sauce: 2 (12 ounce) cans Coca-Cola (or 1 can cola plus equal amounts water)', '', '', 'Spices / Condiments'),
  ('Sauce: 1/2 cup apricot jam', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-028: Clementine Glazed Chicken and Baby Arugula Salad with Balsamic-Soy Vinaigrette
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Clementine Glazed Chicken and Baby Arugula Salad with Balsamic-Soy Vinaigrette', 6, 'protein', null, '[Meat] Whisk together the soy sauce, oil, toasted sesame oil, honey, garlic, clementine juice, red pepper flakes, salt, and black pepper to make the marinade. | Place the chicken in a zip-top bag with the marinade, seal, and refrigerate overnight or at least 6 hours. | To make the vinaigrette, combine all dressing ingredients in a jar or cruet and shake until well combined. | Remove the chicken from the marinade and grill or broil for 6 to 8 minutes per side. | In a large bowl, combine the baby arugula, red onion, endive, pomegranate seeds, sunflower seeds, sliced almonds, and sliced clementines. | Drizzle the salad with vinaigrette, arrange the chicken on top or on the side, and sprinkle with black sesame seeds before serving. | Notes | A few words on the attachment were small, but the ingredients and method were readable enough to reconstruct this clean version.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Chicken and marinade: 1/2 cup soy sauce', '', '', 'Meat / Fish'),
  ('Chicken and marinade: 1/2 cup oil', '', '', 'Meat / Fish'),
  ('Chicken and marinade: 1 tablespoon toasted sesame oil', '', '', 'Meat / Fish'),
  ('Chicken and marinade: 1/3 cup honey', '', '', 'Meat / Fish'),
  ('Chicken and marinade: 5 cloves garlic, minced', '', '', 'Produce'),
  ('Chicken and marinade: 1 clementine, juiced (about 1/4 cup)', '', '', 'Meat / Fish'),
  ('Chicken and marinade: 1 teaspoon red pepper flakes', '', '', 'Produce'),
  ('Chicken and marinade: salt and black pepper', '', '', 'Produce'),
  ('Chicken and marinade: 2 lbs boneless, skinless chicken thighs, cut into 1-inch pieces', '', '', 'Meat / Fish'),
  ('Salad: 6 oz baby arugula', '', '', 'Produce'),
  ('Salad: 1 small red onion, very thinly sliced', '', '', 'Produce'),
  ('Salad: 1 endive, very thinly sliced', '', '', 'Pantry'),
  ('Salad: 1 cup pomegranate seeds', '', '', 'Pantry'),
  ('Salad: 4 clementines, peeled and sliced into rounds', '', '', 'Pantry'),
  ('Salad: 1/3 cup sunflower seeds', '', '', 'Pantry'),
  ('Salad: 1/3 cup toasted sliced almonds', '', '', 'Pantry'),
  ('Salad: black sesame seeds, to sprinkle on the clementines', '', '', 'Pantry'),
  ('Vinaigrette: 1/2 cup oil', '', '', 'Spices / Condiments'),
  ('Vinaigrette: 1 tablespoon toasted sesame oil', '', '', 'Spices / Condiments'),
  ('Vinaigrette: 2 clementines, juiced', '', '', 'Pantry'),
  ('Vinaigrette: 2 to 3 tablespoons honey, to taste', '', '', 'Spices / Condiments'),
  ('Vinaigrette: 1 tablespoon balsamic vinegar', '', '', 'Spices / Condiments'),
  ('Vinaigrette: 2 tablespoons lite soy sauce', '', '', 'Spices / Condiments'),
  ('Vinaigrette: 1 clove garlic, minced', '', '', 'Produce'),
  ('Vinaigrette: 1 pinch kosher salt and fresh black pepper', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-029: Breaded Veal Chops
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Breaded Veal Chops', 6, 'protein', '/recipe-photos/breaded-veal-chops.jpg', '[Meat] Dip each veal chop into the seasoned breadcrumbs, then into egg, then again into the breadcrumbs. | Freeze the chops individually in zip-top bags until ready to bake. | Bake until cooked through; the attachment noted that this supper takes about 90 minutes from oven to table. | Notes | The attachment described the breading method clearly but did not show a complete temperature or full baking method.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Veal chops', '', '', 'Meat / Fish'),
  ('Breadcrumbs seasoned with salt, pepper, paprika, and garlic powder', '', '', 'Produce'),
  ('Egg', '', '', 'Dairy / Eggs')
) as t(name, qty, unit, category);

-- SF-030: Flanken Roast
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Flanken Roast', 6, 'protein', null, '[Meat] Season the flanken roast with salt, pepper, garlic powder, and herbed sea salt. | Drizzle with soy sauce. | Add a drop of liquid hickory smoke. | Sprinkle onion soup mix over the meat. | Top with sliced onions. | Add a little Jim Beam maple hickory BBQ sauce. | Cover tightly three times. | Bake at 250°F for 5 to 6 hours.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Flanken roast', '', '', 'Meat / Fish'),
  ('Salt', '', '', 'Spices / Condiments'),
  ('Pepper', '', '', 'Produce'),
  ('Garlic powder', '', '', 'Produce'),
  ('Herbed sea salt', '', '', 'Produce'),
  ('Soy sauce, for drizzling', '', '', 'Spices / Condiments'),
  ('Liquid hickory smoke, a drop', '', '', 'Pantry'),
  ('Onion soup mix, for sprinkling', '', '', 'Produce'),
  ('Onions, sliced', '', '', 'Produce'),
  ('Jim Beam Maple Hickory BBQ sauce, a little', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-031: French Roast
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'French Roast', 6, 'protein', null, '[Meat] Place the onions and half the tomatoes in a large roasting pan. | Place the roast on top and cover with the remaining onions and tomatoes, the duck sauce, wine, and spices. | Cover and refrigerate for at least 2 hours, or preferably overnight. | Preheat the oven to 375°F. | Bring the roast to room temperature. | Bake covered for about 3.5 hours, until tender when pierced with a fork. | Remove from the oven and cool. | Transfer to a cutting board and slice thinly across the grain with a sharp knife. | For gravy, blend the tomatoes and onions with the sauce.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('big onions, sliced in rings', '2', '', 'Produce'),
  ('tomatoes, sliced in rings', '2', '', 'Produce'),
  ('(5-pound) French roast or square cut roast', '1', '', 'Pantry'),
  ('duck sauce', '1.5', 'cups', 'Spices / Condiments'),
  ('dry red wine', '1.5', 'cups', 'Pantry'),
  ('onion powder', '1', 'tablespoon', 'Produce'),
  ('garlic powder', '2', 'teaspoons', 'Produce'),
  ('paprika', '2', 'teaspoons', 'Spices / Condiments'),
  ('Salt', '', '', 'Spices / Condiments'),
  ('Freshly ground black pepper', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-032: Pulled Brisket
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Pulled Brisket', 6, 'protein', null, '[Meat] Preheat the oven to 425°F. | Place the brisket into a roasting pan. | Combine the remaining ingredients in a 4-quart saucepan and cook over low heat for 10 minutes, stirring occasionally. | Pour the sauce over the meat in the pan. Cover and seal the pan tightly. | Bake for 15 minutes. | Reduce the oven temperature to 200°F. Bake overnight or for at least 6 hours. | Remove the pan from the oven and let it cool enough to handle. | If desired, remove the fat from the meat and discard. | Use two forks to shred the meat. | Rewarm the shredded meat in the sauce before serving. | Notes | Overlay note on the image suggested reheating right before Shabbos at 210° and serving on a platter with shredded meat, crackers, and sauce.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('(3- to 4-pound) second cut brisket', '1', '', 'Meat / Fish'),
  ('prepared horseradish', '1', 'tablespoon', 'Pantry'),
  ('imitation mustard', '1', 'tablespoon', 'Spices / Condiments'),
  ('1/2 to 1 cup ketchup, to taste', '', '', 'Spices / Condiments'),
  ('water', '1', 'cup', 'Pantry'),
  ('garlic, chopped', '2', 'teaspoons', 'Produce'),
  ('1/4 brown sugar', '', 'cup', 'Bakery / Dry'),
  ('1/4 vinegar', '', 'cup', 'Spices / Condiments'),
  ('Salt, to taste', '', '', 'Spices / Condiments'),
  ('Pepper, to taste', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-033: Simple and Delicious Corned Beef
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Simple and Delicious Corned Beef', 6, 'protein', null, '[Meat] Pour 1 cup of water on the bottom of the pan. | Place the corned beef in the pan. | Sprinkle 1 cup brown sugar on top. | Sprinkle 3 tablespoons balsamic vinegar on top. | Cover and bake at 400°F for 3 hours.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Corned beef', '', '', 'Meat / Fish'),
  ('water', '1', 'cup', 'Pantry'),
  ('brown sugar', '1', 'cup', 'Bakery / Dry'),
  ('balsamic vinegar', '3', 'tablespoons', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-034: Tongue Polonaise
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Tongue Polonaise', 6, 'protein', null, '[Meat] Preheat the oven to 350°F. | In a small saucepan, combine the sauce ingredients, adjusting the amount of brown sugar to the desired level of sweetness. | Bring to a boil over medium-high heat, stirring continuously. | Transfer the tongue to a baking pan and pour the sauce over it. | Bake covered for 20 minutes. | Serve warm.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('sliced prepared pickled tongue, from the deli counter', '1', 'pound', 'Meat / Fish'),
  ('oil', '2', 'tablespoons', 'Spices / Condiments'),
  ('Dijon mustard', '1', 'tablespoon', 'Spices / Condiments'),
  ('ketchup', '5', 'tablespoons', 'Spices / Condiments'),
  ('distilled white vinegar', '2', 'tablespoons', 'Spices / Condiments'),
  ('1/3 to 1/2 cup brown sugar, to taste', '', '', 'Bakery / Dry')
) as t(name, qty, unit, category);

-- SF-035: Oyster Steaks
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Oyster Steaks', 6, 'protein', null, '[Meat] For pan-searing: Heat several tablespoons of olive oil in a large nonstick pan over medium-high heat. | Rub kosher salt, pepper, and frozen garlic cubes on both sides of the steak. | Sear for about 6 to 7 minutes on each side. | For grilling: Rub the oyster steaks with olive oil and season with salt, pepper, and frozen garlic cubes. | Grill for 6 to 7 minutes on each side, then let rest for several minutes. | Slice and drizzle with chimichurri, pesto sauce, or flavored garlic or truffle mayonnaise, if desired. | For a more well-done result, bake uncovered in a preheated 350°F oven until the desired internal temperature is reached.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Oyster steaks', '', '', 'Pantry'),
  ('Olive oil', '', '', 'Spices / Condiments'),
  ('Kosher salt', '', '', 'Spices / Condiments'),
  ('Pepper', '', '', 'Produce'),
  ('Frozen garlic cubes', '', '', 'Produce'),
  ('Optional for serving: chimichurri, pesto sauce, or flavored mayonnaise', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-036: Breaded Veal Chops
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Breaded Veal Chops', 6, 'protein', '/recipe-photos/breaded-veal-chops.jpg', '[Meat] Season the breadcrumbs with salt, pepper, paprika, and garlic powder. | Dip each veal chop into the breadcrumbs. | Dip into egg. | Dip again into the breadcrumbs. | Freeze individually in Ziploc bags until ready to bake. | Bake and serve when desired; the image notes that dinner is ready about 90 minutes after placing in the oven. | Notes | The screenshot did not show an exact oven temperature.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Veal chops', '', '', 'Meat / Fish'),
  ('Breadcrumbs', '', '', 'Bakery / Dry'),
  ('Egg', '', '', 'Dairy / Eggs'),
  ('Salt', '', '', 'Spices / Condiments'),
  ('Pepper', '', '', 'Produce'),
  ('Paprika', '', '', 'Spices / Condiments'),
  ('Garlic powder', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-037: Asian Ribs
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Asian Ribs', 6, 'protein', null, '[Meat] Preheat the oven to 350°F. | Season the ribs and bake covered for 2 hours. | Reserve the juice from the pan and mix it with the sauce ingredients. | Pour the sauce over the ribs and bake uncovered for 30 minutes. | Bake longer, until the meat is tender. | Notes | The last line of the note appears to say to bake longer until the meat softens/tenders.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('3 1/2 to 4 pounds spare ribs', '', '', 'Meat / Fish'),
  ('garlic powder', '1', 'teaspoon', 'Produce'),
  ('paprika', '1', 'teaspoon', 'Spices / Condiments'),
  ('1/2 black pepper', '', 'teaspoon', 'Produce'),
  ('hoisin sauce', '5', 'tablespoons', 'Spices / Condiments'),
  ('soy sauce', '5', 'tablespoons', 'Spices / Condiments'),
  ('ketchup', '5', 'tablespoons', 'Spices / Condiments'),
  ('honey', '5', 'tablespoons', 'Spices / Condiments'),
  ('crushed garlic', '3', 'cloves', 'Produce'),
  ('reserved juice', '2', 'tablespoons', 'Pantry')
) as t(name, qty, unit, category);

-- SF-038: Standing Rib Roast
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Standing Rib Roast', 6, 'protein', null, '[Meat] Sprinkle the roast with olive oil, salt, pepper, garlic powder, and onion powder. | Pour the oil and Dijon mustard mixture over the roast. | Bake 20 minutes at 500°F, uncovered. | Lower the oven to 350°F and continue baking for 20 minutes per pound, covered.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('4- standing rib roast', '', 'pound', 'Pantry'),
  ('Olive oil, for sprinkling', '', '', 'Spices / Condiments'),
  ('Salt', '', '', 'Spices / Condiments'),
  ('Pepper', '', '', 'Produce'),
  ('Garlic powder', '', '', 'Produce'),
  ('Onion powder', '', '', 'Produce'),
  ('Mixture: 1/2 cup oil plus 1/2 cup Dijon mustard', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-039: Rack of Ribs
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Rack of Ribs', 6, 'protein', null, '[Meat] Rub the ribs with olive oil, salt, and pepper. | Mix together the ketchup, honey, brown sugar, vinegar, Worcestershire sauce, white pepper, chili powder, garlic, and cayenne to make the sauce. | Heat the oven to 350°F. | Cover the ribs tightly and bake for about 3 hours. | Uncover, brush with sauce, and continue baking until done.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Ribs', '', '', 'Meat / Fish'),
  ('Olive oil', '', '', 'Spices / Condiments'),
  ('Salt', '', '', 'Spices / Condiments'),
  ('Pepper', '', '', 'Produce'),
  ('1/4 ketchup', '', 'cup', 'Spices / Condiments'),
  ('1/4 honey', '', 'cup', 'Spices / Condiments'),
  ('1/2 brown sugar', '', 'cup', 'Bakery / Dry'),
  ('vinegar', '1', 'tablespoon', 'Spices / Condiments'),
  ('Worcestershire sauce', '1', 'tablespoon', 'Spices / Condiments'),
  ('1/4 white pepper', '', 'teaspoon', 'Produce'),
  ('1/2 chili powder', '', 'teaspoon', 'Spices / Condiments'),
  ('to 3 cloves garlic', '2', '', 'Produce'),
  ('1/4 cayenne', '', 'teaspoon', 'Pantry')
) as t(name, qty, unit, category);

-- SF-040: Roasted Marrow Bones
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Roasted Marrow Bones', 6, 'protein', null, '[Meat] Preheat the oven to 450°F. | Place the marrow bones on a tray or ovenproof skillet, bone side down. | Roast until the bones are lightly browned, about 20 minutes. | Some fat will render from the bones, but most of the marrow should stay in the bone. | Serve immediately, with bread and a sharp green salad on the side. | Notes | Only part of the ingredient list was visible in the screenshot.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Marrow bones', '', '', 'Meat / Fish'),
  ('Salt and pepper, to taste', '', '', 'Produce'),
  ('Toasted slices of bread', '', '', 'Bakery / Dry')
) as t(name, qty, unit, category);

-- SF-041: Red Wine BBQ Cheek Meat Tacos
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Red Wine BBQ Cheek Meat Tacos', 6, 'protein', null, '[Meat] Pour BBQ sauce over a piece of cheek meat. | Bake low and slow overnight at 200°F for about 8 to 10 hours. | Pour the sauce into a pan, add some red wine, and reduce it. | Pour the reduced sauce back into the meat. | Pull or shred the meat. | Fill mini tacos and serve. | Notes | The visible caption was truncated, so only the readable portion was included.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Cheek meat', '', '', 'Pantry'),
  ('BBQ sauce', '', '', 'Spices / Condiments'),
  ('Red wine', '', '', 'Pantry'),
  ('Mini taco shells or small tortillas', '', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-042: Chummus Bassar
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Chummus Bassar', 6, 'protein', null, '[Meat] Place the ground meat in a frying pan sprayed with Pam. | Let it cook and do not drain the liquid. | Add the brown sugar, cumin, garlic powder, and salt. | Let the liquid cook off. | Pour in a whole jar of marinara sauce. | Cook on a low flame until the sauce is evaporated. | Notes | The lower part of the note was cut off in the screenshot, so this document includes only the visible portion.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('to 5 pounds ground meat', '4', '', 'Meat / Fish'),
  ('Pam spray', '', '', 'Pantry'),
  ('Brown sugar, about 1 cup (less)', '', '', 'Bakery / Dry'),
  ('Cumin, enough to cover the meat', '', '', 'Spices / Condiments'),
  ('Garlic powder', '', '', 'Produce'),
  ('Salt', '', '', 'Spices / Condiments'),
  ('whole jar marinara sauce', '1', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-043: Sweetened Veal Steak
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Sweetened Veal Steak', 6, 'protein', null, '[Meat] Pat the steaks dry, then sprinkle generously with salt and pepper. | Sear over medium heat until golden brown. | Transfer to a disposable pan and generously cover the meat with the duck sauce. | Bake for 1 1/2 hours covered, then 15 minutes uncovered. | For the duck sauce: cook all ingredients for 45 minutes in a covered pot, then uncover and let simmer for another 30 minutes. Let cool and blend to the desired consistency.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('veal steaks, first cut', '4', '', 'Meat / Fish'),
  ('Kosher salt', '', '', 'Spices / Condiments'),
  ('Pepper', '', '', 'Produce'),
  ('Homemade Duck Sauce', '', '', 'Spices / Condiments'),
  ('segmented grapefruits', '2', '', 'Pantry'),
  ('segmented oranges', '2', '', 'Pantry'),
  ('3/4 sugar', '', 'cup', 'Bakery / Dry')
) as t(name, qty, unit, category);

-- SF-044: Eileen’s Sweet and Tangy Chicken
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Eileen’s Sweet and Tangy Chicken', 6, 'protein', null, '[Meat] 1. Preheat oven to 350°F. Grease a roasting pan. | 2. Place chicken into the prepared pan. | 3. Season lightly with sea salt, garlic powder, onion powder, and paprika. | 4. Spread mayonnaise over the chicken. | 5. Sprinkle with cornflake crumbs to evenly cover. | 6. Cover and bake on the center rack for 1 hour 20 minutes. | 7. Meanwhile, combine the sauce ingredients in a small bowl. | 8. Remove the pan from the oven and pour the accumulated liquid into a small bowl. Allow liquid to cool, then discard. | 9. Pour the sauce over the chicken and return the pan to the oven. | 10. Bake uncovered for 20–30 minutes, until tender. | Note | You can also use chicken bottoms separated into drumsticks and thighs.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('chicken bottoms', '8', '', 'Meat / Fish'),
  ('Sea salt, to taste', '', '', 'Spices / Condiments'),
  ('Garlic powder, to taste', '', '', 'Produce'),
  ('Onion powder, to taste', '', '', 'Produce'),
  ('Paprika, to taste', '', '', 'Spices / Condiments'),
  ('1/2 mayonnaise', '', 'cup', 'Spices / Condiments'),
  ('1/2 cornflake crumbs', '', 'cup', 'Bakery / Dry'),
  ('Sweet and Tangy Sauce', '', '', 'Spices / Condiments'),
  ('duck sauce', '1', 'cup', 'Spices / Condiments'),
  ('1/2 honey', '', 'cup', 'Spices / Condiments'),
  ('. yellow mustard', '3', 'Tbsp', 'Spices / Condiments'),
  ('. low sodium soy sauce', '3', 'Tbsp', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-045: Saucy Chicken Cutlets – EN Steg.
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Saucy Chicken Cutlets – EN Steg.', 6, 'protein', null, '[Meat] 1. Whisk together the eggs, water, flour, and salt. | 2. Coat and fry the chicken cutlets. | 3. Sauté the onion, green pepper, red pepper, and mushrooms. | 4. Add the apricot jam, ketchup, and brown sugar. | 5. Pour the sauce over the fried cutlets. | 6. Bake uncovered. | Note | The screenshot did not show the oven temperature or baking time.')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-046: One Pan Chicken and Rice
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'One Pan Chicken and Rice', 6, 'protein', null, '[Meat] 1. In a 9x13 pan, combine the rice, water, and onion soup mix. Stir well. | 2. Top with 4 pieces of chicken. | 3. Mix together the ketchup, brown sugar, vinegar, soy sauce, and garlic. | 4. Brush or spoon the sauce over the chicken. | 5. Sprinkle with sesame seeds, if using. | 6. Cover tightly with a 9x13 lid or tin foil. | 7. Bake for 3 hours at 350°F.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1 1/2 rice', '', 'cups', 'Bakery / Dry'),
  ('2 1/4 water', '', 'cups', 'Pantry'),
  ('1 1/2 . onion soup mix', '', 'Tbsp', 'Produce'),
  ('pieces bone-in chicken, skin on', '4', '', 'Meat / Fish'),
  ('Sauce', '', '', 'Spices / Condiments'),
  ('1/4 ketchup', '', 'cup', 'Spices / Condiments'),
  ('. brown sugar', '2', 'Tbsp', 'Bakery / Dry'),
  ('1/2 . vinegar', '', 'tsp', 'Spices / Condiments'),
  ('. soy sauce', '1', 'tsp', 'Spices / Condiments'),
  ('garlic cubes, or garlic powder', '2', '', 'Produce'),
  ('Optional', '', '', 'Pantry'),
  ('Sesame seeds, for sprinkling on top', '', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-047: Cedar Plank Salmon with Maple Glaze
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Cedar Plank Salmon with Maple Glaze', 6, 'protein', null, '[Parve (Fish)] Soak cedar plank in water for 1 hour. When ready to use, remove from the water and proceed with recipe. Do not pat dry. | Place the first 6 ingredients in a saucepan; bring to a slow boil. Remove from the heat and let cool slightly. | Place the salmon in a shallow dish. Reserving about 1/4 cup, pour the glaze over the salmon. Marinate at room temperature for 30 minutes. | Preheat the oven to 400°F. | Place the cedar plank directly on the middle rack in the oven and bake for 8 to 10 minutes or until the wood is lightly toasted. Remove the plank from the oven. While still hot, brush with a thin coating of olive oil. | Remove the salmon from the marinade; discard the marinade. Place the salmon directly on the hot plank and then in a shallow roasting pan. | Roast in the center of the preheated oven for 20 to 25 minutes, basting with the reserved 1/4 cup during the last 10 minutes or until the fish flakes easily with a fork. Glaze the fish with the reserved sauce.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('3/4 pure maple syrup', '', 'cup', 'Spices / Condiments'),
  ('1/4 soy sauce', '', 'cup', 'Spices / Condiments'),
  ('honey', '2', 'tablespoons', 'Spices / Condiments'),
  ('scallions, finely chopped', '2', '', 'Produce'),
  ('garlic cloves, minced', '5', '', 'Produce'),
  ('freshly ground black pepper', '1', 'teaspoon', 'Produce'),
  ('2 1/2 center-cut salmon fillet with skin', '', 'lb', 'Meat / Fish'),
  ('untreated cedar plank', '1', '', 'Pantry'),
  ('Olive oil', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-048: Maple-Glazed Salmon
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Maple-Glazed Salmon', 6, 'protein', null, '[Parve (Fish)] In a small bowl, stir together maple syrup, soy sauce, garlic, and lemon juice. | Preheat oven to 425°F. Line a rimmed baking sheet with parchment paper or foil. | Arrange salmon in a single layer on prepared pan. Pour sauce over fish. Let stand for 20 minutes if desired. | Bake, uncovered, for 12–15 minutes, basting once or twice, until salmon is glazed and golden. Serve hot or at room temperature. | Recipe Note | The screenshot included a handwritten note: bring the maple syrup to a boil first in a cool, dry saucepan before adding the other ingredients. Once opened, maple syrup can be refrigerated for short-term storage or frozen for longer storage.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1/2 pure maple syrup', '', 'cup', 'Spices / Condiments'),
  ('soy sauce or tamari', '3', 'tablespoons', 'Spices / Condiments'),
  ('garlic, minced', '2', 'cloves', 'Produce'),
  ('Juice of 1/2 lemon', '', '', 'Produce'),
  ('–6 salmon fillets (about 6 oz / 180 g each)', '4', '', 'Meat / Fish')
) as t(name, qty, unit, category);

-- SF-049: Lacquered Salmon
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Lacquered Salmon', 6, 'protein', null, '[Parve (Fish)] Preheat oven to 375°F. | Place the soy sauce and sugar into a medium pot. Bring to a boil. Add the ginger, garlic, and whiskey. Reduce the heat to low and simmer for 5 minutes. Remove half the sauce to a container to drizzle over the fish after it is cooked. Set aside. | Brush a broiling pan with olive oil. | Season the salmon fillets with salt and pepper. Place them on the prepared pan. Sprinkle 1 tablespoon of crushed pineapple over each fillet. Drizzle 1 tablespoon of the soy sauce mixture over the top of each fillet. | Bake, uncovered, for about 20–25 minutes, until the salmon is pink and slightly firm to the touch. | Drizzle with the reserved sauce before serving.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1/2 soy sauce', '', 'cup', 'Spices / Condiments'),
  ('1/2 sugar', '', 'cup', 'Bakery / Dry'),
  ('1/2 ground ginger', '', 'teaspoon', 'Produce'),
  ('fresh garlic, minced', '2', 'cloves', 'Produce'),
  ('Jack Daniels or other whiskey', '2', 'teaspoons', 'Pantry'),
  ('Olive oil', '', '', 'Spices / Condiments'),
  ('(6-ounce) salmon fillets', '6', '', 'Meat / Fish'),
  ('Fine sea salt', '', '', 'Spices / Condiments'),
  ('Freshly ground black pepper', '', '', 'Produce'),
  ('(5-ounce) can crushed pineapple, drained', '1', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-050: Basil Pesto Glazed Orzo, Salmon, and Artichokes
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Basil Pesto Glazed Orzo, Salmon, and Artichokes', 6, 'protein', null, '[Parve (Fish)] Preheat oven to 375°F. Spray a broiler pan with nonstick cooking spray. | Place the salmon on the broiler pan. Season with fine sea salt and pepper. Toss the mushrooms with 1 tablespoon olive oil and arrange them around the salmon. | Roast for 25 minutes. Set aside. | Meanwhile, place the remaining 3 tablespoons olive oil into a large soup pot over medium heat. Add orzo and stir to coat with warm oil. Toast until lightly browned and fragrant, stirring occasionally. | Add water to come up halfway in the pot. Add 2 tablespoons fine or coarse sea salt and bring to a boil. Cook orzo until tender, usually 9–11 minutes. Drain and rinse orzo and set aside in a medium bowl. | Place basil leaves into a quart-sized or other high-sided container. Add pistachios, 1 cup extra-virgin olive oil, and a pinch of fine sea salt. Using an immersion blender, purée the mixture. This can also be done in a food processor. | Pour half of this pesto into the orzo. Break the salmon into chunks and add it to the orzo. Add the mushrooms and artichokes. Season with 1/2 teaspoon fine sea salt. Toss to combine. | Place into a bowl or serving platter and drizzle with remaining pesto. | Best served warm or at room temperature. | Note | The screenshot caption said the pesto is especially good and that artichokes can be skipped if desired.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1 1/2 salmon fillet, all pinbones removed', '', 'pounds', 'Meat / Fish'),
  ('Fine and coarse sea salts', '', '', 'Spices / Condiments'),
  ('Freshly ground black pepper', '', '', 'Produce'),
  ('whole button mushrooms, cleaned and halved', '12', '', 'Produce'),
  ('olive oil, divided', '4', 'tablespoons', 'Spices / Condiments'),
  ('(1-pound) box orzo', '1', '', 'Bakery / Dry'),
  ('basil (about 2 cups packed leaves)', '1', 'bunch', 'Pantry'),
  ('1/4 raw shelled pistachios, not roasted or salted', '', 'cup', 'Spices / Condiments'),
  ('extra-virgin olive oil', '1', 'cup', 'Spices / Condiments'),
  ('(6-ounce) jar marinated artichoke hearts, drained', '1', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-051: Pickled Salmon
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Pickled Salmon', 6, 'protein', null, '[Parve (Fish)] In a deep skillet, combine sugar and onions. Cook over low heat, stirring occasionally, until sugar melts. Continue cooking for 5–7 minutes, until onions soften. | Add water, salt, and lemon juice. Raise heat to medium-high; bring to a boil. Add salmon; reduce heat to medium. Cover pan; cook 25–30 minutes. | Serve warm or chilled.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('onions, sliced', '3', '', 'Produce'),
  ('sugar', '2', 'cups', 'Bakery / Dry'),
  ('salmon fillet', '6', 'slices', 'Meat / Fish'),
  ('water', '2', 'cups', 'Pantry'),
  ('salt', '1', 'tablespoon', 'Spices / Condiments'),
  ('1/2 lemon juice', '', 'cup', 'Produce')
) as t(name, qty, unit, category);

-- SF-052: Royal Salmon Recipe
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Royal Salmon Recipe', 6, 'protein', null, '[Parve (Fish)] Add 1 cup sugar and the sliced onion to a pot. Cook until the sugar melts, then mix together and add the remaining ingredients. | Bring to a low boil, then add the fish. | Cook another 20–30 minutes, being careful not to overcook. | Serve cool. | Mayo Sauce | Mayonnaise | Chives or dill | Garlic powder | Water, to thin')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('–6 slices salmon', '4', '', 'Meat / Fish'),
  ('sugar', '1', 'cup', 'Bakery / Dry'),
  ('large onion', '1', '', 'Produce'),
  ('1/4 vinegar', '', 'cup', 'Spices / Condiments'),
  ('1/4 lemon juice', '', 'cup', 'Produce'),
  ('sugar', '6', 'tablespoons', 'Bakery / Dry'),
  ('salt', '1', 'teaspoon', 'Spices / Condiments'),
  ('bay leaves', '4', '', 'Pantry'),
  ('Pickling spice, optional, instead of some bay leaves', '', '', 'Spices / Condiments'),
  ('3 1/2 water', '', 'cups', 'Pantry')
) as t(name, qty, unit, category);

-- SF-053: Parmesan-Crusted Grouper (or Sea Bass)
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Parmesan-Crusted Grouper (or Sea Bass)', 6, 'protein', null, '[Parve (Fish)] Preheat broiler to high. | Combine cheese, butter, mayonnaise, and scallions. | Place fish in a lightly greased pan. | Squeeze juice of 1 lemon over fillets and sprinkle with black pepper. | Broil about 6 inches from the heat for 10 minutes. | Remove from oven. Spread the Parmesan mixture over the fish. | Broil 2 minutes more, or until lightly browned and bubbly.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1/2 grated Parmesan', '', 'cup', 'Dairy / Eggs'),
  ('1/3 butter, soft but not melted', '', 'cup', 'Dairy / Eggs'),
  ('mayonnaise', '2', 'tablespoons', 'Spices / Condiments'),
  ('scallions, sliced thinly', '2', '', 'Produce'),
  ('large or 4 small grouper fillets', '2', '', 'Pantry'),
  ('lemon', '1', '', 'Produce'),
  ('Black pepper', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-054: Lemon Caper Fish
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Lemon Caper Fish', 6, 'protein', '/recipe-photos/lemon-caper-fish.jpg', '[Parve (Fish)] Place fillets in a baking dish or on a baking sheet. | Top with capers, butter, lemon, thyme, salt, and pepper. | Bake until the fish is cooked through and flakes easily. | Note | The original screenshot was a dinner story with no exact oven temperature or time shown.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Fish fillets', '', '', 'Meat / Fish'),
  ('Capers', '', '', 'Pantry'),
  ('Butter', '', '', 'Dairy / Eggs'),
  ('Lemon', '', '', 'Produce'),
  ('Fresh thyme', '', '', 'Pantry'),
  ('Salt', '', '', 'Spices / Condiments'),
  ('Black pepper', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-055: Tuna Tartare in Sesame Ginger Sauce
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Tuna Tartare in Sesame Ginger Sauce', 6, 'protein', null, '[Parve (Fish)] Add all sauce ingredients to a bowl and mix together. Set aside. | Add the cut tuna, green onions, and sesame seeds directly to the bowl of sauce and mix until combined. | In a separate bowl, mix together the finely chopped avocado, cucumber, cilantro, lime juice, salt, and pepper. | Plate the tartare using a mold, or by arranging it free-form, and serve.')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-056: Salmon with Vegetable Sauce
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Salmon with Vegetable Sauce', 6, 'protein', null, '[Parve (Fish)] Sauté onions in oil until soft. | Add peppers and sauté on high for about 20 minutes, stirring every few minutes. | Add tomatoes and sauté for another 5 minutes. | Add spices and the rest of the ingredients. Cover and cook for 45 minutes on low. | Place salmon fillet slices in a pan and pour the vegetable sauce over them. Cover pan and bake in a preheated 350°F oven for 1 hour. | Serve warm.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Salmon fillet slices', '', '', 'Meat / Fish'),
  ('onions, diced', '2', '', 'Produce'),
  ('Oil', '', '', 'Spices / Condiments'),
  ('red bell peppers, diced', '2', '', 'Produce'),
  ('orange bell peppers, diced', '2', '', 'Produce'),
  ('green bell peppers, diced', '2', '', 'Produce'),
  ('yellow bell peppers, diced', '2', '', 'Produce'),
  ('beef tomatoes, diced', '4', '', 'Produce'),
  ('Hot peppers, from jar or fresh, diced (optional)', '', '', 'Produce'),
  ('1/4 soy sauce', '', 'cup', 'Spices / Condiments'),
  ('1/2 ketchup', '', 'cup', 'Spices / Condiments'),
  ('onion soup mix', '1', 'tablespoon', 'Produce'),
  ('garlic cloves (or frozen cubes), crushed', '2', '', 'Produce'),
  ('1/2 black pepper', '', 'teaspoon', 'Produce'),
  ('salt', '1', 'teaspoon', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-057: Za’atar Salmon with Pomegranate Gremolata
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Za’atar Salmon with Pomegranate Gremolata', 6, 'protein', null, '[Parve (Fish)] Preheat oven to 400°F. Line a baking sheet with parchment paper. | Place salmon on prepared baking sheet. In a small bowl, combine oil and spices. Pat onto fish; roast for 12–15 minutes, or until the edges are browned and crisp and the fish flakes easily. | Prepare the gremolata. In a small bowl, toss together parsley, pomegranate seeds, garlic, pistachios, lemon rind, and salt. | Top salmon with gremolata and serve. | Try This | Substitute za’atar with 1 tablespoon honey plus 2 tablespoons maple syrup. | Note | Za’atar is a blend that has many adaptations; look for one with hyssop leaves and sumac.')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-058: Side of Salmon
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Side of Salmon', 6, 'protein', null, '[Parve (Fish)] Preheat oven to 425°F. | Soak salmon in lemon juice for 10 minutes. Wash with cold water. Pat dry and place on a baking sheet lined with parchment paper. | Combine all marinade ingredients. Pour over salmon. | Combine all crumb ingredients in a food processor. Blend until just combined. Crumbs can be prepared in advance and frozen until needed. Any leftover crumbs can also be frozen and used on individual slices of salmon. Top salmon with a generous layer of crumbs. | Bake for 30–40 minutes. After 10 minutes, place a loose piece of aluminum foil over the fish so that the crumbs do not burn. | Prepare the dressing. Blend all ingredients together using an immersion blender or food processor. | Serve fish on a platter at room temperature with dressing on the side.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('side of salmon (about 14–18 inches long)', '1', '', 'Meat / Fish'),
  ('Lemon juice', '', '', 'Produce'),
  ('Fish Marinade', '', '', 'Meat / Fish'),
  ('1/4 lemon juice', '', 'cup', 'Produce'),
  ('1 1/2 mustard', '', 'tablespoons', 'Spices / Condiments'),
  ('1/2 garlic', '', 'clove', 'Produce'),
  ('1 1/2 honey', '', 'teaspoons', 'Spices / Condiments'),
  ('1 1/2 olive oil', '', 'teaspoons', 'Spices / Condiments'),
  ('Crumbs', '', '', 'Bakery / Dry'),
  ('breadcrumbs', '1', 'cup', 'Bakery / Dry'),
  ('garlic', '1', 'clove', 'Produce'),
  ('1/2 fresh parsley', '', 'bunch', 'Produce'),
  ('1/2 salt', '', 'teaspoon', 'Spices / Condiments'),
  ('black pepper', '', 'Dash', 'Produce'),
  ('1/4 almonds', '', 'cup', 'Pantry'),
  ('1/4 pistachios', '', 'cup', 'Pantry'),
  ('Or any combination of nuts totaling 1/2 cup', '', '', 'Pantry'),
  ('Dressing', '', '', 'Pantry'),
  ('1/4 oil', '', 'cup', 'Spices / Condiments'),
  ('1/4 honey', '', 'cup', 'Spices / Condiments'),
  ('vinegar', '2', 'tablespoons', 'Spices / Condiments'),
  ('1/2 mustard', '', 'teaspoon', 'Spices / Condiments'),
  ('1/2 salt', '', 'teaspoon', 'Spices / Condiments'),
  ('garlic clove', '1', '', 'Produce'),
  ('black pepper', '', 'Dash', 'Produce')
) as t(name, qty, unit, category);

-- SF-059: Elisheva Vegetable Chicken Soup
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Elisheva Vegetable Chicken Soup', 6, 'soup', '/recipe-photos/elisheva-vegetable-chicken-soup.jpg', '[Meat] Fry the onions, scallions, and celery over a low flame. | Add sliced carrots. | Put the chicken on the bone in a net and place it in the pot. | Add water, salt, and any spices you want. Bring to a boil. | Once it boils, lower the flame and cook for 50 minutes to 1 hour. | Take out the chicken and cut it into small pieces. | Return the chicken to the pot, then add the squash and cook for another 40 minutes. | Notes | Some quantities were not specified in the screenshot and are preserved as originally written.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Onions', '', '', 'Produce'),
  ('Scallions', '', '', 'Produce'),
  ('Celery', '', '', 'Produce'),
  ('Carrots, sliced', '', '', 'Produce'),
  ('Chicken on the bone in a net (at least 5 large pieces, such as triangle pieces and drumsticks)', '', '', 'Meat / Fish'),
  ('Water', '', '', 'Pantry'),
  ('Salt', '', '', 'Spices / Condiments'),
  ('Whatever spices you want', '', '', 'Spices / Condiments'),
  ('Squash', '', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-060: Cauliflower Zucchini Soup
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Cauliflower Zucchini Soup', 6, 'soup', null, '[Parve] Heat oil in a pot. Add the onions and let them steam until translucent. Add salt. | Cube the zucchini and cauliflower, add to the pot, and add salt again. Cook until the vegetables soften. | Slowly add water to cover. Add the seasonings, cover, and let simmer for 30–60 minutes. | Once softened, blend into a smooth purée.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Oil, for sautéing', '', '', 'Spices / Condiments'),
  ('–5 onions', '3', '', 'Produce'),
  ('Salt, to taste', '', '', 'Spices / Condiments'),
  ('zucchinis', '8', '', 'Produce'),
  ('head cauliflower, or 1 frozen bag cauliflower', '1', '', 'Produce'),
  ('Water, to cover', '', '', 'Pantry'),
  ('dried dill', '3', 'Tbsp', 'Produce'),
  ('tamari sauce (optional)', '1', 'Tbsp', 'Spices / Condiments'),
  ('oil', '1', 'Tbsp', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-061: Slow-Cooked French Onion Soup
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Slow-Cooked French Onion Soup', 6, 'soup', null, '[Dairy] Preheat the oven to 400°F. In a roasting pan, roast the chopped onions and minced garlic with the butter, uncovered, for 1 hour, stirring the onions and garlic with the butter once. | Transfer the roasted onion mixture to a 5-quart slow cooker and add the stock, wine, Worcestershire sauce, balsamic vinegar, bay leaf, salt, black pepper, and thyme. Cover and cook on low until the onions are very tender, at least 6 hours. The soup can be cooked for up to 10–12 hours. | About 15 minutes before serving, prepare the baguette slices: Preheat the oven to 450°F. Arrange the baguette slices on a cookie sheet and bake until toasted, about 5 minutes. Remove from the oven, top with shredded cheese, and bake until the cheese is browned and bubbling, about 10 minutes. | To serve, place some shredded cheese in each bowl, fill with soup, and allow the cheese to melt. Top with the toasted baguettes. | Notes | Serves 8.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('onions, chopped', '6', '', 'Produce'),
  ('garlic, minced', '6', 'cloves', 'Produce'),
  ('1/2 (1 stick) butter', '', 'cup', 'Dairy / Eggs'),
  ('pareve chicken or beef stock', '8', 'cups', 'Meat / Fish'),
  ('1/4 port wine or dry red wine', '', 'cup', 'Pantry'),
  ('Worcestershire sauce', '2', 'Tbsp', 'Spices / Condiments'),
  ('balsamic vinegar', '2', 'Tbsp', 'Spices / Condiments'),
  ('bay leaf', '1', '', 'Pantry'),
  ('1/2 sea salt or kosher salt', '', 'Tbsp', 'Spices / Condiments'),
  ('Fresh black pepper', '', '', 'Produce'),
  ('sprig thyme', '1', '', 'Pantry'),
  ('baguette slices', '8', '', 'Pantry'),
  ('Shredded cheese of choice', '', '', 'Dairy / Eggs')
) as t(name, qty, unit, category);

-- SF-062: Cream of Chicken Soup
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Cream of Chicken Soup', 6, 'soup', null, '[Meat] Heat oil in a large pot. Add onions and garlic and sauté over high heat until the onions are translucent and soft, about 8–10 minutes. | Add zucchini, lower the heat to medium, and add the water. Place the chicken in a soup bag and add it to the soup. Add the seasonings and let cook for 1 1/2 hours, until the chicken is soft. | Remove the chicken bag from the soup. Using an immersion blender, blend the soup until smooth. Slowly add the cornstarch mixture to thicken the soup. | Remove the chicken from the bone, cut it into bite-sized pieces, and add it back to the soup.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('oil', '3', 'Tbsp', 'Spices / Condiments'),
  ('large onion, diced', '1', '', 'Produce'),
  ('garlic cloves', '12', '', 'Produce'),
  ('medium zucchini, diced', '4', '', 'Produce'),
  ('–10 cups water', '8', '', 'Pantry'),
  ('chicken bottoms', '4', '', 'Meat / Fish'),
  ('chicken soup mix', '1', 'Tbsp', 'Meat / Fish'),
  ('salt', '2', 'Tbsp', 'Spices / Condiments'),
  ('Pepper, to taste', '', '', 'Produce'),
  ('cornstarch diluted in 4 Tbsp water', '2', 'Tbsp', 'Pantry')
) as t(name, qty, unit, category);

-- SF-063: Parsley Garlic Bread on a Skewer
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Parsley Garlic Bread on a Skewer', 6, 'soup', null, '[Parve] Preheat the oven to 400°F. | Cut the mini baguettes lengthwise. One at a time, and making sure to stay centered, thread a skewer through the baguette so it can lay flat across the bowl. Place the prepared baguettes on a baking sheet. | Mix parsley, garlic, olive oil, and salt in a small bowl. Divide this mixture between the 8 baguette halves, spreading it all over the bread. | Bake for 10–15 minutes, until browned a bit at the edges and fragrant. | Carefully place over any soup that works well with the bread. | Notes | To prepare in advance, underbake slightly, freeze, then thaw and rewarm until crisp and fragrant.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Long wood skewers (make sure they are long enough to rest on both extremities of the soup bowl)', '', '', 'Pantry'),
  ('mini baguettes (par-baked ones work well)', '4', '', 'Pantry'),
  ('cubes frozen chopped parsley', '4', '', 'Produce'),
  ('–3 cubes frozen minced garlic', '2', '', 'Produce'),
  ('About 4 Tbsp olive oil', '', '', 'Spices / Condiments'),
  ('of salt', '', 'Dash', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-064: Elegant Soup Stick
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Elegant Soup Stick', 6, 'soup', null, '[Parve] Preheat oven to 350°F. | Using a sharp knife, cut out 3 long sticks (about 1 1/4 inches wide) at the center of each wrap. Cut out as many as you need. | Spray the sticks with cooking spray and bake for about 8 minutes, or until browned and cracker-like. | When plating, place one cracker on each soup and top with garnish of your choice. | Notes | These can be prepared in advance and either frozen or stored in an airtight container.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Large wheat wraps (each wrap gives 3 soup sticks)', '', '', 'Pantry'),
  ('Garnishes of your choice, such as: thinly sliced radishes, julienned vegetables, chopped chives, herbs, sliced peppers, thinly sliced cucumbers, or pretty colored cherry tomatoes', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-065: Vegetarian “Pho” in a Jar (or Bowl)
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Vegetarian “Pho” in a Jar (or Bowl)', 6, 'soup', null, '[Meat] In the bottom of the jar, combine salt, tamarind paste, lime juice, sesame oil, bouillon, garlic, ginger, and soy sauce. | Add the vegetables in order. If adding other vegetables, make sure to start on the bottom with ones that won’t get soggy. Cover tightly and refrigerate until ready to serve. | When ready to eat, fill the jar with boiling water. Cover tightly and turn the jar up and down a few times to distribute flavor. Let sit for 8 minutes, until the vegetables soften and the flavors blend. | Pour into a bowl, or eat right out of the jar. | Notes | Serves 1 lunch.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('empty 32-ounce jar', '1', '', 'Pantry'),
  ('1/4 salt', '', 'tsp', 'Spices / Condiments'),
  ('1/4 tamarind paste', '', 'tsp', 'Pantry'),
  ('lime juice', '2', 'tsp', 'Produce'),
  ('sesame oil', '1', 'tsp', 'Spices / Condiments'),
  ('3/4 beef bouillon cube, smashed (or 2 heaping tsp onion soup mix)', '', '', 'Produce'),
  ('garlic clove, minced', '1', '', 'Produce'),
  ('1/2 fresh ginger, finely minced', '', 'tsp', 'Produce'),
  ('soy sauce', '2', 'tsp', 'Spices / Condiments'),
  ('1/2 shredded carrots', '', 'cup', 'Produce'),
  ('1/2 shredded red cabbage', '', 'cup', 'Pantry'),
  ('1/2 chopped baby bok choy', '', 'cup', 'Pantry'),
  ('–4 scallions, finely chopped', '3', '', 'Produce'),
  ('zucchini, spiralized or peeled with a julienne peeler', '1', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-066: Cauliflower Soup with Beef-Fry Croutons
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Cauliflower Soup with Beef-Fry Croutons', 6, 'soup', null, '[Dairy] Preheat oven to 400°F. Line a baking sheet with parchment paper. | Toss the cauliflower with the olive oil, 1 tablespoon kosher salt, and 1/2 teaspoon black pepper. Spread on the prepared baking sheet and roast until golden brown, 35–40 minutes. | Slice the beef fry widthwise into very short, narrow strips. Place into a 6-quart pot over medium-high heat and cook, stirring occasionally, until browned and crisp, 10–12 minutes. Remove with a slotted spoon, drain on paper towels, and set aside. Do not discard the rendered fat. | Add the celery, onion, garlic, and dill to the rendered fat and cook for 8–10 minutes, stirring occasionally. Add the sherry and raise the heat. Cook until the liquid is mostly evaporated, about 5 minutes. | Add the roasted cauliflower, broth, nondairy milk, and bay leaves. Season with the remaining 1 tablespoon kosher salt and 1/2 teaspoon black pepper. Bring to a low boil, then reduce heat and simmer for 25–30 minutes. | Remove and discard bay leaves. Using an immersion blender, purée the soup until smooth. Garnish with the beef-fry croutons.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('(24-oz) bag frozen cauliflower, defrosted and drained', '1', '', 'Produce'),
  ('olive oil', '3', 'Tbsp', 'Spices / Condiments'),
  ('kosher salt, divided', '2', 'Tbsp', 'Spices / Condiments'),
  ('black pepper, divided', '1', 'tsp', 'Produce'),
  ('beef fry (about 6 slices)', '4', 'oz', 'Meat / Fish'),
  ('ribs celery, sliced', '4', '', 'Produce'),
  ('small onion, diced', '1', '', 'Produce'),
  ('garlic, crushed', '2', 'cloves', 'Produce'),
  ('fresh dill leaves', '3', 'Tbsp', 'Produce'),
  ('1/3 sherry wine', '', 'cup', 'Pantry'),
  ('chicken broth or 6 cups water + 2 Tbsp chicken soup mix', '6', 'cups', 'Meat / Fish'),
  ('3/4 almond milk or any nondairy milk', '', 'cup', 'Dairy / Eggs'),
  ('bay leaves', '2', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-067: Roasted Mediterranean Vegetable Soup
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Roasted Mediterranean Vegetable Soup', 6, 'soup', null, '[Dairy] Preheat oven to 375°F. | Brush two large, shallow baking dishes with 1 tablespoon olive oil. Arrange tomatoes, peppers, zucchini, and eggplant in a single layer, cut sides down. Sprinkle garlic and onion around the vegetables and drizzle with the remaining oil. Sprinkle with thyme and oregano and season with salt and pepper to taste. | Place in oven and roast, uncovered, for 30–35 minutes, or until soft and browned. Once cooled, scrape out the eggplant flesh and remove skin from peppers and tomatoes. | Add the vegetables to a bowl and use an immersion blender to purée the eggplant, peppers, zucchini, tomatoes, garlic, and onion until chunky like a salsa, not completely smooth. | In a soup pot, combine the chunky vegetable mixture with the broth and simmer for 20–30 minutes. Stir in the nondairy milk and simmer until hot. Add salt and pepper to taste. | Serve warm, topped with shredded basil. | Notes | Serves 6.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('extra-virgin olive oil', '3', 'Tbsp', 'Spices / Condiments'),
  ('vine-ripe tomatoes, halved', '1', 'lb', 'Produce'),
  ('large yellow peppers, seeded and halved', '3', '', 'Produce'),
  ('zucchinis, halved lengthwise', '3', '', 'Produce'),
  ('small eggplant, halved lengthwise', '1', '', 'Produce'),
  ('garlic cloves, halved', '4', '', 'Produce'),
  ('onions, cut into eighths', '2', '', 'Produce'),
  ('1/4 dried thyme', '', 'tsp', 'Pantry'),
  ('1/4 dried oregano', '', 'tsp', 'Spices / Condiments'),
  ('chicken or vegetable stock', '4', 'cups', 'Meat / Fish'),
  ('1/2 nondairy milk substitute', '', 'cup', 'Dairy / Eggs'),
  ('kosher salt', '1', 'tsp', 'Spices / Condiments'),
  ('1/4 ground black pepper', '', 'tsp', 'Produce'),
  ('Fresh basil, shredded, for garnish', '', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-068: Cream of Broccoli Soup
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Cream of Broccoli Soup', 6, 'soup', null, '[Meat] Sauté the onions until clear. | Add the leek, broccoli florets, chicken soup mix, salt, and pepper. | Cook until soft. | Blend until smooth. | Notes | Some quantities were not specified in the message and are preserved as written.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Leek', '', '', 'Pantry'),
  ('large onions (sautéed until clear)', '2', '', 'Produce'),
  ('Frozen broccoli florets', '', '', 'Produce'),
  ('chicken soup mix', '1', 'Tbsp', 'Meat / Fish'),
  ('Salt and pepper, to taste', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-069: Chunky Hearty Vegetable Soup
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Chunky Hearty Vegetable Soup', 6, 'soup', null, '[Meat] Sauté the garlic in a little light olive oil. | Add the onions, zucchini, yellow squash, and carrots and cook until beginning to soften. | Add the frozen cauliflower florets. | Season with black pepper, salt, paprika, and chicken soup mix. | Fill the pot with water and cook until the vegetables are tender. | Make a big pot and freeze the rest.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('A little light olive oil', '', '', 'Spices / Condiments'),
  ('garlic cloves', '2', '', 'Produce'),
  ('–2 onions', '1', '', 'Produce'),
  ('–3 zucchini', '2', '', 'Produce'),
  ('–2 yellow squash', '1', '', 'Pantry'),
  ('–4 carrots', '3', '', 'Produce'),
  ('1/2 –3/4 bag frozen cauliflower florets', '', '', 'Produce'),
  ('Black pepper', '', '', 'Produce'),
  ('Salt', '', '', 'Spices / Condiments'),
  ('Paprika', '', '', 'Spices / Condiments'),
  ('Chicken soup mix (no MSG)', '', '', 'Meat / Fish'),
  ('Water, to fill the pot', '', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-070: Zucchini Soup (Daniella)
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Zucchini Soup (Daniella)', 6, 'soup', null, '[Meat] Sauté the onion in oil. Add the zucchini and carrot and sauté until soft. | Add the parsley, dill, flour, boiling water, chicken soup mix, salt, and pepper. | Simmer for 1 hour. | Blend until smooth.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('medium onion', '1', '', 'Produce'),
  ('medium zucchini, cut into thin slices', '3', '', 'Produce'),
  ('carrot', '1', '', 'Produce'),
  ('A few cubes parsley', '', '', 'Produce'),
  ('A few cubes dill', '', '', 'Produce'),
  ('flour', '3', 'Tbsp', 'Bakery / Dry'),
  ('boiling water', '6', 'cups', 'Spices / Condiments'),
  ('chicken soup mix', '4', 'Tbsp', 'Meat / Fish'),
  ('Salt and pepper', '', '', 'Produce'),
  ('Oil, for sautéing', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-071: Cauliflower Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Cauliflower Salad', 6, 'salad', null, '[Parve] ')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('head cauliflower, soaked and cleaned', '1', '', 'Produce'),
  ('Black olives, sliced', '', '', 'Pantry'),
  ('Green olives, sliced', '', '', 'Pantry'),
  ('Red onion', '', '', 'Produce'),
  ('Green pepper (or any color)', '', '', 'Produce'),
  ('Dressing / Approx.', '', '', 'Pantry'),
  ('salt', '1', 'tbsp', 'Spices / Condiments'),
  ('Splenda', '2', '', 'Pantry'),
  ('1/8 lemon juice', '', 'cup', 'Produce'),
  ('1/4 oil', '', 'cup', 'Spices / Condiments'),
  ('Taste and decide.', '', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-072: Clementine Glazed Chicken and Baby Arugula Salad with Balsamic-Soy Vinaigrette
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Clementine Glazed Chicken and Baby Arugula Salad with Balsamic-Soy Vinaigrette', 6, 'salad', null, '[Parve] Prepare the marinade in a bowl. Whisk together the soy sauce, oil, sesame oil, honey, garlic, clementine juice, red pepper flakes, salt, and black pepper. | Place the chicken in a zip-top bag with the marinade and shake to mix. Seal and leave overnight in the refrigerator, or for at least 6 hours. | Prepare the vinaigrette in a jar or cruet. Combine all dressing ingredients and shake until well combined. | Remove the chicken from the marinade and grill or broil for 6-8 minutes per side. | In a large bowl, combine the baby arugula, red onion, endive, pomegranate seeds, sunflower seeds, and slivered almonds. Toss with the vinaigrette. | Arrange the clementine slices either on top of the salad or on the side, and sprinkle them with pomegranate seeds and black sesame seeds. | Serve with the chicken. | Notes | Serves 6.')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-073: Arugula and Endive Salad with Maple Walnuts
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Arugula and Endive Salad with Maple Walnuts', 6, 'salad', null, '[Parve] Preheat the oven to 350 F. In a small bowl, coat the walnuts with the maple syrup and spread in a single layer on a baking sheet. | Bake for 10 minutes, or until fragrant. Allow to cool. | To prepare the dressing, place all dressing ingredients in a small jar or cruet and shake well to combine. | In a large salad bowl, combine the walnuts with the salad ingredients. Add the dressing and toss to combine. | Serve immediately. | Notes | Serves 6-8.')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-074: Classic Cobb Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Classic Cobb Salad', 6, 'salad', null, '[Parve] ')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-075: Cucumber Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Cucumber Salad', 6, 'salad', null, '[Parve] Salt the cucumbers and let sit for 1/2 hour. | Notes | The handwritten source note only included the brief direction above.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1 1/2 water', '', 'cups', 'Pantry'),
  ('3/4 vinegar', '', 'cup', 'Spices / Condiments'),
  ('sugar', '1', 'cup', 'Bakery / Dry'),
  ('cucumbers', '10', '', 'Produce'),
  ('carrot (optional)', '1', '', 'Produce'),
  ('small purple onion', '1', '', 'Produce'),
  ('salt', '1', 'tbsp', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-076: Pastrami, Apple & Pomegranate Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Pastrami, Apple & Pomegranate Salad', 6, 'salad', null, '[Parve] Slice pastrami and saute in a small amount of oil until it starts to get crispy. Do not let it dry out. Remove from the heat and cool. | Store in a container in the refrigerator until ready to use. | For the dressing, blend onion and sugar well using a food processor. Add vinegar and salt. | Slowly add the oil and blend for a few minutes until the color starts to lighten and the dressing becomes creamy. | Store the dressing in a container in the refrigerator for up to a week. | To assemble, place lettuce, apple, and pomegranate seeds in a bowl. Top with pastrami and drizzle with dressing. Toss and serve. | Notes | Yield: 8-10 servings. | Note from source: you can seed the pomegranate in advance, but it is best to cut and prep the apple and lettuce right before serving. | Note from source: if you do not use vinegar on Rosh Hashanah, this salad will still be delicious with any salad dressing you are able to use.')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-077: Mushroom Romaine Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Mushroom Romaine Salad', 6, 'salad', null, '[Parve] ')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('chopped Romaine lettuce (or a combination of Romaine and spinach or other greens)', '16', 'ounces', 'Produce'),
  ('medium sweet potatoes', '2', '', 'Produce'),
  ('3-4 oil, divided', '', 'tbsp', 'Spices / Condiments'),
  ('baby bella or white button mushrooms', '10', 'ounces', 'Produce'),
  ('Salt and pepper, to season', '', '', 'Produce'),
  ('1/4 toasted slivered almonds', '', 'cup', 'Pantry'),
  ('1/4 pomegranate seeds', '', 'cup', 'Pantry'),
  ('Dressing', '', '', 'Pantry'),
  ('1/2 mayonnaise', '', 'cup', 'Spices / Condiments'),
  ('1/4 soy sauce', '', 'cup', 'Spices / Condiments'),
  ('1/4 honey', '', 'cup', 'Spices / Condiments'),
  ('garlic, crushed', '1', 'clove', 'Produce'),
  ('Notes', '', '', 'Pantry'),
  ('The source image did not include the full instructions section.', '', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-078: Silan and Lime Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Silan and Lime Salad', 6, 'salad', null, '[Parve] In a large bowl, combine greens, mango, oranges, and cucumbers. | Whisk the dressing ingredients separately and toss with the salad, or simply drizzle all the dressing ingredients over the greens and toss. | Top with Craisins and almonds and enjoy.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('arugula, spinach, baby kale, or mixed greens (or just Romaine)', '5', 'ounces', 'Produce'),
  ('mangos, diced', '2', '', 'Produce'),
  ('orange, supremed and diced', '1', '', 'Pantry'),
  ('Persian cucumbers, diced', '2', '', 'Produce'),
  ('A handful Craisins', '', '', 'Pantry'),
  ('A handful sliced almonds', '', '', 'Pantry'),
  ('Dressing', '', '', 'Pantry'),
  ('silan', '2', 'tbsp', 'Spices / Condiments'),
  ('limes, juiced', '2', '', 'Produce'),
  ('garlic clove, crushed', '1', '', 'Produce'),
  ('salt', '1', 'tsp', 'Spices / Condiments'),
  ('coarse black pepper', '', 'Pinch', 'Produce'),
  ('1-2 olive oil', '', 'tbsp', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-079: Purple Cabbage Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Purple Cabbage Salad', 6, 'salad', null, '[Parve] ')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-080: Not Your Typical Cucumber Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Not Your Typical Cucumber Salad', 6, 'salad', null, '[Parve] Mix all dressing ingredients together before mixing over the vegetables. | This salad should last almost a week in the fridge. | Feel free to make it your own by adding in radishes or chickpeas or whatever you are in the mood for.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('5-6 kirbies or small English cucumbers', '', '', 'Produce'),
  ('small red onion', '1', '', 'Produce'),
  ('mini Israeli pickles', '8', '', 'Pantry'),
  ('You can also use dill or gherkins. If the pickles are large, use approximately 5.', '', '', 'Produce'),
  ('Dressing', '', '', 'Pantry'),
  ('mayo', '4', 'tbsp', 'Pantry'),
  ('white vinegar', '3', 'tbsp', 'Spices / Condiments'),
  ('salt', '1', 'tsp', 'Spices / Condiments'),
  ('sugar or sweetener', '2', 'tsp', 'Bakery / Dry'),
  ('fresh or dried dill', '2', 'tsp', 'Produce')
) as t(name, qty, unit, category);

-- SF-081: Light N Springy Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Light N Springy Salad', 6, 'salad', null, '[Parve] In a large bowl, toss together arugula, spinach, apple, walnuts, and cranberries. | The source image shows the beginning of step 2: prepare the dressing by whisking together the vinegar, orange zest, orange juice, mustard, maple syrup, salt, and pepper. The remainder of the step is cut off in the screenshot. | Notes | The source image includes a serving suggestion: add roasted pastrami strips on top.')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-082: Baby Red Potato Salad with Caesar Dill Dressing
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Baby Red Potato Salad with Caesar Dill Dressing', 6, 'salad', null, '[Parve] Preheat the oven to 350 F. | Wash and dry the potatoes. Leaving the peels on, cut each potato in half and place in a baking pan. | Sprinkle the potatoes with oil, salt, and pepper. Bake, covered, until cooked through, about 1 hour. | In a large bowl, combine the baked potatoes with the mayonnaise, mustard, lemon juice, Worcestershire sauce, gherkins, and dill. | Season with salt and pepper. Serve warm, at room temperature, or cold. | Notes | Serves 4-6.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('baby red potatoes, peels intact', '2', 'lb', 'Produce'),
  ('oil', '1', 'tbsp', 'Spices / Condiments'),
  ('mayonnaise', '4', 'tbsp', 'Spices / Condiments'),
  ('Dijon mustard', '1', 'tsp', 'Spices / Condiments'),
  ('garlic (fresh or frozen), minced', '1', 'clove', 'Produce'),
  ('lemon juice', '1', 'tsp', 'Produce'),
  ('1/2 Worcestershire sauce', '', 'tsp', 'Spices / Condiments'),
  ('gherkin dill pickles, finely diced', '3', '', 'Produce'),
  ('fresh dill, chopped', '3', 'tbsp', 'Produce'),
  ('Kosher salt', '', '', 'Spices / Condiments'),
  ('Fresh black pepper', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-083: Kale Quinoa Salad (Raizys Fave Urbana Salad)
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Kale Quinoa Salad (Raizys Fave Urbana Salad)', 6, 'salad', null, '[Parve] Massage the kale with the listed kale-prep ingredients and set aside. | The remaining directions are cut off in the source image. | Notes | The source image notes that if checked kale is unavailable, baby greens can be used.')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-084: Broccoli Slaw with Craisins, Red Onion, and Cashews
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Broccoli Slaw with Craisins, Red Onion, and Cashews', 6, 'salad', '/recipe-photos/broccoli-slaw.jpg', '[Parve] ')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-085: Soba Spring Noodle Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Soba Spring Noodle Salad', 6, 'salad', '/recipe-photos/soba-spring-noodle-salad.jpg', '[Dairy] Whisk together all dressing ingredients until smooth. Peanut butter may take a little extra whisking to fully incorporate. | Combine all salad ingredients in a bowl, or layer them in a terrine-style bowl for presentation. | Toss with dressing when ready to serve and top with any desired toppings.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1/2 Gefen Lo Mein noodles, prepared according to package instructions', '', 'package', 'Bakery / Dry'),
  ('shelled edamame, defrosted', '1', 'cup', 'Pantry'),
  ('carrots, julienned', '2', '', 'Produce'),
  ('red cabbage, or a mixture of red and green cabbage', '4', 'cups', 'Pantry'),
  ('baby spinach, or 1 large handful', '2', 'ounces', 'Produce'),
  ('Dressing', '', '', 'Pantry'),
  ('1/4 peanut butter', '', 'cup', 'Dairy / Eggs'),
  ('soy sauce', '3', 'tablespoons', 'Spices / Condiments'),
  ('1/4 rice vinegar', '', 'cup', 'Bakery / Dry'),
  ('honey', '1', 'tablespoon', 'Spices / Condiments'),
  ('Juice of 1 fresh lime', '', '', 'Produce'),
  ('garlic cloves, crushed', '2', '', 'Produce'),
  ('1/2 salt', '', 'teaspoon', 'Spices / Condiments'),
  ('Optional Toppings', '', '', 'Pantry'),
  ('Cilantro, chopped', '', '', 'Produce'),
  ('Scallions, chopped', '', '', 'Produce'),
  ('Sesame seeds', '', '', 'Pantry'),
  ('Peanuts', '', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-086: Simple Lemon Oil Dressing
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Simple Lemon Oil Dressing', 6, null, null, '[Parve] Whisk together and toss with salad. | Notes | The screenshot did not give an exact amount for the garlic salt.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Juice of 1 lemon', '', '', 'Produce'),
  ('olive oil', '1', 'teaspoon', 'Spices / Condiments'),
  ('Garlic salt (from Trader Joe’s), to taste', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-087: Sium Hashas Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Sium Hashas Salad', 6, 'starch', null, '[Parve] Combine lettuce, mango, pistachios, tomatoes, dried cranberries, and onion in a large bowl. | Place dressing ingredients in a small jar and shake, or blend to combine. | Toss dressing with salad and serve.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('head or bag of lettuce, any variety', '1', '', 'Produce'),
  ('mango, cubed', '1', '', 'Produce'),
  ('1/2 salted, shelled pistachios', '', 'cup', 'Spices / Condiments'),
  ('grape tomatoes, halved', '1', 'cup', 'Produce'),
  ('red onion, diced', '1', '', 'Produce'),
  ('dried cranberries', '1', 'cup', 'Produce'),
  ('Dressing', '', '', 'Pantry'),
  ('1/2 mayonnaise', '', 'cup', 'Spices / Condiments'),
  ('sugar', '3', 'teaspoons', 'Bakery / Dry'),
  ('lemon juice', '3', 'teaspoons', 'Produce'),
  ('Sprinkle salt and pepper', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-088: Basic Salad Dressing
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Basic Salad Dressing', 6, 'starch', null, '[Parve] Combine mayonnaise, lemon juice, salt, and sugar until smooth. | Use immediately or refrigerate until needed.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('mayonnaise', '8', 'tablespoons', 'Spices / Condiments'),
  ('lemon juice', '6', 'tablespoons', 'Produce'),
  ('salt', '1', 'teaspoon', 'Spices / Condiments'),
  ('sugar', '6', 'tablespoons', 'Bakery / Dry')
) as t(name, qty, unit, category);

-- SF-089: Cucumber Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Cucumber Salad', 6, 'starch', null, '[Parve] Slice the cucumbers and let them sit for about 1/2 hour. | Prepare the dressing with the water, vinegar, sugar, and salt. | Add the cucumber, onion, and optional carrot to the dressing. | Chill before serving.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1 1/2 water', '', 'cups', 'Pantry'),
  ('3/4 vinegar', '', 'cup', 'Spices / Condiments'),
  ('sugar', '1', 'cup', 'Bakery / Dry'),
  ('cucumbers', '10', '', 'Produce'),
  ('carrot (optional)', '1', '', 'Produce'),
  ('small purple onion', '1', '', 'Produce'),
  ('salt', '1', 'tablespoon', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-090: Mediterranean Quinoa Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Mediterranean Quinoa Salad', 6, 'starch', null, '[Dairy] In a medium bowl, combine quinoa, cucumber, carrot, tomatoes, avocado, chickpeas, feta cheese, and scallions. | In a small bowl, whisk together the dressing ingredients. | Toss the salad with dressing and garnish with sunflower seeds before serving.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('quinoa, rinsed and prepared according to package instructions', '1', 'cup', 'Bakery / Dry'),
  ('small Kirby cucumber, peeled and diced', '1', '', 'Produce'),
  ('medium carrot, peeled and diced', '1', '', 'Produce'),
  ('cherry tomatoes, halved', '10', '', 'Produce'),
  ('1/2 avocado, diced', '', '', 'Produce'),
  ('1/2 (15-ounce) can chickpeas', '', '', 'Pantry'),
  ('1/2 (8-ounce) package feta cheese, cubed', '', '', 'Dairy / Eggs'),
  ('scallions, diced', '3', '', 'Produce'),
  ('Sunflower seeds, for garnish', '', '', 'Pantry'),
  ('Dressing', '', '', 'Pantry'),
  ('oil', '3', 'tablespoons', 'Spices / Condiments'),
  ('lemon juice', '2', 'tablespoons', 'Produce'),
  ('1/2 cumin', '', 'teaspoon', 'Spices / Condiments'),
  ('1/2 Italian seasoning', '', 'teaspoon', 'Spices / Condiments'),
  ('1/2 salt', '', 'teaspoon', 'Spices / Condiments'),
  ('1/4 pepper', '', 'teaspoon', 'Produce'),
  ('garlic cloves, crushed', '2', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-091: Tomato Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Tomato Salad', 6, 'starch', null, '[Meat] Bring water to a boil and dip the tomatoes in for a few minutes. | Transfer tomatoes to cold water and peel them. | Pulse the tomatoes and onions in a food processor so the mixture is not too fine and not too chunky. | Season with salt, oil, and black pepper, tasting until it suits your preference.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('About 9 beef tomatoes, peeled', '', '', 'Produce'),
  ('large onions', '2', '', 'Produce'),
  ('Salt, to taste', '', '', 'Spices / Condiments'),
  ('Oil, to taste', '', '', 'Spices / Condiments'),
  ('Black pepper, to taste', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-092: Shredded Pastrami Over Leafy Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Shredded Pastrami Over Leafy Salad', 6, 'starch', null, '[Meat] Preheat oven to 350°F. | Place pastrami in a roasting pan with water to cover. Cover tightly and place in the oven for 1 1/2 to 2 hours, until very soft. | When cool enough to handle, but still warm, shred the pastrami. Cover and set aside. | Place all dressing ingredients in a tall container and blend. | Combine the vegetables in a salad bowl. | Pour dressing over the salad vegetables and toss. Place shredded pastrami on top.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('pastrami roast', '2', 'pounds', 'Meat / Fish'),
  ('(8-ounce) bag lettuce', '1', '', 'Produce'),
  ('avocado, sliced', '1', '', 'Produce'),
  ('red onion, sliced into half-rounds', '1', '', 'Produce'),
  ('hearts of palm, sliced', '1', 'can', 'Pantry'),
  ('Dressing', '', '', 'Pantry'),
  ('garlic, crushed', '1', 'clove', 'Produce'),
  ('lemon juice', '2', 'tablespoons', 'Produce'),
  ('mayonnaise', '2', 'tablespoons', 'Spices / Condiments'),
  ('1/4 oil', '', 'cup', 'Spices / Condiments'),
  ('Kosher salt, to taste', '', '', 'Spices / Condiments'),
  ('Black pepper, to taste', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-093: Apple Strawberry Crumble
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Apple Strawberry Crumble', 6, 'starch', null, '[Parve] Preheat oven to 350°F (175°C). | Combine apples, sugar, lemon juice, and cinnamon. Place in the bottom of a 9x13-inch baking pan or two 9-inch round pans. | Top with sliced strawberries. | With a fork, mix together the crumble ingredients. Crumble with your fingers and arrange on top of the strawberries. | Bake uncovered for 1 to 1 1/2 hours, or until done.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('apples, peeled and sliced', '7', '', 'Produce'),
  ('1/2 sugar', '', 'cup', 'Bakery / Dry'),
  ('lemon juice', '2', 'teaspoons', 'Produce'),
  ('1/2 cinnamon', '', 'teaspoon', 'Pantry'),
  ('strawberries, cleaned and sliced (or use frozen)', '1', 'pint', 'Produce'),
  ('Crumble', '', '', 'Pantry'),
  ('2 1/2 potato starch', '', 'cups', 'Produce'),
  ('3/4 sugar', '', 'cup', 'Bakery / Dry'),
  ('egg', '1', '', 'Dairy / Eggs'),
  ('oil', '1', 'cup', 'Spices / Condiments'),
  ('3 1/2 (100 g) ground nuts', '', 'oz', 'Pantry'),
  ('1 1/2 vanilla sugar (optional)', '', 'teaspoons', 'Bakery / Dry')
) as t(name, qty, unit, category);

-- SF-094: White Wine Dressing for Roasted Veggie Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'White Wine Dressing for Roasted Veggie Salad', 6, 'starch', null, '[Parve] Blend all ingredients together in a food processor. | Use with roasted vegetables and greens.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('mayonnaise', '1', 'cup', 'Spices / Condiments'),
  ('3/4 white wine (add a bit of sugar if using a wine that is not sweet)', '', 'cup', 'Bakery / Dry'),
  ('chopped fresh basil', '1', 'tablespoon', 'Pantry'),
  ('1 1/2 oregano', '', 'teaspoons', 'Spices / Condiments'),
  ('crushed garlic', '1', 'teaspoon', 'Produce'),
  ('1/2 olive oil', '', 'tablespoon', 'Spices / Condiments'),
  ('1/2 small onion, cut into chunks', '', '', 'Produce'),
  ('freshly squeezed lemon juice', '1', 'tablespoon', 'Produce'),
  ('kosher salt', '1', 'teaspoon', 'Spices / Condiments'),
  ('coarse black pepper', '', 'Pinch', 'Produce')
) as t(name, qty, unit, category);

-- SF-095: Scalloped Potatoes - Pareve
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Scalloped Potatoes - Pareve', 6, 'starch', null, '[Meat] Sauté onions in oil for 7 to 8 minutes until clear and soft. | Add the flour or potato starch, stirring well. | Add the mayonnaise and chicken stock. Cook 2 to 3 minutes until the sauce thickens. Set aside. | Peel and slice the potatoes into 1/4-inch-thick slices. | Pour 3 to 4 ladles of sauce on the bottom of a 9x13-inch pan. | Spread a layer of potatoes, then sauce, then another layer of potatoes, ending with sauce on top. | Sprinkle with salt, pepper, and paprika. | Bake at 350°F for 1 to 1 1/2 hours, or until ready.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('9-10 large potatoes', '', '', 'Produce'),
  ('large onions', '2', '', 'Produce'),
  ('oil', '6', 'tablespoons', 'Spices / Condiments'),
  ('flour or potato starch', '5', 'tablespoons', 'Produce'),
  ('1/2 mayonnaise', '', 'cup', 'Spices / Condiments'),
  ('3 1/2 chicken stock', '', 'cups', 'Meat / Fish'),
  ('1/2 salt', '', 'teaspoon', 'Spices / Condiments'),
  ('Pepper and paprika, to taste', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-096: Scalloped Potatoes with Pastrami
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Scalloped Potatoes with Pastrami', 6, 'starch', null, '[Meat] In a medium saucepan over medium heat, sauté the onions and pastrami in the fat, stirring frequently, until the onions are caramelized and the pastrami is browned in spots. | Add potato starch and stir until the onion and pastrami mixture is evenly coated. | Add mayonnaise, chicken stock, salt, and pepper; stir until the mixture is smooth and thickened. | Preheat oven to 350°F. | Peel and slice potatoes crosswise into very thin circles. Rinse well with cold water. | Pour some sauce into a 9x13-inch baking dish. Arrange a layer of potato slices over the sauce, then more sauce, and continue the pattern until you have about 5 to 6 layers. Cover tightly with foil. | Bake for 30 minutes, then uncover and cook for another hour, or until crispy.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('medium onions, diced', '8', '', 'Produce'),
  ('pastrami, diced', '2', 'pounds', 'Meat / Fish'),
  ('duck or chicken fat', '8', 'tablespoons', 'Meat / Fish'),
  ('potato starch', '5', 'tablespoons', 'Produce'),
  ('1/2 mayonnaise', '', 'cup', 'Spices / Condiments'),
  ('3 1/2 chicken stock', '', 'cups', 'Meat / Fish'),
  ('1 1/2 salt', '', 'tablespoons', 'Spices / Condiments'),
  ('3/4 coarse black pepper', '', 'teaspoon', 'Produce'),
  ('large russet potatoes', '8', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-097: Scalloped Potatoes (Instagram Version)
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Scalloped Potatoes (Instagram Version)', 6, 'starch', null, '[Parve] In a pot, sauté the onions with the margarine, brown sugar, and red wine vinegar until lightly golden. | Sprinkle the potato starch over the onions while stirring. | Add the water and soup mix and let it simmer until it thickens, then turn off the heat. Taste and add more salt if needed. | Slice the potatoes thinly. | Grease a baking dish or 9x13 pan and start layering sauce, potatoes, sauce, potatoes, ending with sauce on top. | Sprinkle with paprika and black pepper. | Bake at 350°F for about 1 1/2 hours.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('3/4 margarine (may be replaced with 6 tablespoons oil)', '', 'stick', 'Spices / Condiments'),
  ('onions, thinly sliced', '2', '', 'Produce'),
  ('brown sugar', '1', 'tablespoon', 'Bakery / Dry'),
  ('1/2 red wine vinegar (optional if you do not use products)', '', 'teaspoon', 'Spices / Condiments'),
  ('3 1/2 water', '', 'cups', 'Pantry'),
  ('onion soup mix', '3', 'tablespoons', 'Produce'),
  ('A bit more salt, if needed', '', '', 'Spices / Condiments'),
  ('1/2 potato starch (during the year, use flour)', '', 'cup', 'Produce'),
  ('About 8 potatoes, thinly sliced', '', '', 'Produce'),
  ('Paprika', '', '', 'Spices / Condiments'),
  ('Black pepper', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-098: Apple Kugel Topping (Partial)
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Apple Kugel Topping (Partial)', 6, 'starch', null, '[Parve] The provided image only shows the topping ingredients and does not include the rest of the recipe.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('(2 sticks) margarine, at room temperature', '1', 'cup', 'Pantry'),
  ('2 1/2 old fashioned oats', '', 'cups', 'Bakery / Dry'),
  ('1 1/4 flour', '', 'cups', 'Bakery / Dry'),
  ('1/2 brown sugar', '', 'cup', 'Bakery / Dry'),
  ('1/4 demerara sugar (or replace with brown sugar if unavailable)', '', 'cup', 'Bakery / Dry'),
  ('salt', '', 'Pinch', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-099: Colorful Green Bean Salad with Creamy Garlic Dressing
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Colorful Green Bean Salad with Creamy Garlic Dressing', 6, 'starch', null, '[Parve] Bring a large pot of salted water to a boil. Cook green beans for about 5 to 7 minutes; drain. Run ice-cold water over the green beans immediately to stop the cooking. Drain again. | Place all dressing ingredients in a food processor fitted with the steel blade attachment. Process on high for about 1 minute. | When ready to serve, place green beans, mango, dried cranberries, and almonds in a large bowl. Drizzle dressing over and toss well. | Notes | Yield: approximately 6 servings. | Note: This dressing can be made ahead of time and kept in an airtight container in the refrigerator.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('. green beans, trimmed', '2', 'lbs', 'Pantry'),
  ('large mango, peeled, dried, and cut into chunks', '1', '', 'Produce'),
  ('dried cranberries', '1', 'cup', 'Produce'),
  ('whole salted, toasted almonds (slivered almonds also work well)', '1', 'cup', 'Spices / Condiments'),
  ('Dressing', '', '', 'Pantry'),
  ('olive oil', '2', 'tsp', 'Spices / Condiments'),
  ('1/2 mayonnaise (reduced fat is fine)', '', 'cup', 'Spices / Condiments'),
  ('garlic', '8', 'cloves', 'Produce'),
  ('scallions, chopped', '3', '', 'Produce'),
  ('A bit less than 1/4 cup balsamic vinegar', '', '', 'Spices / Condiments'),
  ('Dijon mustard', '2', 'Tbsp', 'Spices / Condiments'),
  ('honey', '3', 'Tbsp', 'Spices / Condiments'),
  ('Kosher salt to taste', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-100: Soba Spring Noodle Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Soba Spring Noodle Salad', 6, 'starch', '/recipe-photos/soba-spring-noodle-salad.jpg', '[Dairy] Whisk together all dressing ingredients until smooth. | Combine all salad ingredients in a bowl, or layer in a terrine-style bowl if desired. | Toss with dressing when ready to serve and top with desired toppings. | Notes | Yield: 4 to 6 servings.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1/2 Gefen lo mein noodles, prepared according to package instructions', '', 'package', 'Bakery / Dry'),
  ('shelled edamame, defrosted', '1', 'cup', 'Pantry'),
  ('julienned carrots', '2', '', 'Produce'),
  ('red cabbage, or a mixture of red and green', '4', 'cups', 'Pantry'),
  ('or 1 big handful baby spinach', '2', 'ounces', 'Produce'),
  ('Dressing', '', '', 'Pantry'),
  ('1/4 peanut butter', '', 'cup', 'Dairy / Eggs'),
  ('soy sauce', '3', 'Tbsp', 'Spices / Condiments'),
  ('1/4 rice vinegar', '', 'cup', 'Bakery / Dry'),
  ('honey', '1', 'Tbsp', 'Spices / Condiments'),
  ('Juice of 1 fresh lime', '', '', 'Produce'),
  ('garlic cloves, crushed', '2', '', 'Produce'),
  ('1/2 salt', '', 'tsp', 'Spices / Condiments'),
  ('Optional Toppings', '', '', 'Pantry'),
  ('Cilantro, chopped', '', '', 'Produce'),
  ('Scallions', '', '', 'Produce'),
  ('Sesame seeds', '', '', 'Pantry'),
  ('Peanuts', '', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-101: Bean, Corn, and Cilantro Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Bean, Corn, and Cilantro Salad', 6, 'starch', null, '[Parve] Combine all salad ingredients. | Dress with olive oil, lemon juice, salt, black pepper, and cumin. | Toss and refrigerate overnight so the dressing can soak in. | Leave out for about 20 minutes before serving and toss again. | Notes | A commenter suggested adding a little red wine vinegar and honey, if desired.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Corn', '', '', 'Pantry'),
  ('Chickpeas', '', '', 'Pantry'),
  ('Black beans', '', '', 'Pantry'),
  ('Red kidney beans', '', '', 'Pantry'),
  ('Red peppers', '', '', 'Produce'),
  ('Yellow peppers', '', '', 'Produce'),
  ('Jalapeño pepper', '', '', 'Produce'),
  ('Red onion', '', '', 'Produce'),
  ('A lot of chopped cilantro', '', '', 'Produce'),
  ('Dressing', '', '', 'Pantry'),
  ('Extra-virgin olive oil', '', '', 'Spices / Condiments'),
  ('Freshly squeezed lemon juice', '', '', 'Produce'),
  ('Salt', '', '', 'Spices / Condiments'),
  ('Black pepper', '', '', 'Produce'),
  ('Cumin', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-102: Garlic Roasted String Beans
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Garlic Roasted String Beans', 6, 'starch', null, '[Parve] Using fresh string beans, wash and snip off the ends. | Place on a baking sheet, toss with the oil, and mix. | Scatter over the almonds, garlic, and salt. | Bake at 400°F for 15 to 20 minutes, until crunchy. If you like them softer, add a little more oil. | This is also very good prepared in a wok as a stir-fry. | Notes | Serving/yield: 6.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('fresh string beans', '3', 'cups', 'Pantry'),
  ('crushed garlic', '2', 'Tbsp', 'Produce'),
  ('salt', '1', 'pinch', 'Spices / Condiments'),
  ('olive oil', '2', 'Tbsp', 'Spices / Condiments'),
  ('1/2 sliced almonds (optional)', '', 'cup', 'Pantry')
) as t(name, qty, unit, category);

-- SF-103: Get Rice Right
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Get Rice Right', 6, 'starch', null, '[Parve] Method 1: Oven-Baked Rice — Preheat oven to 350°F (175°C). In an ovenproof dish, mix the rice, oil, water, and salt. Cover tightly with foil and bake for 30 minutes. Remove from the oven and let stand for 10 minutes. Fluff with a fork and serve. | Method 2: Stovetop — Heat a saucepan over medium heat. Add the oil and rice. Stir for 1 to 2 minutes until the rice is well-coated. Add the salt and boiling water. Scrape any rice from the bottom of the pot. Bring to a boil, cover, and reduce to a simmer for 15 to 20 minutes. Let stand for 10 minutes. Fluff with a fork and serve. | Notes | The printed note says the oven-baked method yields rice that is fluffier yet a bit mushy, while the stovetop rice has more distinct grains and is chewy, fluffy, and sticky enough. | The original article notes a 1:1.5 rice-to-water ratio for white rice.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('rice, rinsed', '1', 'cup', 'Bakery / Dry'),
  ('oil', '1', 'Tbsp', 'Spices / Condiments'),
  ('1 1/2 boiling water', '', 'cups', 'Spices / Condiments'),
  ('3/4 pink or sea salt', '', 'tsp', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-104: Garlic and Chive Cauliflower Mash
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Garlic and Chive Cauliflower Mash', 6, 'starch', null, '[Dairy] Preheat oven to 350°F. | Slice off the top of the garlic head and drizzle with olive oil. Seal in a tin foil pouch and bake for 1 hour. Let cool and squeeze out the roasted cloves. | Bring a pot of water to a boil. Add cauliflower and cook for 10 minutes. Strain well. | Place hot cauliflower in a blender and pulse. Once it is broken down, add roasted garlic, dairy-free butter, and salt. Keep pulsing until smooth and creamy. | Remove from blender, add chives, and serve. | Notes | Yield: 4 servings.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('fresh cauliflower (1 whole head broken up)', '7', 'cups', 'Produce'),
  ('head garlic', '1', '', 'Produce'),
  ('olive oil', '2', 'Tbsp', 'Spices / Condiments'),
  ('1 1/2 Smart Balance dairy-free butter', '', 'Tbsp', 'Dairy / Eggs'),
  ('1 1/2 salt', '', 'tsp', 'Spices / Condiments'),
  ('diced chives', '2', 'Tbsp', 'Pantry')
) as t(name, qty, unit, category);

-- SF-105: Seasoned Doughless Potato Knishes
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Seasoned Doughless Potato Knishes', 6, 'starch', null, '[Meat] Boil potatoes in salted water until soft. Drain and mash. Add margarine and mix. Allow to cool. | Preheat oven to 350°F (180°C). | When potatoes are cool, add the remaining knish ingredients. If desired, blend using a stick blender for a smoother texture. | Spoon into muffin cups and sprinkle with sesame seeds. Bake for 45 minutes, or less if using mini muffin cups. | For the topping, sauté onion until golden. Add pastrami and beef fry and sauté 5 minutes longer. | Add the remaining topping ingredients and allow the sugar to melt. Continue to simmer on low another 3 to 5 minutes. | Rewarm before serving and spoon over doughless knishes. | Notes | Yields approximately 12 knishes.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Yukon gold or russet potatoes (the note says Idaho potatoes are too dry)', '5', '', 'Produce'),
  ('1/2 margarine', '', 'cup', 'Pantry'),
  ('large onions, sautéed', '2', '', 'Produce'),
  ('eggs', '4', '', 'Dairy / Eggs'),
  ('1/2 salt', '', 'tsp', 'Spices / Condiments'),
  ('Montreal steak spice (optional)', '1', 'tsp', 'Spices / Condiments'),
  ('1/2 flour', '', 'cup', 'Bakery / Dry'),
  ('Black and white sesame seeds', '', '', 'Pantry'),
  ('Topping', '', '', 'Pantry'),
  ('onion, diced', '1', '', 'Produce'),
  ('pastrami, cut into strips', '6', 'oz', 'Meat / Fish'),
  ('beef fry, cut into strips', '6', 'oz', 'Meat / Fish'),
  ('garlic, minced', '1', 'clove', 'Produce'),
  ('1/3 packed brown sugar', '', 'cup', 'Bakery / Dry'),
  ('Scant 1/4 cup sauerkraut', '', '', 'Pantry'),
  ('mustard', '1', 'Tbsp', 'Spices / Condiments'),
  ('1/4 ginger powder', '', 'tsp', 'Produce')
) as t(name, qty, unit, category);

-- SF-106: Avis Kugel
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Avis Kugel', 6, 'starch', null, '[Parve] Use the food processor S blade to process 4 onions until very mushy, then change to the E blade. | In a bowl, put eggs and oil together, then add potatoes and salt. | Preheat oven to 350°F. Grease a 9x13 pan with cooking spray and place the pan in the oven for a few minutes. | Pour the mixture into the hot pan and bake uncovered for 2 hours, until browned. | To reheat overnight, cover twice and place water on the bottom. Warm on 200°F. | Notes | This recipe was handwritten and some wording was hard to read; this is a careful transcription of the visible instructions.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('bag green giant white potatoes', '1', '', 'Produce'),
  ('medium-size onion', '1', '', 'Produce'),
  ('oil', '1', 'cup', 'Spices / Condiments'),
  ('eggs', '8', '', 'Dairy / Eggs'),
  ('1 1/2 salt', '', 'Tbsp', 'Spices / Condiments'),
  ('A few dashes pepper', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-107: Indonesian Rice
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Indonesian Rice', 6, 'starch', null, '[Meat] Cook rice according to package directions and set aside. | Meanwhile, sauté garlic and onion in a small amount of oil over low heat until golden. | Add chopped meat and cook until meat is no longer pink and is thoroughly cooked through, about 12 to 15 minutes. Mix constantly, pressing the meat down and breaking it apart as you stir. | Add this mixture to the rice. | Add soy sauce, brown sugar, and cayenne pepper to the pot and mix until well combined. Taste and adjust seasoning if needed. | Stir in a handful of chopped scallions. Garnish with carrot curls. | Notes | Serves 10. | Tip on the clipping: cubed turkey, pastrami, or leftover roast meat can be substituted for the chopped meat.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1 1/2 raw rice', '', 'cups', 'Bakery / Dry'),
  ('water', '3', 'cups', 'Pantry'),
  ('salt', '1', 'tsp', 'Spices / Condiments'),
  ('Oil, for sautéing', '', '', 'Spices / Condiments'),
  ('garlic, finely chopped', '3', 'cloves', 'Produce'),
  ('medium onion, cubed', '1', '', 'Produce'),
  ('chopped meat', '1', 'lb', 'Pantry'),
  ('2 1/2 to 3 1/2 Tbsp soy sauce', '', '', 'Spices / Condiments'),
  ('2 1/2 brown sugar, or to taste', '', 'Tbsp', 'Bakery / Dry'),
  ('1/2 cayenne pepper', '', 'tsp', 'Produce'),
  ('Salt and pepper, to taste (optional)', '', '', 'Produce'),
  ('Chopped scallions', '', '', 'Produce'),
  ('Carrot curls, for garnish', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-108: Orzo and Pastrami
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Orzo and Pastrami', 6, 'starch', null, '[Meat] Cook orzo according to package directions. Set aside. | Sauté onion and garlic in a generous amount of oil, about 1/4 cup, then add pastrami cut into small strips. | Add orzo to the pot and drizzle in some soy sauce. Mix well. | Season with a bit of salt and pepper.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('box orzo', '1', '', 'Bakery / Dry'),
  ('Onion and garlic, sautéed in a generous amount of oil (about 1/4 cup)', '', '', 'Produce'),
  ('pastrami cut into small strips', '6', 'oz', 'Meat / Fish'),
  ('Soy sauce', '', '', 'Spices / Condiments'),
  ('Salt and pepper', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-109: Oven Roasted Veggies Penne
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Oven Roasted Veggies Penne', 6, 'starch', null, '[Parve] Slice the squash lengthwise with peel. Slice mushrooms, then peppers lengthwise into strips. Slice and dice the eggplant into medium-size pieces. Place vegetables on a greased cookie sheet. | Combine olive oil, balsamic vinegar, and salt, and pour over vegetables. | Preheat oven to 350°F and bake for 30 to 40 minutes. | Cook the pasta, rinse, and let stand. | Combine the dressing ingredients with a hand blender or in a container and shake well. Combine vegetables and pasta. | Bake covered at 350°F for 20 minutes. Pour the dressing over the pasta-vegetable mixture and serve.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('zucchini', '2', '', 'Produce'),
  ('portobello mushrooms', '3', '', 'Produce'),
  ('large red pepper', '1', '', 'Produce'),
  ('large yellow pepper', '1', '', 'Produce'),
  ('large orange pepper', '1', '', 'Produce'),
  ('eggplant', '1', '', 'Produce'),
  ('1/8 salt', '', 'tsp', 'Spices / Condiments'),
  ('olive oil', '2', 'tsp', 'Spices / Condiments'),
  ('balsamic vinegar', '3', 'tsp', 'Spices / Condiments'),
  ('pasta fusilli', '1', 'package', 'Bakery / Dry'),
  ('Dressing', '', '', 'Pantry'),
  ('garlic', '3', 'cloves', 'Produce'),
  ('1/2 vinegar', '', 'cup', 'Spices / Condiments'),
  ('1/2 olive oil', '', 'cup', 'Spices / Condiments'),
  ('oregano', '2', 'tsp', 'Spices / Condiments'),
  ('1/2 salt', '', 'tsp', 'Spices / Condiments'),
  ('1/2 black pepper', '', 'tsp', 'Produce')
) as t(name, qty, unit, category);

-- SF-110: Baked Ratatouille
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Baked Ratatouille', 6, 'starch', null, '[Parve] Preheat oven to 375°F / 190°C. | Slice the eggplants, Roma tomatoes, squash, and zucchini into approximately 1/16-inch rounds and set aside. | Heat 2 tablespoons of olive oil in a 12-inch oven-safe pan. Sauté onions, garlic, and bell peppers until soft. Season with salt and pepper, then add crushed tomatoes. Stir until incorporated. Turn off heat, add basil, and smooth the surface of the sauce. | Arrange the sliced vegetables in alternating patterns on top of the sauce from the outer edge to the inside of the pan. Season with salt and pepper. | Mix the herb seasoning and pour over the vegetables. | Cover the pan with foil and bake for 40 minutes. Uncover and bake an additional 20 minutes until vegetables are soft. | Serve while hot as a main dish or as a side dish. The ratatouille is also excellent the next day.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('For the sauce:', '', '', 'Spices / Condiments'),
  ('olive oil', '2', 'Tbsp', 'Spices / Condiments'),
  ('onion, diced', '1', '', 'Produce'),
  ('garlic cloves, minced', '4', '', 'Produce'),
  ('bell peppers, diced', '2', '', 'Produce'),
  ('Salt, to taste', '', '', 'Spices / Condiments'),
  ('Pepper, to taste', '', '', 'Produce'),
  ('(28 ounces) crushed tomatoes', '1', 'can', 'Produce'),
  ('fresh basil, chiffonade', '2', 'Tbsp', 'Pantry'),
  ('For the sliced vegetables:', '', '', 'Pantry'),
  ('eggplants', '2', '', 'Produce'),
  ('Roma tomatoes', '6', '', 'Produce'),
  ('yellow squash', '2', '', 'Pantry'),
  ('zucchini', '2', '', 'Produce'),
  ('For the herb seasoning:', '', '', 'Produce'),
  ('fresh basil, chiffonade', '2', 'Tbsp', 'Pantry'),
  ('garlic, minced', '1', 'tsp', 'Produce'),
  ('fresh parsley, chopped', '2', 'Tbsp', 'Produce'),
  ('fresh thyme', '2', 'tsp', 'Pantry'),
  ('Salt, to taste', '', '', 'Spices / Condiments'),
  ('Pepper, to taste', '', '', 'Produce'),
  ('olive oil', '4', 'Tbsp', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-111: Dried Fruit
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Dried Fruit', 6, 'starch', null, '[Parve] Put sliced fruit on a greased cookie sheet. | Dry overnight in a 180°F oven for about 8 hours. | Notes | The image caption described this as an easy, healthy idea.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Fruit such as pineapple, mango, and kiwi, sliced', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-112: Navel Pastrami Personal Pies
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Navel Pastrami Personal Pies', 6, 'starch', null, '[Meat] For the navel pastrami: place the navel pastrami with the vacuum bag in a pan and cover with water. Cover the pan tightly with foil. Bake at 225°F for about 8 to 13 hours, best overnight. | Once cooked, cut open the bag and discard any liquid. Using two forks, pull the meat into shreds. | To assemble: place one pita square on each serving. Smear with a generous tablespoon of barbecue sauce. | Top with about half a handful of arugula and then pastrami. | If using mushrooms or onions, add a couple here. | Generously drizzle each pita with Caesar dressing and serve. | Notes | Yields: 4 servings.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('bag Pas Pita squares (4 pieces)', '1', '', 'Pantry'),
  ('Western Grill barbecue sauce, sweet and spicy', '', '', 'Spices / Condiments'),
  ('to 3 cups baby arugula', '2', '', 'Produce'),
  ('to 3 cups navel pastrami, cooked and shredded', '2', '', 'Meat / Fish'),
  ('Sautéed sliced baby mushrooms (optional)', '', '', 'Produce'),
  ('Sautéed red onion rings (optional)', '', '', 'Produce'),
  ('Ready Caesar dressing', '', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-113: Roasted Veggies and Quinoa
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Roasted Veggies and Quinoa', 6, 'starch', null, '[Meat] Prepare the quinoa according to package directions using the broth or water and soup mix. | Preheat the oven to broil. Line a baking sheet with parchment and coat with cooking spray. | Slice peppers lengthwise, remove seeds, and cut each pepper into about 1-inch strips. Cut the eggplant and zucchini into 1-inch chunks. Quarter each onion round. Add vegetables to the prepared quinoa. | Spread vegetables on the baking sheet. Brush or drizzle with oil and season with salt and pepper. | Place baking sheet on the middle shelf and broil for 10 minutes. Turn the vegetables and broil 5 more minutes, or until roasted. Let cool. | Whisk together all dressing ingredients. | Pour dressing over quinoa and roasted vegetables and toss before serving. | Notes | This was carefully reconstructed from the uploaded page; a few words were partially obscured in the photo.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Quinoa: 1 cup quinoa; 2 cups broth or water; 1 packet Lipton Ranch mix for soup and dip mix', '', '', 'Bakery / Dry'),
  ('Roasted vegetables: 1 red bell pepper, 1 yellow bell pepper, 2 zucchini, 1 eggplant, 1 red onion cut into eighths, 3 Tbsp olive oil, 1 Tbsp kosher salt, 1/2 tsp black pepper', '', '', 'Produce'),
  ('Dressing', '', '', 'Pantry'),
  ('garlic, crushed', '2', 'cloves', 'Produce'),
  ('1/3 olive oil', '', 'cup', 'Spices / Condiments'),
  ('lemon juice', '2', 'tsp', 'Produce'),
  ('honey', '2', 'tsp', 'Spices / Condiments'),
  ('Dijon mustard', '2', 'tsp', 'Spices / Condiments'),
  ('dark brown sugar', '1', 'tsp', 'Bakery / Dry'),
  ('dried basil', '1', 'tsp', 'Pantry'),
  ('dried parsley flakes', '1', 'tsp', 'Produce'),
  ('1/4 black pepper', '', 'tsp', 'Produce')
) as t(name, qty, unit, category);

-- SF-114: Baby Red Potato Salad with Caesar Dill Dressing
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Baby Red Potato Salad with Caesar Dill Dressing', 6, 'starch', null, '[Parve] Preheat oven to 350°F. Wash and dry the potatoes. Leave the peels on, cut each potato in half, and place in a baking pan. | Sprinkle the potatoes with the oil and bake, covered, until cooked through, about 1 hour. | In a large bowl, combine the baked potatoes with mayonnaise, mustard, garlic, lemon juice, Worcestershire sauce, gherkins, and dill. | Season with salt and black pepper. Serve warm, at room temperature, or cold. | Notes | Serves 4 to 6.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('baby red potatoes, peels intact', '2', 'lbs', 'Produce'),
  ('oil', '1', 'Tbsp', 'Spices / Condiments'),
  ('mayonnaise', '4', 'Tbsp', 'Spices / Condiments'),
  ('Dijon mustard', '1', 'tsp', 'Spices / Condiments'),
  ('garlic (fresh or frozen), minced', '1', 'clove', 'Produce'),
  ('lemon juice', '1', 'tsp', 'Produce'),
  ('1/2 Worcestershire sauce', '', 'tsp', 'Spices / Condiments'),
  ('gherkin dill pickles, finely diced', '3', '', 'Produce'),
  ('fresh dill, chopped', '3', 'Tbsp', 'Produce'),
  ('Kosher salt', '', '', 'Spices / Condiments'),
  ('Fresh black pepper', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-115: Sesame Noodles with Asian Dressing
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Sesame Noodles with Asian Dressing', 6, 'starch', null, '[Dairy] Toast sesame seeds in a small frying pan over medium heat, stirring frequently, until golden and fragrant, about 10 minutes. | Place toasted sesame seeds in a food processor with the knife attachment. Add peanut butter, garlic, ginger, soy sauce, rice vinegar, hot sauce, and sugar. Blend, adding boiling water 1 tablespoon at a time until creamy. | Heat oven to grill. Broil chicken cutlets a few minutes on each side until lightly browned. Cool slightly and shred or cut into bite-size pieces. | In a large bowl, toss cooked spaghetti with sesame oil until evenly coated. Add shredded chicken, scallions, carrots, and sauce. Mix well. | Serve warm or at room temperature. | Notes | The note on the page says this side dish can be made without the cutlets and is just as delicious.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1/4 sesame seeds', '', 'cup', 'Pantry'),
  ('1/4 chunky peanut butter', '', 'cup', 'Dairy / Eggs'),
  ('medium cloves garlic', '2', '', 'Produce'),
  ('1/2 minced fresh ginger', '', 'Tbsp', 'Produce'),
  ('soy sauce', '5', 'Tbsp', 'Spices / Condiments'),
  ('rice vinegar', '2', 'Tbsp', 'Bakery / Dry'),
  ('1/2 hot pepper sauce', '', 'tsp', 'Produce'),
  ('light brown sugar', '2', 'Tbsp', 'Bakery / Dry'),
  ('Boiling water', '', '', 'Spices / Condiments'),
  ('chicken cutlets', '1', 'lb', 'Meat / Fish'),
  ('spaghetti, cooked according to package directions', '10', 'oz', 'Pantry'),
  ('sesame oil', '2', 'Tbsp', 'Spices / Condiments'),
  ('to 3 scallions, thinly sliced', '2', '', 'Produce'),
  ('large carrot, grated', '1', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-116: Mini Spinach Frittatas
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Mini Spinach Frittatas', 6, 'starch', null, '[Dairy] Preheat oven to 350°F and grease a 12-cup muffin tin. | Heat olive oil in a skillet over medium-high heat. | Sauté the onion until softened, about 3–5 minutes. | Add the garlic and cook 1 minute more. | Add the spinach and cook until wilted, then cool slightly. | Whisk the eggs with salt and pepper. | If using feta, divide it among the muffin cups. | Whisk the cooled onion mixture and herbs into the eggs. | Divide among the muffin cups. | Bake for 25–30 minutes, until set in the center.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('extra-virgin olive oil', '1', 'tablespoon', 'Spices / Condiments'),
  ('small onion, finely diced', '1', '', 'Produce'),
  ('garlic, minced', '1', 'clove', 'Produce'),
  ('packed fresh spinach, chopped, or 1 (10-ounce) box frozen chopped spinach, thawed and squeezed dry', '2', 'cups', 'Produce'),
  ('large eggs', '10', '', 'Dairy / Eggs'),
  ('1/2 salt', '', 'teaspoon', 'Spices / Condiments'),
  ('1/4 pepper', '', 'teaspoon', 'Produce'),
  ('chopped fresh herbs (such as parsley, thyme, rosemary, or chives)', '2', 'tablespoons', 'Produce'),
  ('1/2 crumbled feta or goat cheese (optional)', '', 'cup', 'Dairy / Eggs')
) as t(name, qty, unit, category);

-- SF-117: Carrot Muffins
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Carrot Muffins', 6, 'starch', null, '[Parve] Mix all ingredients together until combined. | Portion into muffin tins. | Bake until done. | Recipe Notes | The handwritten photo showed ingredients only. The baking time and temperature were not visible. | “Salt” was listed without a measured amount.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('eggs', '4', '', 'Dairy / Eggs'),
  ('sugar', '2', 'cups', 'Bakery / Dry'),
  ('oil', '1', 'cup', 'Spices / Condiments'),
  ('4 1/2 jars baby carrots', '', '', 'Produce'),
  ('baking powder', '1', 'teaspoon', 'Bakery / Dry'),
  ('flour', '2', 'cups', 'Bakery / Dry'),
  ('1/2 baking soda', '', 'teaspoon', 'Bakery / Dry'),
  ('cinnamon', '1', 'teaspoon', 'Pantry'),
  ('vanilla extract', '1', 'teaspoon', 'Pantry'),
  ('Salt', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-118: Lockshen Kugel
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Lockshen Kugel', 6, 'starch', null, '[Parve] Cook the lokshen. | In a bowl, combine the eggs, sugar, oil, vanilla sugar, and fruit cocktail. | Use a hand blender to mix the whole mixture. | Pour the mixture over the lokshen. | Bake at 350°F for at least 40 minutes. | Keep checking until the top is golden brown. | Recipe Notes | The original message did not specify the quantity of lokshen or the size of the fruit cocktail can/container.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Lokshen, cooked', '', '', 'Pantry'),
  ('eggs', '5', '', 'Dairy / Eggs'),
  ('sugar', '1', 'cup', 'Bakery / Dry'),
  ('3/4 oil', '', 'cup', 'Spices / Condiments'),
  ('vanilla sugar', '2', 'tablespoons', 'Bakery / Dry'),
  ('fruit cocktail', '1', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-119: Avis Kugel
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Avis Kugel', 6, 'starch', null, '[Parve] Using the food processor with the “S” blade, blend the onions until very mushy. | Change to the “E” blade. | In a bowl, combine the eggs and oil, then add the potatoes and salt. | Preheat the oven to 350°F. | Grease the pan with Pam and place it in the oven for a few minutes. | Put the mixture into the pan. | Bake uncovered for 2 hours, until browned. | Let cool completely, then freeze. | Recipe Notes | The back of the note says: “To overnight, cover twice with water on the bottom, on 200°.” | The note appears to say “4 onions” in the food processor direction, but the ingredient list shows 1 medium onion. I kept the ingredient list exactly as written and noted the discrepancy here.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('bag green giant white potatoes', '1', '', 'Produce'),
  ('medium onion', '1', '', 'Produce'),
  ('oil', '1', 'cup', 'Spices / Condiments'),
  ('eggs', '8', '', 'Dairy / Eggs'),
  ('1 1/2 salt', '', 'tablespoons', 'Spices / Condiments'),
  ('A few dashes pepper', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-120: Dill Dip
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Dill Dip', 6, null, null, '[Parve] Blend all ingredients together. | Store in a closed container in the fridge.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1/2 mayonnaise', '', 'cup', 'Spices / Condiments'),
  ('cubes frozen dill', '5', '', 'Produce'),
  ('garlic, crushed', '5', 'cloves', 'Produce'),
  ('1/2 sugar', '', 'tablespoon', 'Bakery / Dry'),
  ('vinegar or lemon juice', '1', 'teaspoon', 'Produce')
) as t(name, qty, unit, category);

-- SF-121: Shallot Dip
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Shallot Dip', 6, null, null, '[Parve] Heat oil in a medium skillet over medium-high heat. Add shallots and sugar; sauté until brown, crispy, and somewhat caramelized. | Place into a container; add mayonnaise and salt. Blend well with an immersion blender until smooth and light brown.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('oil', '1', 'tablespoon', 'Spices / Condiments'),
  ('–6 shallots, thinly sliced', '5', '', 'Pantry'),
  ('sugar', '2', 'teaspoons', 'Bakery / Dry'),
  ('1/2 mayonnaise', '', 'cup', 'Spices / Condiments'),
  ('1/2 salt', '', 'teaspoon', 'Spices / Condiments'),
  ('pepper', '', 'Pinch', 'Produce')
) as t(name, qty, unit, category);

-- SF-122: Jalapeño Dip
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Jalapeño Dip', 6, null, null, '[Parve] Place jalapeños over an open fire and roast for 5–10 minutes, until blistered and soft. Place in a plastic bag to sweat so they peel easily. Let cool and peel, removing stem. | In a food processor, blend pepper and mayonnaise. For less heat, remove some or all of the seeds first, then add back little by little to control the heat level. | Note | The screenshot also notes: if using store-bought mayonnaise, add 1 garlic clove and some salt and pepper when blending with the jalapeño.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('–4 jalapeños', '3', '', 'Pantry'),
  ('recipe homemade mayonnaise', '1', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-123: Eggplant Dip — Partial
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Eggplant Dip — Partial', 6, null, null, '[Parve] ')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-124: Roasted Garlic Dipping Oil
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Roasted Garlic Dipping Oil', 6, null, null, '[Meat] Preheat oven to 400°F. Slice about 1/8 inch from the top of the garlic bulbs. Drizzle with oil, season, wrap in foil, and roast for 40–45 minutes until soft. | Squeeze roasted garlic cloves into a bowl. | Combine lemon zest and juice, olives, parsley, cilantro, chili, fresh garlic, and cashews, and mix into a paste with the roasted garlic. | Mound the mixture in the center of a plate. | Drizzle olive oil around it, add soy sauce, and season the oil with sea salt and freshly cracked black pepper. | Serve with warm crusty bread.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('heads garlic', '3', '', 'Produce'),
  ('olive oil, plus more for drizzling garlic', '1', 'cup', 'Produce'),
  ('Zest of lemon', '', '', 'Produce'),
  ('green olives, minced', '4', '', 'Pantry'),
  ('–3 tablespoons curly parsley, finely chopped', '2', '', 'Produce'),
  ('cilantro', '2', 'tablespoons', 'Produce'),
  ('1/2 red chili, diced, or less to taste', '', '', 'Pantry'),
  ('–6 roasted salted cashews, finely chopped', '5', '', 'Spices / Condiments'),
  ('garlic, crushed', '1', 'clove', 'Produce'),
  ('1/2 tamari soy sauce', '', 'tablespoon', 'Spices / Condiments'),
  ('Sea salt and cracked black pepper', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-125: Low Fat Cheesecake
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Low Fat Cheesecake', 6, null, null, '[Dairy] Blend the yogurt, sugar, eggs, and vanilla in a blender or mixer. | Add the salt and cornstarch and mix again. | Pour into the graham cracker crust. | Bake at 350°F for 30 minutes. The middle may be slightly jiggly, but it should look baked and browned. | Let cool at least 6 hours before serving so it can set. | Notes | Source note on printout: “It’s not really cheesecake technically. But it’s really really good and no one would know.”')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('(6 oz) Greek yogurts', '2', '', 'Dairy / Eggs'),
  ('1/2 sugar', '', 'cup', 'Bakery / Dry'),
  ('eggs', '2', '', 'Dairy / Eggs'),
  ('vanilla extract', '2', 'tsp', 'Pantry'),
  ('1/8 salt', '', 'tsp', 'Spices / Condiments'),
  ('cornstarch', '1', 'Tbsp', 'Pantry'),
  ('graham cracker crust', '1', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-126: Monkey Bread – Pesto
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Monkey Bread – Pesto', 6, null, '/recipe-photos/monkey-bread-pesto.jpg', '[Dairy] Sauté the diced portobello mushrooms and onion until soft. | Add the mushroom-onion mixture, prepared pesto, and shredded cheese. | Drizzle the top with olive oil. | Bake until the cheese is melted. | Notes | This screenshot appears to show only the variation/filling portion of the recipe, not the full base dough method.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('portobello mushrooms, diced', '3', '', 'Produce'),
  ('large onion, diced', '1', '', 'Produce'),
  ('Prepared pesto', '', '', 'Pantry'),
  ('Shredded cheese', '', '', 'Dairy / Eggs'),
  ('Olive oil, for drizzling', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-127: Monkey Bread – Tomato
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Monkey Bread – Tomato', 6, null, '/recipe-photos/monkey-bread-tomato.jpg', '[Dairy] Add the pizza or marinara sauce, tomato chunks, and shredded cheese. | Bake until the cheese is melted. | Notes | This screenshot appears to show only the variation/topping portion of the recipe, not the full base dough method.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Pizza sauce or marinara sauce', '', '', 'Spices / Condiments'),
  ('Tomatoes, cut into chunks', '', '', 'Produce'),
  ('shredded cheese, or more', '8', 'oz', 'Dairy / Eggs')
) as t(name, qty, unit, category);

-- SF-128: Pizza Dough
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Pizza Dough', 6, null, null, '[Dairy] Combine the yeast, sugar, and warm water. Let sit until bubbly, about 45 minutes. | Add 4 cups flour and the oil; mix for about 10 seconds. | Add the salt and the remaining 6 cups flour. | Mix until doughy. | Let rise for 30 minutes. | Top with sauce and cheese and bake. | Notes | Written from a photographed recipe card and WhatsApp follow-up. One line appears to read “mix for 10 sec.”')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('dry yeast', '2', 'Tbsp', 'Pantry'),
  ('sugar', '2', 'tsp', 'Bakery / Dry'),
  ('warm water', '4', 'cups', 'Pantry'),
  ('flour', '4', 'cups', 'Bakery / Dry'),
  ('oil', '2', 'Tbsp', 'Spices / Condiments'),
  ('salt', '4', 'tsp', 'Spices / Condiments'),
  ('flour', '6', 'cups', 'Bakery / Dry')
) as t(name, qty, unit, category);

-- SF-129: Grilled Salmon Salad with Red Wine and Walnut Vinaigrette
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Grilled Salmon Salad with Red Wine and Walnut Vinaigrette', 6, null, null, '[Dairy] Layer all salad ingredients in a bowl, or divide among individual plates. | Place all vinaigrette ingredients into a food processor fitted with the S blade. | Pulse until completely combined. | Pour the dressing over the salad and toss to combine. | Notes | The original post notes that the salad also works well without the salmon.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('(225 g) summer crisp lettuce, shredded', '8', 'oz', 'Produce'),
  ('avocado, sliced', '1', '', 'Produce'),
  ('cucumber, sliced', '1', '', 'Produce'),
  ('1/2 prepared chickpeas', '', 'cup', 'Pantry'),
  ('(85 g) goat cheese, shredded (optional)', '3', 'oz', 'Dairy / Eggs'),
  ('grilled salmon, served on top or shredded and mixed in', '1', 'slice', 'Meat / Fish'),
  ('Beet sticks, for garnish', '', '', 'Pantry'),
  ('Red Wine and Walnut Vinaigrette', '', '', 'Pantry'),
  ('1/4 red wine vinegar', '', 'cup', 'Spices / Condiments'),
  ('silan (or honey)', '5', 'tsp', 'Spices / Condiments'),
  ('1/2 olive oil', '', 'cup', 'Spices / Condiments'),
  ('1/4 chopped walnuts', '', 'cup', 'Pantry'),
  ('1/2 salt', '', 'tsp', 'Spices / Condiments'),
  ('1/4 black pepper', '', 'tsp', 'Produce')
) as t(name, qty, unit, category);

-- SF-130: Parmesan-Crusted Grouper (or Sea Bass)
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Parmesan-Crusted Grouper (or Sea Bass)', 6, null, null, '[Dairy] Preheat the broiler to high. | Combine the parmesan, butter, mayo, and scallions. | Place the fish in a lightly greased pan. | Squeeze the juice of 1 lemon over the fillets and sprinkle with black pepper. | Broil 6 inches from the heat for 10 minutes. | Remove from the oven and spread the cheese mixture over the fillets. | Broil 2 minutes more, or until lightly browned and bubbly. | Notes | Recipe card title reads: “A Recipe For Parmesan-Crusted Grouper (or Sea Bass).”')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1/2 grated parmesan', '', 'cup', 'Dairy / Eggs'),
  ('1/3 butter, soft but not melted', '', 'cup', 'Dairy / Eggs'),
  ('mayo', '2', 'Tbsp', 'Pantry'),
  ('scallions, finely sliced', '2', '', 'Produce'),
  ('or 4 small grouper fillets', '2', 'lb', 'Pantry'),
  ('lemon', '1', '', 'Produce'),
  ('Black pepper', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-131: No Pot Creamy Ziti
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'No Pot Creamy Ziti', 6, null, null, '[Dairy] Preheat oven to 350°F. | Add the pasta in an even layer to a 9- x 13-inch baking pan. | Add the salt and sauce. | Fill the empty sauce jar with water, anywhere from 3/4 full to completely full, and add it to the pan. | Add most of the cheese and mix to combine. Add more cheese on top, or mix all of it in. | Cover and bake for 90 minutes. | For a crisp top, uncover and bake a little longer until browned and bubbly and the noodles crisp up a bit.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1 9- x 13-inch pan', '', '', 'Pantry'),
  ('salt', '1', 'tsp', 'Spices / Condiments'),
  ('penne pasta, raw', '1', 'lb', 'Bakery / Dry'),
  ('(26 oz) jar pasta sauce', '1', '', 'Bakery / Dry'),
  ('3/4 to 1 jar water (use the empty sauce jar)', '', '', 'Spices / Condiments'),
  ('cheese (about 1 1/2 cups)', '12', 'oz', 'Dairy / Eggs')
) as t(name, qty, unit, category);

-- SF-132: Weight Watchers Muffins – Leah Zicherman
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Weight Watchers Muffins – Leah Zicherman', 6, 'dessert', null, '[Parve] Mix ingredients together and divide into muffin pans. | Bake at 350°F for 25 minutes. | Note | This recipe was typed from a handwritten card and a few details may be worth double-checking.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('whole wheat flour (note on card says white cake flour works best)', '2', 'cups', 'Bakery / Dry'),
  ('oats', '4', 'cups', 'Bakery / Dry'),
  ('2 2/3 unsweetened applesauce', '', 'cups', 'Produce'),
  ('honey', '2', 'cups', 'Spices / Condiments'),
  ('eggs', '4', '', 'Dairy / Eggs'),
  ('oil', '1', 'cup', 'Spices / Condiments'),
  ('vanilla sugar', '4', 'teaspoons', 'Bakery / Dry'),
  ('1/3 bag chocolate chips', '', '', 'Pantry'),
  ('salt', '4', 'teaspoons', 'Spices / Condiments'),
  ('baking powder', '4', 'teaspoons', 'Bakery / Dry'),
  ('baking soda', '2', 'teaspoons', 'Bakery / Dry'),
  ('cinnamon', '4', 'teaspoons', 'Pantry')
) as t(name, qty, unit, category);

-- SF-133: Ooey Gooey Chocolate Cake
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Ooey Gooey Chocolate Cake', 6, 'dessert', null, '[Parve] Mix together the egg, confectioner''s sugar, and cocoa powder until fully combined. | Place ingredients in a microwave-safe mug. | Microwave for 1 minute.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('egg', '1', '', 'Dairy / Eggs'),
  ('1/4 confectioner''s sugar', '', 'cup', 'Bakery / Dry'),
  ('cocoa powder', '2', 'tablespoons', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-134: Instant Blueberry Muffin
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Instant Blueberry Muffin', 6, 'dessert', null, '[Dairy] Whisk together margarine, sugar, vanilla extract, and soy milk. | Add baking powder, flour, and blueberries. | Place ingredients in a microwave-safe mug. | Microwave for 1 minute.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('margarine', '2', 'tablespoons', 'Pantry'),
  ('2 1/2 sugar', '', 'tablespoons', 'Bakery / Dry'),
  ('1/2 vanilla extract', '', 'teaspoon', 'Pantry'),
  ('soy milk', '2', 'tablespoons', 'Dairy / Eggs'),
  ('1/2 baking powder', '', 'teaspoon', 'Bakery / Dry'),
  ('1/4 flour', '', 'cup', 'Bakery / Dry'),
  ('blueberries', '10', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-135: Brownie Bites
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Brownie Bites', 6, 'dessert', null, '[Parve] Preheat oven to 325°F. Line a 7- by 11-inch brownie pan with parchment paper and coat with nonstick cooking spray. | In the bowl of an electric stand mixer, combine the melted margarine, cocoa powder, oil, sugar, flour, eggs, and vanilla. Beat to combine. | Spread the mixture into the prepared pan. | Bake for 35–40 minutes. Remove the pan from the oven and place into the refrigerator to cool for 20 minutes or until cool enough to handle. | When the brownies are cool, run a knife around the edge of the pan. Flip the brownie out onto a piece of parchment paper on a hard work surface in one whole piece. | Using a 1 1/2-inch diameter round cookie cutter, cut circles from the center of the brownie, leaving the harder crust. Roll the circles between the palms of your hands to form into balls, and roll into coating of your choice. | Store in an airtight container.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1/2 (1 stick) unsalted margarine, melted and placed in refrigerator to cool for 10 minutes', '', 'cup', 'Spices / Condiments'),
  ('3/4 good-quality Dutch process cocoa powder, such as Droste brand', '', 'cup', 'Spices / Condiments'),
  ('1/4 vegetable or canola oil', '', 'cup', 'Spices / Condiments'),
  ('sugar', '2', 'cups', 'Bakery / Dry'),
  ('all-purpose flour', '1', 'cup', 'Bakery / Dry'),
  ('large eggs', '3', '', 'Dairy / Eggs'),
  ('pure vanilla extract', '1', 'teaspoon', 'Pantry'),
  ('Coating Options', '', '', 'Bakery / Dry'),
  ('Confectioners'' sugar', '', '', 'Bakery / Dry'),
  ('Cocoa powder', '', '', 'Spices / Condiments'),
  ('Chopped nuts', '', '', 'Pantry'),
  ('Edible glitter', '', '', 'Pantry'),
  ('Colored sanding sugars', '', '', 'Bakery / Dry')
) as t(name, qty, unit, category);

-- SF-136: Flaky Dough Berry Sandwiches
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Flaky Dough Berry Sandwiches', 6, 'dessert', '/recipe-photos/flaky-dough-berry-sandwiches.jpg', '[Parve] Bake puff pastry squares in a preheated 400°F oven for about 8–10 minutes, until golden and puffed. | Whip the topping until stiff peaks form, then mix in the vanilla instant pudding powder. | Assemble as shown: puff pastry, vanilla cream, berries, and another piece of puff pastry. | Sprinkle with confectioners'' sugar. Add a mint leaf for garnish if desired.')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-137: Banana Muffins – Mindy
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Banana Muffins – Mindy', 6, 'dessert', null, '[Dairy] Mix ingredients together. | Bake at 350°F for about 22–23 minutes.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('mashed bananas (about 4 or 5 bananas)', '1.5', 'cups', 'Pantry'),
  ('egg', '1', '', 'Dairy / Eggs'),
  ('honey', '1', 'tablespoon', 'Spices / Condiments'),
  ('1 1/2 almond flour', '', 'cups', 'Bakery / Dry'),
  ('almond butter', '5', 'tablespoons', 'Dairy / Eggs'),
  ('baking soda', '1', 'teaspoon', 'Bakery / Dry'),
  ('1/2 kosher salt', '', 'teaspoon', 'Spices / Condiments'),
  ('Cinnamon, to sprinkle', '', '', 'Pantry'),
  ('vanilla extract', '1', 'teaspoon', 'Pantry'),
  ('Some chia seeds', '', '', 'Pantry'),
  ('% chocolate nibs', '72', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-138: Low Fat Cheesecake
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Low Fat Cheesecake', 6, 'dessert', null, '[Dairy] Blend yogurt, sugar, eggs, and vanilla in a blender or mixer. Add salt and cornstarch and mix again. | Pour into graham cracker crust. | Bake at 350°F for 30 minutes. The middle may be slightly jiggly, but it should look baked and brown. | Let cool at least 6 hours before serving to allow it to set.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('(6-ounce) Greek yogurt', '2', '', 'Dairy / Eggs'),
  ('1/2 sugar', '', 'cup', 'Bakery / Dry'),
  ('eggs', '2', '', 'Dairy / Eggs'),
  ('vanilla extract', '2', 'teaspoons', 'Pantry'),
  ('1/8 salt', '', 'teaspoon', 'Spices / Condiments'),
  ('corn starch', '1', 'tablespoon', 'Pantry'),
  ('graham cracker crust', '1', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-139: Wholesome Breakfast Muffin
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Wholesome Breakfast Muffin', 6, 'dessert', null, '[Parve] Preheat oven to 400°F. Grease 12 standard muffin cups; set aside. | Mix whole wheat flour, oats, brown sugar, baking powder, baking soda, cinnamon, applesauce, egg, apple juice, and vanilla in a large bowl by hand until just combined. | Stir in chocolate chips. | Pour batter into prepared muffin cups, filling each about 3/4 full. | Bake 17–20 minutes until centers are firm and muffins are light brown. Do not overbake.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1 1/2 whole wheat flour', '', 'cups', 'Bakery / Dry'),
  ('quick cooking oats', '1', 'cup', 'Bakery / Dry'),
  ('1/2 packed brown sugar', '', 'cup', 'Bakery / Dry'),
  ('baking powder', '2', 'teaspoons', 'Bakery / Dry'),
  ('1 1/2 baking soda', '', 'teaspoons', 'Bakery / Dry'),
  ('ground cinnamon', '1', 'teaspoon', 'Pantry'),
  ('1/2 applesauce', '', 'cup', 'Produce'),
  ('large egg', '1', '', 'Dairy / Eggs'),
  ('apple juice', '1', 'cup', 'Produce'),
  ('vanilla extract', '1', 'teaspoon', 'Pantry'),
  ('1/2 chocolate chips', '', 'cup', 'Pantry')
) as t(name, qty, unit, category);

-- SF-140: Chipper Razzle Ice Cream Pie
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Chipper Razzle Ice Cream Pie', 6, 'dessert', null, '[Dairy] Remove ice cream from freezer to soften. | In a small pot, melt chocolate chips and peanut butter. Add dried cranberries and potato chips and stir until well coated. | Stir half the mixture into the ice cream and spoon into pie crust. | Drop remaining mixture over top of pie, spreading to cover as much of the ice cream as possible. | Freeze immediately. | Note | You can use store-bought vanilla fudge ice cream or homemade vanilla ice cream. If using homemade, drizzle some chocolate syrup in when stirring the razzle mixture into the ice cream.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('vanilla fudge ice cream', '4', 'cups', 'Dairy / Eggs'),
  ('1/2 chocolate chips', '', 'cup', 'Pantry'),
  ('1/3 peanut butter', '', 'cup', 'Dairy / Eggs'),
  ('dried cranberries', '2', 'tablespoons', 'Produce'),
  ('potato chips, slightly crushed', '2', 'cups', 'Produce'),
  ('chocolate graham cracker pie crust', '1', 'cup', 'Pantry')
) as t(name, qty, unit, category);

-- SF-141: Marble Cake
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Marble Cake', 6, 'dessert', null, '[Parve] Beat whites. | Add sugar, then yolks, then remaining ingredients except cocoa mixture. | Pour 3/4 of the batter into pan. | To the remaining batter, add 2 tablespoons cocoa and 2 tablespoons sugar. Mix and pour on top of cake. Do not marbleize. | Bake at 325°F for about 45–50 minutes.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('eggs, separated', '7', '', 'Dairy / Eggs'),
  ('sugar', '2', 'cups', 'Bakery / Dry'),
  ('oil', '1', 'cup', 'Spices / Condiments'),
  ('1/2 orange juice', '', 'cup', 'Pantry'),
  ('vanilla sugar', '1', '', 'Bakery / Dry'),
  ('baking powder', '2', 'teaspoons', 'Bakery / Dry'),
  ('flour', '2', 'cups', 'Bakery / Dry'),
  ('cocoa', '2', 'tablespoons', 'Pantry'),
  ('sugar', '2', 'tablespoons', 'Bakery / Dry')
) as t(name, qty, unit, category);

-- SF-142: Chocolate Chip Sticks
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Chocolate Chip Sticks', 6, 'dessert', null, '[Parve] Mix with a fork. Mix sugars with oil. | Add baking soda and salt. Mix. | Add egg and vanilla. Mix. | Add flour. Mix. | Form into 2 logs on a cookie sheet, pat down, sprinkle with Maldon sea salt flakes if using, and bake at 350°F for 20–30 minutes. The post notes 25 minutes for a slightly chewy texture. | When it comes out of the oven, slice into sticks.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('chocolate chunks or chips', '1.5', 'cups', 'Pantry'),
  ('flour', '3', 'cups', 'Bakery / Dry'),
  ('sugar', '1', 'cup', 'Bakery / Dry'),
  ('brown sugar', '1', 'cup', 'Bakery / Dry'),
  ('oil', '1', 'cup', 'Spices / Condiments'),
  ('eggs', '2', '', 'Dairy / Eggs'),
  ('vanilla extract', '2', 'teaspoons', 'Pantry'),
  ('1/4 salt', '', 'teaspoon', 'Spices / Condiments'),
  ('baking soda', '1', 'teaspoon', 'Bakery / Dry'),
  ('Maldon sea salt, optional', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-143: Jar of Strawberry Heaven
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Jar of Strawberry Heaven', 6, 'dessert', '/recipe-photos/jar-of-strawberry-heaven.jpg', '[Parve] Preheat oven to 350°F (180°C). Line two 9x13-inch pans or one large roasting pan with parchment paper. | Beat eggs on high speed for 10 minutes, adding the sugar in slow intervals. Add the remaining sponge cake ingredients and beat for a few more seconds, just until incorporated. | Pour into lined pans and bake for 42–50 minutes or until the top springs back and a toothpick inserted comes out clean. Let cool. | Beat the whipping cream and add the remaining strawberry cream ingredients. | Meanwhile, macerate the strawberries by combining them with sugar and basil, if using, and lemon juice. Mix together. Let rest at room temperature for 20 minutes until the strawberries are juicy and the sugar has dissolved. | Use a glass or the lid of a jar to cut circles out of the cake, and place one cut circle at the bottom of each jar. Top with a few spoons of the macerated strawberries and top with some strawberry whip. Repeat so you have 2 or 3 layers. | Garnish with strawberries and lemon peel, or basil. | Note | For a shortcut, use store-bought sponge cake, cut into slices and then into round disks. | Make the cake and cream ahead. Macerate berries and assemble up to 6 hours before serving.')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-144: Berry Green Smoothie
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Berry Green Smoothie', 6, null, null, '[Dairy] Blend until smooth. Add more sugar to taste, if desired.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('spinach leaves', '1', 'cup', 'Produce'),
  ('1/2 frozen blueberries', '', 'cup', 'Frozen'),
  ('1/2 frozen raspberries', '', 'cup', 'Frozen'),
  ('ripe banana', '1', '', 'Pantry'),
  ('1/2 milk', '', 'cup', 'Dairy / Eggs'),
  ('old fashioned oats', '2', 'tablespoons', 'Bakery / Dry'),
  ('sugar, or more to taste', '1', 'tablespoon', 'Bakery / Dry')
) as t(name, qty, unit, category);

-- SF-145: Fruity Pebble Fluff Treats
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Fruity Pebble Fluff Treats', 6, 'kids_platter', null, '[Dairy] Mix the salt into the cereal. | Spray a 9x13-inch pan with cooking spray. | In a large saucepan over low heat, melt 4 tablespoons butter. You can also melt the butter in the microwave if you do not want to turn on the stove. | Gently stir the marshmallow fluff into the butter and allow it to fully melt. Stir until the butter and marshmallows are blended. | Remove the pan from the heat and stir in the Rice Krispies, salt, and Fruity Pebbles until the cereal is completely coated with the melted marshmallows. | Add mini marshmallows if desired. | Spread the mixture into the prepared pan, press down firmly, and sprinkle with extra Fruity Pebbles. | Refrigerate for 1 hour to set, then cut into bars. | Recipe Notes | The original post suggests you can swap in other favorite cereals such as Cocoa Pebbles, Cap’n Crunch, or Froot Loops. | The original post also mentions you can add chocolate chips or other mix-ins if you want.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1/2 butter', '', 'stick', 'Dairy / Eggs'),
  ('(16 oz) container marshmallow fluff', '1', '', 'Pantry'),
  ('Large handful of mini marshmallows (optional)', '', '', 'Pantry'),
  ('Rice Krispie cereal', '3.5', 'cups', 'Bakery / Dry'),
  ('to 2.5 cups Fruity Pebbles', '2', '', 'Pantry'),
  ('Extra Fruity Pebbles for sprinkling on top', '', '', 'Pantry'),
  ('1/4 to 1/2 teaspoon kosher salt', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-146: Cauliflower Crust Lachmagine
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Cauliflower Crust Lachmagine', 6, null, null, '[Parve] Tightly wrap the riced cauliflower in a clean dish towel and squeeze until the crumbs are dry. If the cauliflower is still cold from the freezer, let it sit out for 20 minutes and squeeze again. The cauliflower should be very dry or the crust will become soggy. | Place the dry crumbs into a bowl; add eggs, salt, and spices. Mix really well until a dough forms. | Preheat oven to 400°F. Line a baking pan with parchment paper. | Form a quarter cup of dough into a two- to three-inch round and place onto the prepared pan. Repeat with remaining dough. Bake for 15 minutes, until they start to brown. Remove pan from oven. | Meanwhile, prepare the meat topping by adding all topping ingredients to a large bowl and mixing well to combine. | Reduce oven temperature to 350°F. Spread a quarter cup of meat topping onto each baked round, pressing down so it sticks to the dough. Spread topping all the way to the edges as the meat shrinks while it cooks. Sprinkle a few pine nuts on each, if using. | Bake until the meat is cooked through and browned, approximately 30 minutes.')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-147: Garlic and Chive Cauliflower Mash
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Garlic and Chive Cauliflower Mash', 6, null, null, '[Dairy] Preheat oven to 350°F. | Slice off the top of the garlic head and drizzle with olive oil. Seal in a tin foil pouch and bake for 1 hour. Let cool and squeeze out roasted cloves. | Meanwhile, bring an 8-quart pot to a full boil. Add cauliflower and cook for 10 minutes. Strain well. | Place hot cauliflower in a blender and pulse. Once it is well broken down, add roasted garlic, nondairy butter, and salt. Keep pulsing until mixture is smooth and creamy. | Remove from blender, add chives, and serve.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('fresh cauliflower (1 whole head broken up)', '7', 'cups', 'Produce'),
  ('head garlic', '1', '', 'Produce'),
  ('olive oil', '2', 'tablespoons', 'Spices / Condiments'),
  ('1 1/2 Smart Balance dairy-free butter', '', 'tablespoons', 'Dairy / Eggs'),
  ('1 1/2 salt', '', 'teaspoons', 'Spices / Condiments'),
  ('diced chives', '2', 'tablespoons', 'Pantry')
) as t(name, qty, unit, category);

-- SF-148: Roasted Cauliflower
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Roasted Cauliflower', 6, null, null, '[Parve] Toss cauliflower with oil, then toss with the defrosted cubes. | Spread on a large baking sheet. It should be spread out a bit. | Bake at 425°F (220°C) for 25 minutes.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('large head of cauliflower, checked and cut into chunks', '1', '', 'Produce'),
  ('1/3 oil', '', 'cup', 'Spices / Condiments'),
  ('frozen garlic cubes, defrosted', '2', '', 'Produce'),
  ('frozen parsley cubes, defrosted', '2', '', 'Produce'),
  ('Salt, to taste', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-149: Roasted Italian Eggplant
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Roasted Italian Eggplant', 6, null, null, '[Parve] Preheat oven to 400°F. | Slice eggplants diagonally and spread on a lined cookie sheet. | Sprinkle with salt; then rub about 1 teaspoon of spice rub on each slice. | Brush melted schmaltz or oil on each piece. | Roast for 30 minutes, until browned and crispy. | Note | The recipe text notes that rendered chicken or duck fat gives extra flavor, but oil can be used instead.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('mini Italian eggplants', '6', '', 'Produce'),
  ('1/2 spice rub', '', 'cup', 'Spices / Condiments'),
  ('Salt, to taste', '', '', 'Spices / Condiments'),
  ('Schmaltz or oil, to drizzle', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-150: Weight Watchers Muffins – Leah Zicherman
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Weight Watchers Muffins – Leah Zicherman', 6, null, null, '[Parve] Mix ingredients together and divide into muffin pans. | Bake at 350°F for 25 minutes. | Note | This was typed from a handwritten card, so a few details may be worth double-checking.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('whole wheat flour (handwritten note says white cake flour may work best)', '2', 'cups', 'Bakery / Dry'),
  ('oats', '4', 'cups', 'Bakery / Dry'),
  ('2 2/3 unsweetened applesauce', '', 'cups', 'Produce'),
  ('honey', '2', 'cups', 'Spices / Condiments'),
  ('eggs', '4', '', 'Dairy / Eggs'),
  ('oil', '1', 'cup', 'Spices / Condiments'),
  ('vanilla sugar', '4', 'teaspoons', 'Bakery / Dry'),
  ('1/3 bag chocolate chips', '', '', 'Pantry'),
  ('salt', '4', 'teaspoons', 'Spices / Condiments'),
  ('baking powder', '4', 'teaspoons', 'Bakery / Dry'),
  ('baking soda', '2', 'teaspoons', 'Bakery / Dry'),
  ('cinnamon', '4', 'teaspoons', 'Pantry')
) as t(name, qty, unit, category);

-- SF-151: Slow Cooker Pulled Beef
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Slow Cooker Pulled Beef', 6, 'protein', '/recipe-photos/slow-cooker-pulled-beef.jpg', '[Meat] Place brisket into the slow cooker and cover with sliced onions. | In a small bowl, combine the coffee, brown sugar, paprika, salt, minced onions, and garlic powder. Sprinkle the spice mixture over the onions and brisket. | Pour the barbecue sauce over the top. | Add the water to the empty sauce bottle, close and shake to loosen any remaining sauce, then pour that into the slow cooker as well. | Cook on Low for 8 hours. | Using two forks, shred the meat by pulling in opposite directions. | Mix well with the sauce and serve over mashed potatoes. | Notes | If your family does not use prepared sauces, double the spice rub and leave out the barbecue sauce. The brisket can still be served shredded or sliced. | Original note: Works great for a Shabbos or Yom Tov main, too.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('(3-pound) second-cut brisket', '1', '', 'Meat / Fish'),
  ('large onion, sliced', '1', '', 'Produce'),
  ('ground coffee (if using instant, reduce to 1/2 teaspoon)', '1', 'tablespoon', 'Pantry'),
  ('dark brown sugar', '1', 'tablespoon', 'Bakery / Dry'),
  ('paprika', '1', 'teaspoon', 'Spices / Condiments'),
  ('salt', '1', 'teaspoon', 'Spices / Condiments'),
  ('minced onions', '1', 'teaspoon', 'Produce'),
  ('garlic powder', '1', 'teaspoon', 'Produce'),
  ('1/4 water', '', 'cup', 'Pantry'),
  ('(18-ounce) bottle Unger’s Bone Chilling BBQ sauce', '1', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-152: Caramelized French Roast (Cook Kosher)
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Caramelized French Roast (Cook Kosher)', 6, null, null, '[Parve] Rinse the French roast and pat dry. Season well with salt, pepper, and paprika. | Place the sugar in a sauté or braising pot large enough to fit the meat and cover. Cook over low heat, stirring occasionally, until the sugar melts and turns into a caramel color. | Add the meat to the pan on top of the caramelized sugar. Using a fork or tongs, rotate and sear both sides of the meat twice. | When all surfaces of the meat are browned, lift the roast and place the onions underneath. Cover and cook over medium-low heat for 2½–3 hours. Keep the flame low enough so the meat does not burn, but high enough that the sauce still bubbles slightly. | Remove the meat from the pan. | As the onions cook, their liquid will mix with the sugar and create a sauce. | In a small bowl, combine the potato starch and cold water. Add to the sauce and cook until thickened. | Slice the meat and serve with the caramelized onion sauce. | Notes | To freeze and rewarm: slightly undercook the roast. Freeze the meat and sugar-onion sauce separately. Rewarm the sauce and add the potato starch slurry only at that point, then slice the meat and reheat with the sauce. | One source note mentioned that the potato starch can be skipped if you prefer a thinner sauce. | Compiled from the recipe images you provided. | Source version: Cook Kosher')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-153: Pesach Chocolate Cupcakes
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Pesach Chocolate Cupcakes', 6, null, null, '[Parve] 1. Mix all ingredients together until the batter is smooth. | 2. Pour the batter into cupcake pans or lined muffin tins. | 3. Bake for 20 to 25 minutes. | Notes | • The oven temperature was not visible in the screenshot source.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('• 8 eggs', '', '', 'Dairy / Eggs'),
  ('• 2 cups oil', '', '', 'Spices / Condiments'),
  ('• 3 cups sugar', '', '', 'Bakery / Dry'),
  ('• 1 1/4 cups potato starch', '', '', 'Produce'),
  ('• 1 cup cocoa', '', '', 'Pantry'),
  ('• 1 cup ground almonds', '', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-154: Roasted Mediterranean Vegetable Soup
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Roasted Mediterranean Vegetable Soup', 6, null, null, '[Parve] ')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-155: Situm Hashas Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Situm Hashas Salad', 6, null, null, '[Parve] Combine lettuce, mango, pistachios, tomatoes, dried cranberries, and onion in a large bowl. | Place dressing ingredients in a small jar and shake or blend to combine. | Toss dressing with salad and serve.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('head or bag of lettuce, any variety', '1', '', 'Produce'),
  ('mango, cubed', '1', '', 'Produce'),
  ('1/2 salted, shelled pistachios', '', 'cup', 'Spices / Condiments'),
  ('grape tomatoes, halved', '1', 'cup', 'Produce'),
  ('red onion, diced', '1', '', 'Produce'),
  ('dried cranberries', '1', 'cup', 'Produce'),
  ('DRESSING', '', '', 'Pantry'),
  ('1/2 mayonnaise', '', 'cup', 'Spices / Condiments'),
  ('sugar', '3', 'teaspoons', 'Bakery / Dry'),
  ('lemon juice', '3', 'teaspoons', 'Produce'),
  ('Sprinkle salt and pepper', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-156: Succulent Chicken
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Succulent Chicken', 6, null, null, '[Meat] In a 6-quart pot or Dutch oven, sauté the onions in oil for approximately 15 minutes, until just golden (not brown or crisp). | Add the skinned chicken to the pot (“skin side” down) and brown for a few minutes, until the edges appear cooked. | Add the grape juice and salt, to taste. Bring to a boil. | Lower the heat and mix gently so all pieces of chicken are sitting in the juice. This assures that all pieces will be evenly colored. | Cook for 1½–2 hours. | If using fillets, cook for much less time, approximately ½–¾ hour. Chicken will then have a dark tinge to it. | When serving, remove the chicken carefully from the pot, as it will be very soft and you don’t want it to fall apart. | Source image transcription from user-provided WhatsApp screenshot.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('large onions, sliced', '5', '', 'Produce'),
  ('oil', '4', 'tablespoons', 'Spices / Condiments'),
  ('chickens, de-skinned and cut into eighths, or 4½ lbs. (2 kilo) boneless chicken cut lengthwise into long, wide strips', '2', '', 'Meat / Fish'),
  ('–1½ cups dark grape juice', '1', '', 'Pantry'),
  ('–1½ teaspoons salt', '1', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-157: Basic Salad Dressing
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Basic Salad Dressing', 6, null, null, '[Parve] Combine mayonnaise, lemon juice, salt, and sugar until smooth. | Use immediately or refrigerate until needed.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('mayonnaise', '8', 'tablespoons', 'Spices / Condiments'),
  ('lemon juice', '6', 'tablespoons', 'Produce'),
  ('salt', '1', 'teaspoon', 'Spices / Condiments'),
  ('sugar', '6', 'tablespoons', 'Bakery / Dry')
) as t(name, qty, unit, category);

-- SF-158: Caramelized French Roast (Between Carpools)
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Caramelized French Roast (Between Carpools)', 6, null, null, '[Parve] Rinse the French roast and pat dry. Season well with salt, pepper, and paprika. | Place the sugar in a sauté or braising pot large enough to fit the meat and cover. Cook over low heat, stirring occasionally, until the sugar melts and turns into a caramel color. | Add the meat to the pan on top of the caramelized sugar. Using a fork or tongs, rotate and sear both sides of the meat twice. | When all surfaces of the meat are browned, lift the roast and place the onions underneath. Cover and cook over medium-low heat for 2½–3 hours. Keep the flame low enough so the meat does not burn, but high enough that the sauce still bubbles slightly. | Remove the meat from the pan. | As the onions cook, their liquid will mix with the sugar and create a sauce. | In a small bowl, combine the potato starch and cold water. Add to the sauce and cook until thickened. | Slice the meat and serve with the caramelized onion sauce. | Notes | To freeze and rewarm: slightly undercook the roast. Freeze the meat and sugar-onion sauce separately. Rewarm the sauce and add the potato starch slurry only at that point, then slice the meat and reheat with the sauce. | One source note mentioned that the potato starch can be skipped if you prefer a thinner sauce. | Compiled from the recipe images you provided. | Source version: Between Carpools')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-159: Chicken Francese
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Chicken Francese', 6, null, null, '[Meat] In a small dish, mix potato starch, ½ teaspoon salt, and ¼ teaspoon pepper. Lightly coat chicken in the potato starch mixture, shaking off any excess. The coating should be light, because excess will create a gummy texture. | Heat oil in a large skillet over medium-high heat. Add chicken and brown until golden, about 3 minutes per side. Remove chicken and set aside on a loosely covered plate. | Add wine, broth, and lemon juice to the same skillet, scraping bits off the bottom of the pan and making sure any remaining potato starch is dissolved. Cook over high heat for about 5 minutes until reduced slightly. | Season with remaining 1 teaspoon salt and ¼ teaspoon pepper. Lower heat to a simmer and return chicken to skillet. | Top chicken with lemon slices and cook gently for 5 minutes. | Arrange chicken on a serving platter. Serve warm with sauce and lemon slices. | Source image transcription from user-provided magazine photo.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('½ potato starch', '', 'cup', 'Produce'),
  ('1½ kosher salt, divided', '', 'teaspoons', 'Spices / Condiments'),
  ('½ black pepper, divided', '', 'teaspoon', 'Produce'),
  ('skinless, boneless chicken breasts, pounded thinly', '8', '', 'Meat / Fish'),
  ('¼ olive oil', '', 'cup', 'Spices / Condiments'),
  ('Herzog Lineage Chardonnay or any dry white wine', '1', 'cup', 'Pantry'),
  ('chicken broth', '1', 'cup', 'Meat / Fish'),
  ('Juice of 2 lemons, about ¾ cup', '', '', 'Produce'),
  ('lemons, thinly sliced', '2', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-160: Pesach Chocolate Cake
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Pesach Chocolate Cake', 6, null, null, '[Parve] 1. Mix all ingredients together until well combined. | 2. Pour the batter into a 9 x 13-inch pan. | 3. Bake at 350°F for about 1 hour. For a fudgier texture, bake a little under 1 hour and adjust to your preference. | 4. For a gooey topping, cover the cake while it is still hot.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('• 9 eggs', '', '', 'Dairy / Eggs'),
  ('• 2 3/4 cups sugar', '', '', 'Bakery / Dry'),
  ('• 1 1/2 cups oil', '', '', 'Spices / Condiments'),
  ('• 1 1/2 cups potato starch', '', '', 'Produce'),
  ('• 1 cup cocoa', '', '', 'Pantry'),
  ('• 1 teaspoon baking powder', '', '', 'Bakery / Dry'),
  ('• 1 teaspoon baking soda', '', '', 'Bakery / Dry')
) as t(name, qty, unit, category);

-- SF-161: Veg Chicken Soup
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Veg Chicken Soup', 6, null, null, '[Parve] ')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-162: Cucumber Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Cucumber Salad', 6, null, null, '[Parve] Slice the cucumbers and let them sit for 1/2 hour. | Combine water, vinegar, sugar, salt, purple onion, and carrot, if using. | Add the cucumbers and chill before serving.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('1 1/2 water', '', 'cups', 'Pantry'),
  ('3/4 vinegar', '', 'cup', 'Spices / Condiments'),
  ('sugar', '1', 'cup', 'Bakery / Dry'),
  ('cucumbers', '10', '', 'Produce'),
  ('carrot (optional)', '1', '', 'Produce'),
  ('small purple onion', '1', '', 'Produce'),
  ('salt', '1', 'tablespoon', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-163: French Roast
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'French Roast', 6, null, null, '[Parve] Season the meat generously with salt, pepper, and the 5 cloves or cubes of garlic. | Heat oil in a Dutch oven or oven-safe pot and sear the roast and neck bones on all sides. Remove from the pot. | Add a little more oil if needed, then sauté the onion and minced garlic until caramelized in spots. | Add the tomato paste. Return the roast to the pot and deglaze with the red wine. Add the brown sugar, soy sauce, red wine vinegar (or substitute mixture), apple cider vinegar, honey, maple syrup, and black pepper. Season with additional salt and pepper if needed. | Bring the mixture to a boil, cover the pot, and bake at 300°F for 3–4 hours. | Turn the roast over and bake for 1 additional hour. | Compiled from the recipe images you provided.')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-164: Pesach Crumb Cake
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Pesach Crumb Cake', 6, null, null, '[Parve] 1. Preheat the oven to 350°F. | 2. Mix all cake ingredients until combined. | 3. Pour the batter into a 9 x 13-inch pan and bake for 20 minutes. | 4. While the cake is baking, combine all crumb topping ingredients and mix until crumbs form. | 5. After the cake has baked for 20 minutes, sprinkle the crumb topping evenly over the top. | 6. Return to the oven and bake for about 35 minutes more, or until a toothpick inserted comes out dry. | Notes | • One Instagram version says the cake may need a little more bake time depending on your oven.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Cake', '', '', 'Pantry'),
  ('• 1 cup sugar', '', '', 'Bakery / Dry'),
  ('• 1 cup brown sugar', '', '', 'Bakery / Dry'),
  ('• 1 teaspoon baking powder', '', '', 'Bakery / Dry'),
  ('• 1 scoop vanilla sugar', '', '', 'Bakery / Dry'),
  ('• 1 cup oil', '', '', 'Spices / Condiments'),
  ('• 4 eggs', '', '', 'Dairy / Eggs'),
  ('• 1 cup potato starch', '', '', 'Produce'),
  ('• 1/2 teaspoon cinnamon', '', '', 'Pantry'),
  ('Crumb Topping', '', '', 'Pantry'),
  ('• 6 crushed ladyfingers', '', '', 'Pantry'),
  ('• 1/4 cup brown sugar', '', '', 'Bakery / Dry'),
  ('• 1/4 cup sugar', '', '', 'Bakery / Dry'),
  ('• 1/4 cup oil', '', '', 'Spices / Condiments'),
  ('• 1/4 teaspoon cinnamon', '', '', 'Pantry')
) as t(name, qty, unit, category);

-- SF-165: Glazed Chocolate Cake
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Glazed Chocolate Cake', 6, null, null, '[Parve] 1. Preheat the oven to 350°F. Lightly grease a 9 x 13-inch pan. | 2. Using an electric mixer, cream the eggs, sugar, oil, and vanilla extract in a large mixing bowl until light in color, thickened, and creamy. Add the cocoa, coffee, and potato starch. | 3. In a small bowl, combine the baking soda and vinegar, then add it to the batter and mix well. | 4. Pour the batter into the prepared pan and bake for 40 minutes. Allow the cake to cool completely before glazing. | 5. When the cake is completely cool, combine the glaze ingredients in a large bowl and stir until thick enough to pour. Pour over the cake to cover.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Cake', '', '', 'Pantry'),
  ('• 5 eggs', '', '', 'Dairy / Eggs'),
  ('• 1 1/2 cups sugar', '', '', 'Bakery / Dry'),
  ('• 1 teaspoon vanilla sugar', '', '', 'Bakery / Dry'),
  ('• 1 cup oil', '', '', 'Spices / Condiments'),
  ('• 1 teaspoon vanilla extract', '', '', 'Pantry'),
  ('• 1/2 cup cocoa', '', '', 'Pantry'),
  ('• Pinch instant coffee', '', '', 'Pantry'),
  ('• 3/4 cup potato starch', '', '', 'Produce'),
  ('• 1 teaspoon baking soda', '', '', 'Bakery / Dry'),
  ('• 1 teaspoon vinegar', '', '', 'Spices / Condiments'),
  ('Glaze', '', '', 'Pantry'),
  ('• 1 cup confectioners'' sugar, or more as needed', '', '', 'Bakery / Dry'),
  ('• 3 tablespoons hot water', '', '', 'Pantry'),
  ('• 3 tablespoons cocoa', '', '', 'Pantry'),
  ('• 3 teaspoons oil', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-166: Mediterranean Quinoa Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Mediterranean Quinoa Salad', 6, null, null, '[Dairy] In a medium bowl, combine quinoa, cucumber, carrot, tomatoes, avocado, chickpeas, feta cheese, and scallions. | In a small bowl, whisk together oil, lemon juice, cumin, Italian seasoning, salt, pepper, and garlic. | Toss dressing with salad and serve. | Yield: 4 servings')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('quinoa, rinsed and prepared according to package instructions', '1', 'cup', 'Bakery / Dry'),
  ('small Kirby cucumber, peeled and diced', '1', '', 'Produce'),
  ('medium carrot, peeled and diced', '1', '', 'Produce'),
  ('cherry tomatoes, halved', '10', '', 'Produce'),
  ('1/2 avocado, diced', '', '', 'Produce'),
  ('1/2 (15-ounce) can chickpeas', '', '', 'Pantry'),
  ('1/2 (8-ounce) package feta cheese, cubed', '', '', 'Dairy / Eggs'),
  ('scallions, diced', '3', '', 'Produce'),
  ('Sunflower seeds, for garnish', '', '', 'Pantry'),
  ('DRESSING', '', '', 'Pantry'),
  ('oil', '3', 'tablespoons', 'Spices / Condiments'),
  ('lemon juice', '2', 'tablespoons', 'Produce'),
  ('1/2 cumin', '', 'teaspoon', 'Spices / Condiments'),
  ('1/2 Italian seasoning', '', 'teaspoon', 'Spices / Condiments'),
  ('1/2 salt', '', 'teaspoon', 'Spices / Condiments'),
  ('1/4 pepper', '', 'teaspoon', 'Produce'),
  ('garlic cloves, crushed', '2', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-167: Slow Cooked French Roast
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Slow Cooked French Roast', 6, null, null, '[Parve] Place the roast in a large roasting pan. | Drizzle with oil and season generously with kosher salt. Rub the seasoning into the meat. | For overnight roasting: roast uncovered overnight (at least 10 hours) at 190°F. | Alternative method: roast at 250°F for 7 hours. | Compiled from the recipe images you provided.')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-168: Fruitfreeze
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Fruitfreeze', 6, null, null, '[Parve] 1. Bring the water and sugar to a boil for the lemon layer. Add the lemon juice and turn off the flame. | 2. Place the lemon mixture in a 9 x 13-inch pan. Freeze, then blend until the mixture is slushy. | 3. For the watermelon layer, remove and discard about one-third of the watermelon rind. Cube the watermelon and blend with the confectionary sugar, lemon juice, and salt until smooth. | 4. Pour the watermelon mixture over the frozen lemon layer. | 5. Spoon the reserved lemon slush over the watermelon layer so it looks light and fluffy. Return to the freezer until firm. | 6. Let the ice stand briefly, then lightly scrape across the top to create a fine, snow-like texture. | Notes | • Some of the right-side text in the source image was cut off, so this recipe was reconstructed from the visible text.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Lemon Layer', '', '', 'Produce'),
  ('• 4 cups water', '', '', 'Pantry'),
  ('• 2 1/2 cups sugar', '', '', 'Bakery / Dry'),
  ('• 1 1/2 cups lemon juice, or the juice of 10 to 12 lemons', '', '', 'Produce'),
  ('Watermelon Layer', '', '', 'Pantry'),
  ('• 1 medium watermelon', '', '', 'Pantry'),
  ('• 3 tablespoons confectionary sugar', '', '', 'Bakery / Dry'),
  ('• 1 tablespoon lemon juice', '', '', 'Produce'),
  ('• 1/4 teaspoon salt', '', '', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-169: Sweetened Veal Steak
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Sweetened Veal Steak', 6, null, null, '[Parve] Pat the veal steaks dry and sprinkle generously with salt and pepper. | Sear over medium heat until golden brown. | Transfer to a disposable pan and generously cover the meat with duck sauce. | Bake for 1½ hours covered, then 15 minutes uncovered. | Notes | Homemade Duck Sauce: 2 segmented grapefruits, 2 segmented oranges, and ¾ cup sugar. Cook all ingredients for 45 minutes in a covered pot, then uncover and simmer for an additional 30 minutes. Let cool and blend to desired consistency. | Compiled from the recipe images you provided.')
  returning id
)
select 1; -- no ingredients listed for this recipe

-- SF-170: Tomato Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Tomato Salad', 6, null, null, '[Meat] Bring water to a boil and dip the tomatoes in for a few minutes. | Transfer tomatoes to cold water and peel them. | Pulse the tomatoes and onions in a food processor so the mixture is not too fine and not too chunky. | Season with salt, oil, and black pepper, tasting until it suits your preference.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('About 9 beef tomatoes, peeled', '', '', 'Produce'),
  ('large onions', '2', '', 'Produce'),
  ('Salt, to taste', '', '', 'Spices / Condiments'),
  ('Oil, to taste', '', '', 'Spices / Condiments'),
  ('Black pepper, to taste', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-171: Chocolate Mousse Cups with Crispy Crumbs
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Chocolate Mousse Cups with Crispy Crumbs', 6, null, null, '[Parve] 1. Combine all crumb ingredients in a mixer or by hand and bake in a preheated 350°F (180°C) oven for about 20 minutes, or until browned nicely. | 2. Refrigerate well, then break the baked mixture into crumbs by hand. | 3. In a small pot, cook the chocolate, oil, coffee, and wine, stirring constantly until well combined. Cool slightly. | 4. Whip the egg yolks with 1/2 cup sugar for about 5 minutes. | 5. Reduce mixer speed and add the chocolate mixture. | 6. In a separate bowl, whip the egg whites with 1/4 cup sugar to make a firm foam. | 7. Fold the chocolate-egg yolk mixture into the egg whites until uniform. | 8. To assemble, pour some crumbs into the bottom of serving glasses. Pour chocolate mousse three-quarters of the way up. | 9. Cool the mousse and place a mound of whipped cream in the center, or add more crumbs on top. | 10. Keep refrigerated for up to 48 hours, or freeze for up to 2 weeks. | 11. For the chocolate squares, spread melted chocolate on parchment paper or a flat glass platter. Let dry at room temperature, cut into squares of different sizes, freeze for 10 minutes, then remove gently from the paper or glass. | 12. Decorate the mousse cups with the chocolate squares before serving.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('For the Crumbs', '', '', 'Bakery / Dry'),
  ('• 1 1/4 cups potato flour', '', '', 'Produce'),
  ('• 1 cup ground almonds or walnuts', '', '', 'Pantry'),
  ('• 1 egg', '', '', 'Dairy / Eggs'),
  ('• 6 tablespoons walnut oil', '', '', 'Spices / Condiments'),
  ('• 1/2 cup sugar', '', '', 'Bakery / Dry'),
  ('• 1/2 teaspoon salt', '', '', 'Spices / Condiments'),
  ('For the Chocolate Mousse', '', '', 'Pantry'),
  ('• 10.5 ounces (300 g) high-quality dark or bittersweet chocolate', '', '', 'Pantry'),
  ('• 1/2 cup walnut oil', '', '', 'Spices / Condiments'),
  ('• 2 tablespoons ground coffee, dissolved in 3 tablespoons boiling water', '', '', 'Spices / Condiments'),
  ('• 2 tablespoons liqueur or wine', '', '', 'Pantry'),
  ('• 5 large eggs, separated', '', '', 'Dairy / Eggs'),
  ('• 3/4 cup sugar', '', '', 'Bakery / Dry'),
  ('• 16 oz. Unger''s non-dairy topping, whipped', '', '', 'Pantry'),
  ('Wow Factor Chocolate Squares', '', '', 'Pantry'),
  ('• 7 ounces (200 g) baking chocolate, melted', '', '', 'Bakery / Dry')
) as t(name, qty, unit, category);

-- SF-172: Shredded Pastrami Over Leafy Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Shredded Pastrami Over Leafy Salad', 6, null, null, '[Meat] Preheat oven to 350°F. | Place pastrami in a roasting pan with water to cover. Cover tightly and place in the oven for 1 1/2 to 2 hours, until very soft. | When cool enough to handle, but still warm, shred the pastrami. Cover and set aside. | Place all dressing ingredients in a tall container and blend. | Combine the vegetables in a salad bowl. | Pour dressing over the salad vegetables and toss. Place shredded pastrami on top.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('pastrami roast', '2', 'pounds', 'Meat / Fish'),
  ('(8-ounce) bag lettuce', '1', '', 'Produce'),
  ('avocado, sliced', '1', '', 'Produce'),
  ('red onion, sliced into half-rounds', '1', '', 'Produce'),
  ('hearts of palm, sliced', '1', 'can', 'Pantry'),
  ('Dressing', '', '', 'Pantry'),
  ('garlic, crushed', '1', 'clove', 'Produce'),
  ('lemon juice', '2', 'tablespoons', 'Produce'),
  ('mayonnaise', '2', 'tablespoons', 'Spices / Condiments'),
  ('1/4 oil', '', 'cup', 'Spices / Condiments'),
  ('Kosher salt, to taste', '', '', 'Spices / Condiments'),
  ('Black pepper, to taste', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-173: Apple Strawberry Crumble
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Apple Strawberry Crumble', 6, null, null, '[Parve] Preheat oven to 350°F (175°C). | Combine apples, sugar, lemon juice, and cinnamon. Place in the bottom of a 9x13-inch baking pan or two 9-inch round pans. | Top with sliced strawberries. | With a fork, mix together the crumble ingredients. Crumble with your fingers and arrange on top of the strawberries. | Bake uncovered for 1 to 1 1/2 hours, or until done.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('apples, peeled and sliced', '7', '', 'Produce'),
  ('1/2 sugar', '', 'cup', 'Bakery / Dry'),
  ('lemon juice', '2', 'teaspoons', 'Produce'),
  ('1/2 cinnamon', '', 'teaspoon', 'Pantry'),
  ('strawberries, cleaned and sliced (or use frozen)', '1', 'pint', 'Produce'),
  ('Crumble', '', '', 'Pantry'),
  ('2 1/2 potato starch', '', 'cups', 'Produce'),
  ('3/4 sugar', '', 'cup', 'Bakery / Dry'),
  ('egg', '1', '', 'Dairy / Eggs'),
  ('oil', '1', 'cup', 'Spices / Condiments'),
  ('3 1/2 (100 g) ground nuts', '', 'oz', 'Pantry'),
  ('1 1/2 vanilla sugar (optional)', '', 'teaspoons', 'Bakery / Dry')
) as t(name, qty, unit, category);

-- SF-174: Pineapple Curd Pavlova
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Pineapple Curd Pavlova', 6, null, null, '[Parve] 1. Preheat the oven to 275°F. | 2. Beat the egg whites with the sugar until stiff peaks form. Add in the potato starch and vinegar. | 3. Line 2 baking sheets with parchment paper and trace a 9-inch round cake pan on the sheets to form 2 circles. Spoon meringue to fill the circles. | 4. Bake for 1 hour and 15 minutes. Shut off the heat and leave the meringues in the oven for 1 hour. | 5. In a blender or food processor, combine the canned pineapple, including the juices, with the potato starch. | 6. Transfer the pineapple mixture to a saucepan and bring to a boil over medium heat. Lower the heat and add the egg yolks and vanilla, whisking quickly so the eggs do not scramble. | 7. To assemble, spread pineapple curd over one meringue layer and top with fresh fruit. Repeat with the second layer, or assemble as individual desserts. | 8. Serve immediately after assembling.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('Meringue', '', '', 'Pantry'),
  ('• 8 eggs, separated', '', '', 'Dairy / Eggs'),
  ('• 2 cups sugar', '', '', 'Bakery / Dry'),
  ('• 2 tablespoons potato starch, sifted', '', '', 'Produce'),
  ('• 2 teaspoons white vinegar', '', '', 'Spices / Condiments'),
  ('Filling', '', '', 'Pantry'),
  ('• 2 cans (20 ounces each) pineapple pieces in their own juice', '', '', 'Produce'),
  ('• 6 tablespoons potato starch, loosely packed', '', '', 'Produce'),
  ('• 1 teaspoon vanilla', '', '', 'Pantry'),
  ('For Assembly', '', '', 'Pantry'),
  ('• Assorted chopped fresh fruit, such as kiwis, blueberries, strawberries, and pineapple', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-175: White Wine Dressing for Roasted Veggie Salad
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'White Wine Dressing for Roasted Veggie Salad', 6, null, null, '[Parve] Blend all ingredients together in a food processor. | Use with roasted vegetables and greens.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('mayonnaise', '1', 'cup', 'Spices / Condiments'),
  ('3/4 white wine (add a bit of sugar if using a wine that is not sweet)', '', 'cup', 'Bakery / Dry'),
  ('chopped fresh basil', '1', 'tablespoon', 'Pantry'),
  ('1 1/2 oregano', '', 'teaspoons', 'Spices / Condiments'),
  ('crushed garlic', '1', 'teaspoon', 'Produce'),
  ('1/2 olive oil', '', 'tablespoon', 'Spices / Condiments'),
  ('1/2 small onion, cut into chunks', '', '', 'Produce'),
  ('freshly squeezed lemon juice', '1', 'tablespoon', 'Produce'),
  ('kosher salt', '1', 'teaspoon', 'Spices / Condiments'),
  ('coarse black pepper', '', 'Pinch', 'Produce')
) as t(name, qty, unit, category);

-- SF-176: Scalloped Potatoes - Pareve
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Scalloped Potatoes - Pareve', 6, null, null, '[Meat] Sauté onions in oil for 7 to 8 minutes until clear and soft. | Add the flour or potato starch, stirring well. | Add the mayonnaise and chicken stock. Cook 2 to 3 minutes until the sauce thickens. Set aside. | Peel and slice the potatoes into 1/4-inch-thick slices. | Pour 3 to 4 ladles of sauce on the bottom of a 9x13-inch pan. | Spread a layer of potatoes, then sauce, then another layer of potatoes, ending with sauce on top. | Sprinkle with salt, pepper, and paprika. | Bake at 350°F for 1 to 1 1/2 hours, or until ready.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('9-10 large potatoes', '', '', 'Produce'),
  ('large onions', '2', '', 'Produce'),
  ('oil', '6', 'tablespoons', 'Spices / Condiments'),
  ('flour or potato starch', '5', 'tablespoons', 'Produce'),
  ('1/2 mayonnaise', '', 'cup', 'Spices / Condiments'),
  ('3 1/2 chicken stock', '', 'cups', 'Meat / Fish'),
  ('1/2 salt', '', 'teaspoon', 'Spices / Condiments'),
  ('Pepper and paprika, to taste', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-177: Scalloped Potatoes with Pastrami
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Scalloped Potatoes with Pastrami', 6, null, null, '[Meat] In a medium saucepan over medium heat, sauté the onions and pastrami in the fat, stirring frequently, until the onions are caramelized and the pastrami is browned in spots. | Add potato starch and stir until the onion and pastrami mixture is evenly coated. | Add mayonnaise, chicken stock, salt, and pepper; stir until the mixture is smooth and thickened. | Preheat oven to 350°F. | Peel and slice potatoes crosswise into very thin circles. Rinse well with cold water. | Pour some sauce into a 9x13-inch baking dish. Arrange a layer of potato slices over the sauce, then more sauce, and continue the pattern until you have about 5 to 6 layers. Cover tightly with foil. | Bake for 30 minutes, then uncover and cook for another hour, or until crispy.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('medium onions, diced', '8', '', 'Produce'),
  ('pastrami, diced', '2', 'pounds', 'Meat / Fish'),
  ('duck or chicken fat', '8', 'tablespoons', 'Meat / Fish'),
  ('potato starch', '5', 'tablespoons', 'Produce'),
  ('1/2 mayonnaise', '', 'cup', 'Spices / Condiments'),
  ('3 1/2 chicken stock', '', 'cups', 'Meat / Fish'),
  ('1 1/2 salt', '', 'tablespoons', 'Spices / Condiments'),
  ('3/4 coarse black pepper', '', 'teaspoon', 'Produce'),
  ('large russet potatoes', '8', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-178: Scalloped Potatoes (Instagram Version)
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Scalloped Potatoes (Instagram Version)', 6, null, null, '[Parve] In a pot, sauté the onions with the margarine, brown sugar, and red wine vinegar until lightly golden. | Sprinkle the potato starch over the onions while stirring. | Add the water and soup mix and let it simmer until it thickens, then turn off the heat. Taste and add more salt if needed. | Slice the potatoes thinly. | Grease a baking dish or 9x13 pan and start layering sauce, potatoes, sauce, potatoes, ending with sauce on top. | Sprinkle with paprika and black pepper. | Bake at 350°F for about 1 1/2 hours.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('3/4 margarine (may be replaced with 6 tablespoons oil)', '', 'stick', 'Spices / Condiments'),
  ('onions, thinly sliced', '2', '', 'Produce'),
  ('brown sugar', '1', 'tablespoon', 'Bakery / Dry'),
  ('1/2 red wine vinegar (optional if you do not use products)', '', 'teaspoon', 'Spices / Condiments'),
  ('3 1/2 water', '', 'cups', 'Pantry'),
  ('onion soup mix', '3', 'tablespoons', 'Produce'),
  ('A bit more salt, if needed', '', '', 'Spices / Condiments'),
  ('1/2 potato starch (during the year, use flour)', '', 'cup', 'Produce'),
  ('About 8 potatoes, thinly sliced', '', '', 'Produce'),
  ('Paprika', '', '', 'Spices / Condiments'),
  ('Black pepper', '', '', 'Produce')
) as t(name, qty, unit, category);

-- SF-179: Apple Kugel Topping (Partial)
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Apple Kugel Topping (Partial)', 6, null, null, '[Parve] The provided image only shows the topping ingredients and does not include the rest of the recipe.')
  returning id
)
insert into public.recipe_ingredients (recipe_id, name, quantity, unit, category)
select new_recipe.id, t.name, nullif(t.qty,'')::numeric, t.unit, t.category from new_recipe, (values
  ('(2 sticks) margarine, at room temperature', '1', 'cup', 'Pantry'),
  ('2 1/2 old fashioned oats', '', 'cups', 'Bakery / Dry'),
  ('1 1/4 flour', '', 'cups', 'Bakery / Dry'),
  ('1/2 brown sugar', '', 'cup', 'Bakery / Dry'),
  ('1/4 demerara sugar (or replace with brown sugar if unavailable)', '', 'cup', 'Bakery / Dry'),
  ('salt', '', 'Pinch', 'Spices / Condiments')
) as t(name, qty, unit, category);

-- SF-180: Pesach Fish
with new_recipe as (
  insert into public.recipes (property_id, name, servings, course, photo_url, notes)
  values ((select id from public.properties where name = 'Strauss' limit 1), 'Pesach Fish', 6, null, null, '[Parve] Add the sugar and sliced onion to a pot and cook until the sugar melts. | Add the vinegar, lemon juice, additional sugar, salt, bay leaves or pickling spice, and water. | Bring to a low boil. | Add the fish and cook for 20-30 minutes, being careful not to overcook. | Serve cold. | Prepared from your uploaded recipe image')
  returning id
)
select 1; -- no ingredients listed for this recipe
