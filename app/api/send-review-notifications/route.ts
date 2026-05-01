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
    const now = Date.now();
    // 30 minutes ago
    const thirtyMinsAgo = new Date(now - 30 * 60 * 1000).toISOString();
    // 45 minutes ago
    const fortyFiveMinsAgo = new Date(now - 45 * 60 * 1000).toISOString();

    let successCount = 0;
    let failureCount = 0;

    // --- 1. First Notification Logic (30 minutes) ---
    const { data: firstSessions, error: firstFetchError } = await supabase
      .from('push_sessions')
      .select('id, fcm_token')
      .eq('notification_sent', false)
      .lt('session_start', thirtyMinsAgo);

    if (firstFetchError) {
      console.error('Database error fetching first sessions:', firstFetchError);
    } else if (firstSessions && firstSessions.length > 0) {
      for (const session of firstSessions) {
        if (!session.fcm_token) continue;
        try {
          await admin.messaging().send({
            token: session.fcm_token,
            notification: {
              title: "Thank you for dining with us! 🍽️",
              body: "Enjoyed your meal? Tap to share your experience ⭐"
            },
            data: { url: `/api/review-click?session=${session.id}` }
          });

          const { error: updateError } = await supabase
            .from('push_sessions')
            .update({
              notification_sent: true,
              notification_sent_at: new Date().toISOString()
            })
            .eq('id', session.id);

          if (updateError) {
            console.error(`Failed to update session ${session.id}:`, updateError);
            failureCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          console.error(`Failed to send first notification for session ${session.id}:`, err);
          failureCount++;
        }
      }
    }

    // --- 2. Second Notification Logic (45 minutes) ---
    const { data: secondSessions, error: secondFetchError } = await supabase
      .from('push_sessions')
      .select('id, fcm_token')
      .eq('notification_sent', true)
      .eq('second_notification_sent', false)
      .eq('review_clicked', false)
      .lt('session_start', fortyFiveMinsAgo);

    if (secondFetchError) {
      console.error('Database error fetching second sessions:', secondFetchError);
    } else if (secondSessions && secondSessions.length > 0) {
      for (const session of secondSessions) {
        if (!session.fcm_token) continue;
        try {
          await admin.messaging().send({
            token: session.fcm_token,
            notification: {
              title: "We miss your feedback! 🌟",
              body: "Your review takes just 10 seconds and helps so many people. Tap to share ❤️"
            },
            data: { url: `/api/review-click?session=${session.id}` }
          });

          const { error: updateError } = await supabase
            .from('push_sessions')
            .update({
              second_notification_sent: true,
              second_notification_sent_at: new Date().toISOString()
            })
            .eq('id', session.id);

          if (updateError) {
            console.error(`Failed to update session ${session.id} (second notification):`, updateError);
            failureCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          console.error(`Failed to send second notification for session ${session.id}:`, err);
          failureCount++;
        }
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
