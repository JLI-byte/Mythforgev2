-- A dedicated endpoint for the keep-alive workflow.
--
-- WHY THIS EXISTS
--
-- .github/workflows/supabase-keepalive.yml kept the free-tier project awake by
-- selecting from public.workspaces as `anon`. 20260904120100 revoked that
-- grant to take the table out of the anonymous GraphQL schema, which was the
-- right call for the table and the wrong one for the workflow: every run since
-- has failed with 42501, and the project has been drifting toward a pause with
-- nothing surfacing it.
--
-- WHY A FUNCTION AND NOT A TABLE
--
-- The obvious repair is a throwaway table with SELECT granted to anon. That
-- works, but a SELECT grant is exactly what puts an object into the anonymous
-- GraphQL schema (advisor lint 0026) — reintroducing, on a new object, the
-- class of exposure 20260904120100 removed.
--
-- A function grants no table access at all. It is deliberately NOT SECURITY
-- DEFINER: that would trip lints 0028 and 0029, as the beta_requests throttle
-- did in 20260904120200. It runs as the caller, reads nothing, and returns a
-- constant.
--
-- WHAT IT ACTUALLY PROVES
--
-- PostgREST executes this in Postgres, so a successful call is a genuine
-- round trip to the database — which is what the pause heuristic counts. It is
-- not a mock: if the database is unreachable, the call fails, which is the
-- behaviour the workflow wants.

create or replace function public.keepalive()
returns integer
language sql
stable
-- Empty search_path satisfies lint 0011. The body resolves nothing, so there
-- is no schema for it to need.
set search_path = ''
as $$ select 1 $$;

comment on function public.keepalive() is
    'Keep-alive probe for the scheduled GitHub workflow. Reads nothing; a successful call only proves the database answered.';

-- Only the roles the workflow can actually present. `public` would include
-- every future role by default, which is more than this needs.
revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
