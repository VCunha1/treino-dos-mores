-- =====================================================================
-- TREINO DOS MORES — Fase 3: Treino individual
--
-- Modelo:
--  * workout_sessions: uma execução de treino de UM usuário (user_id = dono).
--  * workout_session_exercises: "foto" (snapshot) dos exercícios do dia no
--    momento em que o treino começou. Editar o plano depois NÃO altera o
--    histórico.
--  * workout_sets: as séries. Pré-criadas ao iniciar; o usuário preenche.
--
-- Regras de segurança:
--  * Tudo é privado do dono. Nem o parceiro nem o admin do casal leem sessões
--    (compartilhamento de atividade virá na Fase 6, só com eventos resumidos).
--  * Sessão só nasce via start_workout_session e só termina via
--    finish_workout_session. O cliente não escolhe o dono.
--  * Sessão finalizada é imutável (séries e exercícios não podem mudar).
--  * A carga sugerida vem EXCLUSIVAMENTE do histórico do próprio usuário.
-- =====================================================================

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid references public.workout_plans (id) on delete set null,
  day_id uuid references public.workout_plan_days (id) on delete set null,
  plan_name text not null check (char_length(plan_name) between 1 and 80),
  day_name text not null check (char_length(day_name) between 1 and 60),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 500),
  total_volume_kg numeric(12,2),
  sets_completed integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_sessions_end_consistent check ((status = 'completed') = (ended_at is not null)),
  constraint workout_sessions_end_after_start check (ended_at is null or ended_at >= started_at)
);
-- No máximo uma sessão em andamento por usuário (base da "retomada").
create unique index workout_sessions_one_active on public.workout_sessions (user_id) where status = 'in_progress';
create index workout_sessions_user_started_idx on public.workout_sessions (user_id, started_at desc);

create table public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid references public.exercises (id) on delete set null,
  exercise_name text not null,
  primary_muscle text not null,
  position integer not null,
  planned_sets smallint not null check (planned_sets between 1 and 20),
  planned_reps text not null,
  planned_load_kg numeric(6,2),
  rest_seconds integer not null check (rest_seconds between 0 and 900),
  special_technique text,
  plan_notes text,
  status text not null default 'pending' check (status in ('pending', 'skipped')),
  notes text check (notes is null or char_length(notes) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_session_exercises_session_idx on public.workout_session_exercises (session_id, position);
create index workout_session_exercises_exercise_idx on public.workout_session_exercises (exercise_id);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.workout_session_exercises (id) on delete cascade,
  set_number smallint not null check (set_number between 1 and 50),
  reps smallint check (reps is null or reps between 0 and 1000),
  load_kg numeric(6,2) check (load_kg is null or load_kg between 0 and 1000),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Idempotência: reenviar a mesma série (reconexão) nunca duplica o registro.
  constraint workout_sets_unique_number unique (session_exercise_id, set_number)
);

create trigger workout_sessions_updated_at before update on public.workout_sessions
  for each row execute function public.set_updated_at();
create trigger workout_session_exercises_updated_at before update on public.workout_session_exercises
  for each row execute function public.set_updated_at();
create trigger workout_sets_updated_at before update on public.workout_sets
  for each row execute function public.set_updated_at();

create or replace function public.stamp_set_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.completed then
    if tg_op = 'INSERT' or not old.completed then
      new.completed_at := now();
    else
      new.completed_at := old.completed_at;
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger workout_sets_stamp_completion before insert or update on public.workout_sets
  for each row execute function public.stamp_set_completion();

-- ---------------------------------------------------------------------
-- Funções de autorização
-- ---------------------------------------------------------------------
create or replace function public.owns_session(p_session uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workout_sessions s
    where s.id = p_session and s.user_id = auth.uid()
  );
$$;

-- Dono E sessão ainda em andamento (única situação em que se pode editar séries).
create or replace function public.can_edit_session(p_session uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workout_sessions s
    where s.id = p_session and s.user_id = auth.uid() and s.status = 'in_progress'
  );
$$;

