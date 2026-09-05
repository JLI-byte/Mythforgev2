-- Account deletion. Table stakes for a paid product and a legal requirement in
-- several jurisdictions.
--
-- SECURITY DEFINER because removing a row from auth.users needs privileges the
-- browser will never hold. The function is safe to expose because it takes no
-- arguments and can only ever act on auth.uid() — its own caller. There is no
-- parameter to point it at somebody else.
--
-- The alternative was a Next.js route holding SUPABASE_SERVICE_ROLE_KEY. That
-- key is omnipotent over every account in the project, and the deployment does
-- not currently carry one; a function whose entire body is
-- `delete from auth.users where id = auth.uid()` is a far smaller thing to get
-- wrong.
--
-- Deliberately NOT deleting from public.workspaces here: workspaces_user_id_fkey
-- is ON DELETE CASCADE (see 20260904120000_workspaces.sql), so the row goes with
-- the user. A second delete would be a lie about where the guarantee lives.
--
-- public.beta_feedback.user_id is ON DELETE SET NULL (see
-- 20260610_beta_feedback.sql), so feedback text survives with the account
-- detached. The UI says so before the user confirms.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    uid uuid := auth.uid();
begin
    if uid is null then
        raise exception 'Not signed in.' using errcode = 'PT401';
    end if;

    delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

-- Advisor lint 0029 (authenticated_security_definer_function_executable) fires
-- on this function and is ACCEPTED BY DESIGN. Unlike beta_requests_throttle,
-- which is a trigger and needed no caller, this one exists precisely to be
-- called from the client at /rest/v1/rpc/delete_own_account. Its safety comes
-- from taking no arguments and reading auth.uid() itself, not from being
-- unreachable. anon holds no EXECUTE.
