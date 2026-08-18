import "dotenv/config"
import { createClient } from "@supabase/supabase-js"
import * as net from "net"

// ── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL           = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const MOCK_PRINT             = process.env.MOCK_PRINT !== "false"
const KITCHEN_PRINTER_IP     = process.env.KITCHEN_PRINTER_IP ?? "192.168.1.100"
const RECEPTION_PRINTER_IP   = process.env.RECEPTION_PRINTER_IP ?? "192.168.1.101"
const POLL_MS                = parseInt(process.env.POLL_MS ?? "2000", 10)
const PRINTER_PORT           = 9100

// Bill header lines the web app does not send — restaurants only stores name,
// address, gstin and upi_id. Override any of them in .env without a code change.
const BILL_BRAND   = process.env.BILL_BRAND   ?? "TASTEFY"
const BILL_COMPANY = process.env.BILL_COMPANY ?? "SHREEJA HOSPITALITY"
const BILL_EMAIL   = process.env.BILL_EMAIL   ?? "shreejahospitality@gmail.com"
const BILL_MOBILE  = process.env.BILL_MOBILE  ?? "8793604904"

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("[bridge] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
  process.exit(1)
}

// Service role bypasses RLS — required because print_jobs has no public SELECT/UPDATE policy.
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

// ── Payload types (match exactly what approveOrder / generateBill write) ────

// orderType/tokenNumber/customerName are absent on jobs queued before parcel
// support shipped — every read of them falls back to dine-in behaviour.
type KotPayload = {
  tableNumber: number | null
  roundNumber: number
  time: string        // "HH:MM" IST
  items: { name: string; qty: number }[]
  orderType?: "dine_in" | "parcel"
  tokenNumber?: number | null
  customerName?: string | null
}

type BillPayload = {
  restaurantName: string
  address: string
  gstin: string
  upiId: string
  tableNumber: number | null
  orderType?: "dine_in" | "parcel"
  tokenNumber?: number | null
  customerName: string
  rounds: { number: number; time: string; items: { name: string; qty: number; price: number }[] }[]
  subtotal: number
  gstRate: number
  gstAmount: number
  total: number
}

type PrintJob = {
  id: string
  type: "kot" | "bill"
  payload: KotPayload | BillPayload
}

// ── Layout ──────────────────────────────────────────────────────────────────
//
// Slips are described as a list of segments; the same segments render to
// plain text (mock mode) or to an ESC/POS byte stream (real mode).
// WIDTH = 48 chars is a full 80mm line at Font A; WIDTH_SM = 64 is Font B
// ("small") on the same paper. Both span the full 72mm print area, so mixed-size
// slips keep flush edges. On 58mm paper these must drop to 32 and 42.

const WIDTH = 48
const WIDTH_SM = 64
const LINE = "-".repeat(WIDTH)
const LINE_SM = "-".repeat(WIDTH_SM)
const DOTS = ". ".repeat(WIDTH / 2).trimEnd()

type Seg =
  { text: string; center?: boolean; bold?: boolean; size?: "tall" | "big" | "small" }

// ESC/POS output is single-byte, so strip anything non-ASCII (₹, ─, accents).
function toAscii(s: string): string {
  return s.normalize("NFKD").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim()
}

function money(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

// "left ....... right" padded to the given width
function pair(left: string, right: string, width = WIDTH): string {
  const gap = width - left.length - right.length
  return gap > 0 ? left + " ".repeat(gap) + right : `${left} ${right}`
}

// Right-align "Rs. X.XX" against a label
function amountLine(label: string, n: number, width = WIDTH): string {
  return pair(label, `Rs. ${n.toFixed(2)}`, width)
}

// Current date/time in IST (bills print at generation time, so "now" is correct)
function nowIST(): { date: string; time: string } {
  const d = new Date()
  const ist = new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 5.5 * 3600000)
  const dd = String(ist.getUTCDate()).padStart(2, "0")
  const mo = String(ist.getUTCMonth() + 1).padStart(2, "0")
  const yy = String(ist.getUTCFullYear()).slice(-2)
  const hh = String(ist.getUTCHours()).padStart(2, "0")
  const mi = String(ist.getUTCMinutes()).padStart(2, "0")
  return { date: `${dd}/${mo}/${yy}`, time: `${hh}:${mi}` }
}

