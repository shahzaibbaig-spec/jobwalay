import { beforeAll,afterAll,it,expect } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { database } from '../scripts/database-harness.mjs';
import { engineFixture,start,answerAll,acting,value } from './helpers/engine-fixture';
let db:PGlite;beforeAll(async()=>{db=await database();},30000);afterAll(async()=>{await db?.close();});
it('completes a migration-backed hiring journey from published job and scan-gated application to reviewed hire and notifications',async()=>{
 const f=await engineFixture(db);const attempt=await start(db,f);await answerAll(db,attempt);await db.query('select public.submit_assessment_attempt($1)',[attempt]);expect(await value<string>(db,'select status as value from public.applications where id=$1',[f.application])).toBe('shortlisted');
 await acting(db,f.owner);for(const stage of ['interview','offer','hired']){const version=await value<number>(db,'select version as value from public.applications where id=$1',[f.application]);await db.query('select public.transition_application($1,$2,$3,$4,$5)',[f.org,f.application,version,stage,`Hiring process moved to ${stage}`]);}
 const analytics=await value<{stages:Record<string,number>;outcomes:Record<string,number>}>(db,'select public.recruitment_analytics($1) as value',[f.org]);expect(analytics.stages.hired).toBe(1);expect(analytics.outcomes.passed).toBe(1);
 await acting(db,f.candidate);expect(await value<string>(db,'select status as value from public.applications where id=$1',[f.application])).toBe('hired');expect(await value<number>(db,"select count(*)::int as value from public.application_events where application_id=$1 and to_status in ('shortlisted','interview','offer','hired')",[f.application])).toBe(4);expect(await value<number>(db,"select count(*)::int as value from public.user_notifications where application_id=$1 and kind='application_status'",[f.application])).toBeGreaterThanOrEqual(4);
 await acting(db,f.outsider);expect(await value<number>(db,'select count(*)::int as value from public.applications where id=$1',[f.application])).toBe(0);
},15000);
