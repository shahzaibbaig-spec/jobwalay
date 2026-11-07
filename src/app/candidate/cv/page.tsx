import Link from 'next/link';
import { requireUser } from '@/lib/auth/context';
import { ActionForm } from '@/components/action-form';
import { Field } from '@/components/field';
import { uploadCvAction,chooseCvAction } from '@/modules/documents/server/actions';
import { dateTime } from '@/lib/format';
export const maxDuration=60;
export const runtime='nodejs';
export default async function CVs(){
  const {db,user}=await requireUser();
  const [profile,documents]=await Promise.all([db.from('candidate_profiles').select('current_cv_id').eq('user_id',user.id).maybeSingle(),db.from('candidate_documents').select('id,filename,size_bytes,scan_status,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100)]);
  if(profile.error||documents.error)throw new Error('Unable to load CVs');
  return <section className="max-w-2xl space-y-8"><header><h1 className="text-3xl font-bold">Your CVs</h1><p className="mt-3">Upload a PDF up to 10 MiB. A security scan must pass before a CV can be used or downloaded.</p><p className="mt-3">Replacing your current CV keeps earlier application attachments unchanged.</p></header>{profile.data?<div className="panel"><ActionForm action={uploadCvAction} label="Upload and scan CV"><Field name="cv" label="PDF CV" type="file" accept="application/pdf" /></ActionForm></div>:<p className="panel"><Link href="/candidate/profile">Create your professional profile before uploading a CV.</Link></p>}<ul className="space-y-4">{documents.data?.map(d=><li className="panel space-y-4" key={d.id}><div className="flex flex-wrap justify-between gap-3"><h2 className="font-bold">{d.filename}</h2><span className="badge">{d.id===profile.data?.current_cv_id?'Current CV':d.scan_status}</span></div><p className="text-sm text-muted-foreground">{dateTime(d.created_at)} PKT · {Math.ceil(d.size_bytes/1024)} KiB</p>{d.scan_status==='clean'?<><Link href={`/api/cvs/${d.id}`}>Download PDF</Link>{d.id!==profile.data?.current_cv_id&&<ActionForm action={chooseCvAction} label="Use this CV"><input name="documentId" type="hidden" value={d.id} /></ActionForm>}</>:<p className="text-sm">{d.scan_status==='pending'?'Awaiting security scan.':d.scan_status==='error'?'The scan did not complete. Upload again when the scanner is available.':'This file was rejected and cannot be used.'}</p>}</li>)}</ul></section>;
}
