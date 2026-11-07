export function signupErrorMessage(code?: string, status?: number): string {
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || status === 429) {
    return 'Too many signup or email requests. Please wait a few minutes, then try again. If you already registered, check your inbox and spam folder.';
  }
  if (code === 'email_address_not_authorized' || code === 'email_address_not_allowed') {
    return 'Verification email delivery is not configured for this email address yet. Please contact Jobwalay support.';
  }
  if (code === 'email_address_invalid') return 'Please enter a valid email address.';
  if (code === 'weak_password') return 'Please choose a stronger password with at least 12 characters.';
  if (code === 'signup_disabled') return 'New account registration is temporarily unavailable. Please try again later.';
  if (status !== undefined && status >= 500) return 'We could not complete signup or send the verification email. Please try again later. If you received a verification email, use its link before signing in.';
  return 'We could not complete signup. Please try again, or sign in or reset your password if you already have an account.';
}
