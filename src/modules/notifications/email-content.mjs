/** @type {Record<string,string>} */
export const notificationMessages={application_status:'Your application status was updated.',assessment_invitation:'You have an assessment invitation.',assessment_result:'An assessment result or review update is available.',assessment_review:'An assessment needs human review.',assessment_retake:'An assessment retake was approved.',assessment_appeal:'Your assessment appeal has a decision.',organization_update:'An organization verification update is available.',job_moderation:'A job moderation update is available.'};
export function notificationText(kind){return typeof kind==='string'&&Object.hasOwn(notificationMessages,kind)?notificationMessages[kind]:'A recruitment update is available.';}
/** Pure versioned templates: never interpolate notification/candidate content. */
export function notificationEmail(kind,appUrl){
 const base=new URL(appUrl);
 if(base.username||base.password||base.pathname!=='/'||base.search||base.hash||(base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1'].includes(base.hostname))))throw new Error('Use a trusted HTTPS APP_URL origin (loopback HTTP for development)');
 const link=new URL('/notifications',base).href,preferences=new URL('/account/notifications',base).href;
 const message=notificationText(kind);
 const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 return {subject:'Jobwalay recruitment update',text:`${message}\n\nSign in to view the update: ${link}\n\nEmail preferences: ${preferences}`,html:`<!doctype html><html lang="en"><body><h1>Jobwalay update</h1><p>${message}</p><p><a href="${escape(link)}">Sign in to view your update</a></p><p>No sensitive assessment or application details are included in this email.</p><p><a href="${escape(preferences)}">Manage email preferences</a></p></body></html>`};
}
