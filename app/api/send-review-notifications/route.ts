import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as admin from 'firebase-admin';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      console.warn("FIREBASE_SERVICE_ACCOUNT is missing in environment variables.");
    }
  } catch (error) {
    console.error("Firebase admin initialization error:", error);
  }
}

export async function GET(request: Request) {
  // Verify CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('x-cron-secret');
  
  if (!cronSecret || authHeader !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 30 minutes ago
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // Query push_sessions where notification_sent is false and session_start < thirtyMinsAgo
    const { data: sessions, error: fetchError } = await supabase
      .from('push_sessions')
      .select('id, fcm_token')
      .eq('notification_sent', false)
      .lt('session_start', thirtyMinsAgo);

    if (fetchError) {
      console.error('Database error fetching sessions:', fetchError);
      return NextResponse.json({ error: 'Database error fetching sessions' }, { status: 500 });
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending notifications' });
    }

    let successCount = 0;
    let failureCount = 0;

    // Process sequentially (could use Promise.all for speed if high volume)
    for (const session of sessions) {
      if (!session.fcm_token) continue;

      try {
        // Send Firebase FCM push notification
        await admin.messaging().send({
          token: session.fcm_token,
          notification: {
            title: "Thank you for dining with us! 🍽️",
            body: "Enjoyed your meal? Tap to share your experience ⭐"
          },
          data: {
            url: `/api/review-click?session=${session.id}`
          }
        });

        // Update row on successful send
        const { error: updateError } = await supabase
          .from('push_sessions')
          .update({
            notification_sent: true,
            notification_sent_at: new Date().toISOString()
          })
          .eq('id', session.id);

        if (updateError) {
          console.error(`Failed to update session ${session.id}:`, updateError);
          // Even if DB update fails, the message was sent, so we still count it as a notification success?
          // Or we count it as failure because it might send again. We'll count as failure for logging.
          failureCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`Failed to send notification for session ${session.id}:`, err);
        failureCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      sent: successCount, 
      failed: failureCount 
    });
  } catch (error) {
    console.error('Error processing notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
