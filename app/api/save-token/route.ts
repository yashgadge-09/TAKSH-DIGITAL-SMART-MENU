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
      console.warn('Invalid FCM token format:', fcm_token?.substring(0, 50));
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
      console.error('Error checking existing session:', JSON.stringify(checkError, null, 2));
      return NextResponse.json({ error: 'Database error', details: checkError }, { status: 500 });
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
      console.error('Error saving token:', JSON.stringify(error, null, 2));
      return NextResponse.json({ error: 'Database error', details: error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in save-token catch block:', error instanceof Error ? error.message : JSON.stringify(error));
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
