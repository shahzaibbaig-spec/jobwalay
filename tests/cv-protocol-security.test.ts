import { createServer,type Socket } from 'node:net';
import { describe,it,expect,vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { scanCv,pingScanner } from '../src/modules/documents/server/scan';
async function daemon(connect:(socket:Socket)=>void,run:(port:number)=>Promise<void>){const sockets=new Set<Socket>();const server=createServer(s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));s.on('error',()=>{});connect(s);});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();try{if(!address||typeof address==='string')throw new Error('Missing test port');await run(address.port);}finally{for(const s of sockets)s.destroy();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}}
const bytes=Buffer.from('%PDF-1.4\nMemory-only fixture\n%%EOF');
describe('bounded fail-closed clamd protocol',()=>{
 it('uses big-endian bounded chunks and a zero terminator for multichunk files',async()=>{
  const data=Buffer.alloc(200000,32);let received=Buffer.alloc(0),sizes:number[]=[];
  await daemon(socket=>{let input=Buffer.alloc(0);socket.on('data',part=>{input=Buffer.concat([input,typeof part==='string'?Buffer.from(part):part]);if(input.length<10)return;expect(input.subarray(0,10).toString()).toBe('zINSTREAM\0');let offset=10;const chunks:Buffer[]=[];const lengths:number[]=[];while(input.length>=offset+4){const length=input.readUInt32BE(offset);offset+=4;if(length===0){received=Buffer.concat(chunks);sizes=lengths;socket.end('stream: OK\0');return;}if(input.length<offset+length)return;chunks.push(input.subarray(offset,offset+length));lengths.push(length);offset+=length;}});},async port=>{expect(await scanCv(data,{host:'127.0.0.1',port,timeout:1000})).toBe('clean');});
  expect(received.equals(data)).toBe(true);expect(sizes.length).toBeGreaterThan(1);expect(sizes.every(n=>n<=65536)).toBe(true);
 });
 it('waits for a complete framed reply rather than accepting a partial clean prefix',async()=>{await daemon(s=>{s.once('data',()=>{s.write('stream: O');setTimeout(()=>s.end('K\0'),10);});},async port=>{expect(await scanCv(bytes,{host:'127.0.0.1',port,timeout:1000})).toBe('clean');});});
 it('rejects truncated, malformed, oversized and limit-error responses',async()=>{for(const reply of ['stream: OK','stream: OKAY\0','stream: scanning failed ERROR\0','INSTREAM size limit exceeded. ERROR\0','x'.repeat(4097)+'\0'])await daemon(s=>s.once('data',()=>s.end(reply)),async port=>{await expect(scanCv(bytes,{host:'127.0.0.1',port,timeout:1000})).rejects.toThrow();});});
 it('blocks unresponsive and prematurely closed daemons',async()=>{await daemon(()=>{},async port=>{await expect(scanCv(bytes,{host:'127.0.0.1',port,timeout:30})).rejects.toThrow(/unavailable/);});await daemon(s=>s.destroy(),async port=>{await expect(scanCv(bytes,{host:'127.0.0.1',port,timeout:1000})).rejects.toThrow();});});
 it('accepts only the exact PONG readiness response',async()=>{await daemon(s=>s.once('data',p=>{expect(p.toString()).toBe('zPING\0');s.end('PONG\0');}),async port=>{await expect(pingScanner({host:'127.0.0.1',port,timeout:1000})).resolves.toBeUndefined();});await daemon(s=>s.once('data',()=>s.end('OK\0')),async port=>{await expect(pingScanner({host:'127.0.0.1',port,timeout:1000})).rejects.toThrow(/unavailable/);});});
});
