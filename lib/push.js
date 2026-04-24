  export async function scheduleNotification(session_id, dishes, delayMinutes = 40) {
  if (!session_id || !Array.isArray(dishes) || dishes.length === 0) {
    console.warn("scheduleNotification called without session_id or dishes.");
    return null;
  }

  const response = await fetch("/api/push/schedule", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session_id,
      dishes,
      delay_minutes: delayMinutes,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || "Failed to schedule feedback notification.");
  }

  return payload?.data || null;
}