// ── KOT: centred header block, then a left/right Item–Qty table ─────────────

// "Dish name .......... 3", wrapping names too long to share the qty's line
function kotItemRows(name: string, qty: number): string[] {
  const q = String(qty)
  const clean = toAscii(name)
  const nameWidth = WIDTH - q.length - 1
  if (clean.length <= nameWidth) return [pair(clean, q)]

  const rows = [pair(clean.slice(0, nameWidth), q)]
  let rest = clean.slice(nameWidth)
  while (rest.length > 0) {
    rows.push("  " + rest.slice(0, WIDTH - 2))
    rest = rest.slice(WIDTH - 2)
  }
  return rows
}

export function kotSegments(p: KotPayload): Seg[] {
  // A parcel has no table — the daily token is what the counter calls out, so
  // it takes the table's place in the header at the same size.
  const isParcel = p.orderType === "parcel"
  const { date } = nowIST()

  const segs: Seg[] = [
    { text: "Running Table", center: true, bold: true, size: "tall" },
    { text: `${date} ${p.time}`, center: true },
    { text: `KOT - ${p.roundNumber}`, center: true },
    { text: isParcel ? "Parcel" : "Dine In", center: true, bold: true, size: "tall" },
    isParcel
      ? { text: `Token No: ${p.tokenNumber ?? "-"}`, center: true, bold: true, size: "tall" }
      : { text: `Table No: ${p.tableNumber ?? "-"}`, center: true, bold: true, size: "tall" },
  ]
  if (isParcel && p.customerName) {
    segs.push({ text: `Name: ${toAscii(p.customerName)}`, center: true, bold: true })
  }
  segs.push(
    { text: DOTS },
    { text: pair("Item", "Qty.") },
    { text: LINE },
  )
  for (const i of p.items) {
    for (const row of kotItemRows(i.name, i.qty)) segs.push({ text: row, bold: true })
  }
  return segs
}

// ── Bill: GST-invoice style, items consolidated across rounds ───────────────

// Merge the same dish (name + price) ordered in different rounds into one line
function consolidateItems(rounds: BillPayload["rounds"]) {
  const merged = new Map<string, { name: string; qty: number; price: number }>()
  for (const round of rounds) {
    for (const item of round.items) {
      const key = `${item.name}|${item.price}`
      const existing = merged.get(key)
      if (existing) existing.qty += item.qty
      else merged.set(key, { name: item.name, qty: item.qty, price: item.price })
    }
  }
  return Array.from(merged.values())
}

// Columns: ITEM(20) QTY(5) PRICE(11) AMOUNT(12) = 48; long names wrap below
function itemRows(item: { name: string; qty: number; price: number }): string[] {
  const name = toAscii(item.name)
  const rows = [
    name.slice(0, 20).padEnd(20) +
      String(item.qty).padStart(5) +
      item.price.toFixed(2).padStart(11) +
      (item.qty * item.price).toFixed(2).padStart(12),
  ]
  let rest = name.slice(20)
  while (rest.length > 0) {
    rows.push("  " + rest.slice(0, WIDTH - 2))
    rest = rest.slice(WIDTH - 2)
  }
  return rows
}

// Word-wrap a long line (the address) into centred rows
function centredWrap(text: string): Seg[] {
  const words = toAscii(text).split(" ")
  const lines: string[] = []
  let line = ""
  for (const w of words) {
    if (line && (line + " " + w).length > WIDTH) { lines.push(line); line = w }
    else line = line ? `${line} ${w}` : w
  }
  if (line) lines.push(line)
  return lines.map(l => ({ text: l, center: true }))
}

