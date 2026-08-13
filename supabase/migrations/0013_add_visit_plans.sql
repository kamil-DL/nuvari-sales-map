-- Visit Planner, Phase 1 (see the "Visit Planner — Implementation Plan" artifact for the full
-- design). A visit_plan is the *intent* for one rep's one day ("Cathy visits these 5 shops on
-- Aug 20th, in this order"); visit_plan_stops is the ordered shop list within it. Deliberately
-- layered on top of the existing `visits` table rather than replacing it — a stop links to a real
-- `visits` row once it's actually completed (via visit_plan_stops.visit_id), so all the existing
-- visit-history/photo machinery keeps working untouched.
--
-- Decisions this schema encodes (see the plan artifact's "Decisions" section):
--   1. Any authenticated user can read any plan (open SELECT) — reps can view each other's day
--      plans for coordination, but only edit their own.
--   2. start_location defaults to the depot coordinates, overridable per plan.
--   3. (No schema impact — "mark visited" opens the existing visits.html form.)
--   4. (Not this migration — quota rollover lands with visit_quotas in a later phase.)

create table if not exists public.visit_plans (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references auth.users(id),
  plan_date date not null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  start_location text not null default '24.13315821890205,120.62641783465286',
  status text not null default 'planned',
  created_by uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visit_plans_status_check check (status in ('planned', 'completed', 'cancelled'))
);

create index if not exists visit_plans_rep_date_idx on public.visit_plans (rep_id, plan_date);

create table if not exists public.visit_plan_stops (
  id uuid primary key default gen_random_uuid(),
  visit_plan_id uuid not null references public.visit_plans(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  stop_order integer not null,
  visit_id uuid references public.visits(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (visit_plan_id, stop_order)
);

create index if not exists visit_plan_stops_plan_idx on public.visit_plan_stops (visit_plan_id);

alter table public.visit_plans enable row level security;
alter table public.visit_plan_stops enable row level security;

-- Read access is intentionally open to every authenticated user (same shape as
-- campaigns_select / shop_datasets_select) — decision 1 above. Write access stays restricted to
-- the plan's own rep, or the single admin account already used for shop deletes/dataset deletes
-- (shared/delete-policy.js's SHOP_DELETE_ALLOWED_EMAIL) — reused here rather than introducing a
-- second admin concept.
create policy "visit_plans_select" on public.visit_plans
  for select using (auth.role() = 'authenticated');

create policy "visit_plans_insert" on public.visit_plans
  for insert with check (
    rep_id = auth.uid()
    or (auth.jwt() ->> 'email') = 'kamil.wysocki@datalake-tech.com'
  );

create policy "visit_plans_update" on public.visit_plans
  for update using (
    rep_id = auth.uid()
    or (auth.jwt() ->> 'email') = 'kamil.wysocki@datalake-tech.com'
  );

create policy "visit_plans_delete" on public.visit_plans
  for delete using (
    rep_id = auth.uid()
    or (auth.jwt() ->> 'email') = 'kamil.wysocki@datalake-tech.com'
  );

-- Stops inherit their parent plan's ownership rather than having their own rep_id — a stop's
-- writability is entirely "can I write to the plan it belongs to". select is open, same reasoning
-- as visit_plans_select.
create policy "visit_plan_stops_select" on public.visit_plan_stops
  for select using (auth.role() = 'authenticated');

create policy "visit_plan_stops_insert" on public.visit_plan_stops
  for insert with check (
    exists (
      select 1 from public.visit_plans p
      where p.id = visit_plan_id
        and (p.rep_id = auth.uid() or (auth.jwt() ->> 'email') = 'kamil.wysocki@datalake-tech.com')
    )
  );

create policy "visit_plan_stops_update" on public.visit_plan_stops
  for update using (
    exists (
      select 1 from public.visit_plans p
      where p.id = visit_plan_id
        and (p.rep_id = auth.uid() or (auth.jwt() ->> 'email') = 'kamil.wysocki@datalake-tech.com')
    )
  );

create policy "visit_plan_stops_delete" on public.visit_plan_stops
  for delete using (
    exists (
      select 1 from public.visit_plans p
      where p.id = visit_plan_id
        and (p.rep_id = auth.uid() or (auth.jwt() ->> 'email') = 'kamil.wysocki@datalake-tech.com')
    )
  );
