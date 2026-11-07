import { disclosureVersion,type BrowserKind,type IntegrityEvent } from './contracts';
export type MonitoringState={pending:number;interrupted:boolean;overlap:boolean;warningCount:number;limited:boolean};
type Reply={accepted:string[];simultaneous:boolean;closed:boolean};
/** Bounded, in-memory telemetry only. No responses or device identifiers. */
export class IntegrityBuffer {
 readonly sessionId:string;
 private events:IntegrityEvent[]=[];
 private sending:Promise<void>|null=null;
 private stopped=false;
 private interrupted=false;
 private overlap=false;
 private warnings=0;
 private lastWarning=-Infinity;
 private limited=false;
 constructor(private attemptId:string,private post:(body:unknown,keepalive:boolean)=>Promise<Reply>,private update:(state:MonitoringState)=>void,private recovered:()=>void,private uuid:()=>string=()=>crypto.randomUUID(),private now:()=>number=Date.now){this.sessionId=uuid();}
 private notify(){this.update({pending:this.events.length,interrupted:this.interrupted,overlap:this.overlap,warningCount:this.warnings,limited:this.limited});}
 observe(kind:BrowserKind){if(this.stopped)return;if(['window_blur','visibility_hidden','fullscreen_exit'].includes(kind)&&this.now()-this.lastWarning>2000){this.warnings++;this.lastWarning=this.now();}
  if(this.events.length<199)this.events.push({id:this.uuid(),kind,observedAt:new Date(this.now()).toISOString()});
  else if(!this.events.some(e=>e.kind==='queue_overflow')){this.events.push({id:this.uuid(),kind:'queue_overflow',observedAt:new Date(this.now()).toISOString()});this.limited=true;}this.notify();
 }
 requestOutcome(ok:boolean){if(!ok&&!this.interrupted){this.interrupted=true;this.observe('request_failed');}else if(ok&&this.interrupted){this.interrupted=false;this.observe('request_recovered');if(!this.stopped)this.recovered();}this.notify();}
 private async send(keepalive:boolean,release:boolean){const batch=this.events.slice(0,20);try{const result=await this.post({sessionId:this.sessionId,disclosure:disclosureVersion,events:batch,release},keepalive);const ids=new Set(result.accepted);this.events=this.events.filter(e=>!ids.has(e.id));this.overlap=result.simultaneous;if(result.closed)this.stopped=true;this.requestOutcome(true);}catch(error){if(error instanceof TypeError)this.requestOutcome(false);else this.limited=true;}this.notify();}
 flush(keepalive=false,release=false):Promise<void>{
  if(this.stopped&&!release&&this.events.length===0)return Promise.resolve();
  // On departure a second keepalive snapshot may race an existing request;
  // event IDs make duplicate delivery safe on the server.
  if(keepalive)return this.send(true,release);
  if(this.sending)return this.sending;
  this.sending=(async()=>{for(let i=0;i<10;i++){const before=this.events.length;await this.send(false,release);if(this.events.length===0||this.events.length>=before||this.stopped)break;}})().finally(()=>{this.sending=null;});return this.sending;
 }
 finish(){this.stopped=true;void this.flush(true,true);}
}

/** Observe browser signals without blocking keyboard, Escape or navigation. */
export function bindBrowserSignals(doc:Document,win:Window,buffer:IntegrityBuffer,onReconnect:()=>void){
 const cleanups:(()=>void)[]=[];let away=false;let full=Boolean(doc.fullscreenElement);
 const on=(target:EventTarget,type:string,handler:EventListener,options?:boolean)=>{target.addEventListener(type,handler,options);cleanups.push(()=>target.removeEventListener(type,handler,options));};
 const depart=()=>{if(!away){away=true;buffer.observe('navigation_away');}void buffer.flush(true);};
 on(doc,'visibilitychange',()=>{buffer.observe(doc.visibilityState==='hidden'?'visibility_hidden':'visibility_visible');if(doc.visibilityState==='hidden')void buffer.flush(true);});
 on(doc,'fullscreenchange',()=>{const next=Boolean(doc.fullscreenElement);if(next!==full){buffer.observe(next?'fullscreen_enter':'fullscreen_exit');full=next;}});
 on(win,'blur',()=>buffer.observe('window_blur'));on(win,'focus',()=>buffer.observe('window_focus'));
 on(win,'offline',()=>{buffer.observe('network_offline');buffer.requestOutcome(false);});
 on(win,'online',()=>{buffer.observe('network_online');void buffer.flush();onReconnect();});
 on(win,'pagehide',depart);on(win,'popstate',depart);
 on(win,'pageshow',event=>{if((event as PageTransitionEvent).persisted){away=false;buffer.observe('navigation_back');void buffer.flush();onReconnect();}});
 on(doc,'click',event=>{const target=event.target as Element|null;const anchor=target?.closest?.('a[href]') as HTMLAnchorElement|null;if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download'))return;const url=new URL(anchor.href,win.location.href);if(url.origin!==win.location.origin||url.pathname!==win.location.pathname||url.search!==win.location.search)depart();},true);
 buffer.observe('monitoring_started');if(win.navigator.onLine===false){buffer.observe('network_offline');buffer.requestOutcome(false);}void buffer.flush();
 return()=>{cleanups.forEach(fn=>fn());depart();buffer.finish();};
}