// A totals row: label right-aligned at col 36, amount right-aligned at col 48
function totalsRow(prefix: string, label: string, amount: number): string {
  return prefix.padEnd(24) + label.padStart(12) + amount.toFixed(2).padStart(12)
}

export function billSegments(p: BillPayload): Seg[] {
  const { date, time } = nowIST()
  const items = consolidateItems(p.rounds)
  const totalQty = items.reduce((n, i) => n + i.qty, 0)
  // One GST figure arrives from the app; a tax invoice shows it split in half
  // as CGST + SGST, which is how intra-state GST is levied. Give the odd paisa
  // to SGST so the two halves always add back to the total the app calculated.
  const halfRate = p.gstRate / 2
  const cgst = Math.round((p.gstAmount / 2) * 100) / 100
  const sgst = Math.round((p.gstAmount - cgst) * 100) / 100

  const segs: Seg[] = [
    { text: BILL_BRAND, center: true, bold: true, size: "tall" },
    { text: `( ${toAscii(p.restaurantName).toUpperCase()} )`, center: true, bold: true, size: "tall" },
  ]
  if (BILL_COMPANY) segs.push({ text: BILL_COMPANY, center: true, bold: true })
  if (p.address) segs.push(...centredWrap(p.address))
  if (BILL_EMAIL) segs.push({ text: `Email: ${BILL_EMAIL}`, center: true })
  if (BILL_MOBILE) segs.push({ text: `Mob: ${BILL_MOBILE}`, center: true })
  if (p.gstin) segs.push({ text: `GST NO: ${p.gstin}`, center: true })

  const orderLabel =
    p.orderType === "parcel"
      ? `Parcel: #${p.tokenNumber ?? "-"}`
      : `Dine In: ${p.tableNumber ?? "-"}`

  segs.push(
    { text: LINE },
    { text: `Name: ${toAscii(p.customerName) || "_".repeat(30)}` },
    { text: LINE },
    { text: pair(`Date: ${date}`, orderLabel) },
    { text: `Time: ${time}` },
    { text: LINE },
    {
      text: "Item".padEnd(20) + "Qty.".padStart(5) + "Price".padStart(11) + "Amount".padStart(12),
    },
    { text: "" },
  )
  for (const item of items) {
    for (const row of itemRows(item)) segs.push({ text: row })
  }
  segs.push(
    { text: LINE },
    { text: totalsRow(`Total Qty: ${totalQty}`, "Sub Total", p.subtotal) },
    { text: totalsRow("", `CGST ${halfRate}%`, cgst) },
    { text: totalsRow("", `SGST ${halfRate}%`, sgst) },
    { text: LINE },
    { text: pair("  Grand Total", `Rs. ${p.total.toFixed(2)}`), bold: true, size: "tall" },
    { text: LINE },
    { text: "Thanks & Visit Again", center: true },
  )
  return segs
}

// ── Renderers ───────────────────────────────────────────────────────────────

export function segsToText(segs: Seg[]): string {
  return segs
    .map(s => {
      if (!s.center) return s.text
      const width = s.size === "small" ? WIDTH_SM : WIDTH
      const pad = Math.max(0, Math.floor((width - s.text.length) / 2))
      return " ".repeat(pad) + s.text
    })
    .join("\n")
}

// Thermal printers can't render UTF-8 like ₹ and ─ — map them to ASCII so the
// printer doesn't emit garbage bytes for characters outside the 7-bit range.
function toPrinterSafe(text: string): string {
  return text
    .replace(/₹/g, "Rs.")
    .replace(/─/g, "-")
    .replace(/[^\x00-\x7F]/g, "?")
}

