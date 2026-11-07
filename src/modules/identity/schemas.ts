import { z } from 'zod';
export const emailSchema = z.email().max(254).transform(v => v.toLowerCase());
export const passwordSchema = z.string().min(12).max(128);
export const credentialsSchema = z.object({ email: emailSchema, password: passwordSchema });
export const nameSchema = z.string().trim().min(1).max(100);
