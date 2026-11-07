import { describe,it,expect,vi } from 'vitest';
import { createHash } from 'node:crypto';
vi.mock('server-only',()=>({}));
import { scanCv,validateCv,pingScanner,scannerVersion } from '../src/modules/documents/server/scan';
import { cleanPdfFixture,infectedPdfFixture,antivirusTestBytes } from '../src/modules/documents/server/scan-fixtures';
const enabled=process.env.TEST_CLAMAV_LIVE==='true';
const connection={host:process.env.CLAMAV_HOST??'127.0.0.1',port:Number(process.env.CLAMAV_PORT??3310),timeout:Number(process.env.CLAMAV_SCAN_TIMEOUT_MS??30000)};
describe.skipIf(!enabled)('real local ClamAV engine (memory-only fixtures, no database or Storage)',()=>{
 it('responds to PING and provides a loaded engine/signature version',async()=>{expect(['127.0.0.1','localhost']).toContain(connection.host);await pingScanner(connection);expect(await scannerVersion(connection)).toMatch(/^ClamAV .*\/\d+\//);},45000);
 it('accepts the clean PDF through the same INSTREAM client as uploads',async()=>{const pdf=cleanPdfFixture();validateCv(pdf);expect(await scanCv(pdf,connection)).toBe('clean');},45000);
 it('rejects the canonical harmless EICAR marker and a PDF containing it',async()=>{const marker=antivirusTestBytes();expect(marker.length).toBe(68);expect(createHash('md5').update(marker).digest('hex')).toBe('44d88612fea8a8f36de82e1278abb02f');expect(await scanCv(marker,connection)).toBe('rejected');const pdf=infectedPdfFixture();validateCv(pdf);expect(await scanCv(pdf,connection)).toBe('rejected');},45000);
});
