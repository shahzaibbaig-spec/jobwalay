import { describe, expect, it } from 'vitest';
import { authDestination, authLink } from '@/lib/auth/destination';

describe('authentication return destinations', () => {
  const application = '/jobs/11111111-1111-4111-8111-111111111111/apply';
  it('resumes application and employer registration entry points', () => {
    expect(authDestination(application)).toBe(application);
    expect(authDestination('/organizations/new')).toBe('/organizations/new');
    expect(new URL(authLink('/signup', application), 'https://jobwalay.test').searchParams.get('next')).toBe(application);
  });
  it.each([
    'https://attacker.invalid', '//attacker.invalid', '/\\attacker.invalid',
    '/organizations/new?next=https://attacker.invalid', '/organizations/new#redirect',
    '/jobs/invalid/apply', `${application}/../../admin`, '/admin',
    '%2F%2Fattacker.invalid', null, undefined, [' /organizations/new'],
  ])('rejects unapproved or malformed destinations: %s', (value) => {
    expect(authDestination(value)).toBe('/dashboard');
    expect(authLink('/login', value)).toBe('/login');
  });
});
