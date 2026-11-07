import { z } from 'zod';
import { searchSchema } from './schemas';

export const externalSource = {
  name: 'Indeed',
  url: 'https://pk.indeed.com/jobs?l=Azad+Kashmir',
  reviewedOn: '2026-11-07',
  expiresAt: '2026-11-21T00:00:00+05:00',
};

const entrySchema = z.object({
  id: z.string().regex(/^[a-f0-9]{16}$/),
  title: z.string().min(1).max(160),
  employer: z.string().min(1).max(160),
  location: z.string().min(1).max(160),
});

// Factual metadata observed on the source search page. No full advertisements,
// employer accounts, verification decisions, or Jobwalay applications are copied.
const entries = z.array(entrySchema).parse([
  { id: 'a00e92aff17bd79c', title: 'Admissions Officer', employer: 'Times Consultant', location: 'Kotli, Azad Kashmir' },
  { id: '47a67e9137ffa57a', title: 'Visit Visa & Travel Consultant', employer: 'Times Consultant', location: 'Kotli, Azad Kashmir' },
  { id: '1f1e4bc3531f439c', title: 'Educational Counselor', employer: 'Times Consultant', location: 'Kotli, Azad Kashmir' },
  { id: '6171c532d301113c', title: 'Senior AI Engineer', employer: 'MTBC', location: 'Bagh, Azad Kashmir' },
  { id: 'b1743bc2a31ba0e1', title: 'Education Consultant – Sales & Admissions', employer: 'Times Consultant', location: 'Kotli, Azad Kashmir' },
  { id: '9cf8b31d1947e42e', title: 'Robotics Lab Instructor', employer: 'MTBC CareCloud', location: 'Bagh, Azad Kashmir' },
  { id: '91d26dec05125dae', title: 'Red Team Engineer', employer: 'MTBC', location: 'Bagh, Azad Kashmir' },
  { id: '7f039b3e76c6c345', title: 'Education Consultant – Scholarships & Research', employer: 'Times Consultant', location: 'Kotli, Azad Kashmir' },
  { id: '3382c7f06f401c02', title: 'Manager Cyber Security', employer: 'MTBC', location: 'Bagh, Azad Kashmir' },
  { id: '4f8802af0f6651cf', title: 'Midwife (Female)', employer: 'MTBC CareCloud', location: 'Azad Kashmir' },
  { id: '752bde954bf633c0', title: 'Medical Officer (Female)', employer: 'MTBC CareCloud', location: 'Azad Kashmir' },
  { id: '3a5117773053f7e4', title: 'Area Manager (Male) – Rawalakot', employer: 'Moonlight Publishers', location: 'Rawalakot, Azad Kashmir' },
  { id: 'f3832b57aee28d1b', title: 'IELTS & PTE Teacher', employer: 'Times Consultant', location: 'Kotli, Azad Kashmir' },
]);

export type ExternalJob = z.infer<typeof entrySchema>;
export function externalJobUrl(job: ExternalJob) {
  return `https://pk.indeed.com/viewjob?jk=${entrySchema.shape.id.parse(job.id)}`;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\bajk\b/g, 'azad kashmir').replace(/\bazad jammu (?:and |& )?kashmir\b/g, 'azad kashmir').replace(/\brawalkot\b/g, 'rawalakot').replace(/\s+/g, ' ').trim();
}

export function findExternalJobs(input: unknown, now = new Date()) {
  const filters = searchSchema.parse(input);
  if (now.getTime() >= Date.parse(externalSource.expiresAt)) return [];
  // Employment type and work arrangement were not confirmed for every source
  // record. Unknown values must not satisfy those filters.
  if (filters.mode || filters.type) return [];
  return entries.filter(job => {
    const text = normalize(`${job.title} ${job.employer} ${job.location}`);
    return normalize(filters.q).split(' ').every(word => text.includes(word))
      && normalize(job.location).includes(normalize(filters.location));
  });
}

export function findExternalJob(id: string, now = new Date()) {
  return findExternalJobs({}, now).find(job => job.id === id);
}
