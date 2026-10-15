-- =====================================================================
-- Markenkompass – Datenbankschema
-- Brand-Identity-Portal (funktionaler Nachbau der Kernfunktionen von Frontify)
--
-- Hierarchie:
--   workspace (z. B. Kurs "Brand Identity WS 26/27")
--     └─ brand (Unternehmen / Verein / Verband / Organisation)
--          ├─ guidelines → guideline_pages → blocks       (Brand Guidelines)
--          ├─ color_palettes → colors                       (Farben)
--          ├─ fonts, text_styles                            (Typografie)
--          ├─ libraries → assets → asset_versions           (Media/Logo/Icon/Dokumente …)
--          ├─ collections ↔ assets                          (Sammlungen)
--          ├─ comments, activity                            (Zusammenarbeit)
--          └─ brand_members, invitations                    (Rechte)
--
-- Rechte (effektive Rolle pro Marke):
--   workspace owner/admin → brand admin
--   brand_members.role    → admin | editor | viewer
--   workspace member      → viewer, wenn brand.visibility = 'workspace'
--   brand.is_public       → anonymes Lesen (ohne Kommentare, Mitglieder, Verlauf)
--
-- Dieses Skript ist idempotent genug für den einmaligen Einsatz im
-- Supabase-SQL-Editor und wird lokal von der Supabase-CLI als Migration genutzt.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Typen
-- ---------------------------------------------------------------------
create type public.workspace_role as enum ('owner', 'admin', 'member');
create type public.brand_role as enum ('admin', 'editor', 'viewer');
create type public.brand_visibility as enum ('private', 'workspace');
create type public.library_kind as enum ('media', 'logos', 'icons', 'documents', 'templates', 'audio_video');
create type public.page_kind as enum ('chapter', 'page');

