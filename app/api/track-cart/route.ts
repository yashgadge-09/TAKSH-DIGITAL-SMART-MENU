import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireServerEnv } from '@/lib/env';
import { errorResponse } from '@/lib/api-error';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * Cart analytics sink.
 *
 * This exists as a plain route handler rather than the `trackCartEvent` Server
 * Action because Server Actions post to the current route and stream back an
 * RSC payload, which makes React re-render the whole menu tree on every ADD tap.
 * On a 440-dish menu that re-render is what guests feel as "add to cart is slow".
 * A fetch to a JSON endpoint has no such side effect.
 */

const MAX_STR = 200;

const supabase = createClient(
  requireServerEnv('NEXT_PUBLIC_SUPABASE_URL'),
  requireServerEnv('SUPABASE_SERVICE_ROLE_KEY')
);

export async function POST(request: Request) {
  try {
    // Unauthenticated endpoint: throttle per-IP so one client can't flood cart_events.
    const ip = getClientIp(request);
    const { allowed, retryAfterSec } = rateLimit(`track-cart:${ip}`, 120, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }

    const body = await request.json();
    const dishId = typeof body?.dishId === 'string' ? body.dishId.trim() : '';
    const dishName = typeof body?.dishName === 'string' ? body.dishName.trim() : '';
    const category = typeof body?.category === 'string' ? body.category.trim() : '';
    const price = Number(body?.price);

    if (!dishId || dishId.length > MAX_STR) {
      return NextResponse.json({ error: 'Invalid dishId' }, { status: 400 });
    }
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000) {
      return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
    }

    const { error } = await supabase.from('cart_events').insert({
      dish_id: dishId,
      dish_name: dishName.slice(0, MAX_STR),
      category: (category || 'General').slice(0, MAX_STR),
      price,
    });

    if (error) {
      return errorResponse('Database error', 500, error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse('Internal server error', 500, error);
  }
}
