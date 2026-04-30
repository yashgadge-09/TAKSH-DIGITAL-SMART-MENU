import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      console.warn('FIREBASE_SERVICE_ACCOUNT environment variable is not set. Firebase Admin cannot be initialized properly.');
    }
  } catch (error) {
    console.error('Firebase Admin initialization error', error);
  }
}

export async function GET(request: Request) {
  try {
    // 1. Check authorization
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Query sessions older than 30 mins
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: sessions, error: fetchError } = await supabase
      .from('push_sessions')
      .select('*')
      .eq('notification_sent', false)
      .lte('session_start', thirtyMinsAgo);

    if (fetchError) {
      console.error('Error fetching sessions:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ message: 'No sessions to process' }, { status: 200 });
    }

    if (!admin.apps.length) {
       return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    // 3. Send notifications and update rows
    const results = [];
    for (const session of sessions) {
      try {
        const message = {
          token: session.fcm_token,
          notification: {
            title: 'Thank you for dining with us! 🍽️',
            body: 'Enjoyed your meal? Tap to share your experience ⭐',
          },
          data: {
            url: `/api/review-click?session=${session.id}`,
          },
        };

        await admin.messaging().send(message);

        // Update supabase row
        const { error: updateError } = await supabase
          .from('push_sessions')
          .update({
            notification_sent: true,
            notification_sent_at: new Date().toISOString(),
          })
          .eq('id', session.id);

        if (updateError) {
          console.error(`Failed to update session ${session.id}:`, updateError);
          results.push({ id: session.id, status: 'error_updating_db' });
        } else {
          results.push({ id: session.id, status: 'success' });
        }
      } catch (sendError) {
        console.error(`Failed to send notification for session ${session.id}:`, sendError);
        results.push({ id: session.id, status: 'error_sending_push' });
      }
    }

    return NextResponse.json({ success: true, processed: sessions.length, results }, { status: 200 });
  } catch (error) {
    console.error('Send notifications error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
