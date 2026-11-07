import { randomUUID } from 'node:crypto';
import { describe,it,expect,vi } from 'vitest';
import { IntegrityBuffer,bindBrowserSignals,type MonitoringState } from '../src/modules/assessments/integrity/browser-monitor';
import type { IntegrityEvent } from '../src/modules/assessments/integrity/contracts';
type Batch={events:IntegrityEvent[];release:boolean};
function harness(){let state:MonitoringState|undefined;let now=Date.now();const batches:Batch[]=[];const recover=vi.fn();const post=vi.fn(async(body:unknown)=>{const b=body as Batch;batches.push(structuredClone(b));return {accepted:b.events.map(e=>e.id),simultaneous:false,closed:false};});const buffer=new IntegrityBuffer(randomUUID(),post,s=>{state=s;},recover,randomUUID,()=>now);return {buffer,post,batches,recover,get state(){return state;},advance(){now+=3000;}};}
describe('standard browser observations and reconnection',()=>{
 it('does not misreport an HTTP rejection as a network interruption',async()=>{
  const h=harness();h.post.mockRejectedValueOnce(new Error('Rate limited'));h.buffer.observe('window_focus');await h.buffer.flush();expect(h.state?.limited).toBe(true);expect(h.state?.interrupted).toBe(false);await h.buffer.flush();expect(h.batches.flatMap(b=>b.events).some(e=>e.kind==='request_failed')).toBe(false);
 });
 it('observes document/window events, coalesces focus warnings and cleans up listeners',async()=>{
  const h=harness();const doc=Object.assign(new EventTarget(),{visibilityState:'visible',fullscreenElement:null as object|null});const win=Object.assign(new EventTarget(),{navigator:{onLine:true},location:{href:'https://jobs.test/exam',origin:'https://jobs.test',pathname:'/exam',search:''}});const reconnect=vi.fn();const stop=bindBrowserSignals(doc as unknown as Document,win as unknown as Window,h.buffer,reconnect);await h.buffer.flush();
  doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));win.dispatchEvent(new Event('blur'));expect(h.state?.warningCount).toBe(1);h.advance();doc.fullscreenElement={};doc.dispatchEvent(new Event('fullscreenchange'));doc.fullscreenElement=null;doc.dispatchEvent(new Event('fullscreenchange'));expect(h.state?.warningCount).toBe(2);
  win.dispatchEvent(new Event('offline'));win.dispatchEvent(new Event('online'));win.dispatchEvent(new Event('focus'));doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));win.dispatchEvent(new Event('pagehide'));const restored=new Event('pageshow');Object.defineProperty(restored,'persisted',{value:true});win.dispatchEvent(restored);await h.buffer.flush();
  const kinds=h.batches.flatMap(b=>b.events.map(e=>e.kind));for(const kind of ['monitoring_started','visibility_hidden','window_blur','fullscreen_enter','fullscreen_exit','network_offline','network_online','window_focus','visibility_visible','navigation_away','navigation_back'])expect(kinds).toContain(kind);expect(reconnect).toHaveBeenCalled();
  stop();const before=h.post.mock.calls.length;win.dispatchEvent(new Event('blur'));await h.buffer.flush();expect(h.state?.warningCount).toBe(2);expect(h.post.mock.calls.length).toBeGreaterThanOrEqual(before);
 });
 it('retains stable event IDs across failures and drains queued observations after reconnect',async()=>{
  const h=harness();h.post.mockRejectedValueOnce(new TypeError('offline'));h.buffer.observe('network_offline');await h.buffer.flush();expect(h.state?.interrupted).toBe(true);expect(h.state?.pending).toBe(2);const first=h.post.mock.calls[0][0] as Batch;
  await h.buffer.flush();expect(h.batches[0].events[0].id).toBe(first.events[0].id);expect(h.state?.pending).toBe(0);expect(h.state?.interrupted).toBe(false);expect(h.recover).toHaveBeenCalledTimes(1);
 });
 it('bounds the local queue, records overflow, and sends no candidate answers or URLs',async()=>{
  const h=harness();for(let i=0;i<400;i++)h.buffer.observe('window_focus');expect(h.state?.pending).toBe(200);expect(h.state?.limited).toBe(true);await h.buffer.flush();expect(h.state?.pending).toBe(0);
  const events=h.batches.flatMap(b=>b.events);expect(events.filter(e=>e.kind==='queue_overflow')).toHaveLength(1);for(const e of events)expect(Object.keys(e).sort()).toEqual(['id','kind','observedAt']);expect(h.batches.every(b=>b.events.length<=20)).toBe(true);
 });
 it('does not treat expected submission as unexpected navigation or restart collection',async()=>{
  const h=harness();h.buffer.requestOutcome(false);h.buffer.observe('window_focus');h.buffer.finish();h.buffer.observe('navigation_away');await h.buffer.flush();expect(h.batches.flatMap(b=>b.events).some(e=>e.kind==='navigation_away')).toBe(false);expect(h.batches.some(b=>b.release)).toBe(true);expect(h.recover).not.toHaveBeenCalled();
 });
});
