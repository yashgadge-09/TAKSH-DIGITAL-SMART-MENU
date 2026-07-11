-- Captain panel (C01): payment settlement fields on bills
-- payment_method + settled_at are stamped by settleBill() when a captain
-- collects payment. A bill with settled_at IS NULL is unsettled.

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IN ('cash', 'upi', 'card', 'other')),
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
