import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const tests=['tests/cv-scanner.test.ts','tests/cv-protocol-security.test.ts','tests/cv-upload-security.test.ts','tests/scanner-config.test.ts','tests/clamav-diagnostic.test.ts','tests/clamav-live.test.ts'];
const result=spawnSync(process.execPath,[resolve('node_modules/vitest/vitest.mjs'),'run',...tests],{stdio:'inherit',windowsHide:true,env:{...process.env,TEST_CLAMAV_LIVE:'true'}});process.exitCode=result.status??1;
