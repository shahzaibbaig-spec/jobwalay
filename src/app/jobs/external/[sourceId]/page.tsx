import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { externalJobUrl, externalSource, findExternalJob } from '@/modules/jobs/external-catalog';

export default async function ExternalJobPage({ params }: { params: Promise<{ sourceId: string }> }) {
  const job = findExternalJob((await params).sourceId);
  if (!job) notFound();
  return <article className="max-w-3xl space-y-6">
    <Link href="/jobs">Back to jobs</Link>
    <span className="badge">External listing · Indeed</span>
    <h1 className="text-4xl font-bold">{job.title}</h1>
    <p className="text-xl">{job.employer}</p>
    <p>{job.location}</p>
    <section className="panel space-y-4">
      <h2 className="text-xl font-bold">About this listing</h2>
      <p>This role appeared in Indeed’s AJK search results. Read the original advertisement for the full requirements, salary, deadline and current availability. Jobwalay has not independently verified this employer or vacancy.</p>
      <p className="text-sm">Source search page reviewed <time dateTime={externalSource.reviewedOn}>7 November 2026</time>. The vacancy may have changed or closed since then.</p>
      <p><a href={externalJobUrl(job)} target="_blank" rel="noopener noreferrer" className="underline">Original Indeed listing (opens in a new tab)</a></p>
    </section>
    <Button asChild><Link href={`/jobs/external/${job.id}/apply`}>Apply via Indeed</Link></Button>
    <p className="text-sm text-muted-foreground">Sign in or create an account to continue from Jobwalay. Your application will be completed on Indeed; Jobwalay will not submit your profile or CV.</p>
  </article>;
}
