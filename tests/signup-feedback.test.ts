import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signupErrorMessage } from '@/modules/identity/signup-feedback';

const mocks = vi.hoisted(() => ({ signUp: vi.fn(), setCookie: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { signUp: mocks.signUp } }) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ set: mocks.setCookie }) }));
vi.mock('@/lib/env/server', () => ({ appUrl: () => 'https://jobwalay.test' }));
vi.mock('@/modules/identity/server/service', () => ({ onboard: vi.fn() }));
vi.mock('@/lib/auth/context', () => ({ requireUser: vi.fn() }));
import { signup } from '@/modules/identity/server/actions';

describe('signup feedback', () => {
  const form = () => {
    const data = new FormData();
    data.set('email', 'synthetic@example.test');
    data.set('password', 'Synthetic-password-123');
    return data;
  };
  beforeEach(() => vi.clearAllMocks());
  it('explains email confirmation after a successful request without claiming a duplicate account was created', async () => {
    mocks.signUp.mockResolvedValue({ data: { user: null, session: null }, error: null });
    expect((await signup({}, form())).message).toContain('verification link');
    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: { emailRedirectTo: 'https://jobwalay.test/auth/callback' } }));
  });
  it('makes invalid credentials actionable without calling Supabase', async () => {
    const input = form(); input.set('password', 'short');
    expect((await signup({}, input)).error).toContain('12 and 128');
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it('explains restricted email delivery without exposing provider messages', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      mocks.signUp.mockResolvedValue({ error: { code: 'email_address_not_authorized', status: 403, message: 'private provider details' } });
      const result = await signup({}, form());
      expect(result.error).toContain('Verification email delivery is not configured');
      expect(JSON.stringify(result)).not.toContain('private provider details');
      expect(warn).toHaveBeenCalledWith('Signup request failed', { code: 'email_address_not_authorized', status: 403 });
    } finally { warn.mockRestore(); }
  });
  it('returns visible feedback on a network failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      mocks.signUp.mockRejectedValue(new Error('private transport details'));
      expect((await signup({}, form())).error).toContain('Unable to reach');
    } finally { warn.mockRestore(); }
  });
  it('explains rate limiting and handles unknown errors safely', () => {
    expect(signupErrorMessage('over_email_send_rate_limit', 429)).toContain('wait a few minutes');
    expect(signupErrorMessage('unexpected', 500)).toContain('verification email');
    expect(signupErrorMessage('user_already_exists', 422)).toContain('if you already have an account');
  });
});
