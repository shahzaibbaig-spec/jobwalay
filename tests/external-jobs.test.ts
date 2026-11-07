import { describe, expect, it } from 'vitest';
import { externalJobUrl, externalSource, findExternalJob, findExternalJobs } from '@/modules/jobs/external-catalog';
import { authDestination } from '@/lib/auth/destination';

const reviewed = new Date('2026-11-07T12:00:00+05:00');
describe('external AJK job discovery', () => {
  it('keeps source records distinct and deduplicated', () => {
    const jobs = findExternalJobs({}, reviewed);
    expect(jobs).toHaveLength(13);
    expect(new Set(jobs.map(j => j.id)).size).toBe(13);
    expect(new Set(jobs.map(j => `${j.title}|${j.employer}|${j.location}`)).size).toBe(13);
    for (const job of jobs) {
      const source = new URL(externalJobUrl(job));
      expect(source.origin).toBe('https://pk.indeed.com');
      expect(source.pathname).toBe('/viewjob');
      expect(source.searchParams.get('jk')).toBe(job.id);
      expect(job.location).toContain('Azad Kashmir');
    }
  });
  it('filters by keywords, employer, city and AJK location aliases', () => {
    expect(findExternalJobs({ q: 'AI', location: 'Bagh' }, reviewed).map(j => j.title)).toEqual(['Senior AI Engineer']);
    expect(findExternalJobs({ q: 'MTBC', location: 'AJK' }, reviewed)).toHaveLength(6);
    expect(findExternalJobs({ location: 'Azad Jammu and Kashmir' }, reviewed)).toHaveLength(13);
    expect(findExternalJobs({ location: 'Rawalkot' }, reviewed)).toHaveLength(1);
    expect(findExternalJobs({ location: 'Lahore' }, reviewed)).toHaveLength(0);
  });
  it('does not invent unconfirmed employment types or work arrangements', () => {
    expect(findExternalJobs({ type: 'full_time' }, reviewed)).toEqual([]);
    expect(findExternalJobs({ mode: 'remote' }, reviewed)).toEqual([]);
  });
  it('removes stale snapshot records and denies unknown records', () => {
    const expired = new Date(externalSource.expiresAt);
    expect(findExternalJobs({}, expired)).toEqual([]);
    expect(findExternalJob('6171c532d301113c', expired)).toBeUndefined();
    expect(findExternalJob('bad-id', reviewed)).toBeUndefined();
    expect(() => externalJobUrl({ id: '//attacker.invalid', title: 'Invalid', employer: 'Invalid', location: 'Invalid' })).toThrow();
  });
  it('preserves external application destinations without allowing arbitrary redirects', () => {
    const path = '/jobs/external/6171c532d301113c/apply';
    expect(authDestination(path)).toBe(path);
    expect(authDestination(`${path}?next=https://attacker.invalid`)).toBe('/dashboard');
    expect(authDestination('/jobs/external/https://attacker.invalid/apply')).toBe('/dashboard');
  });
});
