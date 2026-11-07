import { describe,expect,it,vi } from 'vitest';
import { createServer } from 'node:net';
vi.mock('server-only',()=>({}));
import { scanCv,validateCv } from '../src/modules/documents/server/scan';
const pdf=Buffer.from('%PDF-1.4\nSynthetic fixture\n%%EOF');
async function withScanner(reply:string,run:(port:number)=>Promise<void>){const server=createServer(socket=>{let buffer=Buffer.alloc(0);socket.on('data',data=>{buffer=Buffer.concat([buffer,typeof data==='string'?Buffer.from(data):data]);if(buffer.length>=10+4+pdf.length+4)socket.end(reply);});});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();try{await run(typeof address==='object'&&address?address.port:0);}finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}}
describe('fail-closed CV validation and malware scan protocol',()=>{
 it('rejects prefixed or appended polyglot content and unsupported PDF headers',()=>{for(const bytes of [Buffer.concat([Buffer.from('<script>bad</script>'),pdf]),Buffer.concat([pdf,Buffer.from('<script>bad</script>')]),Buffer.from('%PDF-9.9\ninvalid\n%%EOF')])expect(()=>validateCv(bytes)).toThrow();expect(()=>validateCv(Buffer.concat([pdf,Buffer.from('\r\n  ')]))).not.toThrow();});
 it('rejects spoofed or truncated PDF bytes and oversized files',()=>{expect(()=>validateCv(Buffer.from('Not a PDF'))).toThrow();expect(()=>validateCv(Buffer.from('%PDF-1.4 no ending'))).toThrow();expect(()=>validateCv(Buffer.alloc(10*1024*1024+1))).toThrow();expect(()=>validateCv(pdf)).not.toThrow();});
 it('accepts only explicit clean scanner responses',async()=>{await withScanner('stream: OK\0',async port=>{expect(await scanCv(pdf,{host:'127.0.0.1',port,timeout:1000})).toBe('clean');});});
 it('quarantines malware and errors instead of treating them as clean',async()=>{await withScanner('stream: Eicar-Test-Signature FOUND\0',async port=>{expect(await scanCv(pdf,{host:'127.0.0.1',port,timeout:1000})).toBe('rejected');});await withScanner('stream: scanning unavailable ERROR\0',async port=>{await expect(scanCv(pdf,{host:'127.0.0.1',port,timeout:1000})).rejects.toThrow();});});
});
