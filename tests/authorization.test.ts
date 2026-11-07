import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { database } from '../scripts/database-harness.mjs';
import { credentialsSchema } from '../src/modules/identity/schemas';
import { canManageTeam, inviteSchema } from '../src/modules/organizations/schemas';
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const carol = '33333333-3333-4333-8333-333333333333';
const unverified = '44444444-4444-4444-8444-444444444444';
let db: PGlite; let orgA: string; let orgB: string;
async function as(user: string, aal = 'aal1') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,aal,session_id:user})]);
  await db.exec('set role authenticated');
}
async function scalar<T>(sql: string, params: unknown[] = []) { return (await db.query<{ value:T }>(sql,params)).rows[0].value; }
beforeAll(async () => {
  db=await database();
  for (const [id,email] of [[alice,'alice@example.com'],[bob,'bob@example.com'],[carol,'carol@example.com']]) await db.query('insert into auth.users values($1,$2,now())',[id,email]);
  await db.query('insert into auth.users values($1,$2,null)',[unverified,'unverified@example.com']);
  await db.exec('insert into auth.sessions(id,user_id) select id,id from auth.users');
  await as(alice);
  await db.query("select public.complete_onboarding('Alice')");
  await db.query("select public.save_candidate_profile('Engineer','Private Alice bio')");
  orgA=await scalar<string>("select public.register_organization('Alice Inc') as value");
  await as(bob);
  orgB=await scalar<string>("select public.register_organization('Bob Inc') as value");
  await db.query("select public.save_candidate_profile('Designer','Private Bob bio')");
},30000);
afterAll(async () => { await db?.close(); });
describe('PostgreSQL RLS with actual authenticated and anonymous roles', () => {
  it('does not let Alice read Bob’s account or candidate records',async () => {
    await as(alice);
    expect(await scalar<number>('select count(*)::int as value from public.accounts where id=$1',[bob])).toBe(0);
    expect(await scalar<number>('select count(*)::int as value from public.candidate_profiles where user_id=$1',[bob])).toBe(0);
    expect(await scalar<number>('select count(*)::int as value from public.candidate_profiles')).toBe(1);
  });
  it('does not let Alice read another tenant’s organization, memberships or audit',async () => {
    await as(alice);
    for (const table of ['organizations','memberships','audit_events']) {
      const column=table==='organizations'?'id':'organization_id';
      expect(await scalar<number>(`select count(*)::int as value from public.${table} where ${column}=$1`,[orgB])).toBe(0);
    }
  });
  it('denies direct private writes, role escalation, verification changes and audit tampering',async () => {
    await as(alice);
    await expect(db.query("update public.candidate_profiles set bio='hacked' where user_id=$1",[bob])).rejects.toThrow(/permission denied/);
    await expect(db.query("update public.memberships set role='owner' where user_id=$1",[bob])).rejects.toThrow(/permission denied/);
    await expect(db.query("update public.organizations set verification_status='approved' where id=$1",[orgA])).rejects.toThrow(/permission denied/);
    await expect(db.exec('delete from public.audit_events')).rejects.toThrow(/permission denied/);
    await expect(db.query('insert into private.platform_administrators(user_id) values($1)',[alice])).rejects.toThrow(/permission denied/);
  });
  it('rejects cross-tenant invitations even through direct RPC',async () => {
    await as(alice);
    await expect(db.query("select public.invite_member($1,'carol@example.com','recruiter',$2)",[orgB,'a'.repeat(64)])).rejects.toThrow(/Not permitted/);
    await expect(db.query("select public.invite_member($1,'carol@example.com','owner',$2)",[orgA,'a'.repeat(64)])).rejects.toThrow(/Invalid invitation/);
  });
  it('binds invitation to verified email, prevents replay, and supports multiple organizations plus candidate profile',async () => {
    await as(alice);
    await db.query("select public.invite_member($1,'bob@example.com','recruiter',$2)",[orgA,'b'.repeat(64)]);
    await expect(db.exec('select token_hash from public.organization_invitations')).rejects.toThrow(/permission denied/);
    await as(carol);
    await expect(db.query('select public.accept_invitation($1)',['b'.repeat(64)])).rejects.toThrow(/Invalid/);
    await as(bob);
    await db.query('select public.accept_invitation($1)',['b'.repeat(64)]);
    await expect(db.query('select public.accept_invitation($1)',['b'.repeat(64)])).rejects.toThrow(/Invalid/);
    expect(await scalar<number>('select count(*)::int as value from public.memberships where user_id=$1',[bob])).toBe(2);
    expect(await scalar<number>('select count(*)::int as value from public.candidate_profiles')).toBe(1);
    // Recruiters cannot enumerate colleagues or invitations, or invite another member.
    expect(await scalar<number>('select count(*)::int as value from public.memberships where organization_id=$1',[orgA])).toBe(1);
    expect(await scalar<number>('select count(*)::int as value from public.organization_invitations where organization_id=$1',[orgA])).toBe(0);
    await expect(db.query("select public.invite_member($1,'carol@example.com','admin',$2)",[orgA,'c'.repeat(64)])).rejects.toThrow(/Not permitted/);
  });
  it('revoked membership immediately loses access without waiting for JWT expiry',async () => {
    await as(alice);
    const id=await scalar<string>('select id as value from public.memberships where user_id=$1 and organization_id=$2',[bob,orgA]);
    await db.query('select public.revoke_member($1,$2)',[orgA,id]);
    await as(bob);
    expect(await scalar<number>('select count(*)::int as value from public.organizations where id=$1',[orgA])).toBe(0);
  });
  it('protects ownership and rejects expired invitations',async () => {
    await as(alice);
    const id=await scalar<string>('select id as value from public.memberships where user_id=$1 and organization_id=$2',[alice,orgA]);
    await expect(db.query('select public.revoke_member($1,$2)',[orgA,id])).rejects.toThrow(/Cannot revoke/);
    await db.query("select public.invite_member($1,'carol@example.com','recruiter',$2)",[orgA,'d'.repeat(64)]);
    await db.exec('reset role');
    await db.query("update public.organization_invitations set expires_at=now()-interval '1 minute' where token_hash=$1",['d'.repeat(64)]);
    await as(carol);
    await expect(db.query('select public.accept_invitation($1)',['d'.repeat(64)])).rejects.toThrow(/Invalid/);
  });
  it('requires platform role AND MFA and never grants private candidate access to administrators',async () => {
    await as(carol,'aal2');
    expect(await scalar<boolean>('select private.is_platform_admin() as value')).toBe(false);
    await db.exec('reset role');
    await db.query('insert into private.platform_administrators(user_id) values($1)',[carol]);
    await as(carol);
    expect(await scalar<boolean>('select private.is_platform_admin() as value')).toBe(false);
    await as(carol,'aal2');
    expect(await scalar<boolean>('select private.is_platform_admin() as value')).toBe(true);
    expect(await scalar<number>('select count(*)::int as value from public.organizations')).toBe(2);
    expect(await scalar<number>('select count(*)::int as value from public.candidate_profiles')).toBe(0);
  });
  it('denies unverified, suspended, and anonymous identities',async () => {
    await as(unverified);
    await expect(db.exec("select public.register_organization('Unverified Inc')")).rejects.toThrow(/Not permitted/);
    await db.exec('reset role');
    await db.query("update public.accounts set status='suspended' where id=$1",[bob]);
    await as(bob);
    expect(await scalar<number>('select count(*)::int as value from public.candidate_profiles')).toBe(0);
    await expect(db.exec("select public.save_candidate_profile('No','No')")).rejects.toThrow(/Not permitted/);
    await db.exec('reset role; set role anon');
    await expect(db.exec('select * from public.candidate_profiles')).rejects.toThrow(/permission denied/);
    await expect(db.exec("select public.register_organization('Anonymous Inc')")).rejects.toThrow(/permission denied/);
  });
  it('denies a revoked session even when its JWT has not expired',async () => {
    await db.exec('reset role');
    await db.query('delete from auth.sessions where user_id=$1',[alice]);
    await as(alice);
    expect(await scalar<number>('select count(*)::int as value from public.accounts')).toBe(0);
    await expect(db.exec("select public.register_organization('Revoked session')")).rejects.toThrow(/Not permitted/);
  });
});
describe('input and permission contracts',() => {
  it('rejects weak passwords and privileged invitation roles',() => {
    expect(credentialsSchema.safeParse({email:'user@example.com',password:'short'}).success).toBe(false);
    expect(inviteSchema.safeParse({organizationId:alice,email:'x@example.com',role:'owner'}).success).toBe(false);
    expect(canManageTeam('recruiter')).toBe(false);
    expect(canManageTeam('admin')).toBe(true);
  });
});
