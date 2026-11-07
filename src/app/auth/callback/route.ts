import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { appUrl } from '@/lib/env/server';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const db = await createClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(request.nextUrl.searchParams.get('flow') === 'recovery' ? '/reset-password' : '/dashboard', appUrl()));
  }
  return NextResponse.redirect(new URL('/login?message=Link+expired+or+invalid.+Request+a+new+link.', appUrl()));
}
