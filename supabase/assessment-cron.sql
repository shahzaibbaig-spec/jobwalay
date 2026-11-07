-- Run once through a trusted database administration session after enabling
-- pg_cron in Supabase. The CLI worker is an alternative; never expose a public
-- unauthenticated worker route. Both runners are safe concurrently.
select cron.schedule('jobwalay-assessment-expiry','15 seconds',$$select public.process_assessment_expiry(50);$$);