-- ---------------------------------------------------------------------
-- Hilfsfunktion: Slugs
-- ---------------------------------------------------------------------
create or replace function public.slugify(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(
        lower(
          replace(replace(replace(replace(coalesce(value, ''), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss')
        ),
        '[^a-z0-9]+', '-', 'g'
      )),
      ''
    ),
    'eintrag'
  );
$$;

-- ---------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  org_type text not null default 'organisation',
  tagline text not null default '',
  description text not null default '',
  logo_path text,
  cover_path text,
  theme jsonb not null default '{}'::jsonb,
  home jsonb not null default '{}'::jsonb,
  visibility public.brand_visibility not null default 'workspace',
  is_public boolean not null default false,
  public_until timestamptz,
  public_downloads boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index brands_workspace_idx on public.brands (workspace_id);

create table public.brand_members (
  brand_id uuid not null references public.brands (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.brand_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (brand_id, user_id)
);
create index brand_members_user_idx on public.brand_members (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  brand_id uuid references public.brands (id) on delete cascade,
  email text check (email is null or email = lower(email)),
  workspace_role public.workspace_role not null default 'member' check (workspace_role <> 'owner'),
  brand_role public.brand_role,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0,
  revoked boolean not null default false,
  expires_at timestamptz not null default now() + interval '60 days',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((brand_id is null) = (brand_role is null))
);
create index invitations_workspace_idx on public.invitations (workspace_id);
create index invitations_email_idx on public.invitations (email) where email is not null;

create table public.guidelines (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  icon text not null default 'book-open',
  cover_path text,
  sort integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, slug)
);

create table public.guideline_pages (
  id uuid primary key default gen_random_uuid(),
  guideline_id uuid not null references public.guidelines (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  parent_id uuid references public.guideline_pages (id) on delete cascade,
  kind public.page_kind not null default 'page',
  title text not null check (char_length(title) between 1 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  intro text not null default '',
  sort integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guideline_id, slug)
);
create index guideline_pages_guideline_idx on public.guideline_pages (guideline_id, sort);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.guideline_pages (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  type text not null check (type ~ '^[a-z_]{2,40}$'),
  width text not null default 'full' check (width in ('full', 'two_thirds', 'half', 'third', 'quarter')),
  sort integer not null default 0,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
create index blocks_page_idx on public.blocks (page_id, sort);

create table public.color_palettes (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.colors (
  id uuid primary key default gen_random_uuid(),
  palette_id uuid not null references public.color_palettes (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  hex text not null check (hex ~ '^#[0-9A-F]{6}$'),
  token text not null default '' check (token = '' or token ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  cmyk text not null default '',
  pantone text not null default '',
  hks text not null default '',
  ral text not null default '',
  ncs text not null default '',
  usage text not null default '',
  description text not null default '',
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index colors_palette_idx on public.colors (palette_id, sort);

create table public.fonts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  family text not null check (char_length(family) between 1 and 120),
  source text not null default 'google' check (source in ('google', 'upload', 'system')),
  role text not null default '' ,
  weights integer[] not null default '{400,700}',
  files jsonb not null default '[]'::jsonb,
  fallback text not null default 'sans-serif',
  license text not null default '',
  description text not null default '',
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.text_styles (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  token text not null default '' check (token = '' or token ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  font_family text not null,
  font_weight integer not null default 400 check (font_weight between 100 and 900),
  font_size numeric not null default 16 check (font_size > 0 and font_size <= 400),
  line_height numeric not null default 1.4 check (line_height > 0 and line_height <= 5),
  letter_spacing numeric not null default 0 check (letter_spacing between -1 and 2),
  text_transform text not null default 'none' check (text_transform in ('none', 'uppercase', 'lowercase', 'capitalize')),
  italic boolean not null default false,
  sample text not null default '',
  usage text not null default '',
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.libraries (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  kind public.library_kind not null default 'media',
  name text not null check (char_length(name) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (brand_id, slug)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  file_path text not null,
  thumb_path text,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  ext text not null default '',
  size_bytes bigint not null default 0,
  width integer,
  height integer,
  tags text[] not null default '{}',
  copyright text not null default '',
  license_note text not null default '',
  expires_at date,
  downloadable boolean not null default true,
  version integer not null default 1,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assets_library_idx on public.assets (library_id, created_at desc);
create index assets_brand_idx on public.assets (brand_id);
create index assets_tags_idx on public.assets using gin (tags);

create table public.asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  version integer not null,
  file_path text not null,
  thumb_path text,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  width integer,
  height integer,
  note text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (asset_id, version)
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  library_id uuid not null references public.libraries (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.collection_assets (
  collection_id uuid not null references public.collections (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  sort integer not null default 0,
  primary key (collection_id, asset_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  page_id uuid references public.guideline_pages (id) on delete cascade,
  asset_id uuid references public.assets (id) on delete cascade,
  block_id uuid references public.blocks (id) on delete set null,
  parent_id uuid references public.comments (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  body text not null check (char_length(body) between 1 and 4000),
  pos_x numeric check (pos_x is null or pos_x between 0 and 1),
  pos_y numeric check (pos_y is null or pos_y between 0 and 1),
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((page_id is not null)::int + (asset_id is not null)::int = 1)
);
create index comments_page_idx on public.comments (page_id) where page_id is not null;
create index comments_asset_idx on public.comments (asset_id) where asset_id is not null;

-- Seitenversionen (Snapshots der Blöcke, z. B. vor Abgaben)
create table public.page_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.guideline_pages (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  label text not null default '',
  snapshot jsonb not null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index page_revisions_page_idx on public.page_revisions (page_id, created_at desc);

create table public.activity (
  id bigint generated always as identity primary key,
  brand_id uuid not null references public.brands (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  label text not null default '',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_brand_idx on public.activity (brand_id, created_at desc);

-- ---------------------------------------------------------------------
-- Rechte-Funktionen (security definer, umgehen RLS gezielt und lesend)
-- ---------------------------------------------------------------------
create or replace function public.workspace_role_of(p_workspace uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = ''
as $$
  select wm.role
  from public.workspace_members wm
  where wm.workspace_id = p_workspace and wm.user_id = auth.uid();
$$;

create or replace function public.brand_role_of(p_brand uuid)
returns public.brand_role
language sql
stable
security definer
set search_path = ''
as $$
  with b as (
    select id, workspace_id, visibility from public.brands where id = p_brand
  ),
  ws as (
    select wm.role from public.workspace_members wm, b
    where wm.workspace_id = b.workspace_id and wm.user_id = auth.uid()
  ),
  bm as (
    select m.role from public.brand_members m where m.brand_id = p_brand and m.user_id = auth.uid()
  )
  select case
    when auth.uid() is null then null
    when exists (select 1 from ws where role in ('owner', 'admin')) then 'admin'::public.brand_role
    when exists (select 1 from bm where role = 'admin') then 'admin'::public.brand_role
    when exists (select 1 from bm where role = 'editor') then 'editor'::public.brand_role
    when exists (select 1 from bm where role = 'viewer') then 'viewer'::public.brand_role
    when exists (select 1 from ws) and (select visibility from b) = 'workspace' then 'viewer'::public.brand_role
    else null
  end;
$$;

create or replace function public.can_view_brand(p_brand uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.brand_role_of(p_brand) is not null
      or exists (
        select 1 from public.brands b
        where b.id = p_brand and b.is_public and (b.public_until is null or b.public_until > now())
      );
$$;

create or replace function public.is_brand_member(p_brand uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.brand_role_of(p_brand) is not null;
$$;

create or replace function public.can_edit_brand(p_brand uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.brand_role_of(p_brand) in ('admin', 'editor');
$$;

create or replace function public.can_admin_brand(p_brand uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.brand_role_of(p_brand) = 'admin';
$$;

create or replace function public.can_download_brand(p_brand uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.brand_role_of(p_brand) is not null
      or exists (
        select 1 from public.brands b
        where b.id = p_brand and b.is_public and b.public_downloads
          and (b.public_until is null or b.public_until > now())
      );
$$;

create or replace function public.shares_workspace_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members a
    join public.workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid() and b.user_id = p_user
  ) or exists (
    select 1
    from public.brand_members a
    join public.brand_members b on a.brand_id = b.brand_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

-- ---------------------------------------------------------------------
-- Trigger: Profile, Zeitstempel, abgeleitete brand_id, Mitgliedschaften
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger brands_touch before update on public.brands
  for each row execute function public.touch_updated_at();
create trigger guidelines_touch before update on public.guidelines
  for each row execute function public.touch_updated_at();
create trigger guideline_pages_touch before update on public.guideline_pages
  for each row execute function public.touch_updated_at();
create trigger blocks_touch before update on public.blocks
  for each row execute function public.touch_updated_at();
create trigger assets_touch before update on public.assets
  for each row execute function public.touch_updated_at();
create trigger comments_touch before update on public.comments
  for each row execute function public.touch_updated_at();

-- brand_id wird immer aus dem Elternobjekt abgeleitet (kein Cross-Brand-Schreiben möglich)
create or replace function public.derive_brand_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brand uuid;
begin
  case tg_table_name
    when 'guideline_pages' then
      select brand_id into v_brand from public.guidelines where id = new.guideline_id;
      if new.parent_id is not null and not exists (
        select 1 from public.guideline_pages p
        where p.id = new.parent_id and p.guideline_id = new.guideline_id and p.kind = 'chapter'
      ) then
        raise exception 'parent_id muss ein Kapitel derselben Guideline sein';
      end if;
      if new.parent_id is not null and new.kind = 'chapter' then
        raise exception 'Kapitel können nicht verschachtelt werden';
      end if;
    when 'blocks' then
      select brand_id into v_brand from public.guideline_pages where id = new.page_id;
    when 'colors' then
      select brand_id into v_brand from public.color_palettes where id = new.palette_id;
    when 'assets' then
      select brand_id into v_brand from public.libraries where id = new.library_id;
    when 'asset_versions' then
      select brand_id into v_brand from public.assets where id = new.asset_id;
    when 'collections' then
      select brand_id into v_brand from public.libraries where id = new.library_id;
    when 'collection_assets' then
      select brand_id into v_brand from public.collections where id = new.collection_id;
      if not exists (select 1 from public.assets a where a.id = new.asset_id and a.brand_id = v_brand) then
        raise exception 'Asset gehört nicht zu dieser Marke';
      end if;
    when 'page_revisions' then
      select brand_id into v_brand from public.guideline_pages where id = new.page_id;
    when 'comments' then
      if new.page_id is not null then
        select brand_id into v_brand from public.guideline_pages where id = new.page_id;
      else
        select brand_id into v_brand from public.assets where id = new.asset_id;
      end if;
      if new.parent_id is not null and not exists (
        select 1 from public.comments c where c.id = new.parent_id and c.brand_id = v_brand
      ) then
        raise exception 'Antwort gehört nicht zu dieser Marke';
      end if;
    else
      raise exception 'derive_brand_id: unbekannte Tabelle %', tg_table_name;
  end case;
  if v_brand is null then
    raise exception 'Elternobjekt nicht gefunden';
  end if;
  new.brand_id := v_brand;
  return new;
end;
$$;

create trigger guideline_pages_brand before insert or update of guideline_id, parent_id, kind on public.guideline_pages
  for each row execute function public.derive_brand_id();
create trigger blocks_brand before insert or update of page_id on public.blocks
  for each row execute function public.derive_brand_id();
create trigger colors_brand before insert or update of palette_id on public.colors
  for each row execute function public.derive_brand_id();
create trigger assets_brand before insert or update of library_id on public.assets
  for each row execute function public.derive_brand_id();
create trigger asset_versions_brand before insert on public.asset_versions
  for each row execute function public.derive_brand_id();
create trigger collections_brand before insert or update of library_id on public.collections
  for each row execute function public.derive_brand_id();
create trigger collection_assets_brand before insert on public.collection_assets
  for each row execute function public.derive_brand_id();
create trigger page_revisions_brand before insert on public.page_revisions
  for each row execute function public.derive_brand_id();
create trigger comments_brand before insert on public.comments
  for each row execute function public.derive_brand_id();

-- Kommentare: Autor ist immer der angemeldete Nutzer
create or replace function public.comments_set_author()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.author_id := auth.uid();
  return new;
end;
$$;
create trigger comments_author before insert on public.comments
  for each row execute function public.comments_set_author();

-- Blöcke: letzter Bearbeiter
create or replace function public.blocks_set_editor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;
create trigger blocks_editor before insert or update on public.blocks
  for each row execute function public.blocks_set_editor();

-- Neue Auth-Nutzer bekommen ein Profil; offene E-Mail-Einladungen werden eingelöst
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv record;
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;

  for inv in
    select * from public.invitations i
    where i.email = lower(new.email)
      and not i.revoked
      and i.expires_at > now()
      and (i.max_uses is null or i.use_count < i.max_uses)
  loop
    -- Marken-Einladungen geben nur Zugriff auf diese eine Marke (nicht auf den Workspace)
    if inv.brand_id is not null then
      insert into public.brand_members (brand_id, user_id, role)
      values (inv.brand_id, new.id, inv.brand_role)
      on conflict (brand_id, user_id) do nothing;
    else
      insert into public.workspace_members (workspace_id, user_id, role)
      values (inv.workspace_id, new.id, inv.workspace_role)
      on conflict (workspace_id, user_id) do nothing;
    end if;
    update public.invitations set use_count = use_count + 1 where id = inv.id;
  end loop;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(coalesce(new.email, '')) where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- Der letzte Owner eines Workspaces kann nicht entfernt/herabgestuft werden
create or replace function public.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if not exists (
      select 1 from public.workspace_members
      where workspace_id = old.workspace_id and role = 'owner' and user_id <> old.user_id
    ) and exists (select 1 from public.workspaces where id = old.workspace_id) then
      raise exception 'Ein Workspace braucht mindestens einen Owner';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger workspace_members_last_owner
  before update or delete on public.workspace_members
  for each row execute function public.protect_last_owner();

-- Nur Owner dürfen Owner ernennen oder Owner ändern
create or replace function public.guard_owner_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if (tg_op in ('INSERT', 'UPDATE') and new.role = 'owner')
     or (tg_op in ('UPDATE', 'DELETE') and old.role = 'owner' and old.user_id <> auth.uid()) then
    if public.workspace_role_of(coalesce(new.workspace_id, old.workspace_id)) <> 'owner' then
      raise exception 'Nur Owner können Owner-Rechte vergeben oder entziehen';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger workspace_members_owner_guard
  before insert or update or delete on public.workspace_members
  for each row execute function public.guard_owner_changes();

-- ---------------------------------------------------------------------
-- Aktivitätsverlauf
-- ---------------------------------------------------------------------
create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_brand uuid;
  v_label text;
  v_action text;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_action := case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end;
  v_brand := (v_row ->> 'brand_id')::uuid;
  v_label := coalesce(v_row ->> 'title', v_row ->> 'name', v_row ->> 'family', left(v_row ->> 'body', 80), '');

  if tg_table_name = 'brands' then
    v_brand := (v_row ->> 'id')::uuid;
    if tg_op = 'DELETE' then
      return old;
    end if;
  end if;

  if tg_op = 'UPDATE' and tg_table_name = 'assets'
     and (v_row ->> 'version') is distinct from (to_jsonb(old) ->> 'version') then
    v_action := 'new_version';
  end if;

  if tg_table_name = 'brand_members' then
    select coalesce(nullif(p.full_name, ''), p.email) into v_label
    from public.profiles p where p.id = (v_row ->> 'user_id')::uuid;
  end if;

  -- Beim Löschen einer ganzen Marke keine Einträge erzeugen
  if not exists (select 1 from public.brands where id = v_brand) then
    return coalesce(new, old);
  end if;

  insert into public.activity (brand_id, actor_id, action, entity, entity_id, label)
  values (
    v_brand,
    auth.uid(),
    v_action,
    tg_table_name,
    case when v_row ? 'id' then (v_row ->> 'id')::uuid else null end,
    coalesce(v_label, '')
  );
  return coalesce(new, old);
end;
$$;

create trigger brands_activity after update of name, theme, is_public, visibility on public.brands
  for each row execute function public.log_activity();
create trigger guidelines_activity after insert or delete or update of title on public.guidelines
  for each row execute function public.log_activity();
create trigger guideline_pages_activity after insert or delete or update of title on public.guideline_pages
  for each row execute function public.log_activity();
create trigger assets_activity after insert or delete or update of title, version on public.assets
  for each row execute function public.log_activity();
create trigger color_palettes_activity after insert or delete or update of name on public.color_palettes
  for each row execute function public.log_activity();
create trigger fonts_activity after insert or delete on public.fonts
  for each row execute function public.log_activity();
create trigger libraries_activity after insert or delete or update of name on public.libraries
  for each row execute function public.log_activity();
create trigger comments_activity after insert on public.comments
  for each row execute function public.log_activity();
create trigger brand_members_activity after insert or delete on public.brand_members
  for each row execute function public.log_activity();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.brands enable row level security;
alter table public.brand_members enable row level security;
alter table public.invitations enable row level security;
alter table public.guidelines enable row level security;
alter table public.guideline_pages enable row level security;
alter table public.blocks enable row level security;
alter table public.color_palettes enable row level security;
alter table public.colors enable row level security;
alter table public.fonts enable row level security;
alter table public.text_styles enable row level security;
alter table public.libraries enable row level security;
alter table public.assets enable row level security;
alter table public.asset_versions enable row level security;
alter table public.collections enable row level security;
alter table public.collection_assets enable row level security;
alter table public.comments enable row level security;
alter table public.page_revisions enable row level security;
alter table public.activity enable row level security;

-- profiles
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_workspace_with(id));
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- workspaces (Anlegen nur per RPC create_workspace)
create policy "workspaces_select" on public.workspaces for select to authenticated
  using (public.workspace_role_of(id) is not null);
create policy "workspaces_update" on public.workspaces for update to authenticated
  using (public.workspace_role_of(id) in ('owner', 'admin'))
  with check (public.workspace_role_of(id) in ('owner', 'admin'));
create policy "workspaces_delete" on public.workspaces for delete to authenticated
  using (public.workspace_role_of(id) = 'owner');

-- workspace_members
create policy "workspace_members_select" on public.workspace_members for select to authenticated
  using (public.workspace_role_of(workspace_id) is not null);
create policy "workspace_members_insert" on public.workspace_members for insert to authenticated
  with check (public.workspace_role_of(workspace_id) in ('owner', 'admin'));
create policy "workspace_members_update" on public.workspace_members for update to authenticated
  using (public.workspace_role_of(workspace_id) in ('owner', 'admin'))
  with check (public.workspace_role_of(workspace_id) in ('owner', 'admin'));
create policy "workspace_members_delete" on public.workspace_members for delete to authenticated
  using (public.workspace_role_of(workspace_id) in ('owner', 'admin') or user_id = auth.uid());

-- brands (Anlegen nur per RPC create_brand)
create policy "brands_select" on public.brands for select to anon, authenticated
  using (public.can_view_brand(id));
create policy "brands_update" on public.brands for update to authenticated
  using (public.can_admin_brand(id)) with check (public.can_admin_brand(id));
create policy "brands_delete" on public.brands for delete to authenticated
  using (public.can_admin_brand(id));

-- brand_members
create policy "brand_members_select" on public.brand_members for select to authenticated
  using (public.is_brand_member(brand_id));
create policy "brand_members_insert" on public.brand_members for insert to authenticated
  with check (public.can_admin_brand(brand_id));
create policy "brand_members_update" on public.brand_members for update to authenticated
  using (public.can_admin_brand(brand_id)) with check (public.can_admin_brand(brand_id));
create policy "brand_members_delete" on public.brand_members for delete to authenticated
  using (public.can_admin_brand(brand_id) or user_id = auth.uid());

-- invitations (Einlösen nur per RPC)
create policy "invitations_select" on public.invitations for select to authenticated
  using (
    public.workspace_role_of(workspace_id) in ('owner', 'admin')
    or (brand_id is not null and public.can_admin_brand(brand_id))
  );
create policy "invitations_insert" on public.invitations for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      public.workspace_role_of(workspace_id) in ('owner', 'admin')
      or (
        brand_id is not null
        and public.can_admin_brand(brand_id)
        and workspace_role = 'member'
        and exists (select 1 from public.brands b where b.id = brand_id and b.workspace_id = invitations.workspace_id)
      )
    )
  );
create policy "invitations_update" on public.invitations for update to authenticated
  using (
    public.workspace_role_of(workspace_id) in ('owner', 'admin')
    or (brand_id is not null and public.can_admin_brand(brand_id))
  )
  with check (
    public.workspace_role_of(workspace_id) in ('owner', 'admin')
    or (brand_id is not null and public.can_admin_brand(brand_id))
  );
create policy "invitations_delete" on public.invitations for delete to authenticated
  using (
    public.workspace_role_of(workspace_id) in ('owner', 'admin')
    or (brand_id is not null and public.can_admin_brand(brand_id))
  );

-- Inhalte: Lesen = can_view_brand, Schreiben = can_edit_brand
create policy "guidelines_select" on public.guidelines for select to anon, authenticated
  using (public.can_view_brand(brand_id) and (is_published or public.can_edit_brand(brand_id)));
create policy "guidelines_write" on public.guidelines for all to authenticated
  using (public.can_edit_brand(brand_id)) with check (public.can_edit_brand(brand_id));

create policy "guideline_pages_select" on public.guideline_pages for select to anon, authenticated
  using (
    public.can_view_brand(brand_id)
    and (
      public.can_edit_brand(brand_id)
      or (
        is_published
        and exists (select 1 from public.guidelines g where g.id = guideline_id and g.is_published)
      )
    )
  );
create policy "guideline_pages_write" on public.guideline_pages for all to authenticated
  using (public.can_edit_brand(brand_id)) with check (public.can_edit_brand(brand_id));

create policy "blocks_select" on public.blocks for select to anon, authenticated
  using (
    public.can_view_brand(brand_id)
    and (
      public.can_edit_brand(brand_id)
      or exists (
        select 1 from public.guideline_pages p
        join public.guidelines g on g.id = p.guideline_id
        where p.id = page_id and p.is_published and g.is_published
      )
    )
  );
create policy "blocks_write" on public.blocks for all to authenticated
  using (public.can_edit_brand(brand_id)) with check (public.can_edit_brand(brand_id));

create policy "color_palettes_select" on public.color_palettes for select to anon, authenticated
  using (public.can_view_brand(brand_id));
create policy "color_palettes_write" on public.color_palettes for all to authenticated
  using (public.can_edit_brand(brand_id)) with check (public.can_edit_brand(brand_id));

create policy "colors_select" on public.colors for select to anon, authenticated
  using (public.can_view_brand(brand_id));
create policy "colors_write" on public.colors for all to authenticated
  using (public.can_edit_brand(brand_id)) with check (public.can_edit_brand(brand_id));

create policy "fonts_select" on public.fonts for select to anon, authenticated
  using (public.can_view_brand(brand_id));
create policy "fonts_write" on public.fonts for all to authenticated
  using (public.can_edit_brand(brand_id)) with check (public.can_edit_brand(brand_id));

create policy "text_styles_select" on public.text_styles for select to anon, authenticated
  using (public.can_view_brand(brand_id));
create policy "text_styles_write" on public.text_styles for all to authenticated
  using (public.can_edit_brand(brand_id)) with check (public.can_edit_brand(brand_id));

create policy "libraries_select" on public.libraries for select to anon, authenticated
  using (public.can_view_brand(brand_id));
create policy "libraries_write" on public.libraries for all to authenticated
  using (public.can_edit_brand(brand_id)) with check (public.can_edit_brand(brand_id));

create policy "assets_select" on public.assets for select to anon, authenticated
  using (public.can_view_brand(brand_id));
create policy "assets_write" on public.assets for all to authenticated
  using (public.can_edit_brand(brand_id)) with check (public.can_edit_brand(brand_id));

create policy "asset_versions_select" on public.asset_versions for select to authenticated
  using (public.is_brand_member(brand_id));
create policy "asset_versions_write" on public.asset_versions for all to authenticated
  using (public.can_edit_brand(brand_id)) with check (public.can_edit_brand(brand_id));

create policy "collections_select" on public.collections for select to anon, authenticated
  using (public.can_view_brand(brand_id));
create policy "collections_write" on public.collections for all to authenticated
  using (public.can_edit_brand(brand_id)) with check (public.can_edit_brand(brand_id));

create policy "collection_assets_select" on public.collection_assets for select to anon, authenticated
  using (public.can_view_brand(brand_id));
create policy "collection_assets_write" on public.collection_assets for all to authenticated
  using (public.can_edit_brand(brand_id)) with check (public.can_edit_brand(brand_id));

-- Kommentare: alle Mitglieder (auch Viewer, z. B. Dozierende) dürfen kommentieren
create policy "comments_select" on public.comments for select to authenticated
  using (public.is_brand_member(brand_id));
create policy "comments_insert" on public.comments for insert to authenticated
  with check (public.is_brand_member(brand_id));
create policy "comments_update" on public.comments for update to authenticated
  using (author_id = auth.uid() or public.can_edit_brand(brand_id))
  with check (public.is_brand_member(brand_id));
create policy "comments_delete" on public.comments for delete to authenticated
  using (author_id = auth.uid() or public.can_admin_brand(brand_id));

create policy "page_revisions_select" on public.page_revisions for select to authenticated
  using (public.can_edit_brand(brand_id));
create policy "page_revisions_insert" on public.page_revisions for insert to authenticated
  with check (public.can_edit_brand(brand_id));
create policy "page_revisions_delete" on public.page_revisions for delete to authenticated
  using (public.can_admin_brand(brand_id));

create policy "activity_select" on public.activity for select to authenticated
  using (public.is_brand_member(brand_id));

-- ---------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------
create or replace function public.unique_slug(p_table text, p_base text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text := public.slugify(p_base);
  v_slug text := v_base;
  v_exists boolean;
  v_i integer := 1;
begin
  loop
    execute format('select exists (select 1 from public.%I where slug = $1)', p_table)
      into v_exists using v_slug;
    exit when not v_exists;
    v_i := v_i + 1;
    v_slug := v_base || '-' || v_i;
  end loop;
  return v_slug;
end;
$$;
revoke all on function public.unique_slug(text, text) from public, anon, authenticated;

create or replace function public.create_workspace(p_name text, p_description text default '')
returns public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ws public.workspaces;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  insert into public.workspaces (name, slug, description, created_by)
  values (trim(p_name), public.unique_slug('workspaces', p_name), coalesce(p_description, ''), auth.uid())
  returning * into v_ws;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws.id, auth.uid(), 'owner');
  return v_ws;
end;
$$;

-- Wendet eine Vorlage (JSON) auf eine Marke an. Format siehe src/lib/templates/types.ts.
-- security invoker: RLS prüft, dass der Aufrufer die Marke bearbeiten darf.
create or replace function public.apply_brand_template(p_brand uuid, p_template jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_palette jsonb;
  v_palette_id uuid;
  v_color jsonb;
  v_font jsonb;
  v_style jsonb;
  v_library jsonb;
  v_guideline jsonb;
  v_guideline_id uuid;
  v_item jsonb;
  v_chapter_id uuid;
  v_page jsonb;
  v_page_id uuid;
  v_block jsonb;
  v_sort integer;
  v_i integer;
  v_j integer;
  v_k integer;
  v_g integer := coalesce((select max(sort) + 1 from public.guidelines where brand_id = p_brand), 0);
  v_slug text;
begin
  if not public.can_edit_brand(p_brand) then
    raise exception 'Keine Berechtigung';
  end if;

  -- Farben
  v_i := coalesce((select max(sort) + 1 from public.color_palettes where brand_id = p_brand), 0);
  for v_palette in select * from jsonb_array_elements(coalesce(p_template -> 'palettes', '[]'::jsonb)) loop
    insert into public.color_palettes (brand_id, name, description, sort)
    values (p_brand, v_palette ->> 'name', coalesce(v_palette ->> 'description', ''), v_i)
    returning id into v_palette_id;
    v_i := v_i + 1;
    v_j := 0;
    for v_color in select * from jsonb_array_elements(coalesce(v_palette -> 'colors', '[]'::jsonb)) loop
      insert into public.colors (palette_id, brand_id, name, hex, token, cmyk, pantone, hks, ral, ncs, usage, description, sort)
      values (
        v_palette_id, p_brand,
        v_color ->> 'name', upper(v_color ->> 'hex'),
        coalesce(v_color ->> 'token', ''), coalesce(v_color ->> 'cmyk', ''), coalesce(v_color ->> 'pantone', ''),
        coalesce(v_color ->> 'hks', ''), coalesce(v_color ->> 'ral', ''), coalesce(v_color ->> 'ncs', ''),
        coalesce(v_color ->> 'usage', ''), coalesce(v_color ->> 'description', ''), v_j
      );
      v_j := v_j + 1;
    end loop;
  end loop;

  -- Schriften
  v_i := coalesce((select max(sort) + 1 from public.fonts where brand_id = p_brand), 0);
  for v_font in select * from jsonb_array_elements(coalesce(p_template -> 'fonts', '[]'::jsonb)) loop
    insert into public.fonts (brand_id, family, source, role, weights, fallback, license, description, sort)
    values (
      p_brand, v_font ->> 'family', coalesce(v_font ->> 'source', 'google'), coalesce(v_font ->> 'role', ''),
      coalesce((select array_agg(w::integer) from jsonb_array_elements_text(v_font -> 'weights') w), '{400,700}'),
      coalesce(v_font ->> 'fallback', 'sans-serif'), coalesce(v_font ->> 'license', ''),
      coalesce(v_font ->> 'description', ''), v_i
    );
    v_i := v_i + 1;
  end loop;

  -- Textstile
  v_i := coalesce((select max(sort) + 1 from public.text_styles where brand_id = p_brand), 0);
  for v_style in select * from jsonb_array_elements(coalesce(p_template -> 'textStyles', '[]'::jsonb)) loop
    insert into public.text_styles (
      brand_id, name, token, font_family, font_weight, font_size, line_height, letter_spacing,
      text_transform, italic, sample, usage, sort
    )
    values (
      p_brand, v_style ->> 'name', coalesce(v_style ->> 'token', ''), v_style ->> 'fontFamily',
      coalesce((v_style ->> 'fontWeight')::integer, 400), coalesce((v_style ->> 'fontSize')::numeric, 16),
      coalesce((v_style ->> 'lineHeight')::numeric, 1.4), coalesce((v_style ->> 'letterSpacing')::numeric, 0),
      coalesce(v_style ->> 'textTransform', 'none'), coalesce((v_style ->> 'italic')::boolean, false),
      coalesce(v_style ->> 'sample', ''), coalesce(v_style ->> 'usage', ''), v_i
    );
    v_i := v_i + 1;
  end loop;

  -- Bibliotheken
  v_i := coalesce((select max(sort) + 1 from public.libraries where brand_id = p_brand), 0);
  for v_library in select * from jsonb_array_elements(coalesce(p_template -> 'libraries', '[]'::jsonb)) loop
    v_slug := public.slugify(coalesce(v_library ->> 'slug', v_library ->> 'name'));
    if not exists (select 1 from public.libraries where brand_id = p_brand and slug = v_slug) then
      insert into public.libraries (brand_id, kind, name, slug, description, sort)
      values (
        p_brand, coalesce(v_library ->> 'kind', 'media')::public.library_kind, v_library ->> 'name', v_slug,
        coalesce(v_library ->> 'description', ''), v_i
      );
      v_i := v_i + 1;
    end if;
  end loop;

  -- Guidelines mit Kapiteln, Seiten und Blöcken
  for v_guideline in select * from jsonb_array_elements(coalesce(p_template -> 'guidelines', '[]'::jsonb)) loop
    v_slug := public.slugify(coalesce(v_guideline ->> 'slug', v_guideline ->> 'title'));
    v_k := 1;
    while exists (select 1 from public.guidelines where brand_id = p_brand and slug = v_slug) loop
      v_k := v_k + 1;
      v_slug := public.slugify(coalesce(v_guideline ->> 'slug', v_guideline ->> 'title')) || '-' || v_k;
    end loop;
    insert into public.guidelines (brand_id, title, slug, description, icon, sort)
    values (
      p_brand, v_guideline ->> 'title', v_slug, coalesce(v_guideline ->> 'description', ''),
      coalesce(v_guideline ->> 'icon', 'book-open'), v_g
    )
    returning id into v_guideline_id;
    v_g := v_g + 1;
    v_sort := 0;

    for v_item in select * from jsonb_array_elements(coalesce(v_guideline -> 'items', '[]'::jsonb)) loop
      if v_item ->> 'kind' = 'chapter' then
        insert into public.guideline_pages (guideline_id, brand_id, kind, title, slug, sort)
        values (v_guideline_id, p_brand, 'chapter', v_item ->> 'title',
                public.slugify(v_item ->> 'title') || '-' || substr(md5(random()::text), 1, 4), v_sort)
        returning id into v_chapter_id;
        v_sort := v_sort + 1;
        v_j := 0;
        for v_page in select * from jsonb_array_elements(coalesce(v_item -> 'pages', '[]'::jsonb)) loop
          v_slug := public.slugify(coalesce(v_page ->> 'slug', v_page ->> 'title'));
          if exists (select 1 from public.guideline_pages where guideline_id = v_guideline_id and slug = v_slug) then
            v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
          end if;
          insert into public.guideline_pages (guideline_id, brand_id, parent_id, kind, title, slug, intro, sort)
          values (v_guideline_id, p_brand, v_chapter_id, 'page', v_page ->> 'title', v_slug,
                  coalesce(v_page ->> 'intro', ''), v_j)
          returning id into v_page_id;
          v_j := v_j + 1;
          v_k := 0;
          for v_block in select * from jsonb_array_elements(coalesce(v_page -> 'blocks', '[]'::jsonb)) loop
            insert into public.blocks (page_id, brand_id, type, width, sort, content)
            values (v_page_id, p_brand, v_block ->> 'type', coalesce(v_block ->> 'width', 'full'), v_k,
                    coalesce(v_block -> 'content', '{}'::jsonb));
            v_k := v_k + 1;
          end loop;
        end loop;
      else
        v_slug := public.slugify(coalesce(v_item ->> 'slug', v_item ->> 'title'));
        if exists (select 1 from public.guideline_pages where guideline_id = v_guideline_id and slug = v_slug) then
          v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
        end if;
        insert into public.guideline_pages (guideline_id, brand_id, kind, title, slug, intro, sort)
        values (v_guideline_id, p_brand, 'page', v_item ->> 'title', v_slug, coalesce(v_item ->> 'intro', ''), v_sort)
        returning id into v_page_id;
        v_sort := v_sort + 1;
        v_k := 0;
        for v_block in select * from jsonb_array_elements(coalesce(v_item -> 'blocks', '[]'::jsonb)) loop
          insert into public.blocks (page_id, brand_id, type, width, sort, content)
          values (v_page_id, p_brand, v_block ->> 'type', coalesce(v_block ->> 'width', 'full'), v_k,
                  coalesce(v_block -> 'content', '{}'::jsonb));
          v_k := v_k + 1;
        end loop;
      end if;
    end loop;
  end loop;

  -- Startseite / Theme nur setzen, wenn in der Vorlage vorhanden
  if p_template ? 'theme' then
    update public.brands set theme = theme || (p_template -> 'theme') where id = p_brand;
  end if;
  if p_template ? 'home' then
    update public.brands set home = home || (p_template -> 'home') where id = p_brand;
  end if;
end;
$$;

create or replace function public.create_brand(
  p_workspace uuid,
  p_name text,
  p_org_type text default 'organisation',
  p_tagline text default '',
  p_template jsonb default '{}'::jsonb
)
returns public.brands
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brand public.brands;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  if public.workspace_role_of(p_workspace) is null then
    raise exception 'Kein Mitglied dieses Workspaces';
  end if;
  insert into public.brands (workspace_id, name, slug, org_type, tagline, created_by)
  values (p_workspace, trim(p_name), public.unique_slug('brands', p_name), coalesce(p_org_type, 'organisation'),
          coalesce(p_tagline, ''), auth.uid())
  returning * into v_brand;
  insert into public.brand_members (brand_id, user_id, role)
  values (v_brand.id, auth.uid(), 'admin');
  perform public.apply_brand_template(v_brand.id, coalesce(p_template, '{}'::jsonb));
  select * into v_brand from public.brands where id = v_brand.id;
  return v_brand;
end;
$$;

-- Einladungs-Vorschau (auch ohne Login), gibt keine sensiblen Daten preis
create or replace function public.invitation_preview(p_token text)
returns table (
  workspace_name text,
  brand_name text,
  workspace_role public.workspace_role,
  brand_role public.brand_role,
  is_valid boolean,
  email_bound boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    w.name,
    b.name,
    i.workspace_role,
    i.brand_role,
    (not i.revoked and i.expires_at > now() and (i.max_uses is null or i.use_count < i.max_uses)),
    i.email is not null
  from public.invitations i
  join public.workspaces w on w.id = i.workspace_id
  left join public.brands b on b.id = i.brand_id
  where i.token = p_token;
$$;

create or replace function public.accept_invitation(p_token text)
returns table (workspace_id uuid, brand_id uuid, brand_slug text, workspace_slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invitations;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  select * into inv from public.invitations i where i.token = p_token for update;
  if inv.id is null then
    raise exception 'Einladung nicht gefunden';
  end if;
  if inv.revoked or inv.expires_at <= now() or (inv.max_uses is not null and inv.use_count >= inv.max_uses) then
    raise exception 'Einladung ist nicht mehr gültig';
  end if;
  select lower(email) into v_email from public.profiles where id = auth.uid();
  if inv.email is not null and inv.email <> v_email then
    raise exception 'Diese Einladung gilt für eine andere E-Mail-Adresse';
  end if;

  if inv.brand_id is null then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (inv.workspace_id, auth.uid(), inv.workspace_role)
    on conflict on constraint workspace_members_pkey do update
      set role = case
        when public.workspace_members.role = 'owner' then 'owner'::public.workspace_role
        when excluded.role = 'admin' then 'admin'::public.workspace_role
        else public.workspace_members.role
      end;
  else
    insert into public.brand_members (brand_id, user_id, role)
    values (inv.brand_id, auth.uid(), inv.brand_role)
    on conflict on constraint brand_members_pkey do update
      set role = case
        when public.brand_members.role = 'admin' or excluded.role = 'admin' then 'admin'::public.brand_role
        when public.brand_members.role = 'editor' or excluded.role = 'editor' then 'editor'::public.brand_role
        else 'viewer'::public.brand_role
      end;
  end if;

  update public.invitations set use_count = use_count + 1 where id = inv.id;

  return query
    select inv.workspace_id, inv.brand_id, b.slug, w.slug
    from public.workspaces w
    left join public.brands b on b.id = inv.brand_id
    where w.id = inv.workspace_id;
end;
$$;

-- Direkt hinzufügen, falls die Person schon ein Konto hat (sonst Einladung anlegen)
create or replace function public.add_member_by_email(
  p_workspace uuid,
  p_email text,
  p_workspace_role public.workspace_role default 'member',
  p_brand uuid default null,
  p_brand_role public.brand_role default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_email text := lower(trim(p_email));
  v_is_ws_admin boolean := public.workspace_role_of(p_workspace) in ('owner', 'admin');
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  if p_workspace_role = 'owner' then
    raise exception 'Owner-Rechte können nicht per Einladung vergeben werden';
  end if;
  if p_brand is not null then
    if not exists (select 1 from public.brands b where b.id = p_brand and b.workspace_id = p_workspace) then
      raise exception 'Marke gehört nicht zum Workspace';
    end if;
    if not (v_is_ws_admin or public.can_admin_brand(p_brand)) then
      raise exception 'Keine Berechtigung';
    end if;
    if not v_is_ws_admin and p_workspace_role <> 'member' then
      raise exception 'Keine Berechtigung';
    end if;
  elsif not v_is_ws_admin then
    raise exception 'Keine Berechtigung';
  end if;

  select id into v_user from public.profiles where email = v_email;
  if v_user is null then
    return 'not_found';
  end if;

  if p_brand is not null then
    insert into public.brand_members (brand_id, user_id, role)
    values (p_brand, v_user, coalesce(p_brand_role, 'viewer'))
    on conflict on constraint brand_members_pkey do update set role = excluded.role;
  else
    insert into public.workspace_members (workspace_id, user_id, role)
    values (p_workspace, v_user, p_workspace_role)
    on conflict on constraint workspace_members_pkey do nothing;
  end if;
  return 'added';
end;
$$;

-- Suche über Seiten, Blöcke, Assets und Farben einer Marke (RLS greift)
create or replace function public.search_brand(p_brand uuid, p_query text)
returns table (
  kind text,
  id uuid,
  title text,
  snippet text,
  guideline_slug text,
  page_slug text,
  library_slug text,
  thumb_path text,
  hex text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select '%' || replace(replace(trim(p_query), '%', ''), '_', '') || '%' as pattern)
  (
    select 'page', p.id, p.title, p.intro, g.slug, p.slug, null, null, null
    from public.guideline_pages p
    join public.guidelines g on g.id = p.guideline_id, q
    where p.brand_id = p_brand and p.kind = 'page' and (p.title ilike q.pattern or p.intro ilike q.pattern)
    limit 15
  )
  union all
  (
    select distinct on (p.id) 'block', p.id, p.title,
      left(regexp_replace(b.content::text, '<[^>]+>|[{}"\\]', ' ', 'g'), 400), g.slug, p.slug, null, null, null
    from public.blocks b
    join public.guideline_pages p on p.id = b.page_id
    join public.guidelines g on g.id = p.guideline_id, q
    where b.brand_id = p_brand and b.content::text ilike q.pattern
    limit 15
  )
  union all
  (
    select 'asset', a.id, a.title, a.description, null, null, l.slug, a.thumb_path, null
    from public.assets a
    join public.libraries l on l.id = a.library_id, q
    where a.brand_id = p_brand
      and (a.title ilike q.pattern or a.description ilike q.pattern or a.file_name ilike q.pattern
           or exists (select 1 from unnest(a.tags) t where t ilike q.pattern))
    limit 20
  )
  union all
  (
    select 'color', c.id, c.name, c.description, null, null, null, null, c.hex
    from public.colors c, q
    where c.brand_id = p_brand
      and (c.name ilike q.pattern or c.hex ilike q.pattern or c.pantone ilike q.pattern or c.hks ilike q.pattern)
    limit 10
  );
$$;

-- Nutzer verlassen einen Workspace (inkl. Marken-Mitgliedschaften darin)
create or replace function public.leave_workspace(p_workspace uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.brand_members m
  using public.brands b
  where m.brand_id = b.id and b.workspace_id = p_workspace and m.user_id = auth.uid();
  delete from public.workspace_members where workspace_id = p_workspace and user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- Rechte auf Funktionen
-- ---------------------------------------------------------------------
revoke execute on function public.create_workspace(text, text) from public, anon;
revoke execute on function public.create_brand(uuid, text, text, text, jsonb) from public, anon;
revoke execute on function public.apply_brand_template(uuid, jsonb) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;
revoke execute on function public.add_member_by_email(uuid, text, public.workspace_role, uuid, public.brand_role) from public, anon;
revoke execute on function public.leave_workspace(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
revoke execute on function public.log_activity() from public, anon, authenticated;
revoke execute on function public.derive_brand_id() from public, anon, authenticated;

grant execute on function public.create_workspace(text, text) to authenticated;
grant execute on function public.create_brand(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.apply_brand_template(uuid, jsonb) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.add_member_by_email(uuid, text, public.workspace_role, uuid, public.brand_role) to authenticated;
grant execute on function public.leave_workspace(uuid) to authenticated;
grant execute on function public.invitation_preview(text) to anon, authenticated;
grant execute on function public.search_brand(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Storage: privater Bucket, Pfad beginnt immer mit der brand_id
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('brand-files', 'brand-files', false, 52428800)
on conflict (id) do nothing;

create or replace function public.storage_brand_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

create policy "brand_files_select" on storage.objects for select to anon, authenticated
  using (bucket_id = 'brand-files' and public.can_view_brand(public.storage_brand_id(name)));
create policy "brand_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-files' and public.can_edit_brand(public.storage_brand_id(name)));
create policy "brand_files_update" on storage.objects for update to authenticated
  using (bucket_id = 'brand-files' and public.can_edit_brand(public.storage_brand_id(name)))
  with check (bucket_id = 'brand-files' and public.can_edit_brand(public.storage_brand_id(name)));
create policy "brand_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'brand-files' and public.can_edit_brand(public.storage_brand_id(name)));
