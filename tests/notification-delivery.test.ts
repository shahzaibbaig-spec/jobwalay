import { randomUUID } from 'node:crypto';
import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { database } from '../scripts/database-harness.mjs';
import { engineFixture,start,acting,value } from './helpers/engine-fixture';
import { notificationEmail,notificationText } from '../src/modules/notifications/email-content.mjs';
let db:PGlite;beforeAll(async()=>{db=await database();},30000);afterAll(async()=>{await db?.close();});
type Claim={id:string;token:string;recipient:string;kind:string};
async function worker(){await db.exec('reset role;set role service_role');}
async function enqueue(){const f=await engineFixture(db);await db.query('select public.set_notification_preferences(true)');const attempt=await start(db,f);await db.query('select public.submit_assessment_attempt($1)',[attempt]);return f;}
describe('notification delivery authorization, leases and retries',()=>{
 it('defaults to no email and never grants ordinary users worker access',async()=>{
  const f=await engineFixture(db);const attempt=await start(db,f);await db.query('select public.submit_assessment_attempt($1)',[attempt]);await expect(db.query('select public.claim_notification_emails()')).rejects.toThrow(/permission denied/);await expect(db.query('select * from private.notification_emails')).rejects.toThrow(/permission denied/);await worker();expect(await value(db,'select public.claim_notification_emails() as value')).toEqual([]);
 });
 it('claims once, requires the correct lease and records provider acceptance without a second claim',async()=>{
  const f=await enqueue();await worker();const claims=await value<Claim[]>(db,'select public.claim_notification_emails() as value');expect(claims).toHaveLength(1);const item=claims[0];expect(item.recipient).toBe(`${f.candidate}@example.test`);expect(await value(db,'select public.claim_notification_emails() as value')).toEqual([]);
  await expect(db.query('select public.complete_notification_email($1,$2,true,$3)',[item.id,randomUUID(),'provider-id'])).rejects.toThrow(/lease/);await db.query('select public.complete_notification_email($1,$2,true,$3)',[item.id,item.token,'provider-id']);expect(await value(db,'select public.claim_notification_emails() as value')).toEqual([]);
  await db.exec('reset role');expect(await value<string>(db,'select state as value from private.notification_emails where id=$1',[item.id])).toBe('sent');
 });
 it('bounds retries and expires the delivery horizon before provider idempotency keys expire',async()=>{
  await enqueue();await worker();const [item]=await value<Claim[]>(db,'select public.claim_notification_emails() as value');await db.query('select public.complete_notification_email($1,$2,false)',[item.id,item.token]);expect(await value(db,'select public.claim_notification_emails() as value')).toEqual([]);
  await db.exec('reset role');await db.query("update private.notification_emails set available_at=clock_timestamp()-interval '1 second',created_at=clock_timestamp()-interval '24 hours' where id=$1",[item.id]);await worker();expect(await value(db,'select public.claim_notification_emails() as value')).toEqual([]);await db.exec('reset role');expect(await value<string>(db,'select state as value from private.notification_emails where id=$1',[item.id])).toBe('dead');
 });
 it('rechecks preferences, membership and verification before delivery',async()=>{
  const f=await enqueue();await db.query('select public.set_notification_preferences(false)');await worker();expect(await value(db,'select public.claim_notification_emails() as value')).toEqual([]);
  await acting(db,f.owner);await db.query('select public.set_notification_preferences(true)');await db.exec('reset role');await db.query("insert into public.user_notifications(user_id,organization_id,audience,kind,event_key) values($1,$2,'employer','organization_update',$3)",[f.owner,f.org,randomUUID()]);await db.query("update public.memberships set status='revoked' where organization_id=$1 and user_id=$2",[f.org,f.owner]);await worker();expect(await value(db,'select public.claim_notification_emails() as value')).toEqual([]);
  await acting(db,f.outsider);expect(await value<number>(db,'select count(*)::int as value from public.notification_preferences where user_id=$1',[f.owner])).toBe(0);
 });
});
describe('generic versioned email templates',()=>{
 it('treats prototype property names as unknown notification types',()=>{for(const kind of ['__proto__','toString','constructor'])expect(notificationText(kind)).toBe('A recruitment update is available.');});
 it('contains only safe sign-in/preferences links and ignores unknown kinds as content',()=>{const template=notificationEmail('<script>secret-score</script>','https://jobs.example');expect(template.html).not.toContain('secret-score');expect(template.html).not.toContain('<script>');expect(template.text).toContain('https://jobs.example/notifications');expect(template.text).toContain('https://jobs.example/account/notifications');expect(template.subject).not.toContain('\n');});
 it('rejects unsafe, credential-bearing and non-origin URLs',()=>{for(const url of ['javascript:alert(1)','http://untrusted.example','https://user:password@jobs.example','https://jobs.example/path?token=private'])expect(()=>notificationEmail('assessment_result',url)).toThrow();});
});
