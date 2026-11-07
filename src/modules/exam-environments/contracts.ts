import 'server-only';
/** Optional future module boundary. No Safe Exam Browser adapter is enabled. */
export interface ExamEnvironmentAdapter {
 readonly provider:'safe-exam-browser';
 verify(context:{attemptId:string;canonicalRequestUrl:string;headers:Readonly<Record<string,string>>}):Promise<
  {status:'not_configured'}|{status:'verified';configurationVersion:string}|{status:'unverified';reason:'missing_proof'|'invalid_proof'|'unsupported_version'}
 >;
}
// Future adapters must verify official SEB request/config key proofs using
// server-held configuration. User-Agent/client booleans are never proof.
// No registered adapter means ordinary disclosed browser monitoring only.
