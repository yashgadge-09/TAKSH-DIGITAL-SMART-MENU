# Printer Setup — Single Printer (KOT + Bills)

One thermal printer handles both KOTs and bills. The print bridge (`print-bridge/`) routes
KOT jobs to `KITCHEN_PRINTER_IP` and bill jobs to `RECEPTION_PRINTER_IP` — for a single-printer
setup, both variables point to the **same IP**.

## How printing works

1. Admin clicks **Approve** in `/admin/incoming` → a `kot` row is inserted into `print_jobs` (Supabase).
2. **Generate Bill** (admin tables drawer, captain panel, or guest "Request Bill") → a `bill` row is inserted.
3. The print bridge runs on a computer **inside the restaurant**, polls `print_jobs` every 2 s,
   and sends pending jobs to the printer over TCP port 9100 (ESC/POS raw printing).
4. Successful jobs are marked `sent`; unreachable-printer jobs are marked `failed`.

The bridge must run on the same LAN as the printer. Vercel never talks to the printer —
it only writes job rows.

## Step 1 — Hardware requirements

- One **80mm thermal receipt printer** with an **Ethernet (LAN) port**, ESC/POS compatible,
  supporting RAW printing on port 9100. (TVS RP-3230, Epson TM-T82, Everycom EC-801, Rongta RP328 — all fine.)
- USB-only printers will NOT work — the bridge speaks TCP/IP.
- Placement tip: put the printer where both the kitchen and the counter can hear/see it,
  since every KOT and every bill prints here. The KOT header says `KOT` and the bill has the
  restaurant header, so tearing off and routing slips manually is easy.

## Step 2 — Network setup (fixed IP)

1. Connect the printer's LAN port to the router with an Ethernet cable; power it on.
2. Print the self-test page (hold **FEED** while powering on, on most models) — it shows the
   printer's current IP address and MAC address.
3. Make the IP permanent (if it changes after a router reboot, printing silently breaks):
   - Router admin page → DHCP → **Address Reservation / Static Lease** → bind the printer's
     MAC to a fixed IP, e.g. `192.168.1.100`, **or**
   - Set a static IP in the printer's own web config (open its IP in a browser).

## Step 3 — Verify connectivity

On the computer that will run the bridge, in PowerShell:

```powershell
ping 192.168.1.100
Test-NetConnection 192.168.1.100 -Port 9100
```

`TcpTestSucceeded : True` is required. If ping works but 9100 fails, enable RAW/9100
printing in the printer's web config. Do not continue until this passes.

## Step 4 — Configure the bridge

```powershell
cd print-bridge
npm install
Copy-Item .env.example .env
```

Edit `print-bridge\.env` — **both printer IPs are the same**:

```env
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # NOT the anon key
MOCK_PRINT=false
KITCHEN_PRINTER_IP=192.168.1.100
RECEPTION_PRINTER_IP=192.168.1.100
POLL_MS=2000
```

- URL + service role key: Supabase Dashboard → Project Settings → API. The service role key
  is required (`print_jobs` has no public RLS policy). `.env` is gitignored — keep it that way.
- First run with paper you don't want to waste? Set `MOCK_PRINT=true` to see jobs formatted
  in the console instead, then flip to `false`.

## Step 5 — Start and test end-to-end

```powershell
cd print-bridge
npm start
```

Expect: `[bridge] starting — mode: REAL, poll: 2000ms`.

Live test:
1. Phone → scan a table QR (or open `/taksh/table/1`) → add dishes → place order.
2. `/admin/incoming` → **Approve** → within ~2 s the printer prints the **KOT**
   (`[bridge] job <id> (kot) → sent` in the terminal).
3. `/admin/tables` → open the table drawer → **Generate Bill** → the same printer prints the **bill**.
4. In Supabase, `print_jobs` rows should be `status = sent`.

Jobs print strictly oldest-first, so a KOT and a bill queued together come out in order —
one printer never mixes pages.

## Slip formats

Formats are defined in `kotSegments()` / `billSegments()` in `print-bridge/index.ts` —
changing them never touches the web app. Current design is paper-saving: body text uses
Font B (42 chars wide), headers use Font A (32 chars wide); both span the same print width.

- **KOT** — `TABLE N` (or `PARCEL #N`) in double-size bold, small `KOT Round/Time` line,
  items in standard-size bold UPPERCASE. No blank feed before the cut.
- **Bill** — GST-invoice style: centered restaurant name (double-height bold) with small
  address/GSTIN, `ITEM / QTY / RATE / AMT` columns in the small font, the same dish ordered
  across rounds merged into one line, double-height bold TOTAL, then a **scannable UPI QR**
  (`upi://pay?pa=<upiId>&am=<total>` — GPay/PhonePe pre-fills the amount) printed natively
  by the printer, followed by "Thank you! Visit again".
