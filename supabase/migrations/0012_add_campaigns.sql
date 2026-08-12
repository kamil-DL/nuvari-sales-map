-- A "campaign" is a time-boxed outreach drive (e.g. "2026年8月夥伴拓展計畫") — deliberately
-- independent of shops.priority (a rep's standing "call this one first" ranking that has nothing
-- to do with any particular drive) and of shops.status (the actual pipeline stage). A shop can
-- belong to at most one active campaign at a time, mirroring how dataset_id already works —
-- same RLS shape as shop_datasets (0002_add_shop_datasets.sql).
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date,
  ends_on date,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.shops
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;

alter table public.campaigns enable row level security;

create policy "campaigns_select" on public.campaigns
  for select using (auth.role() = 'authenticated');

create policy "campaigns_insert" on public.campaigns
  for insert with check (auth.uid() = created_by);

create policy "campaigns_update" on public.campaigns
  for update using (auth.uid() = created_by);

create policy "campaigns_delete" on public.campaigns
  for delete using (auth.uid() = created_by);
