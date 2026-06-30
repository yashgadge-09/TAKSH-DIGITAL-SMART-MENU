---
description: Self-review the current code changes — runs security-reviewer and quality-reviewer agents in parallel, then merges their findings.
argument-hint: [optional file/dir/PR scope — defaults to current git diff]
allowed-tools: Agent, Read, Glob, Grep, Bash
---

# /self_review — Parallel Security + Quality Review

Review the code changes below using **two specialist agents running in parallel**.

**Review scope:** $ARGUMENTS

If `$ARGUMENTS` is empty, the scope is the current uncommitted work plus commits on this branch. Determine it first:
- Run `git status` and `git diff` (and `git diff main...HEAD` if on a feature branch) to identify exactly which files changed.
- Summarize the changed files/areas so both agents review the same scope.
- If there are no changes at all, tell the user there is nothing to review and stop.

## Run both reviewers IN PARALLEL — this is mandatory

Issue **both Agent calls in a single message** so they execute concurrently. Do NOT wait for one to finish before launching the other — they are independent and must run at the same time.

1. **`security-reviewer`** (Agent tool, `subagent_type: "security-reviewer"`)
   - Scope: the changed files identified above.
   - Focus: auth, RLS, the dual Supabase client pattern (anon `supabase` vs service-role `adminSupabase` — service role must never reach the browser), injection, input validation on API routes, secret/env-var leakage, push-token and session handling, file-upload safety.
   - Ask it to return a prioritized list of security findings (severity + file:line + fix) as its final message.

2. **`quality-reviewer`** (Agent tool, `subagent_type: "quality-reviewer"`)
   - Scope: the same changed files.
   - Focus: correctness, readability, structure, error handling, performance (N+1 Supabase queries, `unstable_cache` tag invalidation), TypeScript types, i18n field coverage (`name_en/hi/mr` etc.), and test coverage gaps. NOT security (the security-reviewer owns that).
   - Ask it to return a prioritized list of quality findings (severity + file:line + fix) as its final message.

## Merge & report (you, the orchestrator)

Once **both** agents return, synthesize a single consolidated review for the user:

- **Verdict:** ✅ Ship / ⚠️ Address findings first / ❌ Blocking issues.
- **🔒 Security findings** — grouped by severity, each with `file:line` and a concrete fix.
- **🛠️ Quality findings** — grouped by severity, each with `file:line` and a concrete fix.
- **Overlaps / conflicts** — if both agents flagged the same code, merge into one entry and reconcile any conflicting advice.
- **Top priorities** — the 3–5 things to fix before merging, ordered by impact.

Keep your synthesis tight and de-duplicated — do not just concatenate the two raw reports. Surface what matters and where it is.
