// Shared activity-log vocabulary. Plain module — NOT "use server" — because
// database.ts may only export async functions; the constants both the captain
// sheets (reason picker) and the admin activity page need live here.

export type RemovalReason = 'customer_changed_mind' | 'wrong_entry' | 'out_of_stock'

export const REMOVAL_REASONS: Record<RemovalReason, string> = {
  customer_changed_mind: 'Customer changed mind',
  wrong_entry: 'Wrong entry',
  out_of_stock: 'Out of stock',
}

export type ActivityAction =
  | 'order_started'
  | 'item_added'
  | 'item_qty_changed'
  | 'item_removed'
  | 'bill_printed'
  | 'bill_reprinted'
  | 'bill_settled'
  | 'table_moved'
  | 'order_approved'
  | 'order_rejected'
  | 'parcel_cancelled'
  | 'force_reset'

export const ACTIVITY_ACTION_LABELS: Record<ActivityAction, string> = {
  order_started: 'Order started',
  item_added: 'Item added',
  item_qty_changed: 'Qty changed',
  item_removed: 'Item removed',
  bill_printed: 'Bill printed',
  bill_reprinted: 'Bill reprinted',
  bill_settled: 'Bill settled',
  table_moved: 'Table moved',
  order_approved: 'Order approved',
  order_rejected: 'Order rejected',
  parcel_cancelled: 'Parcel cancelled',
  force_reset: 'Force reset',
}

/**
 * Actions the admin should scan first — these are the ones where money leaves
 * a live order without a bill to show for it.
 */
export const FLAGGED_ACTIONS: ActivityAction[] = ['item_removed', 'force_reset', 'parcel_cancelled']
