import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

/**
 * Standard API error response.
 *
 * Sends the client ONLY a generic message + a correlation ID. Full details
 * (error objects, DB messages, stack traces) are logged server-side keyed by the
 * same correlation ID, so support can trace an incident without ever leaking
 * internal server info, query details, or file paths to the caller.
 */
export function errorResponse(
  clientMessage: string,
  status: number,
  serverDetail?: unknown
): NextResponse {
  const correlationId = randomUUID();
  if (serverDetail !== undefined) {
    const detail =
      serverDetail instanceof Error ? serverDetail.message : serverDetail;
    console.error(`[${correlationId}] ${clientMessage}:`, detail);
  }
  return NextResponse.json({ error: clientMessage, correlationId }, { status });
}
