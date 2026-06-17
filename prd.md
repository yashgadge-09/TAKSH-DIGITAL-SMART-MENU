# Tastefy — Dev Task Prompts (v2)
### Built on Existing Next.js + Supabase · 4 Devs · 2–3 Days
**Version:** 2.0 · June 2026

---

## What Changed From Before

We already have:
- ✅ Next.js customer app with full UI (menu, item detail, cart)
- ✅ Supabase database with all dish data filled in
- ✅ "Show to Waiter" button (cart works, but no real ordering yet)

We are NOT rebuilding any of this. We are adding the missing pieces on top:
session/PIN system, real order placement, kitchen printing, billing, admin panel.

---

## Why Supabase Instead of a Separate Backend?

**What is Supabase, in plain English?**
Supabase is a tool that gives you a Postgres database PLUS automatic APIs PLUS real-time updates PLUS login system — all without writing backend code yourself. You just create tables in their dashboard (or via SQL), and Supabase instantly gives you working API endpoints to read/write that data. It also has "Realtime" — meaning when data changes, anyone watching gets notified instantly, no extra code needed.

**Why this matters for us:**
Normally we'd need Dev 1 to build an entire Express.js API server (routes, controllers, auth, Socket.io for real-time). With Supabase, most of that is already provided. This means:
- No separate API server to build and deploy
- No Socket.io needed — Supabase Realtime does this for us
- Less code = fewer bugs = faster than 3 days

**What we still need to build ourselves:**
- The new database tables (sessions, orders, bills, print jobs)
- The actual screens: session/PIN flow, checkout, admin panel
- Business logic (calculating bills, generating PINs) — as either frontend logic or Supabase "Edge Functions" (small serverless functions)
- The print bridge (Supabase can't talk to a printer in a kitchen — this still needs a separate small Node.js script)

---

## The New 4-Part System

1. **Customer app** (EXISTING — Next.js) — we add ordering, sessions, checkout to it
2. **Admin panel** (EXTENDING EXISTING — under /admin routes) — owner's dashboard
3. **Supabase** (EXISTING — just add new tables + Edge Functions) — replaces "Dev 1's API"
4. **Print bridge** (NEW — small Node.js script) — talks to printers, reads from Supabase

---

## What Is an "Edge Function"?

Supabase lets you write small pieces of backend logic called Edge Functions — think of them as mini-programs that run on Supabase's servers, not in the browser. We need these for logic that shouldn't run on the customer's phone (like generating a unique PIN, or calculating a bill total) because that logic needs to be trustworthy and centralized.

We'll use Edge Functions for: creating a session with PIN, placing an order, generating a bill.

---

## Task Prompts Below Use This Pattern

Each task has:
- **Plain English** — what it means and why
- **Prompt** — paste into Claude/Cursor/ChatGPT, but tell it your existing Supabase project URL and that you're extending an existing Next.js app (don't let it scaffold a new one from scratch)

---

## SHARED SETUP — Whoever Has Supabase Access Does This First (30 min)

---

### TASK S1 — Create new database tables in Supabase

**What this means:**
We need to add new tables for the ordering system: restaurants (to store details like address, GSTIN, UPI ID), restaurant_tables (physical tables), table_sessions (dining groups), orders (each round), order_items (the individual items ordered, linking to the existing `dishes` table), customers, bills, and print_jobs.

You'll run this as SQL directly in the Supabase SQL Editor (a built-in tool in their dashboard — no separate database tool needed).

