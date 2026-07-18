const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function listTables() {
  console.log("Fetching tables...");
  
  // Query to get table list
  const { data: tables, error: tablesError } = await supabase.rpc('execute_sql_query', {
    query_text: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
  });

  if (tablesError) {
    console.log("Direct SQL RPC failed, attempting standard table checks.");
    // Fallback: check tables we suspect
    const possibleTables = [
      'dishes', 'categories', 'reviews', 'menu_views', 'dish_views', 
      'cart_events', 'favourites', 'dish_ratings', 'push_sessions',
      'restaurants', 'restaurant_tables', 'table_sessions', 'orders', 'order_items', 'bills', 'print_jobs'
    ];
    
    for (const table of possibleTables) {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`Table '${table}': NOT FOUND or error: ${error.message} (code: ${error.code})`);
      } else {
        console.log(`Table '${table}': EXISTS`);
      }
    }
  } else {
    console.log("Tables found via SQL:", tables);
  }
}

listTables().catch(console.error);
