import { z } from 'zod';
export const profileSchema=z.object({headline:z.string().trim().min(1).max(160),bio:z.string().max(3000),
  skills:z.preprocess(v=>typeof v==='string'?v.split(',').map(s=>s.trim()).filter(Boolean):v,z.array(z.string().trim().min(1).max(60)).max(30)).transform(v=>[...new Set(v)]),
  slug:z.string().max(80).regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/),visibility:z.enum(['private','public']),version:z.coerce.number().int().min(0),
}).superRefine((v,ctx)=>{if(v.visibility==='public'&&v.slug.length<3)ctx.addIssue({code:'custom',path:['slug'],message:'A public profile needs a slug of at least three characters.'});});
const optionalDate=z.union([z.iso.date(),z.literal('')]);
const base={id:z.union([z.uuid(),z.literal('')])};
const dated={started_on:z.iso.date(),ended_on:optionalDate,description:z.string().max(2000)};
export const entrySchema=z.discriminatedUnion('kind',[
  z.object({...base,kind:z.literal('experience'),company:z.string().trim().min(1).max(160),title:z.string().trim().min(1).max(160),location:z.string().max(160),...dated}),
  z.object({...base,kind:z.literal('education'),school:z.string().trim().min(1).max(160),qualification:z.string().trim().min(1).max(160),field_of_study:z.string().max(160),...dated,description:z.string().max(1000)}),
  z.object({...base,kind:z.literal('certification'),name:z.string().trim().min(1).max(160),issuer:z.string().trim().min(1).max(160),issued_on:z.iso.date(),expires_on:optionalDate,credential_url:z.union([z.literal(''),z.url({protocol:/^https$/}).max(500)])}),
]).superRefine((v,ctx)=>{
  const start=v.kind==='certification'?v.issued_on:v.started_on;
  const end=v.kind==='certification'?v.expires_on:v.ended_on;
  if(end&&end<start)ctx.addIssue({code:'custom',message:'The end date must be on or after the start date.'});
});
export const deleteEntrySchema=z.object({kind:z.enum(['experience','education','certification']),id:z.uuid()});
