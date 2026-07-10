alter table public.riot_collection_jobs
drop constraint if exists riot_collection_jobs_target_check;

alter table public.riot_collection_jobs
add constraint riot_collection_jobs_target_check check (
  target_unique_matches in (100, 200, 300, 500)
) not valid;
