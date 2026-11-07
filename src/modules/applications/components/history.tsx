import { dateTime,humanize } from '@/lib/format';
export function ApplicationHistory({events}:{events:{id:string;from_status:string|null;to_status:string;message:string;occurred_at:string}[]}){
  return <section><h2 className="mb-5 text-xl font-bold">Application history</h2><ol className="space-y-5 border-l-2 border-brand-line pl-5">{events.map(e=><li key={e.id}><p className="font-semibold capitalize">{e.from_status?`${humanize(e.from_status)} → `:''}{humanize(e.to_status)}</p><p className="mt-1 text-sm text-muted-foreground">{dateTime(e.occurred_at)} PKT</p>{e.message&&<p className="mt-2 whitespace-pre-wrap">{e.message}</p>}</li>)}</ol></section>;
}
