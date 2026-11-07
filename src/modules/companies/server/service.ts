import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireOrganization, requirePlatformAdmin } from '@/lib/auth/context';
import { databaseError, DomainError } from '@/lib/errors';
import { companySchema, imageKindSchema, reviewSchema, verificationSchema } from '../schemas';
import { normalizeCompanyImage } from './images';
export async function saveCompany(input: unknown) {
  const { organizationId, version, ...profile } = companySchema.parse(input);
  const { db } = await requireOrganization(organizationId,true);
  const { error } = await db.rpc('save_company_profile',{ p_org:organizationId,p_expected_version:version,p_input:profile });
  if(error) throw databaseError(error);
  return organizationId;
}
export async function requestVerification(input: unknown) {
  const values=verificationSchema.parse(input);
  const { db } = await requireOrganization(values.organizationId,true);
  const { error }=await db.rpc('request_verification',{p_org:values.organizationId,p_legal_name:values.legal_name,p_registration_number:values.registration_number,p_notes:values.notes});
  if(error) throw databaseError(error);
  return values.organizationId;
}
export async function reviewVerification(input: unknown) {
  const values=reviewSchema.parse(input);
  const { db }=await requirePlatformAdmin();
  const { error }=await db.rpc('review_verification',{p_request:values.requestId,p_decision:values.decision,p_reason:values.reason});
  if(error) throw databaseError(error);
}
export async function uploadCompanyImage(organizationId: unknown, kind: unknown, file: unknown) {
  const org=z.uuid().parse(organizationId);
  const imageKind=imageKindSchema.parse(kind);
  const { db }=await requireOrganization(org,true);
  if(!(file instanceof File) || !file.size || file.size>3*1024*1024 || !['image/png','image/jpeg','image/webp'].includes(file.type)) throw new DomainError('Choose a PNG, JPEG or WebP image up to 3 MiB.');
  const { data: profile }=await db.from('company_profiles').select('organization_id').eq('organization_id',org).maybeSingle();
  if(!profile) throw new DomainError('Save a company profile first');
  const bytes=await normalizeCompanyImage(Buffer.from(await file.arrayBuffer()),imageKind);
  const path=`${org}/${imageKind}/${randomUUID()}.webp`;
  const {error:uploadError}=await db.storage.from('company-assets').upload(path,bytes,{contentType:'image/webp',upsert:false});
  if(uploadError) throw new DomainError('Image upload failed. Check Storage configuration and the company upload quota.');
  const {error}=await db.rpc('set_company_image',{p_org:org,p_kind:imageKind,p_path:path});
  if(error) throw databaseError(error);
  return org;
}
