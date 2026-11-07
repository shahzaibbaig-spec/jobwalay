import 'server-only';
import { createConnection } from 'node:net';
import type { Socket } from 'node:net';
import { DomainError } from '@/lib/errors';
export const maxCvBytes=10*1024*1024;
export function validateCvFile(file:unknown):asserts file is File {
  if(!(file instanceof File)||file.type!=='application/pdf'||!file.size||file.size>maxCvBytes)throw new DomainError('Choose a PDF CV up to 10 MiB.');
  if(file.name.length>255||/[\x00-\x1f\x7f/\\]/.test(file.name)||!/^.+\.pdf$/i.test(file.name)||!file.name.slice(0,-4).trim()||/\.(exe|com|scr|bat|cmd|ps1|js|html?|svg|dll|msi)\.pdf$/i.test(file.name))throw new DomainError('Use a PDF filename ending in .pdf, without paths or executable extensions.');
}
export function validateCv(bytes:Buffer) {
  if(!bytes.length||bytes.length>maxCvBytes)throw new DomainError('Choose a PDF CV up to 10 MiB.');
  if(!/^%PDF-(?:1\.[0-7]|2\.0)[\r\n\t ]/.test(bytes.subarray(0,16).toString('ascii'))||!/%%EOF[\x00\t\r\n ]*$/.test(bytes.subarray(-2048).toString('latin1')))throw new DomainError('The file does not appear to be a complete PDF.');
}
// ClamAV INSTREAM: length-prefixed binary chunks, followed by a zero length.
// Only an explicit clean response is accepted. Timeouts/errors fail closed.
export type ScannerConnection={host:string;port:number;timeout?:number};
const unavailable=()=>new DomainError('The CV scanner is unavailable. Please try again later.');
function write(socket:Socket,bytes:Buffer|string){return new Promise<void>((resolve,reject)=>{socket.write(bytes,error=>error?reject(error):resolve());});}
function exchange({host,port,timeout=20_000}:ScannerConnection,send:(socket:Socket)=>Promise<void>):Promise<string> {
  return new Promise((resolve,reject)=>{
    const socket=createConnection({host,port});let response='';let settled=false;
    const timer=setTimeout(()=>finish(unavailable()),timeout);
    const finish=(error?:Error,result?:string)=>{if(settled)return;settled=true;clearTimeout(timer);socket.destroy();if(error)reject(error);else resolve(result!);};
    socket.on('error',()=>finish(unavailable()));
    socket.on('connect',()=>{void send(socket).catch(()=>finish(unavailable()));});
    socket.on('data',chunk=>{
      response+=chunk.toString('utf8');
      if(response.length>4096)return finish(new DomainError('Invalid CV scanner response.'));
      if(!response.includes('\0')&&!response.includes('\n'))return;
      finish(undefined,response.split(/[\0\n]/,1)[0]);
    });
    socket.on('end',()=>{if(!settled)finish(new DomainError('Incomplete CV scanner response.'));});
    socket.on('close',()=>{if(!settled)finish(unavailable());});
  });
}
export async function pingScanner(connection:ScannerConnection){const reply=await exchange(connection,socket=>write(socket,'zPING\0'));if(reply!=='PONG')throw unavailable();}
export async function scannerVersion(connection:ScannerConnection){const reply=await exchange(connection,socket=>write(socket,'zVERSION\0'));if(!/^ClamAV [\w.+-]+\/\d+\/[^\r\n\0]+$/.test(reply))throw unavailable();return reply;}
export async function scanCv(bytes:Buffer,connection:ScannerConnection):Promise<'clean'|'rejected'> {
  if(!bytes.length||bytes.length>maxCvBytes)throw new DomainError('Choose a PDF CV up to 10 MiB.');
  const reply=await exchange(connection,async socket=>{
    await write(socket,'zINSTREAM\0');
    for(let offset=0;offset<bytes.length;offset+=64*1024){const chunk=bytes.subarray(offset,offset+64*1024);const length=Buffer.alloc(4);length.writeUInt32BE(chunk.length);await write(socket,length);await write(socket,chunk);}
    await write(socket,Buffer.alloc(4));
  });
  if(reply==='stream: OK')return 'clean';
  if(/^stream: [^\r\n\0]+ FOUND$/.test(reply))return 'rejected';
  throw new DomainError('The CV scanner could not process the file. Please try again later.');
}
