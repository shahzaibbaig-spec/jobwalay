import Link from 'next/link';
import { requireUser } from '@/lib/auth/context';
export default async function CandidateLayout({children}:{children:React.ReactNode}){await requireUser();return <><nav className="mb-8 flex flex-wrap gap-5 border-b pb-5 text-sm" aria-label="Candidate"><Link href="/candidate">Overview & applications</Link><Link href="/candidate/profile">Professional profile</Link><Link href="/candidate/cv">My CVs</Link><Link href="/candidate/saved">Saved jobs</Link><Link href="/jobs">Find jobs</Link></nav>{children}</>;}
