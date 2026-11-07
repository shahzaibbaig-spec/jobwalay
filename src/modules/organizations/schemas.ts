import { z } from 'zod';
import { emailSchema } from '@/modules/identity/schemas';
export const organizationSchema = z.string().trim().min(2).max(120);
export const inviteSchema = z.object({ organizationId: z.uuid(), email: emailSchema, role: z.enum(['admin', 'recruiter']) });
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export type OrgRole = 'owner' | 'admin' | 'recruiter';
export function canManageTeam(role: string): role is 'owner' | 'admin' { return role === 'owner' || role === 'admin'; }
