import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function sendOneSignalNotification(playerId: string, title: string, body: string, url: string) {
  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
    },
    body: JSON.stringify({
      app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
      include_aliases: { onesignal_id: [playerId] },
      target_channel: 'push',
      headings: { en: title },
      contents: { en: body },
      url: url,
      chrome_web_icon: 'https://tastefy.food/apple-icon.png',
      chrome_web_badge: 'https://tastefy.food/apple-icon.png',
      android_sound: 'notification',
      ios_sound: 'notification.wav',
      android_visibility: 1,
      priority: 10,
      ttl: 3600,
    })
  });
  const data = await response.json();
  console.log('OneSignal response:', JSON.stringify(data));
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  return data;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('x-cron-secret');
  if (!cronSecret || authHeader !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = Date.now();
    const thirtyMinsAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // Shrunk to 2 minutes for testing
    const ninetyMinsAgo = new Date(Date.now() - 90 * 60 * 1000).toISOString();
    const fortyFiveMinsAgo = new Date(now - 3 * 60 * 1000).toISOString(); // Shrunk to 3 minutes for testing
    let successCount = 0;
    let failureCount = 0;

    // First notification
    const { data: sessions } = await supabase
      .from('push_sessions')
      .select('*')
      .eq('notification_sent', false)
      .not('player_id', 'is', null)
      .lte('session_start', thirtyMinsAgo)
      .gte('session_start', ninetyMinsAgo);

    for (const session of sessions || []) {
      if (!session.player_id) continue;
      try {
        await sendOneSignalNotification(
          session.player_id,
          "Thank you for dining with us! 🍽️",
          "Enjoyed your meal? Tap to share your experience ⭐",
          `https://tastefy.food/api/review-click?session=${session.id}`
        );
        await supabase.from('push_sessions').update({
          notification_sent: true,
          notification_sent_at: new Date().toISOString()
        }).eq('id', session.id);
        successCount++;
      } catch (err) {
        console.error(`First notification failed for ${session.id}:`, err);
        failureCount++;
      }
    }

    // Second notification — 2 mins
    const { data: secondSessions } = await supabase
      .from('push_sessions')
      .select('id, player_id')
      .eq('notification_sent', true)
      .eq('second_notification_sent', false)
      .eq('review_clicked', false)
      .lt('session_start', fortyFiveMinsAgo);

    for (const session of secondSessions || []) {
      if (!session.player_id) continue;
      try {
        await sendOneSignalNotification(
          session.player_id,
          "We miss your feedback! 🌟",
          "Your review takes just 10 seconds and helps so many people ❤️",
          `https://tastefy.food/api/review-click?session=${session.id}`
        );
        await supabase.from('push_sessions').update({
          second_notification_sent: true,
          second_notification_sent_at: new Date().toISOString()
        }).eq('id', session.id);
        successCount++;
      } catch (err) {
        console.error(`Second notification failed for ${session.id}:`, err);
        failureCount++;
      }
    }

    return NextResponse.json({ success: true, sent: successCount, failed: failureCount });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}