import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const { fcm_token } = await request.json();

    if (!fcm_token) {
      return NextResponse.json({ error: 'fcm_token is required' }, { status: 400 });
    }

    // Validate FCM token format (should be a long string, typically 150+ chars)
    if (typeof fcm_token !== 'string' || fcm_token.trim().length < 10) {
      // Do NOT log the token itself — it is a device push identifier (PII).
      console.warn('Invalid FCM token format (failed length/type check)');
      return NextResponse.json({ error: 'Invalid FCM token format' }, { status: 400 });
    }

    const trimmedToken = fcm_token.trim();

    // Check if this token already exists for this table in the last hour
    // To prevent multiple sessions from being created continuously
    const { data: existingSession, error: checkError } = await supabase
      .from('push_sessions')
      .select('id, session_start')
      .eq('fcm_token', trimmedToken)
      .order('session_start', { ascending: false })
      .limit(1)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('save-token: error checking existing session:', checkError.message);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const now = new Date();
    if (existingSession) {
      const sessionStart = new Date(existingSession.session_start);
      // If a session exists within the last 2 hours, don't create a new one
      const diffHours = (now.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
      if (diffHours < 2) {
        return NextResponse.json({ success: true, message: 'Session already active' });
      }
    }

    const { data, error } = await supabase
      .from('push_sessions')
      .insert([
        {
          fcm_token: trimmedToken,
          session_start: now.toISOString(),
        }
      ]);

    if (error) {
      console.error('save-token: error saving token:', error.message);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('save-token: unexpected error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
