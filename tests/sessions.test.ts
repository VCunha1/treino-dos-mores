import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asSuperuser, asUser, createTestDb, createUser, errorOf, type Db } from "./helpers/db";

let db: Db;
let ana: string; // admin do casal 1
let bia: string; // parceira
let carlos: string; // estranho
let supino: string;
let agacho: string;
let planAna: string;
let dayAna: string;
let planBia: string;
let dayBia: string;
let emptyDay: string;

async function sessionOf(uid: string) {
  await asUser(db, uid);
  const r = await db.query<{ id: string }>("select id from public.workout_sessions where status = 'in_progress'");
  return r.rows[0]?.id;
}

async function start(uid: string, day: string) {
  await asUser(db, uid);
  const r = await db.query<{ start_workout_session: string }>("select public.start_workout_session($1)", [day]);
  return r.rows[0]!.start_workout_session;
}

async function setsOf(uid: string, session: string) {
  await asUser(db, uid);
  const r = await db.query<{ id: string; exercise_name: string; set_number: number; load_kg: string | null }>(
    `select st.id, se.exercise_name, st.set_number, st.load_kg
       from public.workout_sets st
       join public.workout_session_exercises se on se.id = st.session_exercise_id
      where se.session_id = $1
      order by se.position, st.set_number`,
    [session],
  );
  return r.rows;
}

async function completeSet(uid: string, setId: string, reps: number, load: number) {
  await asUser(db, uid);
  return db.query("update public.workout_sets set reps = $2, load_kg = $3, completed = true where id = $1 returning id", [
    setId,
    reps,
    load,
  ]);
}

async function createPlanWithDay(uid: string, name: string, exercises: [string, number, string, number | null][]) {
  await asUser(db, uid);
  const plan = (await db.query<{ p: string }>("select public.create_workout_plan($1, $2, 'full_body', null, array['Dia']) as p", [uid, name])).rows[0]!.p;
  const day = (await db.query<{ id: string }>("select id from public.workout_plan_days where plan_id = $1", [plan])).rows[0]!.id;
  let pos = 1;
  for (const [ex, sets, reps, load] of exercises) {
    await db.query(
      "insert into public.workout_plan_exercises (day_id, exercise_id, position, sets, reps, initial_load_kg, rest_seconds) values ($1,$2,$3,$4,$5,$6,75)",
      [day, ex, pos++, sets, reps, load],
    );
  }
  return { plan, day };
}

beforeAll(async () => {
  db = await createTestDb();
  ana = await createUser(db, "Ana");
  bia = await createUser(db, "Bia");
  carlos = await createUser(db, "Carlos");

  await asUser(db, ana);
  const c1 = (await db.query<{ c: string }>("select public.create_couple('C1') as c")).rows[0]!.c;
  const code = (await db.query<{ code: string }>("select * from public.create_invitation($1)", [c1])).rows[0]!.code;
  await asUser(db, bia);
  await db.query("select public.accept_invitation($1)", [code]);

  await asSuperuser(db);
  supino = (await db.query<{ id: string }>("select id from public.exercises where name = 'Supino reto com barra'")).rows[0]!.id;
  agacho = (await db.query<{ id: string }>("select id from public.exercises where name = 'Agachamento livre'")).rows[0]!.id;

  const a = await createPlanWithDay(ana, "Plano Ana", [
    [supino, 3, "8-12", 40],
    [agacho, 2, "10", null],
  ]);
  planAna = a.plan;
  dayAna = a.day;
  const b = await createPlanWithDay(bia, "Plano Bia", [[supino, 3, "10-12", 20]]);
  planBia = b.plan;
  dayBia = b.day;

  await asUser(db, carlos);
  const e = (await db.query<{ p: string }>("select public.create_workout_plan($1, 'Vazio', 'custom', null, array['A']) as p", [carlos])).rows[0]!.p;
  emptyDay = (await db.query<{ id: string }>("select id from public.workout_plan_days where plan_id = $1", [e])).rows[0]!.id;
});

afterAll(async () => {
  await db.close();
});

