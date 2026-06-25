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

// ── Mock formatters ─────────────────────────────────────────────────────────

const LINE = "─".repeat(40)

function formatKot(p: KotPayload): string {
  const lines = [
    LINE,
    "            KOT",
    `Table ${p.tableNumber} · Round ${p.roundNumber}`,
    `Time: ${p.time}`,
    LINE,
    ...p.items.map(i => `  ${i.qty} x ${i.name}`),
    LINE,
  ]
  return lines.join("\n")
}

function formatBill(p: BillPayload): string {
  const lines = [
    LINE,
    `  ${p.restaurantName}`,
    `  ${p.address}`,
    `  GSTIN: ${p.gstin}`,
    LINE,
    `Table ${p.tableNumber ?? "—"}`,
    `Customer: ${p.customerName}`,
    LINE,
  ]
  for (const round of p.rounds) {
    lines.push(`Round ${round.number} — ${round.time}`)
    for (const item of round.items) {
      const lineTotal = item.qty * item.price
      lines.push(`  ${item.qty} x ${item.name}  ₹${lineTotal}`)
    }
  }
  lines.push(
    LINE,
    `Subtotal          ₹${p.subtotal}`,
    `GST (${p.gstRate}%)         ₹${p.gstAmount}`,
    `TOTAL             ₹${p.total}`,
    LINE,
    `UPI: ${p.upiId}`,
    LINE,
  )
  return lines.join("\n")
}

// ── TCP send (real ESC/POS mode) ────────────────────────────────────────────

function sendToprinter(ip: string, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket()
    sock.connect(PRINTER_PORT, ip, () => {
      // ESC/POS init + text + cut
      const ESC_INIT = Buffer.from([0x1b, 0x40])
      const CUT      = Buffer.from([0x1d, 0x56, 0x42, 0x00])
      sock.write(Buffer.concat([ESC_INIT, Buffer.from(data, "utf8"), CUT]))
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
        if (MOCK_PRINT) {
          if (job.type === "kot") {
            console.log("\n[MOCK KOT]")
            console.log(formatKot(job.payload as KotPayload))
          } else {
            console.log("\n[MOCK BILL]")
            console.log(formatBill(job.payload as BillPayload))
          }
        } else {
          const ip   = job.type === "kot" ? KITCHEN_PRINTER_IP : RECEPTION_PRINTER_IP
          const text = job.type === "kot"
            ? formatKot(job.payload as KotPayload)
            : formatBill(job.payload as BillPayload)
          await sendToprinter(ip, text)
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
