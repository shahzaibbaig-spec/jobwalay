import { defineConfig } from 'vitest/config';
import path from 'node:path';
// Each database suite loads its own PostgreSQL WASM instance. Bound parallelism
// so the local app, Supabase and real antivirus can remain running during tests.
export default defineConfig({ resolve: { alias: { '@': path.resolve('src') } }, test: { include: ['tests/**/*.test.ts'],maxWorkers:2 } });
