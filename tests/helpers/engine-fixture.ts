import { randomUUID } from 'node:crypto';
export interface EngineDb {query(sql:string,params?:unknown[]):Promise<{rows:Record<string,unknown>[]}>}
export async function value<T>(db:EngineDb,sql:string,params:unknown[]=[]){return (await db.query(sql,params)).rows[0]?.value as T;}
export async function acting(db:EngineDb,user:string){await db.query('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,session_id:user,aal:'aal1'})]);await db.query('set role authenticated');}
export async function engineFixture(db:EngineDb,settings:Record<string,unknown>={},kinds:string[]=['single_choice','multiple_select','numerical']){
 const owner=randomUUID(),candidate=randomUUID(),outsider=randomUUID();
 await db.query('reset role');
 for(const user of [owner,candidate,outsider]){await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[user,`${user}@example.test`]);await db.query('insert into auth.sessions(id,user_id) values($1,$1)',[user]);}
 await db.query("update public.accounts set display_name='Engine fixture',onboarded_at=now() where id=any($1::uuid[])",[[owner,candidate,outsider]]);
 await acting(db,owner);const org=await value<string>(db,"select public.register_organization('Engine Company') as value");
 await db.query('select public.save_company_profile($1,0,$2)',[org,JSON.stringify({company_name:'Engine Company',slug:`engine-${org}`,industry:'Technology',location:'Karachi',website:'',description:'A synthetic company for secure assessment execution tests.',is_public:true})]);
 await db.query('reset role');await db.query("update public.organizations set verification_status='approved' where id=$1",[org]);await acting(db,owner);
 const job=await value<string>(db,'select public.save_job($1,0,$2) as value',[org,JSON.stringify({title:'Assessment Engineer',description:'A synthetic position for testing transaction-safe assessments and recruiting.',department:'Engineering',location:'Karachi',work_mode:'remote',job_type:'full_time',required_skills:[],experience_min:0,positions:1})]);
 await db.query("select public.transition_job($1,$2,1,'published')",[org,job]);
 const assessment=await value<string>(db,"select public.create_assessment($1,'Secure engineering test',$2) as value",[org,job]);
 const version=await value<string>(db,'select id as value from public.assessment_versions where assessment_id=$1',[assessment]);
 const bank:string[]=[];
 for(const [i,kind] of kinds.entries()){
  const question=await value<string>(db,'select public.save_bank_question($1,$2) as value',[org,JSON.stringify({kind,prompt:`Solve this ${kind} question carefully?`,category:'Fundamentals',difficulty:'medium',options:['single_choice','multiple_select'].includes(kind)?[{id:'a',text:'First option'},{id:'b',text:'Second option'},{id:'c',text:'Third option'}]:[],answer:kind==='numerical'?{value:42,tolerance:0.5}:kind==='written'?{rubric:'Award points for clear, accurate reasoning and evidence.'}:{correct_ids:kind==='single_choice'?['b']:['a','c']}})]);
  bank.push(question);await db.query('select public.set_assessment_question($1,$2,$3,10,$4)',[org,version,question,i+1]);
 }
 let deadline='';if(settings.expireInMs){deadline=await value<string>(db,"select (clock_timestamp()+($1::text||' milliseconds')::interval)::text as value",[settings.expireInMs]);}
 const configuration={duration_minutes:5,passing_percentage:70,max_attempts:2,retake_policy:'automatic',retake_delay_minutes:0,appeals_enabled:true,appeal_window_hours:72,invitation_window_hours:24,summary:'Read carefully.',...settings,deadline:deadline||settings.deadline||''};delete (configuration as Record<string,unknown>).expireInMs;
 const revision=await value<number>(db,'select revision as value from public.assessment_versions where id=$1',[version]);await db.query('select public.save_assessment_settings($1,$2,$3,$4)',[org,version,revision,JSON.stringify(configuration)]);
 const updated=await value<number>(db,'select revision as value from public.assessment_versions where id=$1',[version]);await db.query('select public.publish_assessment($1,$2,$3)',[org,version,updated]);
 await acting(db,candidate);await db.query("select public.save_candidate_profile('Engineer','My professional biography')");
 const cv=await value<string>(db,"select public.begin_cv_upload('cv.pdf',20,$1) as value",['e'.repeat(64)]);await db.query("insert into storage.objects(bucket_id,name,metadata) values('candidate-cvs',$1,$2)",[`${candidate}/${cv}.pdf`,JSON.stringify({mimetype:'application/pdf',size:20})]);await db.query('reset role');await db.query('set role service_role');await db.query("select public.finish_cv_scan($1,$2,'clean')",[cv,'e'.repeat(64)]);await acting(db,candidate);
 const application=await value<string>(db,'select public.apply_to_job($1) as value',[job]);
 const invitation=await value<string>(db,'select id as value from public.assessment_invitations where application_id=$1',[application]);
 return {org,job,assessment,version,owner,candidate,outsider,application,invitation,bank};
}
export async function start(db:EngineDb,fixture:Awaited<ReturnType<typeof engineFixture>>){await acting(db,fixture.candidate);return value<string>(db,'select public.start_assessment_attempt($1, $q$browser-integrity-v1$q$) as value',[fixture.application]);}
export async function answerAll(db:EngineDb,attempt:string,correct=true,write=true){
 const rows=(await db.query('select id,kind from public.assessment_attempt_questions where attempt_id=$1 order by position',[attempt])).rows;
 for(const q of rows){const answer=q.kind==='single_choice'?{selected_ids:[correct?'b':'a']}:q.kind==='multiple_select'?{selected_ids:correct?['c','a']:['a']}:q.kind==='numerical'?{value:correct?'42.5':'43.0'}:{text:write?'Detailed reasoning and supporting evidence.':''};await db.query('select public.save_assessment_response($1,$2,$3,0)',[attempt,q.id,JSON.stringify(answer)]);}
 return rows;
}
