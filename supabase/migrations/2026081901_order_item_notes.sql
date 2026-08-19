-- Captain-entered prep note per order item, e.g. "half portion", "extra spicy".
-- Guest-placed orders never set this — it's populated only via addItemsToSession
-- (the captain-panel add-item flow), and printed on the KOT under the item line.
alter table order_items add column note text;
