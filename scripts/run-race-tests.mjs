import EmbeddedPostgres from 'embedded-postgres';
import { mkdtemp, mkdir, realpath } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
const root=resolve('.test-postgres');await mkdir(root,{recursive:true});
const data=await mkdtemp(resolve(root,'run-'));const actual=await realpath(data);
if(!actual.startsWith((await realpath(root))+sep))throw new Error('Unexpected disposable database path');
const port=await new Promise((res,rej)=>{const socket=createServer();socket.once('error',rej);socket.listen(0,'127.0.0.1',()=>{const a=socket.address();socket.close(()=>res(a.port));});});
const password=randomBytes(32).toString('hex');
const server=new EmbeddedPostgres({databaseDir:data,user:'postgres',password,port,persistent:true,createPostgresUser:false,authMethod:'scram-sha-256',postgresFlags:['-h','127.0.0.1','-c','fsync=off'],onLog:()=>{},onError:()=>{}});
let started=false;
try{
 await server.initialise();await server.start();started=true;await server.createDatabase('jobwalay_races');
 const code=await new Promise((res,rej)=>{const child=spawn(process.execPath,[resolve('node_modules/vitest/vitest.mjs'),'run','tests/assessment-races.test.ts'],{stdio:'inherit',windowsHide:true,env:{...process.env,TEST_NATIVE_DATABASE_URL:`postgresql://postgres:${password}@127.0.0.1:${port}/jobwalay_races`}});child.on('error',rej);child.on('exit',res);});
 process.exitCode=typeof code==='number'?code:1;
}finally{if(started)await server.stop();console.log('Disposable PostgreSQL stopped. Test data retained under .test-postgres (no application secrets).');}
