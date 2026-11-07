-- Never use a public bucket: unverified/draft company branding stays restricted.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('company-assets','company-assets',false,3145728,array['image/webp'])
on conflict(id) do update set public=false,file_size_limit=3145728,allowed_mime_types=array['image/webp'];
create function private.can_upload_company_image(object_name text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare org uuid;
begin
 if object_name !~ '^[a-f0-9-]{36}/(logo|cover)/[a-f0-9-]{36}\.webp$' then return false; end if;
 begin org:=split_part(object_name,'/',1)::uuid; exception when invalid_text_representation then return false; end;
 return coalesce(private.org_role(org) in ('owner','admin'),false) and
 (select count(*) from storage.objects where bucket_id='company-assets' and name like org::text||'/%')<100;
end; $$;
create function private.can_read_company_image(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.company_profiles p where (p.logo_path=object_name or p.cover_path=object_name)
 and (private.company_is_public(p.organization_id) or private.org_role(p.organization_id) is not null or private.is_platform_admin()))
$$;
create policy company_image_insert on storage.objects for insert to authenticated
with check(bucket_id='company-assets' and private.can_upload_company_image(name));
create policy company_image_select on storage.objects for select to anon,authenticated
using(bucket_id='company-assets' and private.can_read_company_image(name));
-- No client overwrite/delete policy. An operator can purge unreferenced objects
-- through the Storage API; current references must be preserved.
create function public.set_company_image(p_org uuid,p_kind text,p_path text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.organizations where id=p_org for update;
 if coalesce(private.org_role(p_org),'') not in ('owner','admin') then raise exception 'Not permitted' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('logo','cover') or p_path is null or p_path !~ ('^'||p_org::text||'/'||p_kind||'/[a-f0-9-]{36}\.webp$') then raise exception 'Invalid image'; end if;
 if not exists(select 1 from storage.objects where bucket_id='company-assets' and name=p_path and metadata->>'mimetype'='image/webp') then raise exception 'Image unavailable'; end if;
 update public.company_profiles set logo_path=case when p_kind='logo' then p_path else logo_path end,cover_path=case when p_kind='cover' then p_path else cover_path end,version=version+1,updated_at=now() where organization_id=p_org;
 if not found then raise exception 'Save a company profile first'; end if;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,private.active_actor(),'company.image.updated',p_org);
end; $$;
revoke all on function private.can_upload_company_image(text),private.can_read_company_image(text),public.set_company_image(uuid,text,text) from public,anon,authenticated;
grant execute on function private.can_read_company_image(text) to anon,authenticated;
grant execute on function private.can_upload_company_image(text),public.set_company_image(uuid,text,text) to authenticated;
