-- =====================================================================
-- TREINO DOS MORES — Fase 1: Fundação
-- Perfis, casais, membros, convites, RLS e funções auxiliares.
--
-- Princípios de segurança:
--  * RLS habilitada em TODAS as tabelas.
--  * Escritas em couples / couple_members / couple_invitations só
--    acontecem via funções SECURITY DEFINER (RPC), nunca por INSERT direto.
--  * O cliente nunca informa o dono de um registro: o dono é sempre auth.uid().
--  * Dados pessoais/físicos ficam em profile_details (somente o próprio dono).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Utilitário: updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

-- Perfil "público para o casal": nome e foto. Nada sensível aqui.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  avatar_url text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Detalhes pessoais opcionais: SOMENTE o próprio usuário enxerga.
create table public.profile_details (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  birth_date date,
  height_cm numeric(5,1) check (height_cm is null or height_cm between 50 and 260),
  weight_kg numeric(5,1) check (weight_kg is null or weight_kg between 20 and 400),
  training_goals text check (training_goals is null or char_length(training_goals) <= 500),
  training_preferences text check (training_preferences is null or char_length(training_preferences) <= 500),
  available_equipment text check (available_equipment is null or char_length(available_equipment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Nosso casal' check (char_length(name) between 1 and 60),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.couple_members (
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('admin', 'partner')),
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  -- Nesta versão, cada pessoa pertence a no máximo um casal.
  constraint couple_members_one_couple_per_user unique (user_id)
);
create index couple_members_couple_idx on public.couple_members (couple_id);

create table public.couple_invitations (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  code text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint accepted_fields_consistent check (
    (status = 'accepted') = (accepted_by is not null and accepted_at is not null)
  )
);
create index couple_invitations_couple_idx on public.couple_invitations (couple_id);
-- No máximo um convite pendente por casal.
create unique index couple_invitations_one_pending
  on public.couple_invitations (couple_id) where status = 'pending';

create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  default_rest_seconds integer not null default 90 check (default_rest_seconds between 10 and 600),
  sound_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  partner_workout_started boolean not null default true,
  partner_workout_finished boolean not null default true,
  partner_personal_record boolean not null default true,
  partner_exercise_events boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger profile_details_updated_at before update on public.profile_details
  for each row execute function public.set_updated_at();
create trigger couples_updated_at before update on public.couples
  for each row execute function public.set_updated_at();
create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();
create trigger notification_preferences_updated_at before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Funções auxiliares (SECURITY DEFINER evita recursão de RLS)
-- ---------------------------------------------------------------------

create or replace function public.is_couple_member(p_couple uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.couple_members m
    where m.couple_id = p_couple and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_couple_admin(p_couple uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.couple_members m
    where m.couple_id = p_couple and m.user_id = auth.uid() and m.role = 'admin'
  );
$$;

-- Verdadeiro se o usuário logado e p_user estão no mesmo casal (e são pessoas distintas ou iguais).
create or replace function public.shares_couple_with(p_user uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.couple_members me
    join public.couple_members other on other.couple_id = me.couple_id
    where me.user_id = auth.uid() and other.user_id = p_user
  );
$$;

-- Casal do usuário logado (ou null).
create or replace function public.current_couple_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select m.couple_id from public.couple_members m where m.user_id = auth.uid() limit 1;
$$;

revoke all on function public.is_couple_member(uuid) from public;
revoke all on function public.is_couple_admin(uuid) from public;
revoke all on function public.shares_couple_with(uuid) from public;
revoke all on function public.current_couple_id() from public;
grant execute on function public.is_couple_member(uuid) to authenticated;
grant execute on function public.is_couple_admin(uuid) to authenticated;
grant execute on function public.shares_couple_with(uuid) to authenticated;
grant execute on function public.current_couple_id() to authenticated;

-- ---------------------------------------------------------------------
-- Novo usuário => perfil + linhas padrão
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), ''), 60)
  );
  insert into public.user_preferences (user_id) values (new.id);
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- RPCs do casal (únicos pontos de escrita em couples/members/invitations)
-- ---------------------------------------------------------------------

create or replace function public.create_couple(p_name text default 'Nosso casal')
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_couple uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.couple_members where user_id = v_uid) then
    raise exception 'already_in_couple' using errcode = 'P0001';
  end if;

  insert into public.couples (name, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Nosso casal'), v_uid)
  returning id into v_couple;

  insert into public.couple_members (couple_id, user_id, role)
  values (v_couple, v_uid, 'admin');

  return v_couple;
end;
$$;

-- Gera (ou renova) o convite do casal. Apenas admin. Revoga o pendente anterior.
create or replace function public.create_invitation(p_couple uuid)
returns table (id uuid, code text, expires_at timestamptz)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_id uuid;
  v_exp timestamptz := now() + interval '7 days';
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.couple_members m
    where m.couple_id = p_couple and m.user_id = v_uid and m.role = 'admin'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if (select count(*) from public.couple_members m where m.couple_id = p_couple) >= 2 then
    raise exception 'couple_full' using errcode = 'P0001';
  end if;

  update public.couple_invitations i
     set status = 'revoked'
   where i.couple_id = p_couple and i.status = 'pending';

  -- Código de 10 caracteres legíveis (sem 0/O/1/I). A aleatoriedade vem de
  -- gen_random_uuid() (nativo, sem extensão): o byte 0 de um UUID v4 é totalmente
  -- aleatório e 256 é múltiplo de 32, então não há viés na escolha do caractere.
  v_code := '';
  for n in 1..10 loop
    v_code := v_code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
      1 + (get_byte(decode(substr(replace(gen_random_uuid()::text, '-', ''), 1, 2), 'hex'), 0) % 32), 1);
  end loop;

  insert into public.couple_invitations (couple_id, invited_by, code, expires_at)
  values (p_couple, v_uid, v_code, v_exp)
  returning couple_invitations.id into v_id;

  return query select v_id, v_code, v_exp;
