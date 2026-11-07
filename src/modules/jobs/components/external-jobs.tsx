import Link from 'next/link';
import { externalSource, type ExternalJob } from '../external-catalog';

export function ExternalJobs({ jobs }: { jobs: ExternalJob[] }) {
  if (!jobs.length) return null;
  return <section aria-labelledby="external-jobs-heading" className="space-y-5">
    <header className="space-y-3">
      <h2 id="external-jobs-heading" className="text-2xl font-bold">AJK opportunities found on Indeed</h2>
      <p className="text-sm text-muted-foreground">{jobs.length} matching listings. Source search page reviewed <time dateTime={externalSource.reviewedOn}>7 November 2026</time>. Confirm current availability and full requirements on Indeed. This is a dated selection; it does not cover every vacancy or update automatically.</p>
      <p className="text-sm"><a href={externalSource.url} target="_blank" rel="noopener noreferrer" className="underline">Search more AJK jobs on Indeed (opens in a new tab)</a></p>
    </header>
    <div className="grid gap-5 md:grid-cols-2">{jobs.map(job => <article key={job.id} className="panel space-y-3">
      <span className="badge">External listing · Indeed</span>
      <h3 className="text-xl font-bold"><Link href={`/jobs/external/${job.id}`}>{job.title}</Link></h3>
      <p className="font-semibold">{job.employer}</p>
      <p className="text-muted-foreground">{job.location}</p>
      <p className="text-sm">Applications are handled outside Jobwalay. Employer verification by Jobwalay is not implied.</p>
      <Link href={`/jobs/external/${job.id}`} className="inline-block underline">View listing and application options</Link>
    </article>)}</div>
  </section>;
}
