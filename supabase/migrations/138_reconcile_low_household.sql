-- 138_reconcile_low_household.sql
-- Reconciles a fix already applied live via direct SQL, not a migration --
-- property "Low" (3389f7cb) was created through the Add Property form
-- before that flow set household_id (see 139_create_property_with_household.sql
-- for the actual fix), leaving it orphaned. A household named "Low" was
-- created and linked manually. Written here as a no-op against the current
-- database (both already match) so schema history isn't silently missing a
-- real change -- same reasoning as 135_blog_posts_cta_columns.sql.
--
-- Also fixes a second, genuinely still-open loose end from the same
-- incident: the Lax household's created_by was left null (it predates this
-- reconciliation and was never set by anything). Backfilled from the Lax
-- PROPERTY's own created_by -- the same user created both, so this is a
-- reasonable, mechanical default, not a guess about who "should" own it.
--
-- Deliberately NOT touched: QA Demo (69fb6128) still has household_id =
-- null. It's a real QA/demo fixture, not a customer's data -- inventing a
-- household for it would be a guess, and this doesn't need one to function
-- (formatPropertyLabel already handles a null household correctly). Flagged
-- in the register (SS-368) rather than backfilled.
update households
set created_by = (select created_by from properties where id = 'a85471e6-30ee-46d5-838f-e83ed1dc9c16')
where id = '276afe1e-8545-4fa1-b340-5ec6f07e23e2' and created_by is null;
