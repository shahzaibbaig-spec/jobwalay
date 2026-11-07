'use client';
import Link from 'next/link';
export default function ErrorPage({reset}:{reset:()=>void}){return <section role="alert" className="panel max-w-xl space-y-5"><h1 className="text-2xl font-bold">This page could not be loaded</h1><p>Check your connection and retry. Review the latest saved state before repeating a submission. If the problem continues, contact platform support through your organization.</p><button className="rounded bg-primary px-5 py-3 text-white" onClick={reset}>Try again</button><p><Link href="/dashboard">Return to your workspaces</Link></p></section>;}
