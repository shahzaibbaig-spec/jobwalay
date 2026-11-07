import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
const mock=vi.hoisted(()=>({client:vi.fn(),rpc:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@supabase/supabase-js',()=>({createClient:mock.client}));
vi.mock('@/lib/env/public',()=>({publicEnv:()=>({url:'http://127.0.0.1:54321',key:'public-test-key'})}));
import { documentScanner } from '../src/server/document-scanner';
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('CLAMAV_HOST','127.0.0.1');vi.stubEnv('CLAMAV_PORT','3310');vi.stubEnv('CLAMAV_SCAN_TIMEOUT_MS','30000');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','server-test-key');mock.rpc.mockResolvedValue({error:null});mock.client.mockReturnValue({rpc:mock.rpc});});afterEach(()=>vi.unstubAllEnvs());
describe('server-only scanner configuration and commit boundary',()=>{
 it('requires scanner host and a nonempty privileged result-commit credential',()=>{vi.stubEnv('CLAMAV_HOST','');expect(()=>documentScanner()).toThrow(/unavailable/);vi.stubEnv('CLAMAV_HOST','127.0.0.1');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','');expect(()=>documentScanner()).toThrow(/unavailable/);expect(mock.client).not.toHaveBeenCalled();});
 it('rejects invalid ports and unsafe timeout values',()=>{for(const value of ['0','65536','not-a-port']){vi.stubEnv('CLAMAV_PORT',value);expect(()=>documentScanner()).toThrow(/unavailable/);}vi.stubEnv('CLAMAV_PORT','3310');for(const value of ['0','45001','NaN']){vi.stubEnv('CLAMAV_SCAN_TIMEOUT_MS',value);expect(()=>documentScanner()).toThrow(/unavailable/);}});
 it('keeps privileged access limited to scan-result completion with no persisted Auth session',async()=>{const scanner=documentScanner();expect(scanner.timeout).toBe(30000);expect(mock.client).toHaveBeenCalledWith('http://127.0.0.1:54321','server-test-key',{auth:{persistSession:false,autoRefreshToken:false}});await scanner.finish('document-id','hash','rejected');expect(mock.rpc).toHaveBeenCalledWith('finish_cv_scan',{p_document:'document-id',p_sha256:'hash',p_result:'rejected'});});
 it('fails closed if the result cannot be committed',async()=>{mock.rpc.mockResolvedValue({error:{code:'unavailable'}});await expect(documentScanner().finish('document-id','hash','clean')).rejects.toThrow(/remains unavailable/);});
});