**Prompt:**
```
I have an existing Supabase project for a restaurant ordering app called Tastefy.
The database already has tables for dishes and categories (don't recreate these).

Write a SQL migration to add these NEW tables to my existing Supabase Postgres database:

1. restaurants
   - id (uuid, primary key, default gen_random_uuid())
   - name (text, not null)
   - slug (text, unique, not null)
   - address (text, nullable)
   - gstin (text, nullable)
   - upi_id (text, nullable)
   - created_at (timestamptz, default now())

2. restaurant_tables
   - id (uuid, primary key, default gen_random_uuid())
   - restaurant_id (uuid, references public.restaurants(id))
   - table_number (integer)
   - unique constraint on (restaurant_id, table_number)

3. table_sessions
   - id (uuid, primary key, default gen_random_uuid())
   - restaurant_id (uuid, references public.restaurants(id))
   - table_id (uuid, references restaurant_tables)
   - pin (text, 4 characters)
   - status (text, default 'active') -- active, bill_generated, closed
   - opened_at (timestamptz, default now())
   - closed_at (timestamptz, nullable)

4. customers
   - id (uuid, primary key, default gen_random_uuid())
   - restaurant_id (uuid, references public.restaurants(id))
   - name (text, not null)
   - phone (text, nullable)
   - whatsapp_opted_in (boolean, default false)
   - created_at (timestamptz, default now())

5. orders
   - id (uuid, primary key, default gen_random_uuid())
   - session_id (uuid, references table_sessions)
   - customer_id (uuid, references customers)
   - round_number (integer)
   - status (text, default 'received')
   - placed_at (timestamptz, default now())

6. order_items
   - id (uuid, primary key, default gen_random_uuid())
   - order_id (uuid, references orders)
   - dish_id (uuid, references public.dishes(id))
   - name (text) -- snapshot
   - price (numeric) -- snapshot
   - quantity (integer)

7. bills
   - id (uuid, primary key, default gen_random_uuid())
   - session_id (uuid, references table_sessions)
   - subtotal (numeric)
   - gst_amount (numeric)
   - total (numeric)
   - generated_at (timestamptz, default now())

8. print_jobs
   - id (uuid, primary key, default gen_random_uuid())
   - restaurant_id (uuid, references public.restaurants(id))
   - type (text) -- 'kot' or 'bill'
   - payload (jsonb)
   - status (text, default 'pending') -- pending, sent, failed
   - created_at (timestamptz, default now())

Also write Row Level Security (RLS) policies:
- public.restaurants, restaurant_tables, table_sessions, orders, order_items, customers, bills:
  allow public INSERT and SELECT (customers need to create sessions/orders
  without logging in) but restrict UPDATE/DELETE to authenticated admin users only
- print_jobs: allow public INSERT (so orders can create print jobs),
  but only allow SELECT/UPDATE using a service role key (the print bridge
  will use this, not the public key)

Enable Realtime on: table_sessions, orders (so admin panel gets live updates)

Show the complete SQL to paste into Supabase SQL Editor.
```

---

### TASK S2 — Seed Restaurant and Tables for Taksh

**What this means:**
Insert a restaurant row for "TAKSH Veg" and then insert 10 physical tables linked to it.

**Prompt:**
```
Write a SQL insert statement for Supabase Postgres.

1. First, insert a row in the public.restaurants table:
   - name: 'TAKSH Veg'
   - slug: 'taksh'
   - address: 'Chinchwad, Pune'
   - gstin: '27AAAAA1111A1Z1'
   - upi_id: 'takshveg@ybl'
   (Use ON CONFLICT (slug) DO UPDATE to avoid duplicates if already present).

2. Look up the newly created restaurant's ID by slug = 'taksh'.

3. Insert 10 rows into restaurant_tables with table_number 1 through 10, all linked to this restaurant_id. Use ON CONFLICT (restaurant_id, table_number) DO NOTHING.

Show the SQL to run in Supabase SQL Editor.
```

---

## DEV 1 — Supabase Edge Functions (Business Logic)

**Your job:** Build the 3 pieces of server-side logic that can't safely run on the customer's phone: creating a session with a PIN, placing an order, and generating a bill. These run as Supabase Edge Functions.

**What is an Edge Function, simply?** It's a small TypeScript file that runs on Supabase's servers when called. Think of it like a mini API endpoint, but Supabase hosts and runs it for you — no server to manage.

---

### TASK E1 — "Create or Join Session" Edge Function

**What this means:**
When a customer clicks "Place Order," we need to check: is there already an active session for this table? If yes, they need to enter the existing PIN. If no, we create one and generate a fresh PIN.

