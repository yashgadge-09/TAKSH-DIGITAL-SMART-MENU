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

type KotPayload = {
  tableNumber: number
  roundNumber: number
  time: string        // "HH:MM" IST
  items: { name: string; qty: number }[]
}

type BillPayload = {
  restaurantName: string
  address: string
  gstin: string
  upiId: string
  tableNumber: number | null
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

const WIDTH = 32
const LINE = "-".repeat(WIDTH)

type Seg =
  | { text: string; center?: boolean; bold?: boolean; size?: "tall" | "big" }
  | { qr: string }

// ESC/POS output is single-byte, so strip anything non-ASCII (₹, ─, accents).
function toAscii(s: string): string {
  return s.normalize("NFKD").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim()
}

function money(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

// "left ....... right" padded to WIDTH
function pair(left: string, right: string): string {
  const gap = WIDTH - left.length - right.length
  return gap > 0 ? left + " ".repeat(gap) + right : `${left} ${right}`
}

// Right-align "Rs. X.XX" against a label
function amountLine(label: string, n: number): string {
  return pair(label, `Rs. ${n.toFixed(2)}`)
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

// ── KOT: big & bold for kitchen readability ─────────────────────────────────

export function kotSegments(p: KotPayload): Seg[] {
  const segs: Seg[] = [
    { text: LINE },
    { text: "K O T", center: true, bold: true, size: "big" },
    { text: LINE },
    { text: `TABLE ${p.tableNumber}`, bold: true, size: "big" },
    { text: `Round ${p.roundNumber}   Time ${p.time}` },
    { text: LINE },
    { text: "QTY  ITEM", bold: true },
    { text: LINE },
  ]
  for (const i of p.items) {
    segs.push({
      text: `${String(i.qty).padStart(2)} x ${toAscii(i.name).toUpperCase()}`,
      bold: true,
      size: "tall",
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

// Columns: ITEM(14) QTY(3) RATE(7) AMT(8) = 32; long names wrap below
function itemRows(item: { name: string; qty: number; price: number }): string[] {
  const name = toAscii(item.name)
  const rows = [
    name.slice(0, 14).padEnd(14) +
      String(item.qty).padStart(3) +
      money(item.price).padStart(7) +
      money(item.qty * item.price).padStart(8),
  ]
  let rest = name.slice(14)
  while (rest.length > 0) {
    rows.push("  " + rest.slice(0, WIDTH - 2))
    rest = rest.slice(WIDTH - 2)
  }
  return rows
}

function upiLink(p: BillPayload): string {
  const pn = encodeURIComponent(toAscii(p.restaurantName) || "Restaurant")
  return `upi://pay?pa=${p.upiId}&pn=${pn}&am=${p.total.toFixed(2)}&cu=INR`
}

export function billSegments(p: BillPayload): Seg[] {
  const { date, time } = nowIST()
  const segs: Seg[] = [
    { text: toAscii(p.restaurantName).toUpperCase(), center: true, bold: true, size: "tall" },
  ]
  if (p.address) segs.push({ text: toAscii(p.address), center: true })
  if (p.gstin) segs.push({ text: `GSTIN: ${p.gstin}`, center: true })
  segs.push(
    { text: LINE },
    { text: pair(`Table: ${p.tableNumber ?? "-"}`, `Bill To: ${toAscii(p.customerName)}`) },
    { text: pair(`Date: ${date}`, `Time: ${time}`) },
    { text: LINE },
    { text: "ITEM".padEnd(14) + "QTY".padStart(3) + "RATE".padStart(7) + "AMT".padStart(8), bold: true },
    { text: LINE },
  )
  for (const item of consolidateItems(p.rounds)) {
    for (const row of itemRows(item)) segs.push({ text: row })
  }
  segs.push(
    { text: LINE },
    { text: amountLine("Subtotal", p.subtotal) },
    { text: amountLine(`GST @ ${p.gstRate}%`, p.gstAmount) },
    { text: LINE },
    { text: amountLine("TOTAL", p.total), bold: true, size: "tall" },
    { text: LINE },
  )
  if (p.upiId) {
    segs.push(
      { qr: upiLink(p) },
      { text: "Scan to pay via UPI", center: true },
      { text: `UPI: ${p.upiId}`, center: true },
      { text: "" },
    )
  }
  segs.push({ text: "Thank you! Visit again", center: true })
  return segs
}

// ── Renderers ───────────────────────────────────────────────────────────────

export function segsToText(segs: Seg[]): string {
  return segs
    .map(s => {
      if ("qr" in s) return `[UPI QR] ${s.qr}`
      if (!s.center) return s.text
      const pad = Math.max(0, Math.floor((WIDTH - s.text.length) / 2))
      return " ".repeat(pad) + s.text
    })
    .join("\n")
}

// ESC/POS: model-2 QR, size 6, error correction M, store + print
function qrBuffer(data: string): Buffer {
  const bytes = Buffer.from(data, "ascii")
  const len = bytes.length + 3
  return Buffer.concat([
    Buffer.from([0x1b, 0x61, 0x01]),                                   // center
    Buffer.from([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]), // model 2
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06]),       // module size 6
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]),       // EC level M
    Buffer.from([0x1d, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30]),
    bytes,                                                                // store data
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),       // print
  ])
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
    if ("qr" in s) {
      out.push(qrBuffer(s.qr))
      continue
    }
    out.push(Buffer.from([0x1b, 0x61, s.center ? 0x01 : 0x00]))          // align
    out.push(Buffer.from([0x1b, 0x45, s.bold ? 0x01 : 0x00]))            // bold
    // GS ! — 0x11 doubles width+height, 0x01 doubles height only (keeps 32 cols)
    out.push(Buffer.from([0x1d, 0x21, s.size === "big" ? 0x11 : s.size === "tall" ? 0x01 : 0x00]))
    out.push(Buffer.from(toPrinterSafe(s.text) + "\n", "ascii"))
  }
  out.push(Buffer.from([0x1d, 0x21, 0x00]))       // reset size
  out.push(Buffer.from("\n\n\n", "ascii"))         // feed before cut
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
