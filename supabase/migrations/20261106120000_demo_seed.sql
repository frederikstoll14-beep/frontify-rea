-- =====================================================================
-- Brandbench – Beispiel-Workspace für neue Konten
--
-- Jedes neue Konto bekommt beim ersten Anmelden einen eigenen Workspace mit der Beispiel-Marke
-- („SV Rheinblick 1921“). Das legt die Web-App an. Diese Spalte merkt sich, dass es schon geschehen
-- ist, damit der Beispiel-Workspace nach dem Löschen nicht wiederkommt.
-- Bestehende Konten bekommen kein Beispiel nachträglich.
-- =====================================================================
alter table public.profiles add column demo_seeded_at timestamptz;

update public.profiles set demo_seeded_at = now() where demo_seeded_at is null;
