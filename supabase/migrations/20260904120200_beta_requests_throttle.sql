-- beta_requests: lead capture from the two landing pages.
--
-- The first half is a BASELINE — this table was created by hand in the
-- dashboard, as workspaces was, and every statement is idempotent so it is a
-- no-op against the live project. Verified against the live schema.
--
-- The second half is the actual change: a throttle. The RLS policy accepts
-- anonymous inserts with only a status check, and email is UNIQUE, so replaying
-- one address is already blocked — the open abuse path is an unbounded stream of
-- distinct fabricated addresses.

-- ── Baseline ─────────────────────────────────────────────────────────────

create table if not exists public.beta_requests (
    id         uuid primary key default gen_random_uuid(),
    email      text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    name       text check (char_length(name) <= 120),
    reason     text check (char_length(reason) <= 2000),
    status     text not null default 'pending'
               check (status in ('pending', 'invited', 'rejected')),
    created_at timestamptz not null default now()
);

alter table public.beta_requests enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'beta_requests'
          and policyname = 'Anyone can request beta access'
    ) then
        create policy "Anyone can request beta access"
            on public.beta_requests
            for insert
            to anon, authenticated
            with check (status = 'pending');
    end if;
end
$$;

-- ── Throttle ─────────────────────────────────────────────────────────────

-- md5 of the client IP plus a fixed salt. This is a throttle KEY, not
-- anonymisation: IPv4 is small enough to brute-force for anyone who can read
-- both this column and this function. It lives exactly as long as the row.
alter table public.beta_requests
    add column if not exists ip_hash text;

create index if not exists beta_requests_ip_hash_created_at_idx
    on public.beta_requests (ip_hash, created_at desc);

create or replace function public.beta_requests_throttle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    -- Both limits are per rolling hour, and both are named here rather than
    -- inlined at their use site.
    per_ip_limit constant int         := 3;
    global_limit constant int         := 60;
    ip_salt      constant text        := 'lorecanvas-beta-throttle';
    window_start constant timestamptz := now() - interval '1 hour';
    client_ip text;
    recent int;
begin
    -- Never trust a client-supplied value here: anon holds INSERT on this
    -- table, so the payload could otherwise carry someone else's hash.
    new.ip_hash := null;

    client_ip := nullif(btrim(split_part(
        coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''),
        ',', 1
    )), '');

    if client_ip is not null then
        new.ip_hash := md5(client_ip || ip_salt);

        select count(*) into recent
        from public.beta_requests
        where ip_hash = new.ip_hash
          and created_at >= window_start;

        if recent >= per_ip_limit then
            raise exception 'Too many beta requests from this address in the last hour.'
                using errcode = 'PT429';
        end if;
    end if;

    -- Backstop for a missing or forged header. A flood still gets through this
    -- one per hour, which is a rate a person can read by hand.
    select count(*) into recent
    from public.beta_requests
    where created_at >= window_start;

    if recent >= global_limit then
        raise exception 'The beta list is receiving too many requests right now.'
            using errcode = 'PT429';
    end if;

    return new;
end;
$$;

drop trigger if exists beta_requests_throttle_trg on public.beta_requests;

create trigger beta_requests_throttle_trg
    before insert on public.beta_requests
    for each row execute function public.beta_requests_throttle();

-- The throttle is a TRIGGER function: a trigger runs as part of the statement
-- that fired it, so no caller needs EXECUTE. But living in `public` as SECURITY
-- DEFINER meant PostgREST exposed it at /rest/v1/rpc/, which the advisor flags
-- (lints 0028 and 0029). Revoking EXECUTE closes the RPC path; the trigger is
-- unaffected, verified against the live project by inserting past the limit
-- after the revoke.
revoke execute on function public.beta_requests_throttle() from public;
revoke execute on function public.beta_requests_throttle() from anon;
revoke execute on function public.beta_requests_throttle() from authenticated;