end;
$$;

create or replace function public.revoke_invitation(p_invitation uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_couple uuid;
begin
  select i.couple_id into v_couple
    from public.couple_invitations i where i.id = p_invitation;
  if v_couple is null or not exists (
    select 1 from public.couple_members m
    where m.couple_id = v_couple and m.user_id = auth.uid() and m.role = 'admin'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.couple_invitations
     set status = 'revoked'
   where id = p_invitation and status = 'pending';
end;
$$;

-- Aceitação explícita do convite pela outra pessoa.
create or replace function public.accept_invitation(p_code text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.couple_invitations;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.couple_members where user_id = v_uid) then
    raise exception 'already_in_couple' using errcode = 'P0001';
  end if;

  select * into v_inv
    from public.couple_invitations i
   where i.code = upper(trim(p_code))
   for update;

  if v_inv.id is null or v_inv.status <> 'pending' or v_inv.expires_at <= now() then
    raise exception 'invalid_invitation' using errcode = 'P0001';
  end if;
  if v_inv.invited_by = v_uid then
    raise exception 'own_invitation' using errcode = 'P0001';
  end if;
  if (select count(*) from public.couple_members m where m.couple_id = v_inv.couple_id) >= 2 then
    raise exception 'couple_full' using errcode = 'P0001';
  end if;

  insert into public.couple_members (couple_id, user_id, role)
  values (v_inv.couple_id, v_uid, 'partner');

  update public.couple_invitations
     set status = 'accepted', accepted_by = v_uid, accepted_at = now()
   where id = v_inv.id;

  return v_inv.couple_id;
end;
$$;

-- Sair do casal. Se sobrar apenas uma pessoa, ela vira admin; se ninguém, o casal é removido.
create or replace function public.leave_couple()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_couple uuid;
begin
  select m.couple_id into v_couple from public.couple_members m where m.user_id = v_uid;
  if v_couple is null then
    return;
  end if;

  delete from public.couple_members where user_id = v_uid;

  if not exists (select 1 from public.couple_members where couple_id = v_couple) then
    delete from public.couples where id = v_couple;
  else
    update public.couple_members set role = 'admin' where couple_id = v_couple;
    update public.couple_invitations set status = 'revoked'
     where couple_id = v_couple and status = 'pending';
  end if;
end;
$$;

revoke all on function public.create_couple(text) from public;
revoke all on function public.create_invitation(uuid) from public;
revoke all on function public.revoke_invitation(uuid) from public;
revoke all on function public.accept_invitation(text) from public;
revoke all on function public.leave_couple() from public;
grant execute on function public.create_couple(text) to authenticated;
grant execute on function public.create_invitation(uuid) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.leave_couple() to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profile_details enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.couple_invitations enable row level security;
alter table public.user_preferences enable row level security;
alter table public.notification_preferences enable row level security;

-- profiles: o próprio usuário e quem está no mesmo casal podem LER (nome/foto).
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_couple_with(id));
-- Só o dono edita. INSERT é feito pelo trigger; DELETE por cascade de auth.users.
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- profile_details: estritamente privado.
create policy profile_details_select_own on public.profile_details
  for select to authenticated using (user_id = auth.uid());
create policy profile_details_insert_own on public.profile_details
  for insert to authenticated with check (user_id = auth.uid());
create policy profile_details_update_own on public.profile_details
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy profile_details_delete_own on public.profile_details
  for delete to authenticated using (user_id = auth.uid());

-- couples: membros leem; admin renomeia. Sem INSERT/DELETE direto (usar RPC).
create policy couples_select_member on public.couples
  for select to authenticated using (public.is_couple_member(id));
create policy couples_update_admin on public.couples
  for update to authenticated
  using (public.is_couple_admin(id)) with check (public.is_couple_admin(id));

-- couple_members: membros do mesmo casal enxergam a composição. Escrita só via RPC.
create policy couple_members_select on public.couple_members
  for select to authenticated using (public.is_couple_member(couple_id));

-- couple_invitations: somente admin do casal enxerga. Escrita só via RPC.
create policy couple_invitations_select_admin on public.couple_invitations
  for select to authenticated using (public.is_couple_admin(couple_id));

-- Preferências: somente o dono.
create policy user_preferences_all_own on public.user_preferences
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notification_preferences_all_own on public.notification_preferences
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Privilégios de tabela (defesa em profundidade além da RLS)
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.profile_details to authenticated;
grant select, update (name) on public.couples to authenticated;
grant select on public.couple_members to authenticated;
grant select on public.couple_invitations to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;
-- profiles: o cliente só pode alterar nome, foto e onboarding (nunca o id).
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url, onboarding_completed) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- Storage: bucket de avatares (leitura pública do arquivo; escrita só na própria pasta)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
