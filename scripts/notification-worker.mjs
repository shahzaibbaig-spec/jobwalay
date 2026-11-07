import { createClient } from '@supabase/supabase-js';
import { notificationEmail } from '../src/modules/notifications/email-content.mjs';
const env=process.env;
if(env.EMAIL_DELIVERY_ENABLED!=='true')throw new Error('Email delivery is disabled. Enable only after validating the provider and consent setup.');
if(!env.NEXT_PUBLIC_SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY||!env.RESEND_API_KEY||!env.APP_URL||!env.EMAIL_FROM||!/^\S+@[^\s@]+\.[^\s@]+$/.test(env.EMAIL_FROM)||/[\r\n<>]/.test(env.EMAIL_FROM))throw new Error('Configure the isolated email worker environment');
notificationEmail('validation',env.APP_URL); // Validate origin before claiming any work.
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
let stopped=false;process.on('SIGINT',()=>{stopped=true;});process.on('SIGTERM',()=>{stopped=true;});
do{
 const {data,error}=await db.rpc('claim_notification_emails',{p_limit:10});
 if(error)console.error('Email claim failed:',error.code??'unknown');
 else for(const item of data??[]){
  let success=false,providerId=null;
  try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`notification-v1/${item.id}`},body:JSON.stringify({from:env.EMAIL_FROM,to:[item.recipient],...notificationEmail(item.kind,env.APP_URL)}),signal:AbortSignal.timeout(15000)});if(response.ok){const body=await response.json();if(typeof body.id==='string'&&body.id.length<=200){success=true;providerId=body.id;}}}catch{/* Deliberately do not log recipients, credentials or provider bodies. */}
  const {error:completion}=await db.rpc('complete_notification_email',{p_id:item.id,p_token:item.token,p_success:success,p_provider_id:providerId});
  if(completion)console.error('Email receipt not committed:',completion.code??'unknown');else console.log('Email processing completed:',success?'provider_accepted':'retry_or_dead');
 }
 if(process.argv.includes('--once')||stopped)break;
 await new Promise(resolve=>setTimeout(resolve,15000));
}while(!stopped);
