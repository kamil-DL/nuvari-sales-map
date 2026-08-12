-- The live shops table has a shops_status_check CHECK constraint that isn't tracked in any
-- earlier migration file here (schema drift — see the note at the top of 0000_initial_schema.sql).
-- It only allowed the original 7-value vocabulary, so it silently rejected the two new statuses
-- added this session (拜訪過-有意願, 拜訪過-評估中) with a generic "violates check constraint"
-- error. Drop and recreate it with the full current 9-value vocabulary.
alter table public.shops drop constraint if exists shops_status_check;
alter table public.shops add constraint shops_status_check check (status in (
  '尚未開發','電訪過','電訪過-拒絕','拜訪過','拜訪過-有意願','拜訪過-評估中','拜訪過-拒絕','已合作','已合作-流失'
));
