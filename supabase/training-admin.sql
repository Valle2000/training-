-- Trainings-App nur für den Betreiber: Im selben Supabase-Projekt wie SkiWax können sich weiterhin alle
-- SkiWax-Nutzer registrieren. Die Trainings-Tabellen sind dann aber nur für Konten freigegeben, die hier
-- eingetragen sind. Einmal im SQL Editor ausführen (nach supabase/training.sql). Kann erneut ausgeführt werden.

create table if not exists public.training_admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.training_admins enable row level security;
drop policy if exists training_admins_self on public.training_admins;
create policy training_admins_self on public.training_admins for select to authenticated
  using (user_id = auth.uid());
-- Kein Schreibzugriff für Clients: Betreiber werden nur direkt im SQL Editor eingetragen.
revoke insert, update, delete on public.training_admins from authenticated;
grant select on public.training_admins to authenticated;

create or replace function public.training_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.training_admins where user_id = auth.uid());
$$;

drop policy if exists training_records_own on public.training_records;
create policy training_records_own on public.training_records for all to authenticated
  using (owner = auth.uid() and public.training_is_admin()) with check (owner = auth.uid() and public.training_is_admin());
drop policy if exists training_series_own on public.training_series;
create policy training_series_own on public.training_series for all to authenticated
  using (owner = auth.uid() and public.training_is_admin()) with check (owner = auth.uid() and public.training_is_admin());

-- Dich selbst als Betreiber eintragen (E-Mail hier einsetzen, nur im SQL Editor ausführen, nicht im Repository speichern):
-- insert into public.training_admins (user_id) select id from auth.users where email = 'DEINE-EMAIL@beispiel.de';
