import "dotenv/config";
import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE_URL = (process.env.QR_BASE_URL ?? "https://tastefy.food").replace(/\/$/, "");
const SLUG = "taksh";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[qr] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in print-bridge/.env");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getTableNumbers(): Promise<number[]> {
  try {
    const { data: rest, error: restErr } = await db
      .from("restaurants")
      .select("id")
      .eq("slug", SLUG)
      .single();

    if (restErr || !rest) throw new Error(restErr?.message ?? "restaurant not found");

    const { data: tables, error: tablesErr } = await db
      .from("restaurant_tables")
      .select("table_number")
      .eq("restaurant_id", rest.id)
      .order("table_number");

    if (tablesErr || !tables) throw new Error(tablesErr?.message ?? "tables not found");

    return tables.map((t) => t.table_number as number);
  } catch (err) {
    const fallbackCount = parseInt(process.env.TABLE_COUNT ?? "16", 10);
    console.warn(`DB unreachable (${(err as Error).message}), falling back to ${fallbackCount} tables`);
    return Array.from({ length: fallbackCount }, (_, i) => i + 1);
  }
}

async function generate() {
  const tableNumbers = await getTableNumbers();

  const outputDir = path.join(__dirname, "output");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "qr-codes-taksh.pdf");

  // A5: 419.53 x 595.28 pts
  const doc = new PDFDocument({ size: "A5", margin: 40 });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  const pageWidth = 419.53;
  const qrWidth = 250;
  const qrX = (pageWidth - qrWidth) / 2;

  for (let i = 0; i < tableNumbers.length; i++) {
    const tableNumber = tableNumbers[i];
    const url = `${BASE_URL}/${SLUG}/table/${tableNumber}`;

    const png = await QRCode.toBuffer(url, {
      errorCorrectionLevel: "H",
      width: 600,
      margin: 1,
    });

    if (i > 0) doc.addPage();

    const qrY = 60;
    doc.image(png, qrX, qrY, { width: qrWidth });

    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .text(`TABLE ${tableNumber}`, 0, qrY + qrWidth + 16, { align: "center" });

    doc
      .font("Helvetica")
      .fontSize(13)
      .fillColor("#555555")
      .text("Scan to order", 0, qrY + qrWidth + 46, { align: "center" });

    // reset fill for next page
    doc.fillColor("#000000");
  }

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  console.log(`\nDone! ${tableNumbers.length} tables → ${outputPath}\n`);
}

generate().catch((err) => {
  console.error("generateQR failed:", err);
  process.exit(1);
});
