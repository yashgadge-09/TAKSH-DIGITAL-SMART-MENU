import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session');

    const googleReviewUrl = process.env.GOOGLE_REVIEW_URL;
    let redirectUrl;

    if (googleReviewUrl && googleReviewUrl.startsWith('http')) {
      redirectUrl = googleReviewUrl;
    } else {
      // If GOOGLE_REVIEW_URL is missing or relative, fallback to the website's root URL
      redirectUrl = new URL('/', request.url).toString();
    }
    
    if (sessionId) {
      // Update session row: set review_clicked to true and review_clicked_at to current timestamp
      const { error } = await supabase
        .from('push_sessions')
        .update({
          review_clicked: true,
          review_clicked_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) {
        console.error(`Failed to update review_clicked for session ${sessionId}:`, error);
      }
    }

    // Redirect user to the Google Review URL or fallback
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Error in review-click:', error);
    // On error, gracefully fallback and still redirect the user
    return NextResponse.redirect(new URL('/', request.url).toString());
  }
}
