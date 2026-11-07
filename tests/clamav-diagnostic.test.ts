import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
const mock=vi.hoisted(()=>({scanner:vi.fn(),ping:vi.fn(),scan:vi.fn(),version:vi.fn(),finish:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/env/server',()=>({appUrl:()=> 'http://localhost:3001'}));
vi.mock('@/server/document-scanner',()=>({documentScanner:mock.scanner}));
vi.mock('@/modules/documents/server/scan',async importOriginal=>({...await importOriginal<typeof import('../src/modules/documents/server/scan')>(),pingScanner:mock.ping,scanCv:mock.scan,scannerVersion:mock.version}));
import { scannerDiagnostic } from '../src/modules/documents/server/diagnostic';
const token='a'.repeat(64);
const request=(key=token,origin='http://localhost:3001',host='localhost')=>new Request(`http://${host}:3001/api/internal/clamav`,{method:'POST',headers:{'x-clamav-diagnostic-token':key,origin}});
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('NODE_ENV','development');vi.stubEnv('CLAMAV_DIAGNOSTIC_TOKEN',token);mock.scanner.mockReturnValue({host:'127.0.0.1',port:3310,finish:mock.finish});mock.ping.mockResolvedValue(undefined);mock.version.mockResolvedValue('ClamAV 1.5.4/123/test');mock.scan.mockReset().mockResolvedValueOnce('clean').mockResolvedValueOnce('rejected').mockResolvedValueOnce('rejected');});afterEach(()=>vi.unstubAllEnvs());
describe('safe actual-backend scanner diagnostic',()=>{
 it('runs only fixed memory fixtures and never commits a scan result',async()=>{const r=await scannerDiagnostic(request());expect(r.status).toBe(200);expect(await r.json()).toMatchObject({clean:'clean',infected:'rejected',eicar:'rejected',databaseWrites:0,runtime:'nodejs'});expect(mock.finish).not.toHaveBeenCalled();expect(r.headers.get('cache-control')).toContain('no-store');});
 it('is disabled in production even when a token exists',async()=>{vi.stubEnv('NODE_ENV','production');expect((await scannerDiagnostic(request())).status).toBe(404);expect(mock.scanner).not.toHaveBeenCalled();});
 it('rejects absent/wrong tokens, remote hosts and cross-origin requests',async()=>{expect((await scannerDiagnostic(request(''))).status).toBe(404);expect((await scannerDiagnostic(request('wrong'))).status).toBe(404);expect((await scannerDiagnostic(request(token,'http://localhost:3001','external.test'))).status).toBe(404);expect((await scannerDiagnostic(request(token,'https://attacker.invalid'))).status).toBe(403);expect(mock.scanner).not.toHaveBeenCalled();});
 it('fails closed for connection failures and unexpected clean EICAR responses',async()=>{mock.ping.mockRejectedValueOnce(new Error('offline'));const offline=await scannerDiagnostic(request());expect(offline.status).toBe(503);expect(await offline.json()).toMatchObject({uploads:'blocked',databaseWrites:0});mock.scan.mockReset().mockResolvedValue('clean');const unsafe=await scannerDiagnostic(request());expect(unsafe.status).toBe(503);expect(mock.finish).not.toHaveBeenCalled();});
});