This logic needs to live on the server (not the customer's browser) so two people can't accidentally create two different PINs for the same table at the same time.

**Prompt:**
```
Write a Supabase Edge Function (Deno/TypeScript) called "create-or-join-session".

It should:
1. Accept POST request with body: { restaurantId, tableId, pinAttempt? }

2. Check if there's a row in table_sessions where:
   - table_id matches
   - status = 'active'

3. If an active session EXISTS:
   - If pinAttempt was NOT provided: return { exists: true, requiresPin: true }
   - If pinAttempt WAS provided: check if it matches the session's pin
     - If matches: return { exists: true, sessionId, tableNumber, pin }
     - If doesn't match: return 400 error { error: "Incorrect PIN" }

4. If NO active session exists:
   - Generate a random 4-digit PIN (1000-9999)
   - Insert a new row into table_sessions with this PIN, status='active'
   - Return { exists: false, sessionId, tableNumber, pin }

Use the Supabase JS client with the service role key (so it can bypass RLS
for this trusted server-side operation).

Show the complete index.ts for this Edge Function and the exact
`supabase functions deploy create-or-join-session` command to deploy it.
```

---

### TASK E2 — "Place Order" Edge Function

**What this means:**
When the customer confirms their order, this function: saves the order and items to the database, figures out what "round number" this is (1st, 2nd, 3rd time ordering at this table), creates a print job so the kitchen printer knows to print a KOT, and snapshots the current price of each item (so if the owner changes prices later, old orders aren't affected).

**Prompt:**
```
Write a Supabase Edge Function (Deno/TypeScript) called "place-order".

It should:
1. Accept POST request with body:
   { sessionId, customerId, restaurantId, tableNumber,
     items: [{ dishId, quantity }] }

2. Look up the current name and price for each dishId from the
   dishes table (so we snapshot the live price at order time). Note: the dish name is in the 'name_en' column of the dishes table.

3. Find the highest existing round_number for this sessionId in the
   orders table, add 1 (if no orders yet, this is round 1)

4. Insert a new row into orders (session_id, customer_id, round_number)

5. Insert one row per item into order_items
   (order_id, dish_id, name, price, quantity — using the
   snapshotted name/price from step 2)

6. Insert a new row into print_jobs:
   - type: 'kot'
   - restaurant_id: from input
   - payload: {
       tableNumber, roundNumber,
       time: current time as "HH:MM",
       items: [{ name, qty: quantity }]
     }
   - status: 'pending'

7. Return { orderId, roundNumber }

Use the Supabase JS client with service role key.
Show the complete index.ts and the deploy command.
```

---

### TASK E3 — "Generate Bill" Edge Function

**What this means:**
This runs when the OWNER clicks "Generate Bill" in the admin panel. It adds up every item ordered across all rounds for that table's session, calculates GST (tax), saves the bill, and creates a print job so the reception printer prints the final bill.

**Prompt:**
```
Write a Supabase Edge Function (Deno/TypeScript) called "generate-bill".

It should:
1. Accept POST request with body: { sessionId }

2. Fetch the session, then fetch all orders for this session,
   then fetch all order_items for those orders
   (join across orders -> order_items)

3. Group items by round_number for display purposes:
   rounds: [{ number: 1, time: "...", items: [{name, qty, price}] }]

4. Calculate:
   subtotal = sum of (price * quantity) across all order_items
   gstRate = 5 (hardcode 5% for now, restaurant.gst_rate field comes later)
   gstAmount = subtotal * (gstRate / 100)
   total = subtotal + gstAmount

5. Look up the customer name (from the most recent order's customer_id)
   and restaurant details (name, address, gstin, upi_id) —
   assume these columns exist on the restaurants table already

6. Insert a row into bills (session_id, subtotal, gst_amount, total)

7. Insert a row into print_jobs:
   - type: 'bill'
   - payload: {
       restaurantName, address, gstin, upiId,
       tableNumber, customerName, rounds,
       subtotal, gstRate, gstAmount, total
     }
   - status: 'pending'

8. Update the table_sessions row: set status = 'bill_generated'

9. Return { billId, total }

Use Supabase JS client with service role key.
Show the complete index.ts and deploy command.
```

---

## DEV 2 — Customer App (EXTENDING Existing Next.js App)

**Your job:** You are NOT rebuilding the menu or cart UI — that already exists and works. You're adding what happens AFTER "Add to Cart": replacing "Show to Waiter" with the real ordering flow.

---

### TASK C1 — Replace "Show to Waiter" with "Place Order" trigger

**What this means:**
Find wherever the current "Show to Waiter" button is in the existing codebase. We're changing its behavior. Instead of just displaying the cart on screen, it now needs to check if a session exists for this table.

**Prompt:**
```
I have an existing Next.js restaurant ordering app with a working cart.
Currently, the cart has a "Show to Waiter" button that just displays
the cart contents on screen.

I need to replace this with a real ordering flow. The existing cart
state contains: array of items with { menuItemId, name, price, quantity }.

I also have these Supabase Edge Functions already deployed:
- create-or-join-session (POST, body: { restaurantId, tableId, pinAttempt? })
- place-order (POST, body: { sessionId, customerId, restaurantId,
  tableNumber, items })

Build a new component called OrderFlow that:

1. Replaces the "Show to Waiter" button with "Place Order"

2. On click, calls create-or-join-session with { restaurantId, tableId }
   (no pinAttempt yet)

3. If response.exists is false:
   Show a modal: "You're the first to order! Share this PIN with your
   group: [PIN in large text]" with a "Continue" button

4. If response.exists is true and response.requiresPin is true:
   Show a modal with a 4-digit PIN input (styled like OTP boxes)
   On submit, call create-or-join-session again, this time WITH
   pinAttempt included
   If wrong PIN: show error "Incorrect PIN, try again"
   If correct: proceed to next step

5. Once session is confirmed (we have a sessionId), show the
   checkout form (build this as a separate task, just leave a
   placeholder call to onSessionConfirmed(sessionId) for now)

Use the existing app's styling (dark background, gold accents) —
look at the existing components for the design pattern to match.
Use React state for the modal flow (no need for a new state library
if one isn't already in use).

Show the complete OrderFlow component.
```

---

### TASK C2 — Checkout form (name, phone, WhatsApp opt-in)

**What this means:**
After the PIN step, we need to collect the customer's name (required) and optionally their phone number, plus ask if they want WhatsApp offers. This is the only place in the whole app where we ask for personal info, and it's optional except for the name.

**Prompt:**
```
I have an existing Next.js restaurant app. I need a checkout form component
that appears after a table session is confirmed (sessionId already available).

The form should collect:
- Name (required, text input, placeholder "Your name")
- Phone (optional, text input, placeholder "Phone (optional)")
- Checkbox: "Send me offers on WhatsApp" — unchecked by default
  Small helper text below: "Your number stays with this restaurant only"

On submit:
1. Insert a new row into the customers table via Supabase client
   (restaurant_id, name, phone, whatsapp_opted_in)
   — if phone is provided, first check if a customer with that phone
   already exists for this restaurant_id, and reuse that customer_id
   instead of creating a duplicate
2. Call the place-order Edge Function with:
   { sessionId, customerId, restaurantId, tableNumber, items: cart items }
3. On success: clear the cart, navigate to an order confirmation view

Match the existing app's dark + gold visual style.
Show the complete CheckoutForm component including the customer
lookup/insert logic using the Supabase JS client (assume supabase
client is already initialized and importable from a lib/supabase file).
```

---

### TASK C3 — Order confirmation screen

**What this means:**
The final screen after ordering — confirms success, shows what was ordered, and reminds them of the PIN in case they want to order more later (a second round).

**Prompt:**
```
Build an order confirmation component for a Next.js restaurant app.

Shown after an order is successfully placed. Accepts props:
{ items: [{name, quantity, price}], pin: string, tableNumber: number }

Display:
- "Order placed!" heading with a celebratory feel (emoji or simple animation, nothing heavy)
- List of ordered items with quantity and price
- A reminder box: "Your table PIN is [PIN] — remember this if you
  want to order more later"
- Text: "Want to order more? Just scan the QR code again and enter
  your PIN"
- No further action needed — this is the end of the flow, customer
  just closes the browser tab when done

Match the existing dark + gold visual style of the app.
Show the complete component.
```

---

## DEV 3 — Admin Panel (EXTENDING Existing Next.js App)

**Your job:** Extend the existing admin routes within the current codebase under the `/admin` path (rather than building a separate Next.js application). The admin authentication and layouts are already implemented (login at `/admin`, layout in `app/admin/layout.tsx`).

---

### TASK D1 — Verify admin app + layout routing

**What this means:**
Review the existing admin layout (`app/admin/layout.tsx`) and verification code. Make sure that the routing structure properly redirects to the login route `/admin` if the user is unauthenticated, and that we have placeholder navigation tabs in the sidebar for the new views: Dashboard, Menu, Customers, Reports, Settings.

**Prompt:**
```
In my existing Next.js App Router project, I have an admin panel implemented under the '/admin' folder.
The login screen is at 'app/admin/page.tsx' and the root layout 'app/admin/layout.tsx' already handles client-side Supabase auth checking.

Ensure that the AdminSidebar/AdminLayout component contains links to:
- Dashboard: `/admin/dashboard`
- Menu: `/admin/menu`
- Customers: `/admin/customers`
- Reports: `/admin/reports`
- Settings: `/admin/settings`

Ensure all these routes check authentication (via layout-level state) and look cohesive with the gold/dark theme of the application.
```

---

### TASK D2 — Live table dashboard with Supabase Realtime

**What this means:**
This is the most important screen — a grid of all tables showing their live status. Instead of using Socket.io (which we'd need for a custom backend), we use Supabase Realtime — a built-in feature that automatically notifies your app the instant a row changes in the database. So when a customer places an order, the admin dashboard updates instantly without any extra code on our part beyond "subscribe to changes."

**Prompt:**
```
Build the live dashboard page for a Next.js 14 admin panel using Supabase.

PAGE: /dashboard

On load:
1. Fetch all rows from restaurant_tables for this restaurant
2. For each table, fetch its most recent table_sessions row
   (if status is 'active' or 'bill_generated', show it; otherwise table is 'open')
3. For active sessions, fetch all related orders + order_items to
   calculate a running total and list of items

DISPLAY:
- Grid of table cards (responsive: 3 cols tablet, 4 cols desktop)
- Each card shows: table number, status badge
  (OPEN=grey, ACTIVE=green, BILL GENERATED=orange),
  if active: time elapsed + running total + customer name
- Top summary bar: total billed today, tables served today,
  active tables count

REALTIME (this is the key part):
Use supabase.channel() to subscribe to:
1. Changes on table_sessions table (INSERT and UPDATE) filtered
   by restaurant_id — when a new session starts or status changes,
   refresh that table's card
2. Changes on orders table (INSERT) — when a new order comes in,
   refresh the relevant table's running total and item list

Example pattern to use:
```
supabase
  .channel('admin-dashboard')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'table_sessions' },
    (payload) => { /* refresh affected table */ }
  )
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'orders' },
    (payload) => { /* refresh affected table */ }
  )
  .subscribe()
