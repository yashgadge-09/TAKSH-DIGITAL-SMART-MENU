/**
 * Server-side environment validation.
 *
 * Critical secrets (Supabase URL, keys) have no safe default — the server must
 * refuse to run rather than start in a broken/insecure state. `requireServerEnv`
 * throws a clear, named error at the point of use (module load of the DB client),
 * so a missing variable fails loudly instead of surfacing as a cryptic runtime
 * error deep in a request.
 */

export function requireServerEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `[env] Missing required environment variable: ${name}. ` +
        `The server refuses to start without it — see .env.example.`
    );
  }
  return value;
}

/** Optional var with a documented default. */
export function optionalEnv(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}
