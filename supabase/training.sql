-- Trainings-App: Tabellen im selben Supabase-Projekt wie SkiWax (gleiche Anmeldung, getrennte Daten).
-- Einmal im Supabase-Dashboard unter „SQL Editor“ ausführen. Kann gefahrlos erneut ausgeführt werden
-- und ändert nichts an den SkiWax-Tabellen (records, pools, …).
--
-- Modell: Jeder Datensatz der App (Einheit, Krafteinheit, Plan, Rennen, Einstellungen, …) ist eine Zeile.
-- Jeder sieht nur seine eigenen Zeilen. Gelöschte Datensätze bleiben als „deleted“ stehen,
-- damit andere Geräte das Löschen mitbekommen.

create table if not exists public.training_records (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  collection text not null,
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (owner, collection, id)
);
create index if not exists training_records_updated on public.training_records (owner, updated_at);

-- Puls-/Leistungsverläufe je Einheit (5-s-Raster), getrennt, damit der Abgleich klein bleibt.
create table if not exists public.training_series (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  activity_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner, activity_id)
);

-- Zeitstempel immer vom Server, Besitzer nicht änderbar.
create or replace function public.training_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  if tg_op = 'UPDATE' then new.owner := old.owner; end if;
  return new;
end $$;
drop trigger if exists training_records_touch on public.training_records;
create trigger training_records_touch before insert or update on public.training_records
  for each row execute function public.training_touch();
drop trigger if exists training_series_touch on public.training_series;
create trigger training_series_touch before insert or update on public.training_series
  for each row execute function public.training_touch();

alter table public.training_records enable row level security;
alter table public.training_series enable row level security;

drop policy if exists training_records_own on public.training_records;
create policy training_records_own on public.training_records for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists training_series_own on public.training_series;
create policy training_series_own on public.training_series for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

grant select, insert, update, delete on public.training_records, public.training_series to authenticated;
