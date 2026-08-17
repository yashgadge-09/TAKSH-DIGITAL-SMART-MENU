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
// WIDTH = 32 chars fits both 80mm and 58mm printers at Font A.
// WIDTH_SM = 42 chars is Font B ("small") on the same paper — 32 Font A cols
// and 42 Font B cols both span ~48mm, so mixed-size slips keep flush edges.

const WIDTH = 32
const WIDTH_SM = 42
const LINE = "-".repeat(WIDTH)
const LINE_SM = "-".repeat(WIDTH_SM)

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

// ── KOT: table/token stays 4x for kitchen glance; the rest is compact ───────

export function kotSegments(p: KotPayload): Seg[] {
  // A parcel has no table — the daily token is what the counter calls out, so
  // it takes the table's place in the header at the same size.
  const isParcel = p.orderType === "parcel"

  const segs: Seg[] = [
    isParcel
      ? { text: `PARCEL #${p.tokenNumber ?? "-"}`, bold: true, size: "big" }
      : { text: `TABLE ${p.tableNumber ?? "-"}`, bold: true, size: "big" },
  ]
  if (isParcel && p.customerName) {
    segs.push({ text: `NAME: ${toAscii(p.customerName).toUpperCase()}`, bold: true })
  }
  segs.push(
    { text: `KOT  Round ${p.roundNumber}  Time ${p.time}`, size: "small" },
    { text: LINE },
  )
  for (const i of p.items) {
    segs.push({
      text: `${String(i.qty).padStart(2)} x ${toAscii(i.name).toUpperCase()}`,
      bold: true,
    })
  }
  segs.push({ text: LINE })
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

// Columns: ITEM(22) QTY(3) RATE(7) AMT(10) = 42 (Font B); long names wrap below
function itemRows(item: { name: string; qty: number; price: number }): string[] {
  const name = toAscii(item.name)
  const rows = [
    name.slice(0, 22).padEnd(22) +
      String(item.qty).padStart(3) +
      money(item.price).padStart(7) +
      money(item.qty * item.price).padStart(10),
  ]
  let rest = name.slice(22)
  while (rest.length > 0) {
    rows.push("  " + rest.slice(0, WIDTH_SM - 2))
    rest = rest.slice(WIDTH_SM - 2)
  }
  return rows
}

export function billSegments(p: BillPayload): Seg[] {
  const { date, time } = nowIST()
  const segs: Seg[] = [
    { text: toAscii(p.restaurantName).toUpperCase(), center: true, bold: true, size: "tall" },
  ]
  if (p.address) segs.push({ text: toAscii(p.address), center: true, size: "small" })
  if (p.gstin) segs.push({ text: `GSTIN: ${p.gstin}`, center: true, size: "small" })
  const orderLabel =
    p.orderType === "parcel" ? `PARCEL #${p.tokenNumber ?? "-"}` : `Table: ${p.tableNumber ?? "-"}`
  segs.push(
    { text: LINE_SM, size: "small" },
    { text: pair(orderLabel, `Bill To: ${toAscii(p.customerName)}`, WIDTH_SM), size: "small" },
    { text: pair(`Date: ${date}`, `Time: ${time}`, WIDTH_SM), size: "small" },
    { text: LINE_SM, size: "small" },
    {
      text: "ITEM".padEnd(22) + "QTY".padStart(3) + "RATE".padStart(7) + "AMT".padStart(10),
      bold: true,
      size: "small",
    },
    { text: LINE_SM, size: "small" },
  )
  for (const item of consolidateItems(p.rounds)) {
    for (const row of itemRows(item)) segs.push({ text: row, size: "small" })
  }
  segs.push(
    { text: LINE_SM, size: "small" },
    { text: amountLine("Subtotal", p.subtotal, WIDTH_SM), size: "small" },
    { text: amountLine(`GST @ ${p.gstRate}%`, p.gstAmount, WIDTH_SM), size: "small" },
    { text: LINE_SM, size: "small" },
    { text: amountLine("TOTAL", p.total), bold: true, size: "tall" },
    { text: LINE_SM, size: "small" },
  )
  segs.push({ text: "Thank you! Visit again", center: true, size: "small" })
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
