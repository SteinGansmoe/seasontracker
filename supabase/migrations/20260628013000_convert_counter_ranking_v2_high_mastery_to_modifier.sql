alter table public.counter_ranking_v2_mechanical_reviews
add column if not exists high_mastery_required boolean not null default false;

update public.counter_ranking_v2_mechanical_reviews
set high_mastery_required = true,
    public_eligible = false,
    review_status = 'needs_more_data'
where review_status = 'high_mastery_required';

alter table public.counter_ranking_v2_mechanical_reviews
drop constraint if exists counter_ranking_v2_mechanical_review_status_check;

alter table public.counter_ranking_v2_mechanical_reviews
add constraint counter_ranking_v2_mechanical_review_status_check
check (
  review_status in (
    'unreviewed',
    'verified_strong_counter',
    'verified_soft_counter',
    'not_a_counter',
    'needs_more_data',
    'incorrect_suggestion'
  )
);
