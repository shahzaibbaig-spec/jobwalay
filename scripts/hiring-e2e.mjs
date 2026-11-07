import { execFileSync,spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
let status;
try{status=JSON.parse(execFileSync(process.execPath,[resolve('node_modules/supabase/dist/supabase.js'),'status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));}catch{console.error('Live hiring E2E unavailable: start isolated local Supabase and ClamAV, apply migrations, and configure the app. No browser hiring success is claimed.');process.exit(1);}
if(!status.API_URL||!status.DB_URL||!status.SERVICE_ROLE_KEY||!['localhost','127.0.0.1'].includes(new URL(status.API_URL).hostname))throw new Error('Local hiring fixtures require loopback Supabase');
const result=spawnSync(process.execPath,[resolve('node_modules/@playwright/test/cli.js'),'test','e2e/hiring-workflow.spec.ts'],{stdio:'inherit',windowsHide:true,env:{...process.env,TEST_HIRING_E2E:'true',NEXT_PUBLIC_SUPABASE_URL:status.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:status.ANON_KEY??status.PUBLISHABLE_KEY,TEST_SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY,TEST_DATABASE_URL:status.DB_URL}});process.exitCode=result.status??1;