function compile(segs: Seg[]): Buffer {
  const out: Buffer[] = [Buffer.from([0x1b, 0x40])] // init
  for (const s of segs) {
    out.push(Buffer.from([0x1b, 0x61, s.center ? 0x01 : 0x00]))          // align
    out.push(Buffer.from([0x1b, 0x45, s.bold ? 0x01 : 0x00]))            // bold
    // ESC M — Font B (smaller standard font, 42 cols) for "small", Font A otherwise
    out.push(Buffer.from([0x1b, 0x4d, s.size === "small" ? 0x01 : 0x00]))
    // GS ! — 0x11 doubles width+height, 0x01 doubles height only (keeps 32 cols)
    out.push(Buffer.from([0x1d, 0x21, s.size === "big" ? 0x11 : s.size === "tall" ? 0x01 : 0x00]))
    out.push(Buffer.from(toPrinterSafe(s.text) + "\n", "ascii"))
  }
  out.push(Buffer.from([0x1d, 0x21, 0x00]))       // reset size
  out.push(Buffer.from([0x1b, 0x4d, 0x00]))       // reset font
  // GS V B feeds to the cutter on its own; one blank line is a safety margin
  // so the last printed row clears the blade on clone printers.
  out.push(Buffer.from("\n", "ascii"))
  out.push(Buffer.from([0x1d, 0x56, 0x42, 0x00])) // partial cut
  return Buffer.concat(out)
}

// ── TCP send (real ESC/POS mode) ────────────────────────────────────────────

function sendToPrinter(ip: string, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket()
    sock.connect(PRINTER_PORT, ip, () => {
      sock.write(data)
      sock.end()
    })
    sock.on("close", () => resolve())
    sock.on("error", reject)
    sock.setTimeout(5000, () => { sock.destroy(); reject(new Error("Printer timeout")) })
  })
}

// ── Core loop ───────────────────────────────────────────────────────────────

let isRunning = false

async function tick() {
  if (isRunning) return
  isRunning = true
  try {
    const { data: jobs, error } = await db
      .from("print_jobs")
      .select("id, type, payload")
      .eq("status", "pending")
      .order("created_at", { ascending: true })

    if (error) { console.error("[bridge] fetch error:", error.message); return }
    if (!jobs || jobs.length === 0) return

    for (const job of jobs as PrintJob[]) {
      try {
        const segs = job.type === "kot"
          ? kotSegments(job.payload as KotPayload)
          : billSegments(job.payload as BillPayload)

        if (MOCK_PRINT) {
          console.log(`\n[MOCK ${job.type.toUpperCase()}]`)
          console.log(segsToText(segs))
        } else {
          const ip = job.type === "kot" ? KITCHEN_PRINTER_IP : RECEPTION_PRINTER_IP
          await sendToPrinter(ip, compile(segs))
        }

        const { error: upErr } = await db
          .from("print_jobs")
          .update({ status: "sent" })
          .eq("id", job.id)
        if (upErr) throw upErr
        console.log(`[bridge] job ${job.id} (${job.type}) → sent`)
      } catch (jobErr: any) {
        console.error(`[bridge] job ${job.id} failed:`, jobErr?.message ?? jobErr)
        await db
          .from("print_jobs")
          .update({ status: "failed" })
          .eq("id", job.id)
          .catch(e => console.error("[bridge] failed to mark job as failed:", e?.message))
      }
    }
  } catch (tickErr: any) {
    console.error("[bridge] tick error:", tickErr?.message ?? tickErr)
  } finally {
    isRunning = false
  }
}

// Chain setTimeout so ticks never overlap even if one runs long
function schedule() {
  setTimeout(async () => {
    await tick()
    schedule()
  }, POLL_MS)
}

// ── Startup ─────────────────────────────────────────────────────────────────

console.log(`[bridge] starting — mode: ${MOCK_PRINT ? "MOCK" : "REAL"}, poll: ${POLL_MS}ms`)
tick().then(schedule)