describe("iniciar treino", () => {
  it("cria sessão com snapshot dos exercícios e séries pré-criadas", async () => {
    const s = await start(ana, dayAna);
    await asUser(db, ana);
    const sess = await db.query<{ plan_name: string; day_name: string; status: string; user_id: string }>(
      "select plan_name, day_name, status, user_id from public.workout_sessions where id = $1",
      [s],
    );
    expect(sess.rows[0]).toMatchObject({ plan_name: "Plano Ana", day_name: "Dia", status: "in_progress", user_id: ana });

    const sets = await setsOf(ana, s);
    expect(sets.map((x) => `${x.exercise_name}#${x.set_number}`)).toEqual([
      "Supino reto com barra#1",
      "Supino reto com barra#2",
      "Supino reto com barra#3",
      "Agachamento livre#1",
      "Agachamento livre#2",
    ]);
    // Carga inicial do plano (sem histórico): 40 no supino, nada no agachamento.
    expect(sets.filter((x) => x.exercise_name === "Supino reto com barra").every((x) => Number(x.load_kg) === 40)).toBe(true);
    expect(sets.filter((x) => x.exercise_name === "Agachamento livre").every((x) => x.load_kg === null)).toBe(true);
  });

  it("não permite duas sessões em andamento para o mesmo usuário", async () => {
    await asUser(db, ana);
    expect(await errorOf(() => db.query("select public.start_workout_session($1)", [dayAna]))).toMatch(/session_in_progress/);
  });

  it("a sessão fica registrada no nome de quem treina, mesmo em plano gerenciado pelo admin", async () => {
    // Ana (admin) pode VER o plano da Bia, mas a sessão que ela inicia é dela.
    await asUser(db, ana);
    const active = await sessionOf(ana);
    await db.query("delete from public.workout_sessions where id = $1", [active]); // descarta para liberar
    const s = await start(ana, dayBia);
    await asUser(db, ana);
    const r = await db.query<{ user_id: string }>("select user_id from public.workout_sessions where id = $1", [s]);
    expect(r.rows[0]?.user_id).toBe(ana);
    await db.query("delete from public.workout_sessions where id = $1", [s]);
  });

  it("não inicia treino de plano que não pode ver", async () => {
    await asUser(db, carlos);
    expect(await errorOf(() => db.query("select public.start_workout_session($1)", [dayAna]))).toMatch(/forbidden/);
    await asUser(db, bia);
    expect(await errorOf(() => db.query("select public.start_workout_session($1)", [dayAna]))).toMatch(/forbidden/); // não compartilhado
  });

  it("recusa dia sem exercícios", async () => {
    await asUser(db, carlos);
    expect(await errorOf(() => db.query("select public.start_workout_session($1)", [emptyDay]))).toMatch(/empty_day/);
  });

  it("INSERT direto em sessões, exercícios da sessão é negado", async () => {
    await asUser(db, bia);
    expect(
      await errorOf(() =>
        db.query("insert into public.workout_sessions (user_id, plan_name, day_name) values ($1, 'x', 'y')", [bia]),
      ),
    ).toMatch(/permission denied/i);
    expect(
      await errorOf(() =>
        db.query(
          "insert into public.workout_session_exercises (session_id, exercise_name, primary_muscle, position, planned_sets, planned_reps, rest_seconds) values (gen_random_uuid(),'x','costas',1,1,'1',1)",
        ),
      ),
    ).toMatch(/permission denied/i);
  });
});

