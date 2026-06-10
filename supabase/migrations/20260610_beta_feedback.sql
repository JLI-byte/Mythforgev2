-- Beta feedback table: lets the BetaFeedbackPanel deliver feedback to the
-- developer instead of only the user's own localStorage.
-- Apply via Supabase dashboard SQL editor or `supabase db push` once the
-- project is active.

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('bug', 'feature', 'general')),
  message text not null check (char_length(message) <= 5000),
  app_version text,
  created_at timestamptz not null default now()
);

alter table public.beta_feedback enable row level security;

-- Authenticated users may submit feedback as themselves; nobody can read or
-- modify rows through the anon key (developer reads via the dashboard).
create policy "Users can insert their own feedback"
  on public.beta_feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);
