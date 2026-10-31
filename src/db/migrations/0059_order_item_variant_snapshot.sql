-- Guest and POS orders snapshot the variant id and name from the published (versioned) menu document.
-- Those ids are not rows of the legacy flat menu_item_variants table, so the 0000-era foreign key
-- rejects every order line that selects a variant ("order_items_variant_id_menu_item_variants_id_fk").
-- order_items is an immutable historical snapshot (variant_name, price and options are copied), so the
-- reference adds no integrity and is removed. Forward-only; legacy rows keep their values.
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_variant_id_menu_item_variants_id_fk;