```

CLICKING A TABLE CARD opens a side drawer showing:
- All rounds with items (grouped by round_number)
- Running total
- If status='active': "Generate Bill" button
  → calls the generate-bill Edge Function via supabase.functions.invoke()
- If status='bill_generated': "Close Table" button
  → updates table_sessions status to 'closed' directly via Supabase client

Show the complete dashboard page and drawer component.
```

---

### TASK D3 — Menu management (verify EXISTING menu page integration)

**What this means:**
The menu management page is ALREADY built in the codebase at `app/admin/menu/page.tsx` and categories are managed as well. You just need to verify that it functions correctly with the existing database schema (the `dishes` and `categories` tables) and that the "Available / Unavailable" toggle properly writes changes directly to Supabase.

**Prompt:**
```
Check the existing menu management implementation at 'app/admin/menu/page.tsx'.
Confirm that:
1. It queries 'public.dishes' and 'public.categories' tables correctly.
2. The "Available / Unavailable" toggle successfully calls the 'toggleAvailability' helper function.
3. Verify that any edits or additions of items map properly to the columns in the 'dishes' table:
   - name_en, name_hi, name_mr
   - description_en, description_hi, description_mr
   - price
   - category
   - image_url (text array or single string)
   - is_available
   - spice_level
   - servings
   - is_chef_special, is_guest_favorite, is_trending, is_todays_special
```

