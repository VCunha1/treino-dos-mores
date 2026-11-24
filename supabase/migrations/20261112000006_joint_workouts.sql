-- =====================================================================
-- TREINO DOS MORES — Fase 4: Treinar Juntos
--
-- Modelo:
--  * Cada pessoa continua com a SUA sessão de treino individual (Fase 3), com
--    as próprias cargas, no próprio plano. Nada disso é aberto ao parceiro.
--  * joint_sessions: "encontro" de treino do casal (waiting → active → completed
--    | cancelled). No máximo UM encontro aberto por casal.
--  * joint_participants: uma linha por pessoa, ligada à sessão dela, com um
--    RESUMO de progresso (séries feitas, exercício atual, volume). É isso — e só
--    isso — que o parceiro enxerga, e é nessa tabela que o Realtime transmite.
--    Mantido por triggers; o cliente não escreve nada diretamente.
--
-- Regras de segurança:
--  * Só membros do casal leem o encontro. Estranhos e outros casais: nada.
--  * Parceiro NÃO lê workout_sessions / workout_sets do outro (continuam privadas).
--  * Entrar no encontro é ato explícito de cada pessoa (create / join).
--  * Sair, descartar ou finalizar o treino encerra a participação.
--  * Sair do casal cancela/encerra o encontro aberto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
create table public.joint_sessions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint joint_sessions_end_consistent check ((status in ('completed', 'cancelled')) = (ended_at is not null))
);
-- No máximo um encontro aberto por casal.
create unique index joint_sessions_one_open on public.joint_sessions (couple_id) where status in ('waiting', 'active');
create index joint_sessions_couple_created_idx on public.joint_sessions (couple_id, created_at desc);