describe("registrar séries", () => {
  let session: string;

  beforeAll(async () => {
    // Ana ainda tem a sessão iniciada no primeiro teste? Ela foi descartada; inicia de novo.
    session = (await sessionOf(ana)) ?? (await start(ana, dayAna));
  });

  it("o dono registra repetições e carga e marca a série como concluída", async () => {
    const sets = await setsOf(ana, session);
    const r = await completeSet(ana, sets[0]!.id, 12, 40);
    expect(r.rows).toHaveLength(1);
    await asUser(db, ana);
    const row = await db.query<{ completed: boolean; completed_at: string | null }>(
      "select completed, completed_at from public.workout_sets where id = $1",
      [sets[0]!.id],
    );
    expect(row.rows[0]?.completed).toBe(true);
    expect(row.rows[0]?.completed_at).not.toBeNull();
  });

  it("reenviar a mesma atualização é idempotente (sem duplicar nem mudar a hora de conclusão)", async () => {
    const sets = await setsOf(ana, session);
    await asUser(db, ana);
    const before = (await db.query<{ completed_at: string }>("select completed_at from public.workout_sets where id = $1", [sets[0]!.id])).rows[0]!.completed_at;
    await completeSet(ana, sets[0]!.id, 12, 40);
    await completeSet(ana, sets[0]!.id, 12, 40);
    await asUser(db, ana);
    const after = (await db.query<{ completed_at: string }>("select completed_at from public.workout_sets where id = $1", [sets[0]!.id])).rows[0]!.completed_at;
    expect(new Date(after).getTime()).toBe(new Date(before).getTime());
    expect((await setsOf(ana, session)).length).toBe(5);
  });

  it("desmarcar a série limpa o horário de conclusão", async () => {
    const sets = await setsOf(ana, session);
    await asUser(db, ana);
    await db.query("update public.workout_sets set completed = false where id = $1", [sets[1]!.id]);
    const r = await db.query<{ completed_at: string | null }>("select completed_at from public.workout_sets where id = $1", [sets[1]!.id]);
    expect(r.rows[0]?.completed_at).toBeNull();
  });

  it("o dono pode adicionar uma série extra, mas não duplicar o número", async () => {
    await asUser(db, ana);
    const se = (await db.query<{ id: string }>("select id from public.workout_session_exercises where session_id = $1 order by position limit 1", [session])).rows[0]!.id;
    await db.query("insert into public.workout_sets (session_exercise_id, set_number, load_kg) values ($1, 4, 40)", [se]);
    expect(await errorOf(() => db.query("insert into public.workout_sets (session_exercise_id, set_number) values ($1, 4)", [se]))).toMatch(/unique|duplicate/i);
  });

  it("valores impossíveis são rejeitados", async () => {
    const sets = await setsOf(ana, session);
    await asUser(db, ana);
    expect(await errorOf(() => db.query("update public.workout_sets set reps = 5000 where id = $1", [sets[2]!.id]))).toMatch(/check constraint/i);
    expect(await errorOf(() => db.query("update public.workout_sets set load_kg = -1 where id = $1", [sets[2]!.id]))).toMatch(/check constraint/i);
    expect(await errorOf(() => db.query("update public.workout_sets set load_kg = 5000 where id = $1", [sets[2]!.id]))).toMatch(/check constraint/i);
  });

  it("o dono pula um exercício", async () => {
    await asUser(db, ana);
    const r = await db.query(
      "update public.workout_session_exercises set status = 'skipped' where session_id = $1 and exercise_name = 'Agachamento livre' returning id",
      [session],
    );
    expect(r.rows).toHaveLength(1);
  });

  it("colunas fixas não podem ser alteradas (snapshot e dono)", async () => {
    await asUser(db, ana);
    expect(await errorOf(() => db.query("update public.workout_sessions set user_id = $1 where id = $2", [bia, session]))).toMatch(/permission denied/i);
    expect(await errorOf(() => db.query("update public.workout_sessions set status = 'completed' where id = $1", [session]))).toMatch(/permission denied/i);
    expect(await errorOf(() => db.query("update public.workout_sessions set total_volume_kg = 999999 where id = $1", [session]))).toMatch(/permission denied/i);
    expect(await errorOf(() => db.query("update public.workout_session_exercises set exercise_name = 'x' where session_id = $1", [session]))).toMatch(/permission denied/i);
    expect(await errorOf(() => db.query("update public.workout_sets set completed_at = now() where session_exercise_id is not null"))).toMatch(/permission denied/i);
  });
});