---

### TASK D4 — Customers + Reports + Settings

**What this means:**
Customers page shows everyone who's ordered (from the new customers table Dev 1 created). Reports shows simple daily numbers. Settings is where the owner can see their restaurant info (we'll skip WhatsApp sending in this sprint and add it next — see note below).

**Prompt:**
```
Build customers, reports, and settings pages for a Next.js 14 admin panel
using Supabase.

CUSTOMERS PAGE (/customers):
- Fetch all rows from the customers table for this restaurant
- Table with columns: Name, Phone, WhatsApp opted in (checkmark/dash),
  Created date
- Simple sort by most recent first
- (Don't build WhatsApp sending yet — just display the data for now)

REPORTS PAGE (/reports):
- Date picker (default: today)
- For the selected date, query the bills table joined with
  table_sessions to find all bills generated that day for this restaurant
- Show: Total billed (sum of bill totals), Number of bills (count),
  Average bill value
- Simple list of each bill with time and amount (no fancy charts needed
  for V1 — a clean table is enough)

SETTINGS PAGE (/settings):
- Display restaurant name, address, GSTIN, UPI ID
  (read from the restaurants table — editable text fields)
- Save button updates the restaurants row via Supabase client
- QR Codes section:
  - List all restaurant_tables with their table_number
  - "Download QR Codes PDF" button (can be a placeholder for now,
    or use the qrcode + pdfkit npm packages to generate one PDF
    with a QR per table encoding a URL like
    https://[your-customer-app-domain]/table/[tableNumber])

Show all three pages.
```

