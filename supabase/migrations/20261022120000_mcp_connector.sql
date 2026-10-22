-- =====================================================================
-- Brandbench – MCP-Konnektor (KI-Assistenten wie Claude)
--
-- Apps, die sich per OAuth 2.1 (Supabase-Auth als Server) verbinden, erhalten
-- ein Zugriffs-Token mit dem Claim `client_id`. Dieses Skript sorgt dafür,
-- dass solche Tokens NUR das sehen und ändern können, was die Person bei der
-- Verbindung ausgewählt hat:
--
--   mcp_grants   Auswahl pro Person und App: Workspaces (ganz) und einzelne Marken,
--                optional „nur lesen“
--
-- Die Durchsetzung passiert in der Datenbank an den zentralen Rechte-
-- Funktionen (workspace_role_of, brand_role_of, shares_workspace_with).
-- Alle Row-Level-Security-Regeln und Storage-Regeln bauen darauf auf, deshalb
-- gilt die Auswahl automatisch überall – auch dann, wenn jemand mit dem Token
-- die Datenbank direkt anspricht und nicht über den MCP-Server.
--
--   - Normale Anmelde-Sitzungen der Web-App haben keinen `client_id`-Claim
--     und verhalten sich exakt wie bisher.
--   - Ohne Auswahl-Eintrag sieht eine verbundene App nichts (Standard: verbieten).
--   - Eine verbundene App kann ihre eigene Auswahl nicht ändern.
--   - Konto löschen, Workspace verlassen und Einladungen einlösen sind für
--     verbundene Apps gesperrt.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Hilfsfunktionen: Welche App spricht gerade?
-- ---------------------------------------------------------------------
create or replace function public.oauth_client_id()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'client_id', '');
$$;

-- ---------------------------------------------------------------------
-- Auswahl pro Person und App
-- ---------------------------------------------------------------------
create table public.mcp_grants (
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_id text not null check (char_length(client_id) between 1 and 200),
  client_name text not null default '' check (char_length(client_name) <= 200),
  -- Ganze Workspaces: enthalten alle Marken, auch später angelegte
  workspace_ids uuid[] not null default '{}' check (cardinality(workspace_ids) <= 200),
  -- Einzelne Marken (zusätzlich zu den Workspaces)
  brand_ids uuid[] not null default '{}' check (cardinality(brand_ids) <= 500),
  read_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  primary key (user_id, client_id)
);

alter table public.mcp_grants enable row level security;

-- Lesen und Trennen nur in der Web-App (nie mit dem Token einer verbundenen App).
-- Anlegen und Ändern geht ausschließlich über save_mcp_grant().
create policy "mcp_grants_select" on public.mcp_grants for select to authenticated
  using (user_id = auth.uid() and public.oauth_client_id() is null);
create policy "mcp_grants_delete" on public.mcp_grants for delete to authenticated
  using (user_id = auth.uid() and public.oauth_client_id() is null);

create trigger mcp_grants_touch before update on public.mcp_grants
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Prüfungen gegen die Auswahl (nur sinnvoll, wenn oauth_client_id() gesetzt ist)
-- ---------------------------------------------------------------------
create or replace function public.mcp_allows_workspace(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p_workspace = any (g.workspace_ids)
     from public.mcp_grants g
     where g.user_id = auth.uid() and g.client_id = public.oauth_client_id()),
    false
  );
$$;

create or replace function public.mcp_allows_brand(p_brand uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p_brand = any (g.brand_ids)
            or exists (
              select 1 from public.brands b
              where b.id = p_brand and b.workspace_id = any (g.workspace_ids)
            )
     from public.mcp_grants g
     where g.user_id = auth.uid() and g.client_id = public.oauth_client_id()),
    false
  );
$$;

-- true = nur lesen. Für verbundene Apps ohne Auswahl-Eintrag ebenfalls true.
-- Für normale Sitzungen immer false.
create or replace function public.mcp_read_only()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.oauth_client_id() is not null
     and coalesce(
       (select g.read_only
        from public.mcp_grants g
        where g.user_id = auth.uid() and g.client_id = public.oauth_client_id()),
       true
     );
$$;

