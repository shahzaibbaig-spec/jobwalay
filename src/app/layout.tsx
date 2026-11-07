import Link from 'next/link';
import Image from 'next/image';
import './globals.css';
export const metadata = { title: 'Jobwalay — Your next chapter', description: 'Recruitment for candidates and hiring teams.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="font-sans antialiased"><a href="#main" className="sr-only focus:not-sr-only">Skip to content</a><header className="site-header"><nav aria-label="Main" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6"><Link href="/" className="brand-lockup" aria-label="Jobwalay home"><span className="brand-mark" aria-hidden="true"><Image src="/brand/jobwalay-logo.png" width={92} height={92} alt="" loading="eager" sizes="92px" /></span><span className="brand-name">Job<span>walay</span></span></Link><div className="site-nav-links"><Link href="/jobs">Find jobs</Link><Link href="/organizations/new">Post a job</Link><Link href="/dashboard">Workspaces</Link><Link href="/notifications">Notifications</Link><Link href="/account/security">Security</Link><Link href="/login" className="nav-signin">Sign in</Link><Link href="/signup">Sign up</Link></div></nav></header><main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">{children}</main></body></html>;
}