describe("isolamento", () => {
  let session: string;
  let setId: string;

  beforeAll(async () => {
    session = (await sessionOf(ana))!;
    setId = (await setsOf(ana, session))[0]!.id;
  });

  it("parceira, admin de outro casal e estranho não enxergam sessões, exercícios nem séries", async () => {
    for (const uid of [bia, carlos]) {
      await asUser(db, uid);
      expect((await db.query("select * from public.workout_sessions where user_id = $1", [ana])).rows).toHaveLength(0);
      expect((await db.query("select * from public.workout_session_exercises where session_id = $1", [session])).rows).toHaveLength(0);
      expect((await db.query("select * from public.workout_sets where id = $1", [setId])).rows).toHaveLength(0);
    }
  });

  it("ninguém altera ou apaga a sessão e as séries de outra pessoa", async () => {
    for (const uid of [bia, carlos]) {
      await asUser(db, uid);
      expect((await db.query("update public.workout_sets set reps = 99 where id = $1 returning id", [setId])).rows).toHaveLength(0);
      expect((await db.query("delete from public.workout_sets where id = $1 returning id", [setId])).rows).toHaveLength(0);
      expect((await db.query("update public.workout_sessions set notes = 'x' where id = $1 returning id", [session])).rows).toHaveLength(0);
      expect((await db.query("delete from public.workout_sessions where id = $1 returning id", [session])).rows).toHaveLength(0);
      expect(
        await errorOf(() => db.query("select public.finish_workout_session($1)", [session])),
      ).toMatch(/forbidden/);
    }
  });

  it("não é possível criar série dentro da sessão de outra pessoa", async () => {
    await asUser(db, ana);
    const se = (await db.query<{ id: string }>("select id from public.workout_session_exercises where session_id = $1 limit 1", [session])).rows[0]!.id;
    await asUser(db, bia);
    expect(await errorOf(() => db.query("insert into public.workout_sets (session_exercise_id, set_number) values ($1, 30)", [se]))).toMatch(/row-level security/i);
  });

  it("anônimo não acessa nada", async () => {
    await asSuperuser(db);
    await db.exec("set role anon");
    expect(await errorOf(() => db.query("select * from public.workout_sessions"))).toMatch(/permission denied/i);
    expect(await errorOf(() => db.query("select public.start_workout_session(gen_random_uuid())"))).toMatch(/permission denied/i);
    await asSuperuser(db);
  });
});

describe("finalizar treino", () => {
  it("recusa finalizar sem nenhuma série concluída", async () => {
    await asUser(db, bia);
    const s = await start(bia, dayBia);
    await asUser(db, bia);
    expect(await errorOf(() => db.query("select public.finish_workout_session($1)", [s]))).toMatch(/no_sets_completed/);
    await db.query("delete from public.workout_sessions where id = $1", [s]);
  });

  it("calcula volume e séries, registra o fim e congela o registro", async () => {
    const session = (await sessionOf(ana))!;
    const sets = await setsOf(ana, session);
    // série 1 já concluída: 12 x 40 = 480. Conclui mais duas: 10 x 45 = 450 e 8 x 50 = 400.
    await completeSet(ana, sets[1]!.id, 10, 45);
    await completeSet(ana, sets[2]!.id, 8, 50);
    await asUser(db, ana);
    await db.query("select public.finish_workout_session($1, '  treino bom  ')", [session]);

    const r = await db.query<{ status: string; total_volume_kg: string; sets_completed: number; notes: string; ended_at: string | null }>(
      "select status, total_volume_kg, sets_completed, notes, ended_at from public.workout_sessions where id = $1",
      [session],
    );
    expect(r.rows[0]).toMatchObject({ status: "completed", sets_completed: 3, notes: "treino bom" });
    expect(Number(r.rows[0]!.total_volume_kg)).toBe(480 + 450 + 400);
    expect(r.rows[0]!.ended_at).not.toBeNull();
  });

  it("sessão finalizada é imutável: séries e exercícios não podem mais mudar", async () => {
    await asUser(db, ana);
    const session = (await db.query<{ id: string }>("select id from public.workout_sessions where status = 'completed' limit 1")).rows[0]!.id;
    const sets = await setsOf(ana, session);
    expect((await db.query("update public.workout_sets set reps = 1 where id = $1 returning id", [sets[0]!.id])).rows).toHaveLength(0);
    expect((await db.query("delete from public.workout_sets where id = $1 returning id", [sets[0]!.id])).rows).toHaveLength(0);
    expect((await db.query("update public.workout_session_exercises set status = 'skipped' where session_id = $1 returning id", [session])).rows).toHaveLength(0);
    const se = (await db.query<{ id: string }>("select id from public.workout_session_exercises where session_id = $1 limit 1", [session])).rows[0]!.id;
    expect(await errorOf(() => db.query("insert into public.workout_sets (session_exercise_id, set_number) values ($1, 20)", [se]))).toMatch(/row-level security/i);
    expect(await errorOf(() => db.query("select public.finish_workout_session($1)", [session]))).toMatch(/session_not_active/);
  });

  it("depois de finalizar, o usuário pode iniciar outro treino", async () => {
    const s = await start(ana, dayAna);
    expect(s).toBeTruthy();
  });
});

