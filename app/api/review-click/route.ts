import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session');

    if (sessionId) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from('push_sessions')
        .update({
          review_clicked: true,
          review_clicked_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
    }

    const reviewUrl = process.env.GOOGLE_REVIEW_URL || 'https://g.page/r/fallback'; // fallback url just in case
    return NextResponse.redirect(reviewUrl);
  } catch (error) {
    console.error('Review click error:', error);
    // Even on error, redirect to review url to not block the user
    const reviewUrl = process.env.GOOGLE_REVIEW_URL || 'https://g.page/r/fallback';
    return NextResponse.redirect(reviewUrl);
  }
}
