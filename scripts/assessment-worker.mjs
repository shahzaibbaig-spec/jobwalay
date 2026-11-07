import { createClient } from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Configure the server-only Supabase worker environment');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
let stop=false;process.on('SIGINT',()=>{stop=true;});process.on('SIGTERM',()=>{stop=true;});
do{
 const {data,error}=await db.rpc('process_assessment_expiry',{p_limit:50});
 if(error)console.error('Assessment expiry tick failed:',error.code??'unknown');else console.log('Assessment expiry tick completed:',data);
 if(process.argv.includes('--once'))break;
 await new Promise(r=>setTimeout(r,15_000));
}while(!stop);
