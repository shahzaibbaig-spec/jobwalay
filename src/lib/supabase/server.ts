import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnv } from '@/lib/env/public';
import type { Database } from '@/types/database';
export async function createClient() {
  const jar = await cookies();
  const env = publicEnv();
  return createServerClient<Database>(env.url, env.key, {
    cookieOptions: { sameSite: 'lax', secure: process.env.NODE_ENV === 'production', httpOnly: true },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); }
        catch { /* Server Components cannot write cookies; proxy refreshes them. */ }
      },
    },
  });
}
