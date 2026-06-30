---
description: Generate test cases for a feature, then safely execute them — runs test-case-generator and taksh-test-executor agents in sequence.
argument-hint: <feature description or file/route to test>
allowed-tools: Agent, Read, Glob, Grep
---

# /test_feature — Two-Stage Test Pipeline

Run a sequential, two-agent testing pipeline for the feature described below.

**Feature under test:** $ARGUMENTS

If `$ARGUMENTS` is empty, inspect the current git diff (`git diff` and `git status`) to infer what changed, and test that. If you still cannot determine a clear target, ask the user what feature, file, or route to test before proceeding.

## Pipeline — run these two stages strictly in order

### Stage 1 — Generate test cases
Launch the **`test-case-generator`** agent (Agent tool, `subagent_type: "test-case-generator"`).

Pass it:
- The feature description / target from `$ARGUMENTS` (or your diff-derived summary).
- Any relevant file paths, API routes, DB tables, or contexts you identified.
- An instruction to return the full structured test-case document (coverage matrix + numbered `TC-xxx` cases) as its final message.

Wait for it to finish. Capture its complete output — you will hand this to Stage 2 verbatim.

### Stage 2 — Execute the generated test cases
Launch the **`taksh-test-executor`** agent (Agent tool, `subagent_type: "taksh-test-executor"`).

Pass it:
- The **full test-case document produced in Stage 1** (paste it in, do not summarize it away).
- The same feature target and file paths.
- A reminder to obey its safety rules: no real Supabase writes, no real push sends, no env-var leakage, mocks only.
- An instruction to return its structured TAKSH TEST EXECUTION REPORT (executive summary, results by domain, failures, improvement guidance, safety audit) as its final message.

Do **not** start Stage 2 until Stage 1 has returned. The executor depends on the generator's output.

## Final summary (you, the orchestrator)
After both stages complete, write a concise wrap-up for the user:
- ✅/⚠️/❌ overall health from the execution report.
- Counts: total / passed / failed / skipped.
- The top 3 highest-priority issues or recommended fixes.
- Where the full test cases and report can be found (inline above, or any files the agents wrote).

Keep your own commentary terse — the two agents produce the detailed artifacts; your job is to chain them correctly and surface the headline.
