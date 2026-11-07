import { z } from 'zod';

// Only these entry points can be resumed after authentication. They still
// perform their own authorization; a destination never grants access.
export function authDestination(value: unknown): string {
  if (value === '/organizations/new') return value;
  if (typeof value === 'string') {
    if (/^\/jobs\/external\/[a-f0-9]{16}\/apply$/.test(value)) return value;
    const match = /^\/jobs\/([^/]+)\/apply$/.exec(value);
    if (match && z.uuid().safeParse(match[1]).success) return value;
  }
  return '/dashboard';
}

export function authLink(path: string, destination: unknown): string {
  const next = authDestination(destination);
  return next === '/dashboard' ? path : `${path}?${new URLSearchParams({ next })}`;
}

export const authDestinationCookie = 'jobwalay-auth-destination';
