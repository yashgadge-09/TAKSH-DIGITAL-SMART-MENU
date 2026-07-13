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
changing them never touches the web app. Current design (32 chars wide, fits 80mm and 58mm):

- **KOT** — `K O T` header and `TABLE N` in double-size bold, items in double-height bold
  UPPERCASE so kitchen staff can read at a distance.
- **Bill** — GST-invoice style: centered restaurant header (name/address/GSTIN),
  `ITEM / QTY / RATE / AMT` columns, the same dish ordered across rounds merged into one
  line, double-height bold TOTAL, then a **scannable UPI QR**
  (`upi://pay?pa=<upiId>&am=<total>` — GPay/PhonePe pre-fills the amount) printed natively
  by the printer, followed by "Thank you! Visit again".
- Output is pure ASCII (`Rs.` not `₹`) — safe on every ESC/POS code page.
- Preview any format change without paper: set `MOCK_PRINT=true` and the exact slip text
  is printed to the console.

## Step 6 — Keep the bridge running permanently

The bridge only prints while running. On the restaurant PC:

```powershell
npm install -g pm2 pm2-windows-startup
pm2-startup install
cd print-bridge
pm2 start "npm start" --name taksh-print-bridge
pm2 save
```

Also set Windows power settings so the PC **never sleeps** — a sleeping PC prints nothing.
(Alternative to PM2: a Task Scheduler task running `npm start` in `print-bridge/` "At log on".)

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Nothing prints, no bridge log line | Bridge not running, or `.env` has wrong Supabase credentials |
| `job ... failed` in the log | Printer unreachable — re-check Step 3; after fixing, set the job's `status` back to `pending` in Supabase to reprint it |
| Prints stopped after router restart | Printer IP changed — Step 2 static IP not applied |
| UPI QR doesn't print (rest of bill fine) | Very old ESC/POS models lack native QR support (`GS ( k`) — the text `UPI: <id>` below it still prints, or remove the QR segment in `billSegments` |
| KOT prints but bill doesn't (or vice versa) | One of the two IP vars in `.env` differs — both must be the same IP in single-printer mode |

Before going live, run the full manual pass in `docs/qa-checklist.md`.