create or replace function public.owns_session_exercise(p_se uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workout_session_exercises e
    join public.workout_sessions s on s.id = e.session_id
    where e.id = p_se and s.user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_session_exercise(p_se uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workout_session_exercises e
    join public.workout_sessions s on s.id = e.session_id
    where e.id = p_se and s.user_id = auth.uid() and s.status = 'in_progress'
  );
$$;

revoke all on function public.owns_session(uuid) from public;
revoke all on function public.can_edit_session(uuid) from public;
revoke all on function public.owns_session_exercise(uuid) from public;
revoke all on function public.can_edit_session_exercise(uuid) from public;
grant execute on function public.owns_session(uuid) to authenticated;
grant execute on function public.can_edit_session(uuid) to authenticated;
grant execute on function public.owns_session_exercise(uuid) to authenticated;
grant execute on function public.can_edit_session_exercise(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------

-- Inicia um treino a partir de um dia de plano que o usuário PODE VER.
-- A sessão é sempre do usuário logado, mesmo que o plano seja da parceira.
create or replace function public.start_workout_session(p_day uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_day public.workout_plan_days;
  v_plan public.workout_plans;
  v_session uuid;
  v_se uuid;
  v_load numeric;
  pe record;
  i integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_day from public.workout_plan_days where id = p_day;
  if v_day.id is null or not public.can_view_day(p_day) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_plan from public.workout_plans where id = v_day.plan_id;

  if exists (select 1 from public.workout_sessions s where s.user_id = v_uid and s.status = 'in_progress') then
    raise exception 'session_in_progress' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.workout_plan_exercises e where e.day_id = p_day) then
    raise exception 'empty_day' using errcode = 'P0001';
  end if;

  insert into public.workout_sessions (user_id, plan_id, day_id, plan_name, day_name)
  values (v_uid, v_plan.id, v_day.id, v_plan.name, v_day.name)
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

    -- Carga sugerida: a última série concluída DESTE usuário neste exercício.
    -- Nunca usa dados de outra pessoa. Sem histórico, usa a carga inicial do plano.
    select s.load_kg into v_load
    from public.workout_sets s
    join public.workout_session_exercises se on se.id = s.session_exercise_id
    join public.workout_sessions ss on ss.id = se.session_id
    where ss.user_id = v_uid
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

-- Encerra o treino: calcula volume e séries concluídas e congela o registro.
create or replace function public.finish_workout_session(p_session uuid, p_notes text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_volume numeric;
  v_done integer;
begin
  select s.status into v_status
  from public.workout_sessions s
  where s.id = p_session and s.user_id = v_uid
  for update;

  if v_status is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_status <> 'in_progress' then
    raise exception 'session_not_active' using errcode = 'P0001';
  end if;

  select coalesce(sum(coalesce(st.reps, 0) * coalesce(st.load_kg, 0)), 0), count(*)
    into v_volume, v_done
  from public.workout_sets st
  join public.workout_session_exercises se on se.id = st.session_exercise_id
  where se.session_id = p_session and st.completed;

  if v_done = 0 then
    raise exception 'no_sets_completed' using errcode = 'P0001';
  end if;

  update public.workout_sessions
     set status = 'completed',
         ended_at = now(),
         notes = nullif(left(trim(coalesce(p_notes, '')), 500), ''),
         total_volume_kg = v_volume,
         sets_completed = v_done
   where id = p_session;
end;
$$;

revoke all on function public.start_workout_session(uuid) from public;
revoke all on function public.finish_workout_session(uuid, text) from public;
grant execute on function public.start_workout_session(uuid) to authenticated;
grant execute on function public.finish_workout_session(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.workout_sessions enable row level security;
alter table public.workout_session_exercises enable row level security;
alter table public.workout_sets enable row level security;

-- Sessões: só o dono. Sem INSERT direto (usar start_workout_session).
create policy workout_sessions_select_own on public.workout_sessions
  for select to authenticated using (user_id = auth.uid());
create policy workout_sessions_update_own on public.workout_sessions
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy workout_sessions_delete_own on public.workout_sessions
  for delete to authenticated using (user_id = auth.uid());

-- Exercícios da sessão: leitura do dono; edição só durante o treino.
create policy workout_session_exercises_select_own on public.workout_session_exercises
  for select to authenticated using (public.owns_session(session_id));
create policy workout_session_exercises_update_own on public.workout_session_exercises
  for update to authenticated
  using (public.can_edit_session(session_id)) with check (public.can_edit_session(session_id));

-- Séries: leitura do dono; criar/editar/apagar só durante o treino.
create policy workout_sets_select_own on public.workout_sets
  for select to authenticated using (public.owns_session_exercise(session_exercise_id));
create policy workout_sets_insert_own on public.workout_sets
  for insert to authenticated with check (public.can_edit_session_exercise(session_exercise_id));
create policy workout_sets_update_own on public.workout_sets
  for update to authenticated
  using (public.can_edit_session_exercise(session_exercise_id))
  with check (public.can_edit_session_exercise(session_exercise_id));
create policy workout_sets_delete_own on public.workout_sets
  for delete to authenticated using (public.can_edit_session_exercise(session_exercise_id));

-- ---------------------------------------------------------------------
-- Privilégios de tabela
-- ---------------------------------------------------------------------
revoke all on public.workout_sessions, public.workout_session_exercises, public.workout_sets
  from anon, authenticated;

grant select, delete on public.workout_sessions to authenticated;
grant update (notes) on public.workout_sessions to authenticated;

grant select on public.workout_session_exercises to authenticated;
grant update (status, notes) on public.workout_session_exercises to authenticated;

grant select, insert, delete on public.workout_sets to authenticated;
grant update (reps, load_kg, completed) on public.workout_sets to authenticated;
