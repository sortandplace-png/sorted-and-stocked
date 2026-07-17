# Pending photo matches -- confirmed products, Walmart fetch blocked

Generated 2026-07-16, consolidated from 4 background-agent scratchpad
files (round 1 batch 4, round 2 batches A/B/C). Every row below has an id-confirmed, name-verified
Walmart product URL that was identified via WebSearch but never successfully fetched -- Walmart's
bot-check page blocked every attempt across two full rounds tonight (163 items total).

**Do not re-run WebSearch identification for anything in this list.** Just re-fetch the URL (with
several seconds of pacing between requests, see lib/persist-photo.ts / scripts/inventory-photo-pipeline.ts
for the download+upload+DB-update pattern already used throughout this project), extract og:image,
re-host in the `inventory-photos` Supabase bucket, and update `inventory_items.photo_url`.

Confirm Walmart isn't still bot-walling before running the whole list -- a single cheap test request
is enough (see the block-check pattern used earlier: fetch one URL, check for a "Robot or human?"
response body before committing to the full batch).

## Confirmed matches (163)

| id | name | walmart product URL |
|---|---|---|
| 65c138d8-b6d7-485e-abf4-7d3eadecd59d | Lemon Juice | https://www.walmart.com/ip/Realemon-100-From-Concentrate-Natural-Strength-Lemon-Juice-15-Oz/10294761 |
| 681f99e3-74fd-43c5-a5de-d81d75637e3e | Dove Men+Care Clean Comfort Dry Spray Antiperspirant | https://www.walmart.com/ip/Dove-Men-Care-Long-Lasting-Antiperspirant-Deodorant-Dry-Spray-Clean-Comfort-3-8-oz/39993092 |
| 6ac6b80d-5497-4880-8db5-59436637d3f5 | Hot Peppers (Jarred) | https://www.walmart.com/ip/Mezzetta-Sliced-Hot-Jalape-o-Peppers-16-fl-oz-Jar/10313637 |
| 6bdcf4a3-3fdb-4bc0-9512-80e0b10298b4 | Irish Spring Body Wash | https://www.walmart.com/ip/Irish-Spring-Body-wash-Original-by-Irish-Spring-for-Unisex-15-oz-Body-Wash/15716535 |
| 6c436d49-2532-485f-9b76-2174e4d7cda5 | Pantene Pro-V Daily Moisture Renewal Conditioner (travel) | https://www.walmart.com/ip/12-Pack-Pantene-Pro-V-Daily-Moisture-Conditioner-Travel-Size-TSA-Approved-1-7oz/5222155042 |
| 6e7132c3-798a-4af1-951d-00cba2dd7f35 | Plastic Wrap | https://www.walmart.com/ip/Great-Value-Plastic-Wrap-200-Sq-ft/184907101 |
| 6f4670d6-ba5b-4ce5-b004-382d1c6a25f4 | Gushers Variety Pack | https://www.walmart.com/ip/Fruit-Gushers-Variety-Pack-0-8-oz-42-ct-3-bl/562479408 |
| 6f9e9257-995d-4d8f-b2db-f6d918e1d20f | Facial Tissues (Kleenex) | https://www.walmart.com/ip/Kleenex-Trusted-Care-Facial-Tissue-White-160-Sheets/384273418 |
| 77215cb3-6f14-451b-b5f8-a14967d90b31 | Facial Tissues (Kleenex) | https://www.walmart.com/ip/Kleenex-Trusted-Care-Facial-Tissue-White-160-Sheets/384273418 |
| 7baec558-22f3-42e4-8358-fb52da33f9ac | Facial Tissues (Kleenex) | https://www.walmart.com/ip/Kleenex-Trusted-Care-Facial-Tissue-White-160-Sheets/384273418 |
| 7c1c7d07-4a15-49f5-ab88-95b491f3498a | Facial Tissues (Kleenex) | https://www.walmart.com/ip/Kleenex-Trusted-Care-Facial-Tissue-White-160-Sheets/384273418 |
| 7023c82e-b0cd-41f2-bc20-66b6ecf45fd6 | Dove Deep Moisture Body Wash (travel) | https://www.walmart.com/ip/Dove-Deep-Moisture-Body-Wash-3-oz/33420952 |
| 76bb0510-f3e9-479c-a36e-25e4d987476e | Dove Deep Moisture Body Wash (travel) | https://www.walmart.com/ip/Dove-Deep-Moisture-Body-Wash-3-oz/33420952 |
| 71befc2c-d130-407e-9a71-73b3d0316fd5 | Ground Coriander | https://www.walmart.com/ip/Great-Value-Organic-Ground-Coriander-1-5-oz-Bottle/50597552 |
| 72ad6e24-f49d-4330-9e76-d02066fc7c06 | Real Techniques Makeup Sponges | https://www.walmart.com/ip/Real-Techniques-Miracle-Complexion-Sponge-Makeup-Sponge-for-Liquids-Creams-Orange-1-Count/115226098 |
| 732264a5-7304-4eea-a77e-2fbb19e911f4 | Honey | https://www.walmart.com/ip/Great-Value-Honey-12-oz-Plastic-Bear/20647992 |
| 74830c9b-58da-400e-8bce-0b5dfdc2e09c | Sliced Almonds | https://www.walmart.com/ip/Great-Value-Toasted-and-Sliced-Almonds-10-oz/888727526 |
| 74f99d8a-5ef9-4f44-86a6-c6d1317869e1 | Smart Balance Peanut Butter Creamy | https://www.walmart.com/ip/Smart-Balance-Creamy-Peanut-and-Flaxseed-Oil-Spread-Peanut-Butter-Alternative-16-oz-Jar/10411941 |
| 758ac7bc-d767-4706-8ea0-eddc9bdb682e | Nescafé Tasters Choice House Blend Instant Coffee Sticks | https://www.walmart.com/ip/NESCAFE-TASTER-S-CHOICE-1PACK-House-Blend-Instant-Coffee-Single-Serve-Packets/12874909084 |
| 769541d2-ed80-4ba2-98cf-03ea15cb5849 | Stella Doro Swiss Fudge Cookies 8 Oz | https://www.walmart.com/ip/Stella-D-oro-Cookies-Swiss-Fudge-8-oz/15724054 |
| 7695c0e2-239e-4029-9164-b274b219aa0a | Dill Pickle Spears | https://www.walmart.com/ip/Grillo-s-Pickles-Classic-Dill-Pickle-Spears-32-fl-oz-Jar/143105821 |
| 7780c3c8-8303-40ad-bfa1-98c5f228927a | Half and Half | https://www.walmart.com/ip/Great-Value-Half-and-Half-64-fl-oz-Carton-Refrigerated/14336391 |
| 77958965-53ae-456b-903c-83665fc4580d | Listerine Cool Mint PocketPaks Breath Strips (24 ct) | https://www.walmart.com/ip/Listerine-Cool-Mint-Pocketpaks-Breath-Strips-24-count/24983787 |
| 79b0d84e-5bae-49ed-ae19-8356a95fc239 | Side Of Salmon | https://www.walmart.com/ip/Fresh-Atlantic-Salmon-Fillets-2-00-3-00-lb-Whole-Salmon-Side-240-Calories-per-3-oz-Serving-Certifications-BAP-Certified/805059635 |
| 7a755e23-afa2-45fa-a732-3942ab198bdb | Lawry's Seasoned Salt | https://www.walmart.com/ip/Lawry-s-Kosher-Seasoned-Salt-8-oz-Bottle/10804936 |
| 7aadc05d-db54-4b71-a9af-2bbaa2ec4638 | Manischewitz Egg Noodles Homestyle Wide | https://www.walmart.com/ip/Manischewitz-Homestyle-Wide-Egg-Noodles-12-oz/1635113698 |
| 7b9aff78-3183-40f2-a8e3-77926fb4e0b3 | Dude Wipes (Flushable) | https://www.walmart.com/ip/DUDE-Wipes-Flushable-Wet-Wipes-Unscented-1-Pack-48-Total-Wipes/186643620 |
| 7d6199b9-250c-4ecc-a26b-0626114469eb | Tylenol Extra Strength Rapid Release Gels 500 mg (24 ct) | https://www.walmart.com/ip/Tylenol-Extra-Strength-500-mg-Acetaminophen-Rapid-Release-Gels-24-Ct/111858327 |
| 7f66d11e-adf2-42ba-b91c-510bb8259bbf | Soft Scrub All-Purpose Cleanser — Lemon | https://www.walmart.com/ip/Soft-Scrub-All-Purpose-Surface-Cleanser-Lemon-24-Fluid-Ounces/15028899 |
| 81a4f6ae-8f2b-4114-b57e-f9f2562899e1 | Raw / Turbinado Sugar Packets | https://www.walmart.com/ip/Sugar-In-The-Raw-Turbinado-Cane-Sugar-Packets/10292114 |
| 8425d122-a1a6-43e8-9710-e10352a0215b | Plastic Spoons | https://www.walmart.com/ip/Great-Value-Plastic-Basic-White-Spoons-100-Count/11979183 |
| 817eb02c-4697-49a3-9c47-e55608cafc37 | Green Seedless Grapes 3lbs | https://www.walmart.com/ip/Fresh-Green-Seedless-Grapes-3-lb-Package/32176609 |
| 74592aca-c24b-45bf-b4da-708a00c3ab0b | Meal Mart Kishka 16 Oz | https://www.walmart.com/ip/Meal-Mart-Beef-Kishka-16oz/494986942 |
| 03107bb2-a2a4-48ce-870a-6cfd0a41aedb | Dove Antiperspirant Deodorant (travel) | https://www.walmart.com/ip/Dove-Deodorant-1OZ-48HR/9069600248 |
| 07026be5-67f1-4cee-a8a8-4387528fc92d | Dove Antiperspirant Deodorant (travel) | https://www.walmart.com/ip/Dove-Deodorant-1OZ-48HR/9069600248 |
| 2404b03a-60dc-4151-b801-39bfb61b6869 | Dove Antiperspirant Deodorant (travel) | https://www.walmart.com/ip/Dove-Deodorant-1OZ-48HR/9069600248 |
| 027a50cc-6a3f-412c-b0ca-4bb5493e04f9 | Irish Spring Body Wash | https://www.walmart.com/ip/Irish-Spring-Mens-Body-Wash-Body-Wash-for-Men-All-Skin-Types-Original-Scent-20-fl-oz-Bottle/446149431 |
| 06434e2c-b2bc-49f9-aae1-ef4fa1eecaab | Neutrogena Hydro Boost Face Cream | https://www.walmart.com/ip/Neutrogena-Hydro-Boost-Hyaluronic-Acid-Water-Cream-1-7-fl-oz/2843002480 |
| 07e158ed-0578-4b2a-9f74-1eed1b2ddd3e | Tylenol Extra Strength Rapid Release Gels 500 mg (24 ct) | https://www.walmart.com/ip/Tylenol-Extra-Strength-500-mg-Acetaminophen-Rapid-Release-Gels-24-Ct/111858327 |
| 229a7631-c9b5-47cb-b59e-3d003ef69d75 | Tylenol Extra Strength Rapid Release Gels 500 mg (24 ct) | https://www.walmart.com/ip/Tylenol-Extra-Strength-500-mg-Acetaminophen-Rapid-Release-Gels-24-Ct/111858327 |
| 26aefd26-2e6d-4535-8eea-e5a5f2b28c3f | Tylenol Extra Strength Rapid Release Gels 500 mg (24 ct) | https://www.walmart.com/ip/Tylenol-Extra-Strength-500-mg-Acetaminophen-Rapid-Release-Gels-24-Ct/111858327 |
| 08c9bba1-d9b4-4170-914d-ad85099e7e30 | Listerine Cool Mint Mouthwash | https://www.walmart.com/ip/Listerine-Cool-Mint-Antiseptic-Mouthwash-For-Bad-Breath-Plaque-Oral-Care-1-L/871622 |
| 092a5359-4277-4b66-b684-341cb562752e | Made Good Chocolate Chip Cookies | https://www.walmart.com/ip/MadeGood-Chocolate-Chip-Soft-Baked-Mini-Cookies-0-85-oz-5-count/584278184 |
| 0ac2ffe7-06fc-4077-9eb8-e28b8a25923d | Pantene Pro-V Daily Moisture Renewal Conditioner (travel) | https://www.walmart.com/ip/12-Pack-Pantene-Pro-V-Daily-Moisture-Conditioner-Travel-Size-TSA-Approved-1-7oz/5222155042 |
| 0bb42411-36e4-48ef-b742-b1b5de0c5f02 | Dove Men+Care Clean Comfort Dry Spray Antiperspirant | https://www.walmart.com/ip/Dove-Men-Care-Long-Lasting-Antiperspirant-Deodorant-Dry-Spray-Clean-Comfort-3-8-oz/39993092 |
| 2fe6adbf-dcf7-4855-9c5a-f8ca21c4bfd5 | Dove Men+Care Clean Comfort Dry Spray Antiperspirant | https://www.walmart.com/ip/Dove-Men-Care-Long-Lasting-Antiperspirant-Deodorant-Dry-Spray-Clean-Comfort-3-8-oz/39993092 |
| 0d548285-3562-4037-ab87-055409c05e66 | Opti-Free Replenish Disinfecting Solution | https://www.walmart.com/ip/OPTI-FREE-Replenish-Disinfecting-Contact-Lens-Solution-for-Daily-Contact-Lens-Cleaning-Use-10-fl-oz/12169288 |
| 326bdf7a-70ee-453c-bc04-0031536dacdb | Opti-Free Replenish Disinfecting Solution | https://www.walmart.com/ip/OPTI-FREE-Replenish-Disinfecting-Contact-Lens-Solution-for-Daily-Contact-Lens-Cleaning-Use-10-fl-oz/12169288 |
| 0da2f018-1c11-466c-8b7d-f526eb8b5ce4 | Listerine Cool Mint PocketPaks Breath Strips (24 ct) | https://www.walmart.com/ip/Listerine-Cool-Mint-Pocketpaks-Breath-Strips-24-count/24983787 |
| 0de31f89-21ed-4a9b-8238-9740fc12827f | Sliced Baby Bella Mushrooms | https://www.walmart.com/ip/Fresh-Sliced-Baby-Bella-Mushrooms-16-oz/20923720 |
| 1648dcf8-a47a-4eb0-bf54-4cf120421e08 | TUMS Smoothies Extra Strength 750 Assorted Fruit (12 ct) | https://www.walmart.com/ip/TUMS-Antacid-Chewable-Tablets-Smoothies-Assorted-Fruit-for-Heartburn-Relief-12-count/46108496 |
| 2bfb7ab1-df59-4b54-b183-1523bf5c373a | TUMS Smoothies Extra Strength 750 Assorted Fruit (12 ct) | https://www.walmart.com/ip/TUMS-Antacid-Chewable-Tablets-Smoothies-Assorted-Fruit-for-Heartburn-Relief-12-count/46108496 |
| 18006d06-363d-4111-9940-717e4bfe4f6e | Polar Seltzer Variety Pack | https://www.walmart.com/ip/Polar-Seltzer-Variety-Pack-32-ct-12-oz/905403396 |
| 19c602ca-0c1d-45d9-8399-2d6fe561f6f0 | Facial Tissues (Kleenex) | https://www.walmart.com/ip/Kleenex-Trusted-Care-Facial-Tissue-White-160-Sheets/384273418 |
| 1f33f983-f538-4bc0-98d0-3c31912e3e81 | Kleenex Hand Towels | https://www.walmart.com/ip/Kleenex-Hand-Towels-6-Pack/252360109 |
| 27c3c674-b174-4c27-95be-41f3105f78e1 | New York Biology Vitamin B7 Biotin Conditioner | https://www.walmart.com/ip/New-York-Biology-Vitamin-B7-Biotin-Conditioner-16-9oz-for-Hair-Growth-Thinning-Hair-Thickening-Formula-for-Hair-Loss-Treatment-For-Men-Women/621720461 |
| 2809366f-17c5-4cce-89b1-aee4eb7b5128 | Frozen Raspberries | https://www.walmart.com/ip/Great-Value-Frozen-Whole-Red-Raspberries-12-oz/10543665 |
| 2869cb0a-ebf5-4eb4-86d9-0b06966a4942 | Red Baby Potatoes | https://www.walmart.com/ip/Red-Potatoes-Whole-Fresh-3-lb-Bag/10449949 |
| 290d3d8f-d93f-4816-99cd-7a92fa1b1175 | Saltair Santal Bloom Body Wash (pump) | https://www.walmart.com/ip/Saltair-Body-Wash-Santal-Bloom-2-Pack/5077978656 |
| 2c012dc8-f049-4b93-9ad0-ad515a23e22a | Wet Brush Original Detangler | https://www.walmart.com/ip/Wet-Brush-Original-Detangler-For-Wet-or-Dry-Hair-Black-1CT/743729422 |
| 275351e9-17ed-4d08-b947-8f3da79405cc | Ortega Mini Taco Slider Shells | https://www.walmart.com/ip/Ortega-Yellow-Corn-Mini-Taco-Slider-Shells-Kit-Kosher-18-Ct/507994133 |
| 311b0f0d-35a2-42f1-aa5d-6193f34553b8 | Lipton Recipe Soup & Dip Mix (Ranch) | https://www.walmart.com/ip/Lipton-Ranch-Recipe-Secrets-2-4oz/10320777 |
| 31a3c179-4357-4c80-a18c-bb9fb65e139a | Coppertone Kids Sunscreen SPF50 | https://www.walmart.com/ip/Coppertone-Kids-Sunscreen-Spray-SPF-50-Spray-Sunscreen-for-Kids-8-3-Oz/908686882 |
| 32fee52d-2603-4c2e-8a8f-58fb14210e73 | Dove Advanced Dry Spray Deodorant | https://www.walmart.com/ip/Dove-Advanced-Care-Dry-Spray-Invisible-Clear-Finish-Antiperspirant-Deodorant-3-8-oz/55072155 |
| 2d64c390-34d4-4cf2-8b84-351822bd55d3 | Kedem Cooking Wine Marsala | https://www.walmart.com/ip/Kedem-Gourmet-Marsala-Cooking-Wine-375ml-Certified-Kosher/948786413 |
| 2ef7b891-3f32-47d0-8482-3e5f6c2d428e | Harissa Sauce | https://www.walmart.com/ip/Mina-Harissa-Spicy-Moroccan-Red-Pepper-Sauce-10-Fl-oz/544999596 |
| 0622c39f-4bbf-4da7-acaa-6e04281fb2ee | Eishes Chayil Bedika Cloths (48 ct) | https://www.walmart.com/ip/Eishes-Chayil-Softest-Bedika-Cloth-envelope-enclosed-Ideal-for-Sensitive-skin-With-kosher-certifticate/3557712290 |
| 1115cf5f-9e3f-4e7e-b47d-a7be33f384c3 | Eishes Chayil Bedika Cloths (48 ct) | https://www.walmart.com/ip/Eishes-Chayil-Softest-Bedika-Cloth-envelope-enclosed-Ideal-for-Sensitive-skin-With-kosher-certifticate/3557712290 |
| 3338e27d-ef55-4b75-8892-ba5b9a1d0e86 | Eishes Chayil Bedika Cloths (48 ct) | https://www.walmart.com/ip/Eishes-Chayil-Softest-Bedika-Cloth-envelope-enclosed-Ideal-for-Sensitive-skin-With-kosher-certifticate/3557712290 |
| 1181c319-4942-408e-848a-edf95eb3c0a8 | Sweet Potatoes | https://www.walmart.com/ip/Sweet-Potatoes-Whole-Fresh-Each-Batata-Mameya/44390964 |
| 1213940b-e55a-4c4c-bfa4-ce5e8a6a1771 | Roma Tomatoes | https://www.walmart.com/ip/Fresh-Roma-Tomato-Each/44390944 |
| 230cbb4c-3c9c-44d0-bc63-5c6ca916b27f | Broccoli | https://www.walmart.com/ip/Fresh-Broccoli-Crowns-Each/51259378 |
| 3065d3b5-6203-4e0b-a5de-c133b23f214a | Jalapeno Peppers | https://www.walmart.com/ip/Fresh-Jalapeno-Pepper-approx-3-5-per-0-25-lb/44391018 |
| 212a726b-d9ef-4a24-81c7-722a32c024a0 | Baby Carrots | https://www.walmart.com/ip/Fresh-Baby-Cut-Carrots-2lb-Bag/10451316 |
| 1f78e29a-71aa-4ce1-a413-5e1aeeb560c4 | Iceberg Lettuce | https://www.walmart.com/ip/Fresh-Iceberg-Lettuce-Each/10402650 |
| 06f93118-f1f0-4d07-955c-027217e45c98 | Kale | https://www.walmart.com/ip/Fresh-Green-Kale-Bunch-Each/40347953 |
| 087098bb-c302-440f-8de9-5c0d2112e72a | Navel Oranges | https://www.walmart.com/ip/Fresh-Navel-Orange-Each/162577028 |
| 24cf20d1-8702-4c85-ade1-3dfef8f518af | Raspberries | https://www.walmart.com/ip/Fresh-Raspberries-6-oz-Container/44391666 |
| 169169f2-2552-45d1-bf27-890f2392a226 | Fresh Cranberries | https://www.walmart.com/ip/Fresh-Cranberries-12-oz/13908231 |
| 2eff36fc-3b6f-4a9d-aa3d-8ae52e542f46 | Green Seedless Grapes | https://www.walmart.com/ip/Fresh-Green-Seedless-Grapes-2-25-lbs-Bag-Est/44390943 |
| 2c288d5b-1749-4736-8420-a3f4f3ec5998 | Cilantro | https://www.walmart.com/ip/Fresh-Cilantro-Bunch/160597260 |
| 21f4cef1-1edf-4c02-9c18-35c92af57aae | Dill | https://www.walmart.com/ip/Fresh-Dill-0-5-oz-Clamshell/2623469649 |
| 2b1260b2-0408-426c-a165-7564bb730d30 | Thyme | https://www.walmart.com/ip/Fresh-Thyme-0-5-oz-Clamshell/3953481268 |
| 05557538-3495-496f-ad51-5296452aedc7 | Red Cabbage | https://www.walmart.com/ip/Fresh-Red-Cabbage-Each/44391206 |
| 11c019bb-8be9-4944-8a75-566e03a71b9a | Green Onions | https://www.walmart.com/ip/Fresh-Green-Onions-Bunch-Each/51259361 |
| 0d0577dc-ceca-4ff5-88b5-7aa7069db9ec | Scallions Bunch | https://www.walmart.com/ip/Fresh-Green-Onions-Bunch-Each/51259361 |
| 39990dad-ae25-4e8d-b0b8-9c7f47c64a36 | Dove Men+Care Clean Comfort Dry Spray Antiperspirant | https://www.walmart.com/ip/Dove-Men-Care-Long-Lasting-Antiperspirant-Deodorant-Dry-Spray-Clean-Comfort-3-8-oz/39993092 |
| 4cf49c46-7ab4-4466-b10f-ba9f478148b5 | Irish Spring Body Wash | https://www.walmart.com/ip/Irish-Spring-Body-wash-Original-by-Irish-Spring-for-Unisex-15-oz-Body-Wash/15716535 |
| 5264aa69-ef19-4b18-9bd2-a4c8d6f6eb8e | Irish Spring Body Wash | https://www.walmart.com/ip/Irish-Spring-Body-wash-Original-by-Irish-Spring-for-Unisex-15-oz-Body-Wash/15716535 |
| 3c5cc02c-0c5f-4664-b8b5-e52000732528 | Pantene Pro-V Daily Moisture Renewal Conditioner (travel) | https://www.walmart.com/ip/12-Pack-Pantene-Pro-V-Daily-Moisture-Conditioner-Travel-Size-TSA-Approved-1-7oz/5222155042 |
| 450f6742-6ad3-493c-b381-3fbb9aa94509 | Pantene Pro-V Daily Moisture Renewal Conditioner (travel) | https://www.walmart.com/ip/12-Pack-Pantene-Pro-V-Daily-Moisture-Conditioner-Travel-Size-TSA-Approved-1-7oz/5222155042 |
| 5725b71e-0c80-4cee-a4a7-a6bb1ff34e42 | Pantene Pro-V Daily Moisture Renewal Conditioner (travel) | https://www.walmart.com/ip/12-Pack-Pantene-Pro-V-Daily-Moisture-Conditioner-Travel-Size-TSA-Approved-1-7oz/5222155042 |
| 500e37ca-e98f-495e-a852-5aa67d4a22e6 | Facial Tissues (Kleenex) | https://www.walmart.com/ip/Kleenex-Trusted-Care-Facial-Tissue-White-160-Sheets/384273418 |
| 539abd9c-bc96-4d18-b782-d7a41fa0bc41 | Facial Tissues (Kleenex) | https://www.walmart.com/ip/Kleenex-Trusted-Care-Facial-Tissue-White-160-Sheets/384273418 |
| 393ba6f5-223e-4686-903b-5b0d131bd264 | Listerine Cool Mint PocketPaks Breath Strips (24 ct) | https://www.walmart.com/ip/Listerine-Cool-Mint-Pocketpaks-Breath-Strips-24-count/24983787 |
| 3f90c54c-2794-4373-91aa-45351314e4d1 | TUMS Smoothies Extra Strength 750 Assorted Fruit (12 ct) | https://www.walmart.com/ip/TUMS-Smoothies-Antacid-Tablets-Assorted-Fruit-12-ct/522839823 |
| 5a2cf913-69b0-4799-9e2e-dae701c1ad63 | Crest Scope Classic Mouthwash (travel) | https://www.walmart.com/ip/Crest-Scope-Classic-Travel-Size-TSA-Compliant-Mouthwash-1-2-Oz-36-ML-Blister-Sealed-Pack-Of-3/5318326875 |
| 45b0e566-ffe9-452e-89c5-55312e5d08cf | Eishes Chayil Bedika Cloths (48 ct) | https://www.walmart.com/ip/Eishes-Chayil-Softest-Bedika-Cloth-envelope-enclosed-Ideal-for-Sensitive-skin-With-kosher-certifticate/3557712290 |
| 37c10f97-0998-46ed-83d7-8be07654cbbb | Brown Lentils | https://www.walmart.com/ip/Bob-s-Red-Mill-Brown-Lentils-27-oz-Pkg/806470311 |
| 397c58de-ba5a-4ee9-bcff-ded861e15add | Chopped Walnuts | https://www.walmart.com/ip/Great-Value-Chopped-Walnuts-8-oz/620060802 |
| 3a60a771-e0d2-450b-804e-86b4abd46df3 | Cantaloupe | https://www.walmart.com/ip/Cantaloupe-each/44390974 |
| 3e5ec170-278d-461f-ba3b-6d62c4246e38 | Dried Apricots | https://www.walmart.com/ip/Great-Value-Dried-Apricots-16-oz/974611955 |
| 3ee2ca13-c0b4-4182-9432-cb8494923044 | Smart Balance Dairy Free Butter | https://www.walmart.com/ip/Smart-Balance-Original-Buttery-Spread-15-oz-Tub/10411807 |
| 40063045-298a-4972-a283-db55b6967799 | Cornstarch | https://www.walmart.com/ip/Great-Value-Corn-Starch-16-oz/54802256 |
| 40c81b80-62b9-4c37-b206-ade08be155a5 | Baby Bella Mushrooms | https://www.walmart.com/ip/Fresh-Sliced-Baby-Bella-Mushrooms-8-oz/586083289 |
| 42275e5b-4d2b-4b3a-8450-9a161657032d | Enjoy Life Dark Chocolate Morsels | https://www.walmart.com/ip/Enjoy-Life-Allergy-Friendly-Dairy-Free-Dark-Chocolate-Morsels-Baking-Chocolate-9-oz/36354613 |
| 4286d36b-8faf-479e-bf87-f5e6024b12a6 | Red Onions | https://www.walmart.com/ip/Fresh-Whole-Red-Onion-Each/51259215 |
| 48282ec9-496b-4001-9a49-5648ce9fd75e | Orzo | https://www.walmart.com/ip/RiceSelect-Orzo-Rice-Shaped-Pasta-Premium-Non-GMO-AIS1-nbsp-Orzo-Pasta-26-5-Ounce-Jar/16625267159 |
| 4c9c6238-4589-4fe8-8ae8-af5cf7f80490 | Green Beans | https://www.walmart.com/ip/Fresh-Green-Beans/44391023 |
| 4cbb1557-ba75-4583-84d9-e4dfc3d3e7a3 | Granny Smith Apples | https://www.walmart.com/ip/Fresh-Granny-Smith-Apples-3-lb-Bag/44390991 |
| 4dc477c1-1261-4e01-a974-9e6e1d5b5801 | Heinz Apple Cider Vinegar (2-pack) | https://www.walmart.com/ip/Heinz-All-Natural-Apple-Cider-Vinegar-with-5-Acidity-32-fl-oz-Bottle/14869670 |
| 4f6c8e22-a302-42af-bd3c-9567595efdf8 | Spring Mix | https://www.walmart.com/ip/Marketside-Spring-Mix-Salad-Blend-11-oz-Clam-Shell-Fresh/254834665 |
| 4f7da1d8-e718-461b-b299-19a826b495e3 | Plastic Forks | https://www.walmart.com/ip/Great-Value-Disposable-Plastic-White-Forks-100-Count/12335125 |
| 502919c3-456a-4247-85cc-bbf2f72bd01b | Parsley | https://www.walmart.com/ip/Fresh-Curly-Parsley-Bunch-Each/44391167 |
| 514e3b47-b105-4262-852e-afae6188d2c3 | California Cherries | https://www.walmart.com/ip/Fresh-Red-Cherries-2-25-lb-Bag/46491694 |
| 56410da5-fe36-4719-ac35-ce25653faef4 | Scallions | https://www.walmart.com/ip/Green-Onions-Bunch/51259361 |
| 5bb83fcc-0b55-4db3-900e-59c57f79851b | Feta Cheese (Crumbled) | https://www.walmart.com/ip/Athenos-Traditional-Crumbled-Feta-Cheese-6-oz-Refrigerated-Plastic-Tub/46400590 |
| 5c1c0084-5072-44b2-8852-6144e3ea0077 | Broccoli Crowns | https://www.walmart.com/ip/Fresh-Broccoli-Crowns-Each/51259378 |
| 5f88a9c7-9851-4fd6-831d-71f984f4932b | Muffin Pan (6-cup) | https://www.walmart.com/ip/Mainstays-6-Cup-Nonstick-Steel-Muffin-Pan-1-2-in-Diameter-Cups-6-Pieces/3539939372 |
| 60299532-1b60-4bc4-8342-60e3bc8ed970 | Cherry Tomatoes | https://www.walmart.com/ip/Glory-Cherry-Tomatoes-1-dry-pint/115732128 |
| 3911d41b-32a4-48cb-b364-26b13ba4d6c8 | Dove Antiperspirant Deodorant (travel) | https://www.walmart.com/ip/Dove-Advanced-Care-Travel-Sized-Antiperspirant-Deodorant-Stick-Cool-Essentials-0-5-oz/46268982 |
| 475b2eb3-e467-4be8-8598-9597118fe2f1 | Dove Antiperspirant Deodorant (travel) | https://www.walmart.com/ip/Dove-Advanced-Care-Travel-Sized-Antiperspirant-Deodorant-Stick-Cool-Essentials-0-5-oz/46268982 |
| 4b63f0a3-9779-4870-a8cf-314f7e58da20 | Dove Antiperspirant Deodorant (travel) | https://www.walmart.com/ip/Dove-Advanced-Care-Travel-Sized-Antiperspirant-Deodorant-Stick-Cool-Essentials-0-5-oz/46268982 |
| 92bc1c09-240f-4eef-85df-fcb03a90c04f | Pantene Pro-V Daily Moisture Renewal Conditioner (travel) | https://www.walmart.com/ip/12-Pack-Pantene-Pro-V-Daily-Moisture-Conditioner-Travel-Size-TSA-Approved-1-7oz/5222155042 |
| 965cad21-9fe7-469d-8ed3-e13cfa59d8b0 | Irish Spring Body Wash | https://www.walmart.com/ip/Irish-Spring-Body-wash-Original-by-Irish-Spring-for-Unisex-15-oz-Body-Wash/15716535 |
| 96de62c8-67bd-4cf0-98b9-c7dab7975ee8 | Irish Spring Body Wash | https://www.walmart.com/ip/Irish-Spring-Body-wash-Original-by-Irish-Spring-for-Unisex-15-oz-Body-Wash/15716535 |
| a55e11d8-f9c3-4cf4-8631-a68c71ba63d6 | Dove Deep Moisture Body Wash (travel) | https://www.walmart.com/ip/Dove-Deep-Moisture-Body-Wash-3-oz/33420952 |
| c655e928-dc18-414c-bb8c-fb291e95d572 | Dove Men+Care Clean Comfort Dry Spray Antiperspirant | https://www.walmart.com/ip/Dove-Men-Care-Long-Lasting-Antiperspirant-Deodorant-Dry-Spray-Clean-Comfort-3-8-oz/39993092 |
| 9d5f3999-abb3-4750-bd9b-1726bbd18738 | Potato Flour | https://www.walmart.com/ip/Bob-s-Red-Mill-Potato-Flour-24-oz/436911578 |
| aaeb9760-642d-4ffe-a8c9-c17b011943f5 | Eden Foods White Cannellini Kidney Beans | https://www.walmart.com/ip/Eden-Foods-Organic-Cannellini-White-Kidney-Beans-15-oz/1646307633 |
| c3f4196b-bd3d-49f1-b7cd-451ae50a12f7 | TUMS Smoothies Extra Strength 750 Assorted Fruit (12ct) | https://www.walmart.com/ip/TUMS-Smoothies-Assorted-Fruit-Extra-StrengthAntacid-Chewable-Tablets-for-Heartburn-Relief-12-Tablets/17325222 |
| a1b252bb-58aa-4e6f-986d-e653e388f0e6 | Pacific Blue Select Multifold Paper Towels (16pk x125, Case) | https://www.walmart.com/ip/Georgia-Pacific-Blue-Select-Multifold-Premium-2-Ply-Paper-Towels-White-16-Packs-Per-Case/584928267 |
| 906ec6ee-a8d9-4f63-b88d-3c266935a1e7 | Crest Scope Classic Mouthwash (travel) | https://www.walmart.com/ip/36-Pack-Crest-Scope-Classic-Mouthwash-Travel-Size-1-2-oz-Original-Mint-Flavor/18954023470 |
| c2b114ed-8f2c-4118-b061-e237ded48d4e | Crest Scope Classic Mouthwash (travel) | https://www.walmart.com/ip/36-Pack-Crest-Scope-Classic-Mouthwash-Travel-Size-1-2-oz-Original-Mint-Flavor/18954023470 |
| bd135b2c-9159-4363-ab2f-80142cf779da | Norman's Lowfat Vanilla Yogurt | https://www.walmart.com/ip/Norman-s-Yogurt-80-Lite-Vanilla/12905965381 |
| a13baf74-ea4e-4b80-817d-2f393a6cf356 | Polar Seltzer — Lemon | https://www.walmart.com/ip/Polar-Seltzer-Water-Lemon-12-fl-oz-cans-12-Pack/47375472 |
| a3fa9842-b876-4a85-a9d6-92a0eb1f3fd3 | Fettuccine | https://www.walmart.com/ip/Great-Value-Fettuccine-16-oz/12329728 |
| a21759c3-5da9-4f52-afc3-be19884c149d | Broccoli Slaw Mix | https://www.walmart.com/ip/Green-Giant-Fresh-Broccoli-Slaw-12-oz/13399613 |
| aca145b3-46ed-42d9-9165-609f2a4c494e | Sun Harvest Simply Seedless Red Grapes | https://www.walmart.com/ip/Fresh-Red-Seedless-Grapes-32-oz-Bag/47770140 |
| a04e7a86-b672-4a6b-8f85-e959cd4b07f3 | Green Cabbage | https://www.walmart.com/ip/Fresh-Green-Cabbage-Each/44391042 |
| a15ce69d-9e6a-4444-9bcc-7c33d058d8fd | Peaches | https://www.walmart.com/ip/Fresh-Yellow-Peach-Each/216218066 |
| a18cc02f-e3e5-4e19-87bf-95c537f58841 | Fresh Thyme | https://www.walmart.com/ip/Fresh-Thyme-0-5-oz-Clamshell/3953481268 |
| a20ac71e-61a2-413a-8176-7d35530fb89c | Yellow Peaches 4lbs | https://www.walmart.com/ip/Fresh-Yellow-Peach-Each/216218066 |
| a6b688b4-3953-479f-8ff6-939255c6c231 | Yukon Gold Potatoes | https://www.walmart.com/ip/Yellow-Potatoes-Whole-Fresh-3lb-Bag/42700530 |
| aaad4219-cb6c-45bd-8df1-2d451f25b935 | Fuji Apples | https://www.walmart.com/ip/Fresh-Fuji-Apples-3-lb-Bag/44391639 |
| ab692b81-2106-4662-9241-5ab4d0b8346d | Plums | https://www.walmart.com/ip/Fresh-Plums-2-lb-Bag/153466616 |
| ac36e96d-bfb7-4a41-b7eb-5400eb1d1901 | Red Cabbage | https://www.walmart.com/ip/Fresh-Red-Cabbage-Each/44391206 |
| ad4842c8-2c94-4529-b660-04e517609c68 | Corn on the Cob | https://www.walmart.com/ip/Fresh-Sweet-Corn-on-the-Cob-1-each/44391430 |
| af190adf-32e2-4dc0-a515-f6ab13abacef | Verdini Fresh Dill | https://www.walmart.com/ip/Fresh-Dill-0-5-oz-Clamshell/2623469649 |
| b4b9865c-35e8-4084-bb1d-d8f227cce8fe | Bananas | https://www.walmart.com/ip/Fresh-Banana-Each/44390948 |
| bb3dc792-7a96-47de-8d17-3892efcfb874 | Bosc Pears | https://www.walmart.com/ip/Fresh-Bosc-Pears-Each/349351812 |
| bcba2a1b-ab18-42e2-9a7e-5cf621fec3aa | Romaine Hearts | https://www.walmart.com/ip/Fresh-Romaine-Lettuce-Hearts-3-Count-Each/10532755 |
| bda8f605-575d-4bac-81e3-577771370612 | Beefsteak Tomatoes | https://www.walmart.com/ip/Large-Beefsteak-Tomatoes-each/44390971 |
| beebf8d8-5b0c-4801-a93a-c5d85b6c2b0d | Celery | https://www.walmart.com/ip/Fresh-Celery-Stalk-Each/51259411 |
| c1826c17-c03d-4258-8f2c-8ce02c415ae8 | Yellow Squash | https://www.walmart.com/ip/Fresh-Yellow-Squash/44391040 |
| c6cf1480-24c4-499e-b0b9-c810cf49f8fd | Honeycrisp Apples | https://www.walmart.com/ip/Fresh-Honeycrisp-Apples-3-lb-Bag/151762086 |
| 9d7c0e5d-d641-463f-8289-d0777b554915 | Bell Peppers Mix | https://www.walmart.com/ip/Fresh-Color-Bell-Peppers-3-Count/47770124 |
| ba0bf83a-450c-48a6-be75-5114909fbb8f | Cucumber | https://www.walmart.com/ip/Fresh-Cucumber-Each/44390954 |
| a5a71b6f-bd3e-4a9f-886f-a5621f891908 | Quinoa | https://www.walmart.com/ip/Kirkland-Signature-Organic-Quinoa-4-5-lbs/101020944 |
| a3736e11-c28e-4e45-b9cd-ef1b157c6a1f | Maple Syrup | https://www.walmart.com/ip/Great-Value-Pure-Maple-Syrup-32-fl-oz/492758994 |
| b7e8a4be-9cb8-4679-a724-d5e81cf76808 | Italian Seasoning | https://www.walmart.com/ip/Great-Value-Italian-Seasoning-0-95-oz/637648335 |
| 7c69030e-5a39-47bf-bc91-10fd542027c4 | Shoulder Steak | https://www.walmart.com/ip/Tyson-Foods-Black-Gold-Ranch-Steak-Beef-Shoulder-Center-Steak-12lbs-PACK-OF-1/694840129 |
| ba6feaad-1a71-479d-a38f-34fafb333b67 | Veal Steak | https://www.walmart.com/ip/Today-Gourmet-Veal-Rib-Chops-7-10-12oz-Chops/14656354689 |

