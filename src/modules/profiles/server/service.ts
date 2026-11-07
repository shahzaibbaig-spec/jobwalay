import 'server-only';
import { requireUser } from '@/lib/auth/context';
import { profileSchema,entrySchema,deleteEntrySchema } from '../schemas';
import { databaseError } from '@/lib/errors';
export async function saveProfile(input: unknown) {
  const profile = profileSchema.parse(input);
  const { db } = await requireUser();
  const { error } = await db.rpc('save_professional_profile', {p_headline:profile.headline,p_bio:profile.bio,p_skills:profile.skills,p_slug:profile.slug,p_visibility:profile.visibility,p_expected_version:profile.version});
  if (error) throw databaseError(error);
}
export async function saveEntry(input:unknown) {
  const {kind,id,...entry}=entrySchema.parse(input);
  const {db}=await requireUser();
  const {error}=await db.rpc('save_candidate_entry',{p_kind:kind,p_input:entry,p_id:id||undefined});
  if(error)throw databaseError(error);
}
export async function deleteEntry(input:unknown) {
  const {kind,id}=deleteEntrySchema.parse(input);
  const {db}=await requireUser();
  const {error}=await db.rpc('delete_candidate_entry',{p_kind:kind,p_id:id});
  if(error)throw databaseError(error);
}
