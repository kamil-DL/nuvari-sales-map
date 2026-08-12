-- How many physical GO / Ultra product samples Nuvari has given a shop, independent of the
-- shops.status sales-pipeline field. A shop can have samples installed at any status (e.g. a
-- 已合作 shop clearly has one; a 拜訪過-有意願 shop might have one waiting to be picked up).
-- Null/0 both mean "no sample" — the app treats them the same, only writes a positive integer.
alter table public.shops add column if not exists go_sample_qty integer check (go_sample_qty is null or go_sample_qty >= 0);
alter table public.shops add column if not exists ultra_sample_qty integer check (ultra_sample_qty is null or ultra_sample_qty >= 0);
