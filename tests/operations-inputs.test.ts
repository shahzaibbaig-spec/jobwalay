import { describe,it,expect } from 'vitest';
import { adminOperation,abuseSchema,pageFilter,analyticsFilter } from '../src/modules/administration/schemas';
import { cursorSchema } from '../src/modules/jobs/schemas';
const id='11111111-1111-4111-8111-111111111111';
describe('administration and discovery input boundaries',()=>{
 it('refuses role escalation, arbitrary tenant fields and unreasoned decisions',()=>{const valid={operation:'account',id,status:'suspended',reason:'Independent operational review'};expect(adminOperation.safeParse(valid).success).toBe(true);for(const input of [{...valid,role:'platform_admin'},{...valid,organization_id:id},{...valid,reason:'bad'},{...valid,status:'administrator'}])expect(adminOperation.safeParse(input).success).toBe(false);expect(adminOperation.safeParse({operation:'job',id,hidden:true,version:1,reason:'An independently reviewed listing'}).success).toBe(true);});
 it('bounds reports, directory pages and analytics periods',()=>{expect(abuseSchema.safeParse({jobId:id,category:'other',details:'A short but valid report',reporter_id:id}).success).toBe(false);expect(pageFilter.safeParse({page:10001}).success).toBe(false);expect(analyticsFilter.safeParse({days:366}).success).toBe(false);});
 it('rejects forged cursor expressions and accepts stable timestamp/UUID ties',()=>{expect(cursorSchema.safeParse({at:'2026-10-28T00:00:00+00:00',id}).success).toBe(true);for(const value of [{at:'2026-10-28T00:00:00Z),id.gt.anything',id},{at:'2026-10-28T00:00:00Z',id:'id.eq.injected'}])expect(cursorSchema.safeParse(value).success).toBe(false);});
});