---

## DEV 4 — Print Bridge + QA

**Your job:** Build the print bridge that reads print_jobs from Supabase and sends them to the kitchen and reception printers. Build it in mock mode first (no real printer needed), test with real printers only at the very end.

---

### TASK P1 — Print bridge reading from Supabase (mock mode)

**What this means:**
This is a small standalone Node.js script — NOT part of either Next.js app. It runs separately (eventually on a device inside the restaurant). Its only job: keep checking the print_jobs table in Supabase for new pending rows, and "print" them.

In mock mode, instead of sending to a real printer, it just prints the formatted receipt to your terminal screen so you can see exactly what would come out of the printer — without needing one connected.

**Prompt:**
```
Build a standalone Node.js (TypeScript) print bridge script that connects
to an existing Supabase project.

It should:
1. Use @supabase/supabase-js with the SERVICE ROLE key (not the public
   anon key, since this needs elevated access to read/update print_jobs)

2. Every 2 seconds, query the print_jobs table for rows where
   status = 'pending', ordered by created_at ascending

3. For each pending job:
   - If MOCK_PRINT environment variable is 'true':
     Log the formatted receipt to the console (see formats below)
     instead of connecting to a real printer
   - If MOCK_PRINT is 'false':
     Open a TCP socket to the printer IP (from env vars
     KITCHEN_PRINTER_IP or RECEPTION_PRINTER_IP depending on job.type)
     on port 9100, send ESC/POS formatted bytes, close socket

4. After successful print (real or mock), update that print_job row:
   set status = 'sent'
   Use Supabase client: supabase.from('print_jobs').update({status: 'sent'}).eq('id', job.id)

5. On failure, update status = 'failed' and log the error
   (don't crash the whole script — keep the polling loop running)

MOCK CONSOLE OUTPUT FORMAT for a KOT job (job.type === 'kot'):
========================================
=== MOCK PRINT: KITCHEN KOT ===
========================================
Table: {tableNumber}     Round: {roundNumber}
Time: {time}
----------------------------------------
{for each item: "  {qty}x  {name}"}
========================================

MOCK CONSOLE OUTPUT FORMAT for a bill job (job.type === 'bill'):
========================================
=== MOCK PRINT: BILL ===
========================================
{restaurantName}
{address}
GSTIN: {gstin}
========================================
Table: {tableNumber}    Customer: {customerName}
========================================
{for each round: "ROUND {number} — {time}"
  then for each item: "  {qty}x {name}    ₹{price * qty}"}
========================================
Subtotal:        ₹{subtotal}
GST ({gstRate}%): ₹{gstAmount}
========================================
TOTAL:           ₹{total}
========================================
PAY VIA UPI: {upiId}
========================================
Thank you! Visit again.
========================================

Use dotenv for environment variables. Keep the script running
indefinitely with setInterval. Show the complete index.ts file
and a sample .env file with MOCK_PRINT=true and placeholder
Supabase credentials.
```

---

### TASK P2 — QR code generator for tables

**What this means:**
Generate one QR code image per table that, when scanned, takes the customer to that table's ordering page. Bundle all of them into one printable PDF.

**Prompt:**
```
Write a Node.js (TypeScript) script that generates QR codes for restaurant
tables and bundles them into a printable PDF.

Inputs (hardcode for now, or accept as command-line args):
- restaurantSlug (e.g. "taksh")
- tableCount (e.g. 10)
- baseUrl (e.g. "https://tastefy.food")

For each table number 1 to tableCount:
1. Generate a QR code (use the 'qrcode' npm package) encoding the URL:
   {baseUrl}/{restaurantSlug}/table/{tableNumber}
   Use error correction level 'H' (most durable, survives scratches
   from lamination)

2. Add it to a PDF (use 'pdfkit' npm package):
   - One QR code per page, A5 page size
   - QR code centered, roughly 250x250 px
   - Below it: "TABLE {number}" in large bold text
   - Below that: "Scan to order" in smaller text

Save the final PDF to ./output/qr-codes-{restaurantSlug}.pdf

Show the complete script, ready to run with: npx ts-node generateQR.ts
```

