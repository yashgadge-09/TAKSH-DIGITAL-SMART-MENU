import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request) {
  return NextResponse.json(
    { error: "Notification feature is removed." },
    { status: 410 }
  );
}
