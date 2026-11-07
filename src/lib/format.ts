export function dateTime(value:string) { return new Intl.DateTimeFormat('en-PK',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Karachi'}).format(new Date(value)); }
export function deadlineInput(value:string|null) { return value?new Date(new Date(value).getTime()+5*3600_000).toISOString().slice(0,16):''; }
export function humanize(value:string) { return value.replaceAll('_',' '); }
