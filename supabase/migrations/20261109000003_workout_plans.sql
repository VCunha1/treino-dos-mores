-- =====================================================================
-- TREINO DOS MORES — Fase 2: Biblioteca de exercícios e planejamento
--
-- Regras de autorização:
--  * Cada plano pertence a um usuário (owner_id).
--  * O dono gerencia o próprio plano.
--  * O ADMIN do casal também gerencia os planos da parceira (criar, editar,
--    organizar). Isso NÃO dá acesso a profile_details, saúde ou Cycle Sync:
--    essas tabelas continuam privadas e não dependem de manages_user().
--  * A parceira só vê planos do admin se o admin marcar is_shared = true
--    (somente leitura).
--  * Exercícios do sistema (owner_id null) são legíveis por todos e só podem
--    ser alterados por migrations. Exercícios personalizados são editáveis
--    só pelo dono e legíveis pelo casal.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete cascade, -- null = exercício do sistema
  name text not null check (char_length(name) between 2 and 80),
  primary_muscle text not null check (primary_muscle in (
    'peitoral', 'costas', 'ombros', 'biceps', 'triceps', 'antebraco',
    'quadriceps', 'posterior_coxa', 'gluteos', 'panturrilhas', 'abdomen', 'outros'
  )),
  secondary_muscles text[] not null default '{}'
    check (secondary_muscles <@ array[
      'peitoral', 'costas', 'ombros', 'biceps', 'triceps', 'antebraco',
      'quadriceps', 'posterior_coxa', 'gluteos', 'panturrilhas', 'abdomen', 'outros'
    ]::text[]),
  equipment text check (equipment is null or char_length(equipment) <= 60),
  description text check (description is null or char_length(description) <= 500),
  instructions text check (instructions is null or char_length(instructions) <= 1000),
  safety_notes text check (safety_notes is null or char_length(safety_notes) <= 500),
  media_url text check (media_url is null or (char_length(media_url) <= 500 and media_url ~* '^https?://')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index exercises_owner_name_uq
  on public.exercises (coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index exercises_muscle_idx on public.exercises (primary_muscle);
create index exercises_owner_idx on public.exercises (owner_id);

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  goal text check (goal is null or char_length(goal) <= 200),
  split_type text not null default 'custom' check (split_type in (
    'abc', 'abcd', 'abcde', 'upper_lower', 'push_pull_legs', 'full_body', 'custom'
  )),
  is_archived boolean not null default false,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_plans_owner_idx on public.workout_plans (owner_id, is_archived);

create table public.workout_plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  weekday smallint check (weekday is null or weekday between 0 and 6), -- 0 = domingo
  focus text check (focus is null or char_length(focus) <= 100),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_plan_days_plan_idx on public.workout_plan_days (plan_id, position);

create table public.workout_plan_exercises (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.workout_plan_days (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position integer not null default 0,
  sets smallint not null default 3 check (sets between 1 and 20),
  reps text not null default '8-12' check (char_length(reps) between 1 and 20),
  initial_load_kg numeric(6,2) check (initial_load_kg is null or initial_load_kg between 0 and 1000),
  rest_seconds integer not null default 90 check (rest_seconds between 0 and 900),
  notes text check (notes is null or char_length(notes) <= 300),
  special_technique text check (special_technique is null or char_length(special_technique) <= 100),
  objective text check (objective is null or char_length(objective) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_plan_exercises_day_idx on public.workout_plan_exercises (day_id, position);
create index workout_plan_exercises_exercise_idx on public.workout_plan_exercises (exercise_id);

create trigger exercises_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();
create trigger workout_plans_updated_at before update on public.workout_plans
  for each row execute function public.set_updated_at();
create trigger workout_plan_days_updated_at before update on public.workout_plan_days
  for each row execute function public.set_updated_at();
create trigger workout_plan_exercises_updated_at before update on public.workout_plan_exercises
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Funções de autorização (SECURITY DEFINER, search_path vazio)
-- ---------------------------------------------------------------------

-- O usuário logado pode gerenciar o conteúdo de treino de p_owner?
-- Sim se for ele mesmo, ou se for o ADMIN do casal em que p_owner está.
create or replace function public.manages_user(p_owner uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_owner = auth.uid()
      or exists (
        select 1
        from public.couple_members me
        join public.couple_members other on other.couple_id = me.couple_id
        where me.user_id = auth.uid()
          and me.role = 'admin'
          and other.user_id = p_owner
      );
$$;

create or replace function public.can_manage_plan(p_plan uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workout_plans w
    where w.id = p_plan and public.manages_user(w.owner_id)
  );
$$;

create or replace function public.can_view_plan(p_plan uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workout_plans w
    where w.id = p_plan
      and (
        public.manages_user(w.owner_id)
        or (w.is_shared and public.shares_couple_with(w.owner_id))
      )
  );
$$;

create or replace function public.can_manage_day(p_day uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workout_plan_days d
    where d.id = p_day and public.can_manage_plan(d.plan_id)
  );
$$;

create or replace function public.can_view_day(p_day uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workout_plan_days d
    where d.id = p_day and public.can_view_plan(d.plan_id)
  );
$$;

revoke all on function public.manages_user(uuid) from public;
revoke all on function public.can_manage_plan(uuid) from public;
revoke all on function public.can_view_plan(uuid) from public;
revoke all on function public.can_manage_day(uuid) from public;
revoke all on function public.can_view_day(uuid) from public;
grant execute on function public.manages_user(uuid) to authenticated;
grant execute on function public.can_manage_plan(uuid) to authenticated;
grant execute on function public.can_view_plan(uuid) to authenticated;
grant execute on function public.can_manage_day(uuid) to authenticated;
grant execute on function public.can_view_day(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- RPCs (escritas atômicas)
-- ---------------------------------------------------------------------

-- Cria o plano e seus dias numa única transação. O banco decide se o usuário
-- pode criar para p_owner (ele mesmo ou, sendo admin, a parceira).
create or replace function public.create_workout_plan(
  p_owner uuid,
  p_name text,
  p_split text,
  p_description text,
  p_day_names text[]
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_plan uuid;
  v_name text;
  i integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_owner is null or not public.manages_user(p_owner) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_split not in ('abc', 'abcd', 'abcde', 'upper_lower', 'push_pull_legs', 'full_body', 'custom') then
    raise exception 'invalid_split' using errcode = 'P0001';
  end if;
  if p_day_names is null or coalesce(array_length(p_day_names, 1), 0) not between 1 and 7 then
    raise exception 'invalid_days' using errcode = 'P0001';
  end if;

  insert into public.workout_plans (owner_id, created_by, name, description, split_type)
  values (p_owner, v_uid, trim(p_name), nullif(trim(coalesce(p_description, '')), ''), p_split)
  returning id into v_plan;

  for i in 1..array_length(p_day_names, 1) loop
    v_name := trim(p_day_names[i]);
    insert into public.workout_plan_days (plan_id, name, position)
    values (v_plan, v_name, i);
  end loop;

  return v_plan;
end;
$$;

-- Duplica um plano. Se quem chama gerencia o dono, a cópia fica com o mesmo dono;
-- se só pode VER (plano compartilhado), a cópia vira dele.
create or replace function public.duplicate_workout_plan(p_plan uuid, p_name text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_src public.workout_plans;
  v_new uuid;
  v_owner uuid;
  v_day uuid;
  d record;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_src from public.workout_plans where id = p_plan;
  if v_src.id is null or not public.can_view_plan(p_plan) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_owner := case when public.manages_user(v_src.owner_id) then v_src.owner_id else v_uid end;

  insert into public.workout_plans (owner_id, created_by, name, description, goal, split_type)
  values (
    v_owner, v_uid,
    left(coalesce(nullif(trim(coalesce(p_name, '')), ''), v_src.name || ' (cópia)'), 80),
    v_src.description, v_src.goal, v_src.split_type
  )
  returning id into v_new;

  for d in
    select * from public.workout_plan_days where plan_id = p_plan order by position, created_at
  loop
    insert into public.workout_plan_days (plan_id, name, weekday, focus, position)
    values (v_new, d.name, d.weekday, d.focus, d.position)
    returning id into v_day;

    insert into public.workout_plan_exercises
      (day_id, exercise_id, position, sets, reps, initial_load_kg, rest_seconds, notes, special_technique, objective)
    select v_day, e.exercise_id, e.position, e.sets, e.reps, e.initial_load_kg,
           e.rest_seconds, e.notes, e.special_technique, e.objective
    from public.workout_plan_exercises e
    where e.day_id = d.id;
  end loop;

  return v_new;
end;
$$;

revoke all on function public.create_workout_plan(uuid, text, text, text, text[]) from public;
revoke all on function public.duplicate_workout_plan(uuid, text) from public;
grant execute on function public.create_workout_plan(uuid, text, text, text, text[]) to authenticated;
grant execute on function public.duplicate_workout_plan(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.exercises enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_plan_days enable row level security;
alter table public.workout_plan_exercises enable row level security;

-- exercises: sistema (owner null) para todos; personalizados para o dono e o casal.
create policy exercises_select on public.exercises
  for select to authenticated
  using (owner_id is null or owner_id = auth.uid() or public.shares_couple_with(owner_id));
create policy exercises_insert_own on public.exercises
  for insert to authenticated
  with check (owner_id = auth.uid());
create policy exercises_update_own on public.exercises
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy exercises_delete_own on public.exercises
  for delete to authenticated
  using (owner_id = auth.uid());

-- workout_plans: sem INSERT direto (usar create_workout_plan).
create policy workout_plans_select on public.workout_plans
  for select to authenticated
  using (public.manages_user(owner_id) or (is_shared and public.shares_couple_with(owner_id)));
create policy workout_plans_update on public.workout_plans
  for update to authenticated
  using (public.manages_user(owner_id)) with check (public.manages_user(owner_id));
create policy workout_plans_delete on public.workout_plans
  for delete to authenticated
  using (public.manages_user(owner_id));

-- dias
create policy workout_plan_days_select on public.workout_plan_days
  for select to authenticated using (public.can_view_plan(plan_id));
create policy workout_plan_days_insert on public.workout_plan_days
  for insert to authenticated with check (public.can_manage_plan(plan_id));
create policy workout_plan_days_update on public.workout_plan_days
  for update to authenticated
  using (public.can_manage_plan(plan_id)) with check (public.can_manage_plan(plan_id));
create policy workout_plan_days_delete on public.workout_plan_days
  for delete to authenticated using (public.can_manage_plan(plan_id));

-- exercícios do dia: só aceita exercícios que o próprio usuário consegue enxergar.
create policy workout_plan_exercises_select on public.workout_plan_exercises
  for select to authenticated using (public.can_view_day(day_id));
create policy workout_plan_exercises_insert on public.workout_plan_exercises
  for insert to authenticated
  with check (
    public.can_manage_day(day_id)
    and exists (select 1 from public.exercises e where e.id = exercise_id)
  );
create policy workout_plan_exercises_update on public.workout_plan_exercises
  for update to authenticated
  using (public.can_manage_day(day_id)) with check (public.can_manage_day(day_id));
create policy workout_plan_exercises_delete on public.workout_plan_exercises
  for delete to authenticated using (public.can_manage_day(day_id));

-- ---------------------------------------------------------------------
-- Privilégios de tabela (explícitos, além da RLS)
-- ---------------------------------------------------------------------
revoke all on public.exercises, public.workout_plans,
              public.workout_plan_days, public.workout_plan_exercises
  from anon, authenticated;

grant select, insert, delete on public.exercises to authenticated;
grant update (name, primary_muscle, secondary_muscles, equipment, description, instructions, safety_notes, media_url)
  on public.exercises to authenticated;

grant select, delete on public.workout_plans to authenticated;
-- owner_id e created_by NÃO são atualizáveis: ninguém "toma" o plano de outra pessoa.
grant update (name, description, goal, split_type, is_archived, is_shared)
  on public.workout_plans to authenticated;

grant select, insert, delete on public.workout_plan_days to authenticated;
grant update (name, weekday, focus, position) on public.workout_plan_days to authenticated;

grant select, insert, delete on public.workout_plan_exercises to authenticated;
grant update (position, sets, reps, initial_load_kg, rest_seconds, notes, special_technique, objective)
  on public.workout_plan_exercises to authenticated;
