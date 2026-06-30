---
name: supabase-error-handling-patterns
description: Recurring pattern in database.ts — Supabase error fields silently ignored on maybeSingle() calls, turning DB errors into null responses
metadata:
  type: feedback
---

In `lib/database.ts`, Supabase query results using `.maybeSingle()` are frequently destructured WITHOUT capturing the `error` field. This is a recurring anti-pattern:

```ts
// BAD — error silently dropped
const { data: activeSession } = await adminSupabase
  .from('table_sessions')
  .maybeSingle()

// GOOD — error checked
const { data: activeSession, error: sessionError } = await adminSupabase
  .from('table_sessions')
  .maybeSingle()
if (sessionError) throw new Error('Failed to check active session')
```

When this happens with `.maybeSingle()`, a network error or DB constraint violation becomes indistinguishable from "no row found" — and code proceeds down the wrong branch (e.g., creates a new session when the lookup itself failed).

**Why:** First observed in ordering system review (2026-06-21). Specifically `createOrJoinSession` at line 1180.

**How to apply:** Flag any destructured Supabase result that omits `error:` as a MUST FIX. Affects `maybeSingle()` calls most severely. Also check `select().eq().single()` calls — though `.single()` throws on no rows, a network error could still be swallowed.

[[ordering-system-review]]