describe("carga sugerida e histórico", () => {
  it("sugere a última carga concluída DO PRÓPRIO usuário no exercício", async () => {
    // Ana concluiu supino com 50 kg por último; a nova sessão (iniciada no teste anterior) deve sugerir 50.
    const session = (await sessionOf(ana))!;
    const sets = await setsOf(ana, session);
    const supinoSets = sets.filter((x) => x.exercise_name === "Supino reto com barra");
    expect(supinoSets.every((x) => Number(x.load_kg) === 50)).toBe(true);
  });

  it("NÃO usa a carga de outra pessoa como sugestão (nem do parceiro)", async () => {
    // Bia nunca treinou supino. Mesmo com Ana tendo 50 kg, a sugestão dela é a carga inicial do plano (20).
    const session = await start(bia, dayBia);
    const sets = await setsOf(bia, session);
    expect(sets.every((x) => Number(x.load_kg) === 20)).toBe(true);
    await asUser(db, bia);
    await db.query("delete from public.workout_sessions where id = $1", [session]);
  });

  it("sessão em andamento não conta como histórico para a sugestão", async () => {
    // Descarta a sessão atual da Ana, conclui uma série com 70 kg SEM finalizar e inicia outra: deve continuar 50.
    const cur = (await sessionOf(ana))!;
    const sets = await setsOf(ana, cur);
    await completeSet(ana, sets[0]!.id, 5, 70);
    await asUser(db, ana);
    await db.query("delete from public.workout_sessions where id = $1", [cur]);
    const next = await start(ana, dayAna);
    const nextSets = await setsOf(ana, next);
    expect(nextSets.filter((x) => x.exercise_name === "Supino reto com barra").every((x) => Number(x.load_kg) === 50)).toBe(true);
  });

  it("o histórico preserva o nome do exercício mesmo que o plano mude depois", async () => {
    await asUser(db, ana);
    const done = (await db.query<{ id: string }>("select id from public.workout_sessions where status = 'completed' limit 1")).rows[0]!.id;
    await db.query("update public.workout_plans set name = 'Renomeado' where id = $1", [planAna]);
    await db.query("delete from public.workout_plan_exercises where day_id = $1", [dayAna]);
    const r = await db.query<{ plan_name: string }>("select plan_name from public.workout_sessions where id = $1", [done]);
    expect(r.rows[0]?.plan_name).toBe("Plano Ana");
    expect((await setsOf(ana, done)).length).toBeGreaterThan(0);
  });

  it("apagar o exercício personalizado não apaga o histórico", async () => {
    await asUser(db, ana);
    const ex = (await db.query<{ id: string }>("insert into public.exercises (owner_id, name, primary_muscle) values ($1, 'Custom Ana', 'costas') returning id", [ana])).rows[0]!.id;
    const plan = (await db.query<{ p: string }>("select public.create_workout_plan($1, 'Custom', 'custom', null, array['A']) as p", [ana])).rows[0]!.p;
    const day = (await db.query<{ id: string }>("select id from public.workout_plan_days where plan_id = $1", [plan])).rows[0]!.id;
    await db.query("insert into public.workout_plan_exercises (day_id, exercise_id, position) values ($1, $2, 1)", [day, ex]);
    await db.query("delete from public.workout_sessions where status = 'in_progress'");
    const s = await start(ana, day);
    const sets = await setsOf(ana, s);
    await completeSet(ana, sets[0]!.id, 10, 20);
    await asUser(db, ana);
    await db.query("select public.finish_workout_session($1)", [s]);
    await db.query("delete from public.workout_plan_exercises where day_id = $1", [day]);
    await db.query("delete from public.exercises where id = $1", [ex]);
    const r = await db.query<{ exercise_name: string; exercise_id: string | null }>(
      "select exercise_name, exercise_id from public.workout_session_exercises where session_id = $1",
      [s],
    );
    expect(r.rows[0]).toMatchObject({ exercise_name: "Custom Ana", exercise_id: null });
  });

  it("descartar um treino em andamento remove sessão, exercícios e séries em cascata", async () => {
    await asUser(db, ana);
    const active = (await sessionOf(ana)) ?? (await start(ana, dayBia));
    await asUser(db, ana);
    await db.query("delete from public.workout_sessions where id = $1", [active]);
    await asSuperuser(db);
    expect((await db.query("select 1 from public.workout_session_exercises where session_id = $1", [active])).rows).toHaveLength(0);
  });
});
