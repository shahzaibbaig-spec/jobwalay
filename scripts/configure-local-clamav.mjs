import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
const file=resolve('.env.local');
if(!existsSync(file))throw new Error('Configure the existing local Supabase project first; .env.local is required.');
const original=readFileSync(file,'utf8');
const get=name=>original.split(/\r?\n/).find(line=>line.startsWith(`${name}=`))?.slice(name.length+1).trim();
let status;
try{status=JSON.parse(execFileSync(process.execPath,[resolve('node_modules/supabase/dist/supabase.js'),'status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));}catch{throw new Error('Local Supabase status is unavailable. No settings changed; start the existing local project first.');}
if(!status.API_URL||!['localhost','127.0.0.1'].includes(new URL(status.API_URL).hostname)||get('NEXT_PUBLIC_SUPABASE_URL')!==status.API_URL||!status.SERVICE_ROLE_KEY)throw new Error('This setup only supports the already-configured local Supabase project.');
const updates={CLAMAV_HOST:'127.0.0.1',CLAMAV_PORT:'3310',CLAMAV_SCAN_TIMEOUT_MS:'30000',SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY,CLAMAV_DIAGNOSTIC_TOKEN:randomBytes(32).toString('hex')};
let result=original;const changed=[];
for(const [name,value] of Object.entries(updates)){
 const old=get(name);
 if(old){if(name==='SUPABASE_SERVICE_ROLE_KEY'&&old!==value)throw new Error('Existing service credential differs; refusing to overwrite it.');continue;}
 const line=new RegExp(`^${name}=.*$`,'m');
 if(line.test(result))result=result.replace(line,`${name}=${value}`);else result+=(result.endsWith('\n')?'':'\n')+`${name}=${value}\n`;
 changed.push(name);
}
writeFileSync(file,result,{mode:0o600});
console.log('Configured local scanner variables:',changed.join(', ')||'already present');
console.log('Existing application/public settings preserved. Secret values were not printed. No database writes performed.');
