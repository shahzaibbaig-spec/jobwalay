import Link from 'next/link';
export default function NotFound() { return <section className="space-y-5"><h1 className="text-3xl font-bold">Page unavailable</h1><p>This page does not exist or you do not have access.</p><Link href="/dashboard">Return to your workspaces</Link></section>; }
