import { notFound } from 'next/navigation';
import { z } from 'zod';
import { publicClient } from '@/lib/supabase/public';
import { snapshotSchema } from '@/modules/profiles/types';
import { ProfessionalProfile } from '@/modules/profiles/components/professional-profile';
export default async function PublicCandidate({params}:{params:Promise<{slug:string}>}){const {slug}=await params;if(!z.string().min(3).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).safeParse(slug).success)notFound();const {data,error}=await publicClient().rpc('get_public_candidate',{p_slug:slug});if(error)throw new Error('Unable to load profile');const profile=snapshotSchema.safeParse(data);if(!profile.success)notFound();return <article className="panel mx-auto max-w-3xl"><p className="mb-6 text-sm font-semibold text-secondary">PROFESSIONAL PROFILE</p><ProfessionalProfile profile={profile.data} /></article>;}