- Output is pure ASCII (`Rs.` not `₹`) — safe on every ESC/POS code page.
- Preview any format change without paper: set `MOCK_PRINT=true` and the exact slip text
  is printed to the console.

## Step 6 — Keep the bridge running permanently (no one has to open PowerShell)

The bridge only prints while running, so it must start itself on every boot — no manual
`npm start` ever again. `print-bridge/start-bridge.bat` wraps `npm start` in a loop that
auto-restarts it if it ever crashes, and logs everything to `print-bridge/logs/bridge.log`.
Wire it to Windows Task Scheduler so it launches at boot, before anyone logs in:

1. Open **Task Scheduler** (Start menu → type "Task Scheduler").
2. **Action → Create Task…** (not "Create Basic Task" — need the extra options).
3. **General** tab:
   - Name: `TAKSH Print Bridge`
   - Select **"Run whether user is logged on or not"**
   - Check **"Run with highest privileges"**
4. **Triggers** tab → **New…** → Begin the task: **"At startup"** → OK.
5. **Actions** tab → **New…**:
   - Action: **Start a program**
   - Program/script: full path to `start-bridge.bat`, e.g.
     `C:\Users\<name>\Downloads\TAKSH-DIGITAL-SMART-MENU-main\TAKSH-DIGITAL-SMART-MENU-main\print-bridge\start-bridge.bat`
   - Start in: the `print-bridge` folder (same path, without the filename)
6. **Settings** tab → check **"If the task fails, restart every"** → `1 minute`,
   and **uncheck** "Stop the task if it runs longer than" (it's meant to run forever).
7. Click OK — it will ask for the Windows account password (needed for "run whether
   logged on or not"). Enter the restaurant PC's login password.

Test it without waiting for a real reboot: right-click **TAKSH Print Bridge** → **Run**.
Check `print-bridge\logs\bridge.log` — it should show `[bridge] starting — mode: REAL...`.
Now actually restart the PC once and confirm the bridge comes back up on its own
(place a test order and see if the KOT prints) before trusting it long-term.

Also set Windows power settings (Settings → Power) so the PC **never sleeps** — a sleeping
PC prints nothing even with the task configured correctly.

From now on: the restaurant computer only needs to be powered on. No PowerShell, no
logging in, no `npm start` — ever again. If the bridge crashes, Task Scheduler's
"restart every 1 minute" plus the batch file's own retry loop bring it back automatically.

## Daily routine — does the PC need to run 24/7?

**No.** The restaurant computer only needs to be **powered on during service hours**.

- **Opening:** press the power button. That's it — the bridge starts by itself at boot,
  before anyone logs in. No PowerShell, no login, no `npm start`.
- **Closing:** shut down **only after the last table is settled** (see caveat below).
- Leaving it on 24/7 is fine too and costs nothing but electricity — it idles at one
  small Supabase query every 2 seconds.

**Caveat — jobs queued while the PC is off.** Print jobs live in Supabase, not on the PC.
If a KOT or bill is created while the computer is off, the row stays `pending` and prints
the moment the bridge next starts. That is exactly what you want after a crash or power
cut (nothing is lost), but it means a bill generated after shutdown will print the next
morning. Practical rule: **close all tables before shutting down.** To discard stale jobs,
set their `status` to `failed` in Supabase → Table Editor → `print_jobs` before booting.

The computer must also **never sleep** — a sleeping PC stops polling and prints nothing.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Nothing prints, no bridge log line | Bridge not running, or `.env` has wrong Supabase credentials |
| Nothing prints after a reboot | Check `print-bridge\logs\bridge.log` for the latest entry; open Task Scheduler → confirm "TAKSH Print Bridge" shows "Running"/"Ready" and last run succeeded (not "0x1" or similar error code) |
| `bridge.log` says `FATAL: npm.cmd not found` | Node.js isn't installed on this PC, or was installed for a different Windows user — reinstall from nodejs.org (LTS) and re-run the task |
| A whole day's KOTs print at once in the morning | Jobs queued in Supabase while the PC was off — see "Daily routine" above |
| `job ... failed` in the log | Printer unreachable — re-check Step 3; after fixing, set the job's `status` back to `pending` in Supabase to reprint it |
| Prints stopped after router restart | Printer IP changed — Step 2 static IP not applied |
| UPI QR doesn't print (rest of bill fine) | Very old ESC/POS models lack native QR support (`GS ( k`) — the text `UPI: <id>` below it still prints, or remove the QR segment in `billSegments` |
| KOT prints but bill doesn't (or vice versa) | One of the two IP vars in `.env` differs — both must be the same IP in single-printer mode |

Before going live, run the full manual pass in `docs/qa-checklist.md`.
