'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { IntegrityBuffer,bindBrowserSignals,type MonitoringState } from './browser-monitor';
export function useAssessmentMonitoring(attemptId:string,enabled:boolean,onReconnect:()=>void){
 const buffer=useRef<IntegrityBuffer|null>(null);const reconnect=useRef(onReconnect);
 useEffect(()=>{reconnect.current=onReconnect;},[onReconnect]);
 const [state,setState]=useState<MonitoringState>({pending:0,interrupted:false,overlap:false,warningCount:0,limited:false});
 const [fullscreenNotice,setFullscreenNotice]=useState('');
 useEffect(()=>{if(!enabled)return;const current=new IntegrityBuffer(attemptId,async(body,keepalive)=>{const r=await fetch(`/api/assessment-attempts/${attemptId}/integrity`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive,cache:'no-store'});if(!r.ok)throw new Error('Monitoring delivery unavailable');return r.json();},setState,()=>reconnect.current());buffer.current=current;const unbind=bindBrowserSignals(document,window,current,()=>reconnect.current());const timer=setInterval(()=>void current.flush(),15000);return()=>{clearInterval(timer);unbind();buffer.current=null;};},[attemptId,enabled]);
 const requestFullscreen=useCallback(async()=>{try{if(!document.fullscreenEnabled||!document.documentElement.requestFullscreen)throw new Error('Unavailable');await document.documentElement.requestFullscreen();setFullscreenNotice('Fullscreen requested. Press Escape to leave whenever needed.');}catch{buffer.current?.observe('fullscreen_unavailable');setFullscreenNotice('Fullscreen is unavailable or was declined. You can continue without it.');}},[]);
 const requestOutcome=useCallback((ok:boolean)=>buffer.current?.requestOutcome(ok),[]);
 const finish=useCallback(()=>buffer.current?.finish(),[]);
 return {state,requestFullscreen,requestOutcome,finish,fullscreenNotice};
}
