import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/context';
import { Button } from '@/components/ui/button';
import { externalJobUrl, findExternalJob } from '@/modules/jobs/external-catalog';

export default async function ExternalApplication({ params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params;
  const job = findExternalJob(sourceId);
  if (!job) notFound();
  await requireUser(true, `/jobs/external/${job.id}/apply`);
  return <section className="panel max-w-2xl space-y-5">
    <h1 className="text-3xl font-bold">Continue to Indeed</h1>
    <p>Apply for {job.title} at {job.employer} on Indeed. Check that the vacancy is still open and review its requirements before applying.</p>
    <p>You are leaving Jobwalay. Your profile and CV will not be sent automatically, and this application will not appear in your Jobwalay application history.</p>
    <Button asChild><a href={externalJobUrl(job)} target="_blank" rel="noopener noreferrer">Continue to Indeed (opens in a new tab)</a></Button>
    <p><Link href={`/jobs/external/${job.id}`}>Back to listing</Link></p>
  </section>;
}
