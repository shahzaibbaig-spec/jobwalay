import { z } from 'zod';
export const snapshotSchema=z.object({
  name:z.string(),headline:z.string(),bio:z.string(),skills:z.array(z.string()),
  experiences:z.array(z.object({company:z.string(),title:z.string(),location:z.string(),started_on:z.string(),ended_on:z.string().nullable(),description:z.string()})),
  education:z.array(z.object({school:z.string(),qualification:z.string(),field_of_study:z.string(),started_on:z.string(),ended_on:z.string().nullable(),description:z.string()})),
  certifications:z.array(z.object({name:z.string(),issuer:z.string(),issued_on:z.string(),expires_on:z.string().nullable(),credential_url:z.string()})),
});
export type ProfessionalSnapshot=z.infer<typeof snapshotSchema>;
