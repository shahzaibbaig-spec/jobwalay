import Link from 'next/link';
import { AssessmentRules } from '../integrity/rules';
import { disclosureVersion } from '../integrity/contracts';
import { requireUser } from '@/lib/auth/context';
import { invitationSchema } from '../execution-schemas';
import { dateTime } from '@/lib/format';
import { ActionForm } from '@/components/action-form';
import { startAttemptAction } from '../server/actions';
export async function ApplicationAssessment({applicationId,status}:{applicationId:string;status:string}){
 const {db}=await requireUser();const [invitation,attempts]=await Promise.all([db.rpc('get_candidate_assessment_invitation',{p_application:applicationId}),db.from('assessment_attempts').select('id,state,attempt_number,deadline_at').eq('application_id',applicationId).order('attempt_number',{ascending:false})]);
 if(invitation.error||attempts.error)throw new Error('Unable to load assessment invitation');const parsed=invitationSchema.safeParse(invitation.data);if(!parsed.success)return null;const v=parsed.data;const active=attempts.data?.find(a=>a.state==='in_progress');
 return <section className="panel space-y-5"><header><p className="text-sm font-semibold text-secondary">ASSESSMENT INVITATION</p><h2 className="mt-2 text-2xl font-bold">{v.title}</h2></header><p>{v.question_count} questions · {v.duration_minutes} minutes · {v.passing_percentage}% passing score</p><p className="whitespace-pre-wrap">{v.summary}</p><p className="text-sm">Invitation expires {dateTime(v.expires_at)} PKT · Maximum attempts: {v.max_attempts}</p><p className="text-sm">Retakes: {v.retake_policy} · Cooldown: {v.retake_delay_minutes} minutes. The timer starts immediately when you begin.</p>{!['withdrawn','rejected','hired'].includes(status)&&v.state==='issued'&&new Date(v.expires_at)>new Date()&&(active?<Link href={`/candidate/assessments/${active.id}`}>Resume or view your current attempt →</Link>:<ActionForm action={startAttemptAction} label={attempts.data?.length?'Start permitted retake':'Start assessment'}><input name="applicationId" type="hidden" value={applicationId} /><AssessmentRules /><label className="flex items-start gap-3"><input type="checkbox" name="monitoringDisclosure" value={disclosureVersion} required className="mt-1" /><span>I have read the assessment rules and understand which activity is recorded.</span></label></ActionForm>)}<ul className="space-y-3">{attempts.data?.map(a=><li key={a.id}><Link href={`/candidate/assessments/${a.id}`}>Attempt {a.attempt_number} · {a.state}</Link></li>)}</ul></section>;
}
