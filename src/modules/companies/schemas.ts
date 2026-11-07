import { z } from 'zod';
export const companySchema = z.object({
  organizationId: z.uuid(), version: z.coerce.number().int().min(0),
  company_name: z.string().trim().min(2).max(120),
  slug: z.string().min(3).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens for the slug.'),
  industry: z.string().trim().min(2).max(100), location: z.string().trim().min(2).max(160),
  website: z.union([z.literal(''), z.url({ protocol: /^https$/ }).max(500)]),
  description: z.string().trim().min(20).max(10000),
  is_public: z.preprocess(v => v === 'on' || v === true, z.boolean()),
});
export const verificationSchema = z.object({
  organizationId: z.uuid(), legal_name: z.string().trim().min(2).max(200),
  registration_number: z.string().trim().min(2).max(120), notes: z.string().max(3000),
});
export const reviewSchema = z.object({ requestId: z.uuid(), decision: z.enum(['approved','rejected']), reason: z.string().trim().min(5).max(2000) });
export const imageKindSchema = z.enum(['logo','cover']);
