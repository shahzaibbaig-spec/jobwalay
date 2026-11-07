import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
// Capture locally printed admin credentials in memory; never echo or write them.
const raw=execFileSync(process.execPath,[resolve('node_modules/supabase/dist/supabase.js'),'status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const status=JSON.parse(raw);
const url=status.API_URL;
if (!url || !['localhost','127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Only a local Supabase project is supported');
const key=status.ANON_KEY ?? status.PUBLISHABLE_KEY;
if(!key) throw new Error('Local public key unavailable');
if(process.argv[2]==='setup') {
  if(existsSync('.env.local')) throw new Error('.env.local already exists; review it manually rather than overwriting');
  writeFileSync('.env.local',`NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}\nAPP_URL=http://localhost:3000\n`);
  console.log('Created .env.local with local public configuration only.');
} else if(process.argv[2]==='test') {
  if(!status.SERVICE_ROLE_KEY) throw new Error('Local test-only service role key unavailable');
  const result=spawnSync(process.execPath,[resolve('node_modules/vitest/vitest.mjs'),'run','tests/live-auth.test.ts'],{stdio:'inherit',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key,TEST_SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY}});
  process.exit(result.status ?? 1);
} else throw new Error('Expected setup or test');
