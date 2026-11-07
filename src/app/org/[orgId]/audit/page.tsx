import { AuditLog } from '@/modules/administration/audit-log';
export default async function Audit({params,searchParams}:{params:Promise<{orgId:string}>;searchParams:Promise<Record<string,string|undefined>>}){return <AuditLog org={(await params).orgId} input={await searchParams} />;}