---

### TASK P3 — Full system QA checklist

**What this means:**
Once all 3 other devs are done, this is where you click through the entire system as if you were a real customer and a real restaurant owner, to catch bugs before going live.

**Prompt:**
```
Create a manual QA checklist for testing a restaurant ordering system
built on Next.js + Supabase, covering: customer app, admin panel, and
print bridge (in mock mode).

Write detailed step-by-step test cases for:

1. FIRST ORDER AT A TABLE
   - Open customer app, scan/visit Table 3's URL
   - Add 2 items to cart, click Place Order
   - Verify: PIN is shown
   - Fill checkout form (name only, no phone)
   - Submit
   - Verify: order confirmation screen shows correct items and PIN
   - Verify: print bridge console shows the KOT with correct table/items
   - Verify: admin dashboard shows Table 3 as ACTIVE with correct total

2. SECOND PERSON JOINS SAME TABLE
   - On a different device/browser, visit Table 3's URL again
   - Add a different item, click Place Order
   - Verify: app asks for PIN (not a new PIN)
   - Enter the correct PIN from step 1
   - Verify: order goes through, new KOT prints with round 2
   - Verify: admin dashboard shows combined total from both orders

3. WRONG PIN HANDLING
   - Try entering an incorrect PIN
   - Verify: clear error message, no order is created

4. BILL GENERATION
   - From admin dashboard, click Table 3, click Generate Bill
   - Verify: print bridge console shows bill with both rounds,
     correct subtotal, GST, and total
   - Verify: table status changes to BILL GENERATED on dashboard

5. CLOSING THE TABLE
   - Click Close Table on admin dashboard
   - Verify: table returns to OPEN status, ready for next customer

6. MENU AVAILABILITY
   - In admin panel, mark one menu item as unavailable
   - Refresh customer app — confirm item no longer appears
   - Mark available again — confirm it reappears

7. CUSTOMER DATA
   - Place an order with both name and phone filled, WhatsApp checked
   - Check admin Customers page — confirm the customer appears with
     correct opted-in status

For each test, list: exact steps, expected result, and which screen/
console to check. Format as a checklist with checkboxes.
```

---

## Day-by-Day Targets

**Day 1 — Target:**
- Database tables created in Supabase (Task S1, S2)
- All 3 Edge Functions written and deployed (E1, E2, E3) — test them directly via curl or Supabase dashboard before frontend is ready
- Print bridge running in mock mode, successfully reading test print_jobs (P1)
- Admin app scaffolded with working login (D1)

**Day 2 — Target:**
- Customer app: full order flow works end to end (C1, C2, C3)
- Admin dashboard shows live tables with Realtime updates (D2)
- A test order placed in customer app shows up instantly on admin dashboard
- A test order triggers a KOT in the print bridge console

**Day 3 — Target:**
- Menu management, customers, reports, settings pages done (D3, D4)
- QR codes generated (P2)
- Full QA pass completed (P3)
- Everything still running in mock print mode — confirmed working
- (Printer integration happens after this, as a separate final step)

---

## Common Mistakes to Avoid

1. **Don't let Dev 2 touch the existing menu/cart components more than necessary.** Only add new code for what happens after "Add to Cart." Resist the urge to "clean up" existing code — that wastes time and risks breaking what works.

2. **Use the Supabase service role key only in Edge Functions and the print bridge — never in the customer-facing app.** The service role key bypasses all security rules. If it ends up in customer-facing code, anyone could read/edit/delete all your data.

3. **Test Edge Functions directly before wiring up the frontend.** Use curl or Supabase's dashboard "Invoke function" feature to confirm they work in isolation. This saves hours of confused debugging later.

4. **Realtime subscriptions need cleanup.** When the admin dashboard component unmounts (e.g. navigating away), make sure to call `.unsubscribe()` on the channel, or you'll get duplicate events and memory leaks.

5. **Keep MOCK_PRINT=true until the very last step.** Don't connect to real printers until everything else is confirmed working — this avoids wasted paper and confused kitchen staff during testing.

6. **Snapshot prices in order_items, never recalculate from dishes later.** If the owner changes a price mid-day, old orders and bills must stay accurate to what was actually charged.

---

*Tastefy Dev Prompts v2.0 — Built on existing Next.js + Supabase — June 2026*
