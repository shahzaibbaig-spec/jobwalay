import { AuditLog } from '@/modules/administration/audit-log';
export default async function Audit({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){return <AuditLog input={await searchParams} />;}
