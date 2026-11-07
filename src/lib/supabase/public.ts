import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env/public';
import type { Database } from '@/types/database';
// Never reuse a signed-in client's broader RLS permissions for public discovery.
export function publicClient() {
  const env=publicEnv();
  return createClient<Database>(env.url,env.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store'})}});
}