-- ---------------------------------------------------------------------
-- Zentrale Rechte-Funktionen: Auswahl + „nur lesen“ einarbeiten
-- (Signatur und Verhalten für normale Sitzungen unverändert)
-- ---------------------------------------------------------------------
create or replace function public.workspace_role_of(p_workspace uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.oauth_client_id() is not null and not public.mcp_allows_workspace(p_workspace) then null
    when public.mcp_read_only() and r.role in ('owner', 'admin') then 'member'::public.workspace_role
    else r.role
  end
  from (
    select wm.role
    from public.workspace_members wm
    where wm.workspace_id = p_workspace and wm.user_id = auth.uid()
  ) r;
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
  ),
  r as (
    select case
      when auth.uid() is null then null
      when public.oauth_client_id() is not null and not public.mcp_allows_brand(p_brand) then null
      when exists (select 1 from ws where role in ('owner', 'admin')) then 'admin'::public.brand_role
      when exists (select 1 from bm where role = 'admin') then 'admin'::public.brand_role
      when exists (select 1 from bm where role = 'editor') then 'editor'::public.brand_role
      when exists (select 1 from bm where role = 'viewer') then 'viewer'::public.brand_role
      when exists (select 1 from ws) and (select visibility from b) = 'workspace' then 'viewer'::public.brand_role
      else null
    end as role
  )
  select case
    when r.role is null then null
    when public.mcp_read_only() and r.role <> 'viewer' then 'viewer'::public.brand_role
    else r.role
  end
  from r;
$$;

-- Profile (Name, E-Mail) anderer Personen nur über Workspaces/Marken sichtbar,
-- die der verbundenen App freigegeben sind.
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
      and (public.oauth_client_id() is null or public.mcp_allows_workspace(a.workspace_id))
  ) or exists (
    select 1
    from public.brand_members a
    join public.brand_members b on a.brand_id = b.brand_id
    where a.user_id = auth.uid() and b.user_id = p_user
      and (public.oauth_client_id() is null or public.mcp_allows_brand(a.brand_id))
  );
$$;

-- ---------------------------------------------------------------------
-- Bestehende RPCs: für verbundene Apps absichern
-- ---------------------------------------------------------------------
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
  if public.mcp_read_only() then
    raise exception 'Diese Verbindung ist auf „nur lesen“ beschränkt';
  end if;
  insert into public.workspaces (name, slug, description, created_by)
  values (trim(p_name), public.unique_slug('workspaces', p_name), coalesce(p_description, ''), auth.uid())
  returning * into v_ws;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws.id, auth.uid(), 'owner');
  -- Neue Workspaces gehören automatisch zur Auswahl der App, die sie angelegt hat
  if public.oauth_client_id() is not null then
    update public.mcp_grants
       set workspace_ids = array_append(workspace_ids, v_ws.id)
     where user_id = auth.uid() and client_id = public.oauth_client_id();
  end if;
  return v_ws;
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
  if public.mcp_read_only() then
    raise exception 'Diese Verbindung ist auf „nur lesen“ beschränkt';
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
  if public.oauth_client_id() is not null then
    raise exception 'Einladungen können nur direkt in Brandbench angenommen werden';
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
  if public.mcp_read_only() then
    raise exception 'Diese Verbindung ist auf „nur lesen“ beschränkt';
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

