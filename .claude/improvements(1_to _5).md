MUST FIX

1. createOrJoinSession line 1180 — error field dropped on maybeSingle()
   DB error silently becomes null -> creates duplicate session.
   Fix: destructure error: activeSessionError and throw if set.

2. placeOrder line 1212 — restaurantId param is dead after validation
   Accepted, validated, never written to any DB row.
   Fix: remove it from the signature, or enforce it with a DB query against the session's restaurant.

3. placeOrder line 1244 — no quantity > 0 check
   quantity: 0 or -1 passes through to the DB.
   Fix: if (!Number.isInteger(item.quantity) || item.quantity < 1) throw Error(...)

---

SHOULD FIX

4. generateBill line 1419 — pending_approval orders included in bill
   .neq('status', 'rejected') includes unresolved orders — if one is later rejected, customer is overbilled.
   Fix: .in('status', ['approved', 'served']) or throw if any pending_approval orders still exist.

5. generateBill lines 1468-1487 — 3 sequential queries that can be Promise.all
   customer, restaurant, and table fetches have no dependencies on each other.
   Fix: wrap in Promise.all to save ~100ms.

6. approveOrder lines 1315-1333 — session and items queries are sequential
   Items only need orderId (known immediately after order fetch).
   Fix: run [session, items] in parallel, then fetch table from session result.

7. generateBill line 1404 — error ignored on existing-bill lookup
   If the bills query fails, existing is null -> idempotency guard bypassed -> duplicate bill row.
   Fix: destructure error: existingError and throw if set.

8. SessionResult type line 1158 — requiresPin?: false should be requiresPin: false
   Optional false is not a clean discriminant for consumers.
   Fix: make it required false and pass requiresPin: false explicitly in the return at line 1203.

---

CONSIDER (low priority)

9. gstRate = 5 at line 1459 — extract to a named module-level constant with a comment on tax category.
10. [...orders].sort(...) at line 1464 — orders already sorted by round_number; orders[orders.length-1] is simpler.
11. No dishId dedup in placeOrder — duplicate dishId entries create two KOT lines instead of merged quantity.

If you allow the Write tool for the .claude/ folder, I can create the file in one step.