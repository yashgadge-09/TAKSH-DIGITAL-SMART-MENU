-- Migration: harden security-advisor findings (applied to prod via MCP 2026-07-19)
--
-- Addresses three Supabase Security Advisor WARNs:
--   0011 function_search_path_mutable — get_recommendations / get_fallback_dishes
--   0028 anon_security_definer_function_executable      — rls_auto_enable()
--   0029 authenticated_security_definer_function_executable — rls_auto_enable()
--
-- NOT addressed here (intentional / out of scope):
--   * rls_policy_always_true on menu_views/cart_events/favourites/dish_ratings/
--     reviews/etc — these public INSERTs are required for anonymous guests.
--   * print_jobs / review_analytics "RLS enabled, no policy" — deny-all by design
--     (only the service role touches them).
--   * auth_leaked_password_protection — dashboard-only Auth setting.

-- 0011: pin search_path so it is no longer role-mutable. Unqualified table refs
-- (dishes, category_complements) keep resolving via public; anon/authenticated
-- cannot create objects in public, so the shadowing risk is closed.
alter function public.get_recommendations(uuid, text, integer) set search_path = public, pg_catalog;
alter function public.get_fallback_dishes(uuid, text, integer) set search_path = public, pg_catalog;

-- 0028/0029: rls_auto_enable() is an EVENT TRIGGER function (fires on CREATE TABLE
-- to auto-enable RLS). It must not be callable via the public REST RPC endpoint.
-- Event triggers fire independently of EXECUTE grants, so revoking these does not
-- affect auto-RLS behaviour on newly created tables.
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