create or replace function public.leave_workspace(p_workspace uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.oauth_client_id() is not null then
    raise exception 'Einen Workspace verlassen geht nur direkt in Brandbench';
  end if;
  delete from public.brand_members m
  using public.brands b
  where m.brand_id = b.id and b.workspace_id = p_workspace and m.user_id = auth.uid();
  delete from public.workspace_members where workspace_id = p_workspace and user_id = auth.uid();
end;
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  if public.oauth_client_id() is not null then
    raise exception 'Das Konto kann nur direkt in Brandbench gelöscht werden';
  end if;
  if exists (select 1 from public.workspace_members where user_id = auth.uid() and role = 'owner') then
    raise exception 'Du bist Owner eines Workspaces. Lösche ihn zuerst oder ernenne eine andere Person zum Owner.';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- Kommentare sind Schreibzugriffe: bei „nur lesen“ gesperrt
-- ---------------------------------------------------------------------
drop policy "comments_insert" on public.comments;
create policy "comments_insert" on public.comments for insert to authenticated
  with check (public.is_brand_member(brand_id) and not public.mcp_read_only());

drop policy "comments_update" on public.comments;
create policy "comments_update" on public.comments for update to authenticated
  using ((author_id = auth.uid() or public.can_edit_brand(brand_id)) and not public.mcp_read_only())
  with check (public.is_brand_member(brand_id));

drop policy "comments_delete" on public.comments;
create policy "comments_delete" on public.comments for delete to authenticated
  using ((author_id = auth.uid() or public.can_admin_brand(brand_id)) and not public.mcp_read_only());

-- ---------------------------------------------------------------------
-- Auswahl speichern (nur in der Web-App, z. B. auf der Zustimmungsseite)
-- ---------------------------------------------------------------------
create or replace function public.save_mcp_grant(
  p_client_id text,
  p_client_name text,
  p_workspaces uuid[],
  p_brands uuid[],
  p_read_only boolean default false
)
returns public.mcp_grants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ws uuid[];
  v_brands uuid[];
  v_grant public.mcp_grants;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  if public.oauth_client_id() is not null then
    raise exception 'Die Auswahl kann nur direkt in Brandbench geändert werden';
  end if;
  if coalesce(trim(p_client_id), '') = '' then
    raise exception 'client_id fehlt';
  end if;

  -- Nur Workspaces/Marken, in denen die Person wirklich Mitglied ist
  select coalesce(array_agg(distinct wm.workspace_id), '{}')
    into v_ws
    from public.workspace_members wm
   where wm.user_id = auth.uid() and wm.workspace_id = any (coalesce(p_workspaces, '{}'));

  select coalesce(array_agg(distinct b.id), '{}')
    into v_brands
    from public.brands b
   where b.id = any (coalesce(p_brands, '{}'))
     and public.brand_role_of(b.id) is not null;

  insert into public.mcp_grants as g (user_id, client_id, client_name, workspace_ids, brand_ids, read_only)
  values (auth.uid(), trim(p_client_id), left(coalesce(p_client_name, ''), 200), v_ws, v_brands, coalesce(p_read_only, false))
  on conflict (user_id, client_id) do update
    set client_name = case when excluded.client_name <> '' then excluded.client_name else g.client_name end,
        workspace_ids = excluded.workspace_ids,
        brand_ids = excluded.brand_ids,
        read_only = excluded.read_only
  returning * into v_grant;
  return v_grant;
end;
$$;

-- ---------------------------------------------------------------------
-- Was darf die verbundene App? (wird vom MCP-Server bei jeder Anfrage gelesen)
-- ---------------------------------------------------------------------
create or replace function public.mcp_scope()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant public.mcp_grants;
  v_workspaces jsonb;
  v_brands jsonb;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  if public.oauth_client_id() is null then
    raise exception 'Nur für verbundene Apps';
  end if;

  select * into v_grant
    from public.mcp_grants g
   where g.user_id = auth.uid() and g.client_id = public.oauth_client_id();

  if v_grant.user_id is null then
    return jsonb_build_object(
      'client_id', public.oauth_client_id(),
      'granted', false,
      'read_only', true,
      'workspaces', '[]'::jsonb,
      'brands', '[]'::jsonb
    );
  end if;

  -- „zuletzt genutzt“ höchstens alle 5 Minuten schreiben
  update public.mcp_grants g
     set last_used_at = now()
   where g.user_id = v_grant.user_id and g.client_id = v_grant.client_id
     and (g.last_used_at is null or g.last_used_at < now() - interval '5 minutes');

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', w.id, 'name', w.name, 'slug', w.slug, 'description', w.description,
           'role', public.workspace_role_of(w.id), 'created_at', w.created_at
         ) order by w.name), '[]'::jsonb)
    into v_workspaces
    from public.workspaces w
   where w.id = any (v_grant.workspace_ids)
     and public.workspace_role_of(w.id) is not null;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', b.id, 'name', b.name, 'slug', b.slug, 'org_type', b.org_type, 'tagline', b.tagline,
           'workspace_id', b.workspace_id, 'workspace_name', w.name, 'workspace_slug', w.slug,
           'role', public.brand_role_of(b.id),
           'via', case when b.workspace_id = any (v_grant.workspace_ids) then 'workspace' else 'brand' end,
           'visibility', b.visibility, 'is_public', b.is_public, 'updated_at', b.updated_at
         ) order by w.name, b.name), '[]'::jsonb)
    into v_brands
    from public.brands b
    join public.workspaces w on w.id = b.workspace_id
   where (b.id = any (v_grant.brand_ids) or b.workspace_id = any (v_grant.workspace_ids))
     and public.brand_role_of(b.id) is not null;

  return jsonb_build_object(
    'client_id', v_grant.client_id,
    'client_name', v_grant.client_name,
    'granted', true,
    'read_only', v_grant.read_only,
    'workspaces', v_workspaces,
    'brands', v_brands
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Rechte auf Funktionen
-- ---------------------------------------------------------------------
revoke execute on function public.mcp_allows_workspace(uuid) from public, anon;
revoke execute on function public.mcp_allows_brand(uuid) from public, anon;
revoke execute on function public.mcp_read_only() from public, anon;
revoke execute on function public.save_mcp_grant(text, text, uuid[], uuid[], boolean) from public, anon;
revoke execute on function public.mcp_scope() from public, anon;

grant execute on function public.oauth_client_id() to anon, authenticated;
grant execute on function public.mcp_allows_workspace(uuid) to authenticated;
grant execute on function public.mcp_allows_brand(uuid) to authenticated;
grant execute on function public.mcp_read_only() to authenticated;
grant execute on function public.save_mcp_grant(text, text, uuid[], uuid[], boolean) to authenticated;
grant execute on function public.mcp_scope() to authenticated;
