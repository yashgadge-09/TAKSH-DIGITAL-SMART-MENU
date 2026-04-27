import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request) {
  return NextResponse.json(
    { error: "Notification feature is removed." },
    { status: 410 }
  );
}
