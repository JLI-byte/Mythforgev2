-- Baseline for public.workspaces — the table that holds every customer's
-- manuscript. It existed only in the dashboard, so a fresh project could not be
-- reproduced from this repository and nothing recorded what the live shape was.
--
-- This REPRODUCES what is already live; it is not a change. Every statement is
-- guarded, so running it against production is a no-op and running it against an
-- empty project yields the same schema. Verified against the live database:
-- column types, defaults, nullability, ON DELETE CASCADE on the user foreign
-- key, the UNIQUE (user_id) constraint, and the policy's exact roles ({public},
-- i.e. no TO clause), command (ALL), USING and WITH CHECK.

create table if not exists public.workspaces (
    id         uuid primary key default gen_random_uuid(),
    -- One row per user. CASCADE so deleting the auth user takes the manuscript
    -- with it: the account-deletion path depends on this.
    user_id    uuid not null unique references auth.users (id) on delete cascade,
    data       jsonb not null default '{}'::jsonb,
    updated_at timestamptz default now()
);

alter table public.workspaces enable row level security;

-- Cross-account access is closed here, at the database, rather than in the
-- client: auth.uid() is null for the anon role, so the predicate is never true
-- for an unauthenticated caller.
do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'workspaces'
          and policyname = 'Users own their workspace'
    ) then
        create policy "Users own their workspace"
            on public.workspaces
            for all
            using (auth.uid() = user_id)
            with check (auth.uid() = user_id);
    end if;
end
$$;
