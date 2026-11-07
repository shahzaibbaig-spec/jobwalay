'use client';
export default function GlobalError({reset}:{reset:()=>void}){return <html lang="en"><body><main style={{padding:'2rem',maxWidth:'40rem'}} role="alert"><h1>The platform is temporarily unavailable</h1><p>Please retry. Avoid resubmitting sensitive information until the connection is restored.</p><button onClick={reset}>Try again</button></main></body></html>;}
