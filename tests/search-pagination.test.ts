import { beforeAll,afterAll,it,expect } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { database } from '../scripts/database-harness.mjs';
import { engineFixture } from './helpers/engine-fixture';
let db:PGlite;beforeAll(async()=>{db=await database();},30000);afterAll(async()=>{await db?.close();});
it('paginates public job timestamp ties without duplicates and excludes restricted/expired records under anon RLS',async()=>{
 const f=await engineFixture(db);await db.exec('reset role');
 await db.query("insert into public.jobs(organization_id,title,description,location,work_mode,job_type,status,published_at) select $1,'Pagination engineer '||n,'A synthetic description for public search and pagination testing.', 'Karachi','remote','full_time','published','2026-01-01T00:00:00Z' from generate_series(1,25) n",[f.org]);
 for(const [status,moderation,deadline] of [['draft','visible',null],['closed','visible',null],['published','hidden',null],['published','visible','2000-01-01']])await db.query("insert into public.jobs(organization_id,title,description,location,work_mode,job_type,status,moderation_status,application_deadline,published_at) values($1,'Restricted record','A synthetic restricted job must not be discovered publicly.','Karachi','remote','full_time',$2,$3,$4,clock_timestamp())",[f.org,status,moderation,deadline]);
 await db.exec('set role anon');const first=(await db.query<{id:string;at:string;title:string}>('select id,published_at::text as at,title from public.jobs where organization_id=$1 order by published_at desc,id desc limit 21',[f.org])).rows;expect(first).toHaveLength(21);const page=first.slice(0,20),cursor=page[19];
 const next=(await db.query<{id:string;title:string}>('select id,title from public.jobs where organization_id=$1 and (published_at,id)<($2::timestamptz,$3::uuid) order by published_at desc,id desc limit 21',[f.org,cursor.at,cursor.id])).rows;expect(next).toHaveLength(6);expect(new Set([...page,...next].map(j=>j.id)).size).toBe(26);expect([...page,...next].some(j=>j.title==='Restricted record')).toBe(false);
});
