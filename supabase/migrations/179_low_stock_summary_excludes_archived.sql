-- SS-519 (second report, Racquel's live screenshot): the Shop All Houses
-- "Low Stock by Property" grid renders five archived test properties as
-- full cards. The grid reads THIS VIEW, which enumerated every row in
-- properties - the earlier "already fixed" report had verified the
-- page-level membership filters, a different question. Archived
-- properties leave the view; QA Demo stays because it is NOT archived
-- (SS-512, separate cause, awaiting Racquel's ruling).
--
-- Applied live 3 Aug via MCP (low_stock_summary_excludes_archived);
-- verified after: the view returns exactly Country, Henderson, Lax, Low,
-- Main, QA Demo. Takes effect without a deploy - the client reads the
-- view directly.
CREATE OR REPLACE VIEW v_low_stock_summary AS
 SELECT p.name AS property,
    (p.city || ', '::text) || p.state AS location,
    p.kosher_store_name AS store,
    count(ii.id) FILTER (WHERE is_inventory_item_low(ii.*)) AS items_low,
    count(ii.id) FILTER (WHERE ii.last_counted_at IS NULL) AS never_counted,
    count(ii.id) AS total_items,
    count(ii.id) FILTER (WHERE ii.last_counted_at IS NOT NULL) AS items_counted
   FROM properties p
     LEFT JOIN inventory_items ii ON ii.property_id = p.id
  WHERE p.archived_at IS NULL
  GROUP BY p.name, p.city, p.state, p.kosher_store_name;
