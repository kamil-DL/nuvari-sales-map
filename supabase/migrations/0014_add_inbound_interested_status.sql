-- Adds 主動要合作-有意願 (Inbound - Interested) as a 10th status: a shop that reached out to us
-- wanting to partner, rather than one we cold-called/visited — sits outside the main
-- 尚未開發→電訪過/拜訪過→...→已合作 pipeline shape (no phone/visit step implied), so it isn't
-- nested under 拜訪過 like the other "-有意願" status. Same drop-and-recreate pattern as
-- 0011_expand_status_check_constraint.sql — this CHECK constraint isn't tracked by Postgres
-- migrations tooling, it's just re-stated here in full each time the vocabulary grows.
alter table public.shops drop constraint if exists shops_status_check;
alter table public.shops add constraint shops_status_check check (status in (
  '尚未開發','電訪過','電訪過-拒絕','拜訪過','拜訪過-有意願','拜訪過-評估中','拜訪過-拒絕','已合作','已合作-流失',
  '主動要合作-有意願'
));
