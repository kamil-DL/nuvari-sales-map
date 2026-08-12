-- Independent of the shops.status sales-pipeline field (which tracks Nuvari's own direct
-- partnership progress with a shop) — this flags shops that are part of Merida's dealer
-- network and sell products Nuvari manufactures as OEM for Merida. A shop can be true here
-- regardless of its own status with Nuvari directly (e.g. still 尚未開發 but already selling
-- Nuvari-made product under the Merida brand).
alter table public.shops add column if not exists sells_merida_oem boolean not null default false;
