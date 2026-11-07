const base=process.env.APP_URL,token=process.env.CLAMAV_DIAGNOSTIC_TOKEN;
if(!base||!token||!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Configure the local development scanner diagnostic first.');
const response=await fetch(new URL('/api/internal/clamav',base),{method:'POST',headers:{Origin:new URL(base).origin,'x-clamav-diagnostic-token':token},signal:AbortSignal.timeout(100000)});
const data=await response.json();console.log('Backend scanner diagnostic:',response.status,JSON.stringify(data));
if(!response.ok||data.clean!=='clean'||data.infected!=='rejected'||data.eicar!=='rejected'||data.databaseWrites!==0)process.exitCode=1;
