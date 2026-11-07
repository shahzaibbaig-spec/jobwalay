import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { appUrl } from '@/lib/env/server';
import { authDestination, authDestinationCookie } from '@/lib/auth/destination';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const db = await createClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) {
      const destination = request.nextUrl.searchParams.get('flow') === 'recovery'
        ? '/reset-password' : authDestination(request.cookies.get(authDestinationCookie)?.value);
      const response = NextResponse.redirect(new URL(destination, appUrl()));
      response.cookies.delete(authDestinationCookie);
      return response;
    }
  }
  return NextResponse.redirect(new URL('/login?message=Link+expired+or+invalid.+Request+a+new+link.', appUrl()));
}