## Additional products identified (name only, no item id captured) -- from round 1 batches 3/5/6/8's
## text reports rather than a saved file. Look up the id by name in inventory_items before using.

- Green Beans, Granny Smith Apples, Spring Mix, Scallions, Broccoli Crowns, Cherry Tomatoes,
  Rectangular Roaster/Baker Pans 3-count, Pantene Pro-V Conditioner (travel), Orzo (RiceSelect),
  Irish Spring Body Wash, Crest Scope Classic Mouthwash (travel), Eishes Chayil Bedika Cloths (48ct),
  Mini Israeli Pickles (Lieber's) -- batch 3
- Imitation Mustard (Pesach), Deli Containers 32oz, Disposable Toothbrush Kit,
  Dove Deep Moisture Body Wash (travel), Fettuccine, Fresh Thyme, Full Size Shallow Pan,
  Green Cabbage, Maple Syrup, Pacific Blue Select Multifold Paper Towels, Peaches,
  Plastic Coffee Stirrers, Polar Seltzer Lemon, Portion Cups 1oz, Potato Flour, Quinoa, Red Quinoa,
  Chicken Stock, Contact Lens Case, Bell Peppers Mix, Broccoli Slaw Mix, 9x13 Shallow Pan -- batch 5
- Yukon Gold Potatoes, Fuji Apples, Plums, Red Cabbage, Corn on the Cob, Bananas, Bosc Pears,
  Cucumber, Romaine Hearts, Beefsteak Tomatoes, Celery, Yellow Squash, Splenda,
  Eden Foods Cannellini Beans, Gefen Lo Mein Noodles, Gold's Horseradish & Beets,
  Crest Scope Mouthwash (travel), Mikee Teriyaki Sauce, TUMS Smoothies, Paskesz Rice Cake Minis -- batch 6
- Silan (Galil Syrups Date Silan 12oz), Potato Starch (Streit's, 12oz),
  Riced Cauliflower (Great Value Frozen, 12oz), Vanilla Sugar (Lieber's, 12oz),
  Mikee Sesame Teriyaki Sauce, Prune Butter/Lekvar (Baker's Choice, 12oz),
  Green Split Peas (Goya, 16oz), Gold's Prepared Horseradish (6oz), Pearl Barley (Glicks, 16oz) -- batch 8
