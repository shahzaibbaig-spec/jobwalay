import 'server-only';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env/public';
import { DomainError } from '@/lib/errors';
import type { Database } from '@/types/database';
// Exceptional privileged client, isolated from normal request authorization.
// It is used ONLY to commit server-verified scan results, never for downloads.
export function documentScanner() {
  const config=z.object({host:z.string().trim().min(1),port:z.coerce.number().int().min(1).max(65535),timeout:z.coerce.number().int().min(1000).max(45000),key:z.string().min(1)}).safeParse({host:process.env.CLAMAV_HOST,port:process.env.CLAMAV_PORT??3310,timeout:process.env.CLAMAV_SCAN_TIMEOUT_MS??20000,key:process.env.SUPABASE_SERVICE_ROLE_KEY});
  if(!config.success)throw new DomainError('CV uploads are temporarily unavailable. Please try again later.');
  const client=createClient<Database>(publicEnv().url,config.data.key,{auth:{persistSession:false,autoRefreshToken:false}});
  return {host:config.data.host,port:config.data.port,timeout:config.data.timeout,async finish(document:string,hash:string,result:'clean'|'rejected'|'error'){
    const {error}=await client.rpc('finish_cv_scan',{p_document:document,p_sha256:hash,p_result:result});
    if(error)throw new DomainError('Unable to complete the CV scan. The file remains unavailable.');
  }};
}
