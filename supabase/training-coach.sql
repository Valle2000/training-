-- Trainer-Zugang (nur lesen): Der Betreiber gibt die E-Mail-Adresse einer Trainerin frei.
-- Sie sieht dann Einheiten, Pläne, Rennen, Key Sessions, Wellness, Krankheiten und Verläufe des Betreibers,
-- kann aber nichts ändern oder löschen. Einmal im SQL Editor ausführen (nach training.sql und training-admin.sql).
-- Kann erneut ausgeführt werden.

create table if not exists public.training_coaches (
  athlete uuid not null references auth.users on delete cascade,
  coach uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (athlete, coach)
);
alter table public.training_coaches enable row level security;

-- Betreiber und Trainerin sehen nur ihre eigene Verknüpfung. Schreiben nur über die Funktionen unten.
drop policy if exists training_coaches_self on public.training_coaches;
create policy training_coaches_self on public.training_coaches for select to authenticated
  using (athlete = auth.uid() or coach = auth.uid());
revoke insert, update, delete on public.training_coaches from authenticated;
grant select on public.training_coaches to authenticated;

-- Trainerin darf die Daten ihres Betreibers lesen (zusätzlich zur Eigentümer-Regel).
drop policy if exists training_records_coach_read on public.training_records;
create policy training_records_coach_read on public.training_records for select to authenticated
  using (exists (select 1 from public.training_coaches c where c.athlete = training_records.owner and c.coach = auth.uid()));
drop policy if exists training_series_coach_read on public.training_series;
create policy training_series_coach_read on public.training_series for select to authenticated
  using (exists (select 1 from public.training_coaches c where c.athlete = training_series.owner and c.coach = auth.uid()));

-- Freigeben: nur der Betreiber, per E-Mail der Trainerin (das Konto muss bereits existieren).
create or replace function public.training_grant_coach(coach_email text) returns void
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if not public.training_is_admin() then raise exception 'Nur der Betreiber kann freigeben.'; end if;
  select id into cid from auth.users where lower(email) = lower(trim(coach_email)) limit 1;
  if cid is null then raise exception 'Kein Konto mit dieser E-Mail. Die Trainerin muss sich zuerst registrieren.'; end if;
  if cid = auth.uid() then raise exception 'Du kannst dich nicht selbst freigeben.'; end if;
  insert into public.training_coaches (athlete, coach) values (auth.uid(), cid) on conflict do nothing;
end $$;

-- Freigabe entfernen.
create or replace function public.training_revoke_coach(coach_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.training_is_admin() then raise exception 'Nur der Betreiber kann Freigaben entfernen.'; end if;
  delete from public.training_coaches where athlete = auth.uid() and coach = coach_id;
end $$;

revoke all on function public.training_grant_coach(text) from public;
revoke all on function public.training_revoke_coach(uuid) from public;
grant execute on function public.training_grant_coach(text) to authenticated;
grant execute on function public.training_revoke_coach(uuid) to authenticated;

-- Planen: Die Trainerin darf nur den Trainingsplan (Sammlung „plan“) des Betreibers ändern.
alter table public.training_coaches add column if not exists can_plan boolean not null default true;
drop policy if exists training_records_coach_plan on public.training_records;
create policy training_records_coach_plan on public.training_records for all to authenticated
  using (collection = 'plan' and exists (select 1 from public.training_coaches c where c.athlete = training_records.owner and c.coach = auth.uid() and c.can_plan))
  with check (collection = 'plan' and exists (select 1 from public.training_coaches c where c.athlete = training_records.owner and c.coach = auth.uid() and c.can_plan));
