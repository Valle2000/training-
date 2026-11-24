-- Mitteilungen (Wochenrückblick): ein Eintrag je Gerät mit Push-Abo.
-- Einmal im SQL-Editor von Supabase ausführen. Lesen und Schreiben nur über den Server (Dienstschlüssel);
-- für Browser gibt es bewusst keine Regeln, die Tabelle ist für sie gesperrt.
create table if not exists public.training_push (
  endpoint text primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.training_push enable row level security;
