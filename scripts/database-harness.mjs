import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
// Test-only Auth scaffolding; production Auth tables are supplied by Supabase.
export const bootstrapSql=`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create table auth.sessions(id uuid primary key, user_id uuid references auth.users(id), not_after timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
    $$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid(),auth.jwt() to authenticated,anon;
    grant usage on schema public to authenticated,anon;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated,anon;
    grant select,insert,update,delete on storage.objects to authenticated;
    grant select on storage.objects to anon;
  `;
export async function database() {
  const db = new PGlite();
  await db.exec(bootstrapSql);
  for (const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()) {
    await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
  }
  return db;
}
