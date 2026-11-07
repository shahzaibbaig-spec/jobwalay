import 'server-only';
import { z } from 'zod';
export function appUrl() { return z.url().parse(process.env.APP_URL); }
