import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { restaurantId, tableId, pinAttempt } = await req.json()

    if (!restaurantId || !tableId) {
      return new Response(
        JSON.stringify({ error: "Missing restaurantId or tableId" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      )
    }

    // 1. Fetch table_number to return in responses
    const { data: tableData, error: tableError } = await supabaseClient
      .from('restaurant_tables')
      .select('table_number')
      .eq('id', tableId)
      .single()

    if (tableError || !tableData) {
      return new Response(
        JSON.stringify({ error: "Table not found: " + (tableError?.message ?? "") }),
        { 
          status: 404, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      )
    }

    const tableNumber = tableData.table_number

    // 2. Check for active session on this table
    const { data: activeSession, error: sessionError } = await supabaseClient
      .from('table_sessions')
      .select('*')
      .eq('table_id', tableId)
      .eq('status', 'active')
      .maybeSingle()

    if (sessionError) {
      return new Response(
        JSON.stringify({ error: "Database query error: " + sessionError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      )
    }

    // 3. If session EXISTS
    if (activeSession) {
      if (pinAttempt === undefined || pinAttempt === null) {
        // PIN check is required
        return new Response(
          JSON.stringify({ exists: true, requiresPin: true }),
          { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        )
      }

      // Check pin attempt
      if (String(pinAttempt).trim() === activeSession.pin) {
        return new Response(
          JSON.stringify({ 
            exists: true, 
            sessionId: activeSession.id, 
            tableNumber, 
            pin: activeSession.pin 
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        )
      } else {
        return new Response(
          JSON.stringify({ error: "Incorrect PIN" }),
          { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        )
      }
    }

    // 4. If session DOES NOT exist, create a new one
    // Generate a random 4-digit PIN (1000 to 9999)
    const pin = String(Math.floor(1000 + Math.random() * 9000))

    const { data: newSession, error: insertError } = await supabaseClient
      .from('table_sessions')
      .insert({
        restaurant_id: restaurantId,
        table_id: tableId,
        pin,
        status: 'active'
      })
      .select()
      .single()

    if (insertError || !newSession) {
      return new Response(
        JSON.stringify({ error: "Failed to create session: " + (insertError?.message ?? "") }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        exists: false, 
        sessionId: newSession.id, 
        tableNumber, 
        pin 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }
})
