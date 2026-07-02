# T17 — Real printer integration (kitchen KOT + reception bill)

**Depends on: T14 (print bridge, mock mode — complete) · unblocks: go-live**

## Current state (verified in code, no routing change needed)
`print-bridge/index.ts` already routes by `job.type` (line 145):
- `kot` → `KITCHEN_PRINTER_IP`
- `bill` → `RECEPTION_PRINTER_IP`

This matches the target end-state (KOT on kitchen printer, bill on reception printer). T14 only
ever ran in `MOCK_PRINT=true` (console) mode — this task is about taking it live on real ESC/POS
hardware, plus hardening two gaps found in the current implementation.

## Pilot vs production printer topology
**Decision:** during pilot, KOT and bill both print on **one shared dedicated printer** — not
Petpooja's printers, and not yet split into kitchen/reception. Simplest possible setup for
validating the bridge end-to-end without touching live billing hardware or buying two printers
up front.
- No code change needed for this — `formatKot`/`formatBill` already print clearly-labelled
  headers ("KOT" vs restaurant name/bill), so a mixed roll is still readable during low-volume
  pilot testing.
- Set `KITCHEN_PRINTER_IP` and `RECEPTION_PRINTER_IP` to the **same IP** in `.env`.
- **Before full production rollout**, get a second printer and point `RECEPTION_PRINTER_IP` at
  its own IP — a one-line `.env` change, no code/deploy needed.

## Known gaps to fix before go-live
1. **₹ symbol will likely break on real hardware.** `formatBill` (index.ts:69-97) writes raw UTF-8
   `₹` bytes. Most ESC/POS thermal printers use single-byte codepages (CP437/CP1252) and cannot
   render the rupee sign — it will print blank, `?`, or garbage. Fix: replace `₹` with `Rs.` in
   `formatBill`/`formatKot` (simplest, reliable), or send an explicit codepage-select command
   (more complex, printer-model-dependent). Recommend `Rs.`.
2. **No visibility into failed jobs.** A failed job (printer offline/unreachable) just sits at
   `status: 'failed'` with a console log on the bridge machine. Decide whether v1 needs a
   staff-facing retry affordance (e.g. a badge in `/admin/incoming` or `/admin/tables`) or whether
   watching the bridge console is acceptable for launch.

## Phase 1 — Hardware & network
- **Pilot:** one ESC/POS thermal printer (80mm recommended — matches the bridge's ~40-char line
  width), dedicated to the smart-menu system, separate from Petpooja's printers. LAN/Ethernet
  preferred over WiFi (fewer intermittent drops). Must accept raw TCP on port 9100 (standard for
  ESC/POS "raw" printing — most restaurant thermal printers do).
- **Production (post-pilot):** add a second identical printer, split kitchen/reception as
  originally planned.
- Assign a **static IP** via router DHCP reservation (by MAC) for each printer in use.
- Confirm the printer(s) are reachable on port 9100 from whichever machine will run print-bridge —
  same LAN/VLAN, no AP client isolation.
- Print-bridge must run on a local always-on machine (mini-PC / Raspberry Pi / spare PC) — **not**
  Vercel. It needs LAN access to the printer(s); physical placement doesn't matter as long as it's
  on the same network and has outbound internet access to Supabase.

## Phase 2 — Code hardening
- [ ] Swap `₹` → `Rs.` in `formatKot`/`formatBill` (print-bridge/index.ts).
- [ ] Confirm paper width vs the bridge's fixed `LINE = "─".repeat(40)` — adjust if printers are
  58mm (32 chars) instead of 80mm (42 chars).
- [ ] Decide on failed-job visibility (see gap #2 above) and implement if needed for v1.

## Phase 3 — Deployment as a persistent service
- Run print-bridge under a process manager so it survives crashes/reboots unattended:
  - Windows: `pm2` + `pm2-windows-startup`, or NSSM as a Windows service.
  - Linux (Raspberry Pi, etc.): `pm2` or a `systemd` unit with `Restart=always`.
- Set real `.env` on that machine (already gitignored): `MOCK_PRINT=false`, `KITCHEN_PRINTER_IP`
  and `RECEPTION_PRINTER_IP` both set to the pilot printer's IP, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`.

## Phase 4 — Real-hardware test pass (extends `docs/qa-checklist.md`)
1. Isolated printer smoke test (raw TCP to the printer's IP:9100 with a short ESC/POS test
   string) — confirm it's reachable, prints cleanly, and **the full-cut command
   (`1D 56 42 00`) actually cuts the paper** on this printer model (not all clones honor this
   exact byte sequence — if it doesn't cut, jobs will stay physically joined until torn by hand).
2. `MOCK_PRINT=false`, start the bridge on the target machine.
3. Approve a real order → KOT prints on the pilot printer with a clearly readable "KOT" header.
4. Generate a bill → bill prints on the pilot printer with a clearly readable bill header —
   confirm it's visually distinguishable from a KOT on the same roll.
5. Verify `Rs.`/amounts render correctly on paper (not blank/garbled) — the #1 real-world ESC/POS
   failure mode.
6. Disconnect the printer → trigger a job → `print_jobs` row goes to `failed`, bridge keeps
   polling, process doesn't crash.
7. Reconnect → confirm the recovery path (manual retry affordance, or manually resetting the row
   to `pending` in Supabase) actually reprints.
8. Reboot the bridge machine → process manager auto-restarts print-bridge with no manual step.
9. **Post-pilot, before production:** repeat steps 2–4 after splitting to two printers — confirm
   KOT now goes only to the kitchen printer and bill only to the reception printer.

## Phase 5 — Rollout
- Run one or two shifts in parallel with manual/paper backup while confirming reliability.
- Document printer static IP(s), bridge machine location, and restart steps somewhere staff can
  find them (physical note near the machine, or an admin settings note).

## Definition of Done
### Pilot
- [ ] One dedicated printer (not Petpooja's) on a static IP, reachable from the bridge machine
  on port 9100.
- [ ] `.env` on the bridge machine has `MOCK_PRINT=false`, both printer IPs pointing at the pilot
  printer (never committed).
- [ ] `Rs.` fix applied and verified on real paper (rupee symbol no longer breaks printing).
- [ ] KOT and bill both print correctly on the shared pilot printer with distinguishable headers.
- [ ] Bridge runs as a persistent, auto-restarting service.
- [ ] Printer-offline failure path tested end-to-end (fails cleanly, loop survives, recoverable).
- [ ] Real-hardware checklist appended to `docs/qa-checklist.md`.

### Production (post-pilot)
- [ ] Second printer added, static IP assigned.
- [ ] `RECEPTION_PRINTER_IP` updated to the second printer; `KITCHEN_PRINTER_IP` unchanged.
- [ ] KOT confirmed kitchen-only, bill confirmed reception-only (Phase 4 step 9).