create table public.joint_participants (
  joint_id uuid not null references public.joint_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid references public.workout_sessions (id) on delete set null,
  day_name text not null check (char_length(day_name) between 1 and 60),
  status text not null default 'training' check (status in ('training', 'finished', 'left')),
  joined_at timestamptz not null default now(),
  finished_at timestamptz,
  sets_done integer not null default 0,
  sets_total integer not null default 0,
  exercises_done integer not null default 0,
  exercises_total integer not null default 0,
  current_exercise text,
  volume_kg numeric(12,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (joint_id, user_id)
);
create index joint_participants_session_idx on public.joint_participants (session_id);
create index joint_participants_user_idx on public.joint_participants (user_id);

create trigger joint_sessions_updated_at before update on public.joint_sessions
  for each row execute function public.set_updated_at();
create trigger joint_participants_updated_at before update on public.joint_participants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Autorização
-- ---------------------------------------------------------------------
create or replace function public.can_view_joint(p_joint uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.joint_sessions j
    where j.id = p_joint and public.is_couple_member(j.couple_id)
  );
$$;

-- ---------------------------------------------------------------------
-- Funções internas (nunca chamadas direto pelo cliente)
-- ---------------------------------------------------------------------

-- Cria a sessão individual a partir de um dia de plano. É o corpo que antes vivia
-- em start_workout_session (Fase 3), agora reaproveitado pelo treino conjunto.
create or replace function public.create_session_from_day(p_uid uuid, p_day uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_day public.workout_plan_days;
  v_plan public.workout_plans;
  v_session uuid;
  v_se uuid;
  v_load numeric;
  pe record;
  i integer;
begin
  if p_uid is null or p_uid is distinct from auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_day from public.workout_plan_days where id = p_day;
  if v_day.id is null or not public.can_view_day(p_day) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_plan from public.workout_plans where id = v_day.plan_id;

  if exists (select 1 from public.workout_sessions s where s.user_id = p_uid and s.status = 'in_progress') then
    raise exception 'session_in_progress' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.workout_plan_exercises e where e.day_id = p_day) then
    raise exception 'empty_day' using errcode = 'P0001';
  end if;

  insert into public.workout_sessions (user_id, plan_id, day_id, plan_name, day_name)
  values (p_uid, v_plan.id, v_day.id, v_plan.name, v_day.name)
  returning id into v_session;

  for pe in
    select e.*, x.name as ex_name, x.primary_muscle as ex_muscle
    from public.workout_plan_exercises e
    join public.exercises x on x.id = e.exercise_id
    where e.day_id = p_day
    order by e.position, e.created_at
  loop
    insert into public.workout_session_exercises
      (session_id, exercise_id, exercise_name, primary_muscle, position, planned_sets, planned_reps,
       planned_load_kg, rest_seconds, special_technique, plan_notes)
    values
      (v_session, pe.exercise_id, pe.ex_name, pe.ex_muscle, pe.position, pe.sets, pe.reps,
       pe.initial_load_kg, pe.rest_seconds, pe.special_technique, pe.notes)
    returning id into v_se;

    -- Carga sugerida: SEMPRE do histórico do próprio usuário.
    select s.load_kg into v_load
    from public.workout_sets s
    join public.workout_session_exercises se on se.id = s.session_exercise_id
    join public.workout_sessions ss on ss.id = se.session_id
    where ss.user_id = p_uid
      and ss.status = 'completed'
      and se.exercise_id = pe.exercise_id
      and s.completed
      and s.load_kg is not null
    order by s.completed_at desc
    limit 1;

    for i in 1..pe.sets loop
      insert into public.workout_sets (session_exercise_id, set_number, load_kg)
      values (v_se, i, coalesce(v_load, pe.initial_load_kg));
    end loop;
  end loop;

  return v_session;
end;
$$;

-- A RPC pública da Fase 3 passa a delegar para a função interna (mesmo comportamento).
create or replace function public.start_workout_session(p_day uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return public.create_session_from_day(auth.uid(), p_day);
end;
$$;

-- Recalcula o resumo de progresso de quem está treinando nesta sessão.
create or replace function public.refresh_joint_progress(p_session uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_joint uuid;
  v_user uuid;
  v_total integer;
  v_done integer;
  v_vol numeric;
  v_ex_total integer;
  v_ex_done integer;
  v_cur text;
begin
  select p.joint_id, p.user_id into v_joint, v_user
  from public.joint_participants p
  where p.session_id = p_session and p.status = 'training';
  if v_joint is null then
    return;
  end if;

  select count(*),
         count(*) filter (where st.completed),
         coalesce(sum(case when st.completed then coalesce(st.reps, 0) * coalesce(st.load_kg, 0) else 0 end), 0)
    into v_total, v_done, v_vol
  from public.workout_sets st
  join public.workout_session_exercises se on se.id = st.session_exercise_id
  where se.session_id = p_session and se.status <> 'skipped';

  select count(*) filter (where se.status <> 'skipped'),
         count(*) filter (
           where se.status <> 'skipped'
             and exists (select 1 from public.workout_sets s where s.session_exercise_id = se.id)
             and not exists (select 1 from public.workout_sets s where s.session_exercise_id = se.id and not s.completed)
         )
    into v_ex_total, v_ex_done
  from public.workout_session_exercises se
  where se.session_id = p_session;

  select se.exercise_name into v_cur
  from public.workout_session_exercises se
  where se.session_id = p_session
    and se.status <> 'skipped'
    and exists (select 1 from public.workout_sets s where s.session_exercise_id = se.id and not s.completed)
  order by se.position
  limit 1;

  update public.joint_participants
     set sets_done = v_done,
         sets_total = v_total,
         exercises_done = v_ex_done,
         exercises_total = v_ex_total,
         current_exercise = v_cur,
         volume_kg = v_vol
   where joint_id = v_joint and user_id = v_user;
end;
$$;

-- Fecha o encontro quando ninguém mais está treinando.
create or replace function public.settle_joint(p_joint uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status text;
  v_training integer;
  v_finished integer;
begin
  select j.status into v_status from public.joint_sessions j where j.id = p_joint for update;
  if v_status is null or v_status in ('completed', 'cancelled') then
    return;
  end if;

  select count(*) filter (where p.status = 'training'),
         count(*) filter (where p.status = 'finished')
    into v_training, v_finished
  from public.joint_participants p
  where p.joint_id = p_joint;

  if v_training > 0 then
    return;
  end if;

  if v_status = 'active' and v_finished > 0 then
    update public.joint_sessions set status = 'completed', ended_at = now() where id = p_joint;
  else
    update public.joint_sessions set status = 'cancelled', ended_at = now() where id = p_joint;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Triggers que mantêm o resumo (e o Realtime) em dia
-- ---------------------------------------------------------------------
create or replace function public.trg_joint_sets_changed()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_session uuid;
begin
  select se.session_id into v_session
  from public.workout_session_exercises se
  where se.id = case when tg_op = 'DELETE' then old.session_exercise_id else new.session_exercise_id end;
  if v_session is not null then
    perform public.refresh_joint_progress(v_session);
  end if;
  return null;
end;
$$;

create trigger workout_sets_joint_progress after insert or update or delete on public.workout_sets
  for each row execute function public.trg_joint_sets_changed();

create or replace function public.trg_joint_exercise_changed()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.refresh_joint_progress(new.session_id);
  return null;
end;
$$;

create trigger workout_session_exercises_joint_progress after update of status on public.workout_session_exercises
  for each row when (old.status is distinct from new.status)
  execute function public.trg_joint_exercise_changed();

create or replace function public.trg_joint_session_completed()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_joint uuid;
begin
  update public.joint_participants
     set status = 'finished',
         finished_at = new.ended_at,
         sets_done = coalesce(new.sets_completed, 0),
         volume_kg = coalesce(new.total_volume_kg, 0),
         current_exercise = null
   where session_id = new.id and status = 'training'
  returning joint_id into v_joint;
  if v_joint is not null then
    perform public.settle_joint(v_joint);
  end if;
  return null;
end;
$$;

create trigger workout_sessions_joint_completed after update of status on public.workout_sessions
  for each row when (old.status is distinct from new.status and new.status = 'completed')
  execute function public.trg_joint_session_completed();

-- Descartar o treino em andamento = sair do encontro.
create or replace function public.trg_joint_session_deleted()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_joint uuid;
begin
  update public.joint_participants
     set status = 'left', current_exercise = null
   where session_id = old.id and status = 'training'
  returning joint_id into v_joint;
  if v_joint is not null then
    perform public.settle_joint(v_joint);
  end if;
  return old;
end;
$$;

create trigger workout_sessions_joint_deleted before delete on public.workout_sessions
  for each row execute function public.trg_joint_session_deleted();

-- Sair do casal encerra o encontro aberto (as sessões individuais continuam).
create or replace function public.trg_joint_member_left()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  j record;
begin
  for j in
    select id from public.joint_sessions
    where couple_id = old.couple_id and status in ('waiting', 'active')
  loop
    update public.joint_participants
       set status = 'left', current_exercise = null
     where joint_id = j.id and status = 'training';
    perform public.settle_joint(j.id);
  end loop;
  return old;
end;
$$;

create trigger couple_members_joint_left after delete on public.couple_members
  for each row execute function public.trg_joint_member_left();

-- ---------------------------------------------------------------------
-- RPCs públicas
-- ---------------------------------------------------------------------

-- Cria o encontro e já inicia o treino de quem chamou.
create or replace function public.start_joint_session(p_day uuid)
returns table (r_joint uuid, r_session uuid)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_couple uuid;
  v_session uuid;
  v_joint uuid;
  v_day_name text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  v_couple := public.current_couple_id();
  if v_couple is null then
    raise exception 'no_couple' using errcode = 'P0001';
  end if;
  if (select count(*) from public.couple_members m where m.couple_id = v_couple) < 2 then
    raise exception 'no_partner' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.joint_sessions j
    where j.couple_id = v_couple and j.status in ('waiting', 'active')
  ) then
    raise exception 'joint_open_exists' using errcode = 'P0001';
  end if;

  v_session := public.create_session_from_day(v_uid, p_day);
  select s.day_name into v_day_name from public.workout_sessions s where s.id = v_session;

  insert into public.joint_sessions (couple_id, created_by)
  values (v_couple, v_uid)
  returning id into v_joint;

  insert into public.joint_participants (joint_id, user_id, session_id, day_name)
  values (v_joint, v_uid, v_session, v_day_name);

  perform public.refresh_joint_progress(v_session);

  r_joint := v_joint;
  r_session := v_session;
  return next;
end;
$$;

-- A outra pessoa aceita o convite escolhendo o próprio treino.
create or replace function public.join_joint_session(p_joint uuid, p_day uuid)
returns table (r_joint uuid, r_session uuid)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.joint_sessions;
  v_session uuid;
  v_day_name text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_row from public.joint_sessions j where j.id = p_joint for update;
  if v_row.id is null or not public.is_couple_member(v_row.couple_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_row.status <> 'waiting' then
    raise exception 'joint_not_waiting' using errcode = 'P0001';
  end if;
  if v_row.created_by = v_uid then
    raise exception 'cannot_join_own' using errcode = 'P0001';
  end if;

  v_session := public.create_session_from_day(v_uid, p_day);
  select s.day_name into v_day_name from public.workout_sessions s where s.id = v_session;

  insert into public.joint_participants (joint_id, user_id, session_id, day_name)
  values (p_joint, v_uid, v_session, v_day_name);

  update public.joint_sessions set status = 'active', started_at = now() where id = p_joint;
  perform public.refresh_joint_progress(v_session);

  r_joint := p_joint;
  r_session := v_session;
  return next;
end;
$$;

-- Cancela um convite ainda sem resposta (quem chamou desiste, ou o parceiro recusa).
-- As sessões individuais continuam normalmente.
create or replace function public.cancel_joint_session(p_joint uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.joint_sessions;
begin
  select * into v_row from public.joint_sessions j where j.id = p_joint for update;
  if v_row.id is null or not public.is_couple_member(v_row.couple_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_row.status <> 'waiting' then
    raise exception 'joint_not_waiting' using errcode = 'P0001';
  end if;

  update public.joint_participants set status = 'left', current_exercise = null
   where joint_id = p_joint and status = 'training';
  update public.joint_sessions set status = 'cancelled', ended_at = now() where id = p_joint;
end;
$$;

-- Sai do encontro em andamento; o treino individual de quem saiu segue normal.
create or replace function public.leave_joint_session(p_joint uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_changed integer;
begin
  update public.joint_participants set status = 'left', current_exercise = null
   where joint_id = p_joint and user_id = v_uid and status = 'training';
  get diagnostics v_changed = row_count;
  if v_changed = 0 then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform public.settle_joint(p_joint);
end;
$$;

-- ---------------------------------------------------------------------
-- Privilégios das funções
-- ---------------------------------------------------------------------
revoke all on function public.can_view_joint(uuid) from public, anon, authenticated;
revoke all on function public.create_session_from_day(uuid, uuid) from public, anon, authenticated;
revoke all on function public.refresh_joint_progress(uuid) from public, anon, authenticated;
revoke all on function public.settle_joint(uuid) from public, anon, authenticated;
revoke all on function public.trg_joint_sets_changed() from public, anon, authenticated;
revoke all on function public.trg_joint_exercise_changed() from public, anon, authenticated;
revoke all on function public.trg_joint_session_completed() from public, anon, authenticated;
revoke all on function public.trg_joint_session_deleted() from public, anon, authenticated;
revoke all on function public.trg_joint_member_left() from public, anon, authenticated;
revoke all on function public.start_joint_session(uuid) from public, anon, authenticated;
revoke all on function public.join_joint_session(uuid, uuid) from public, anon, authenticated;
revoke all on function public.cancel_joint_session(uuid) from public, anon, authenticated;
revoke all on function public.leave_joint_session(uuid) from public, anon, authenticated;

grant execute on function public.can_view_joint(uuid) to authenticated;
grant execute on function public.start_joint_session(uuid) to authenticated;
grant execute on function public.join_joint_session(uuid, uuid) to authenticated;
grant execute on function public.cancel_joint_session(uuid) to authenticated;
grant execute on function public.leave_joint_session(uuid) to authenticated;

-- Endurecimento: no Supabase, funções novas nascem executáveis por `anon`.
-- Nenhuma função do app precisa ser chamada sem login.
-- (Funções de trigger não precisam de EXECUTE para disparar; as RPCs já têm GRANT explícito.)
revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.joint_sessions enable row level security;
alter table public.joint_participants enable row level security;

-- Só membros do casal leem. Escrita apenas pelas RPCs/triggers acima.
create policy joint_sessions_select_couple on public.joint_sessions
  for select to authenticated using (public.is_couple_member(couple_id));
create policy joint_participants_select_couple on public.joint_participants
  for select to authenticated using (public.can_view_joint(joint_id));

revoke all on public.joint_sessions, public.joint_participants from anon, authenticated;
grant select on public.joint_sessions to authenticated;
grant select on public.joint_participants to authenticated;

-- ---------------------------------------------------------------------
-- Realtime (só existe no Supabase; ignorado em outros Postgres)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.joint_sessions;
    alter publication supabase_realtime add table public.joint_participants;
  end if;
end $$;
