-- Take public.workspaces out of the anonymous GraphQL schema.
--
-- This is DISCOVERABILITY, not access. RLS already denies every row to anon:
-- auth.uid() is null for that role, so `auth.uid() = user_id` is never true.
-- But the SELECT *grant* is what puts a table into the pg_graphql schema, so an
-- unauthenticated caller holding only the publishable key can enumerate the
-- table and its column names. Clears advisor lint 0026
-- pg_graphql_anon_table_exposed.
--
-- Safe for the application: every call site in src/lib/supabase/workspaceSync.ts
-- takes a userId that only exists after sign-in, so all four run as
-- `authenticated` and none as `anon`.
--
-- The sibling lint, 0027 pg_graphql_authenticated_table_exposed, is NOT cleared
-- and cannot be: loadWorkspace() selects from this table as the signed-in user,
-- so revoking SELECT from `authenticated` would break cloud hydration for
-- everyone. That lint is accepted by design.

revoke select on public.workspaces from anon;
