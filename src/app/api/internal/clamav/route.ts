import { scannerDiagnostic } from '@/modules/documents/server/diagnostic';
export const runtime='nodejs';
export const maxDuration=60;
// Fixed in-memory fixtures only; disabled in production and requires a local
// operator token. No arbitrary-file API and no Supabase read/write operations.
export async function POST(request:Request){return scannerDiagnostic(request);}
