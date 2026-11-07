import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return <div className="space-y-8">
    <Link href="/jobs" className="block overflow-hidden rounded-2xl border shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" aria-label="Find jobs and grow your career with Jobwalay">
      <Image
        src="/brand/career-growth-banner.png"
        alt="Job ki fikar na kar lalay, log on to Jobwalay. Find jobs, apply online, and grow your career."
        width={1916}
        height={821}
        sizes="(max-width: 1152px) 100vw, 1152px"
        preload
        className="h-auto w-full"
      />
    </Link>
    <section className="home-hero max-w-4xl px-3 py-8 sm:px-6 sm:py-12">
      <p className="mb-5 text-sm font-bold uppercase tracking-widest text-secondary">People. Potential. Possibility.</p>
      <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl">Your next chapter<br />starts with a <span className="brand-gradient-text">connection.</span></h1>
      <p className="my-6 max-w-xl text-lg text-muted-foreground">Explore jobs and vacancies from verified companies without an account. Sign in or sign up when you find a role you want to apply for.</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild><Link href="/jobs">Browse jobs</Link></Button>
        <Button asChild variant="outline"><Link href="/organizations/new">List your company or post a job</Link></Button>
      </div>
    </section>
  </div>;
}
