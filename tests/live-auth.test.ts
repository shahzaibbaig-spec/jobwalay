import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { randomBytes } from 'node:crypto';
// Deliberately opt-in: these credentials belong only to an ephemeral local project.
const enabled = Boolean(process.env.TEST_SUPABASE_SERVICE_ROLE_KEY);
describe.skipIf(!enabled)('local Supabase Auth and HTTP authorization', () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  const app = process.env.TEST_APP_URL ?? 'http://localhost:3000';
  const admin = createClient(url,process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? 'not-configured',{ auth:{ persistSession:false,autoRefreshToken:false } });
  const password = randomBytes(24).toString('hex');
  const suffix = randomBytes(8).toString('hex');
  const users: string[]=[];
  let aliceCookie=''; let bobOrg='';
  let alice: ReturnType<typeof createServerClient>;
  beforeAll(async () => {
    if (!['localhost','127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Live fixtures are restricted to local Supabase');
    for (const name of ['alice','bob']) {
      const email=`${name}-${suffix}@example.test`;
      const { data,error }=await admin.auth.admin.createUser({ email,password,email_confirm:true });
      if(error || !data.user) throw new Error('Unable to provision local fixture');
      users.push(data.user.id);
      const jar=new Map<string,string>();
      const client=createServerClient(url,key,{ cookies:{ getAll:()=>Array.from(jar,([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value)) } });
      const { error: signInError }=await client.auth.signInWithPassword({email,password});
      if(signInError) throw signInError;
      const { error: onboardError }=await client.rpc('complete_onboarding',{ p_name:name });
      if(onboardError) throw onboardError;
      const { error: profileError }=await client.rpc('save_candidate_profile',{p_headline:`${name} candidate`,p_bio:'Private fixture profile'});
      if(profileError) throw profileError;
      if(name==='bob') {
        const { data: org,error: orgError }=await client.rpc('register_organization',{p_name:'Live Bob Organization'});
        if(orgError) throw orgError;
        bobOrg=org;
      } else { alice=client; aliceCookie=Array.from(jar,([name,value])=>`${name}=${encodeURIComponent(value)}`).join('; '); }
    }
  },30000);
  afterAll(async () => {
    // Accounts retain audited history by design, so rollback fixtures using a local-only SQL reset.
    // Sign out fixtures; `supabase db reset` removes their account/audit data after the suite.
    for(const id of users) {
      await admin.from('accounts').update({status:'suspended'}).eq('id',id);
    }
  });
  it('redirects unauthenticated dashboard requests at the server',async () => {
    for(const route of ['/dashboard','/candidate',`/org/${bobOrg}`,`/org/${bobOrg}/admin`,'/admin']) {
      const response=await fetch(`${app}${route}`,{redirect:'manual'});
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/login');
    }
  },30000);
  it('requires email verification and supports recovery-token password updates',async () => {
    const email=`verification-${suffix}@example.test`;
    const client=createClient(url,key,{ auth:{persistSession:false,autoRefreshToken:false} });
    const {data: link,error}=await admin.auth.admin.generateLink({type:'signup',email,password});
    if(error) throw error;
    users.push(link.user.id);
    expect((await client.auth.signInWithPassword({email,password})).error).not.toBeNull();
    const verified=await client.auth.verifyOtp({type:'email',token_hash:link.properties.hashed_token});
    expect(verified.error).toBeNull();
    expect(verified.data.user?.email_confirmed_at).toBeTruthy();
    await client.auth.signOut();
    const {data: recovery,error: recoveryError}=await admin.auth.admin.generateLink({type:'recovery',email});
    if(recoveryError) throw recoveryError;
    expect((await client.auth.verifyOtp({type:'recovery',token_hash:recovery.properties.hashed_token})).error).toBeNull();
    const newPassword=randomBytes(24).toString('hex');
    expect((await client.auth.updateUser({password:newPassword})).error).toBeNull();
    await client.auth.signOut({scope:'global'});
    expect((await client.auth.signInWithPassword({email,password})).error).not.toBeNull();
    expect((await client.auth.signInWithPassword({email,password:newPassword})).error).toBeNull();
    await client.auth.signOut({scope:'global'});
  },30000);
  it('serves own dashboard but rejects foreign tenant routes and platform admin',async () => {
    const own=await fetch(`${app}/dashboard`,{headers:{cookie:aliceCookie},redirect:'manual'});
    expect(own.status).toBe(200);
    expect(own.headers.get('cache-control')).toContain('no-store');
    for(const route of [`/org/${bobOrg}`,`/org/${bobOrg}/admin`,'/admin']) {
      const response=await fetch(`${app}${route}`,{headers:{cookie:aliceCookie},redirect:'manual'});
      expect(response.status).toBe(404);
    }
  },30000);
  it('enforces tenant isolation on the live Data API, and revoked session access',async () => {
    const {data,error}=await alice.from('organizations').select('id').eq('id',bobOrg);
    expect(error).toBeNull(); expect(data).toEqual([]);
    const other=await alice.from('candidate_profiles').select('user_id').eq('user_id',users[1]);
    expect(other.error).toBeNull(); expect(other.data).toEqual([]);
    await alice.auth.signOut({scope:'global'});
    const response=await fetch(`${app}/dashboard`,{headers:{cookie:aliceCookie},redirect:'manual'});
    expect(response.status).toBe(307);
  },30000);
});
