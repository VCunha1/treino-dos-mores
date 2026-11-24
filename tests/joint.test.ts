import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asSuperuser, asUser, createTestDb, createUser, errorOf, type Db } from "./helpers/db";

let db: Db;
let ana: string; // casal 1 (admin)
let bia: string; // casal 1 (parceira)
let carlos: string; // estranho, sem casal
let dana: string; // casal 2 (admin)
let eva: string; // casal 2 (parceira)
let fabio: string; // casal de uma pessoa só
let supino: string;
let agacho: string;
let dayAna: string;
let dayBia: string;
let dayDana: string;
let dayEva: string;
let dayFabio: string;

type Joint = { id: string; status: string; created_by: string };
type Part = {
  user_id: string;
  status: string;
  sets_done: number;
  sets_total: number;
  exercises_done: number;
  exercises_total: number;
  current_exercise: string | null;
  volume_kg: string;
  session_id: string | null;
};

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
  return day;
}

async function startJoint(uid: string, day: string) {
  await asUser(db, uid);
  const r = await db.query<{ r_joint: string; r_session: string }>("select * from public.start_joint_session($1)", [day]);
  return { joint: r.rows[0]!.r_joint, session: r.rows[0]!.r_session };
}

async function joinJoint(uid: string, joint: string, day: string) {
  await asUser(db, uid);
  const r = await db.query<{ r_joint: string; r_session: string }>("select * from public.join_joint_session($1, $2)", [joint, day]);
  return r.rows[0]!.r_session;
}

async function jointsSeenBy(uid: string): Promise<Joint[]> {
  await asUser(db, uid);
  return (await db.query<Joint>("select id, status, created_by from public.joint_sessions order by created_at")).rows;
}

async function partsSeenBy(uid: string, joint: string): Promise<Part[]> {
  await asUser(db, uid);
  return (
    await db.query<Part>(
      `select user_id, status, sets_done, sets_total, exercises_done, exercises_total, current_exercise, volume_kg, session_id
         from public.joint_participants where joint_id = $1 order by joined_at, user_id`,
      [joint],
    )
  ).rows;
}

async function statusOf(joint: string) {
  await asSuperuser(db);
  return (await db.query<{ status: string }>("select status from public.joint_sessions where id = $1", [joint])).rows[0]!.status;
}

async function setIds(uid: string, session: string) {
  await asUser(db, uid);
  return (
    await db.query<{ id: string }>(
      `select st.id from public.workout_sets st
         join public.workout_session_exercises se on se.id = st.session_exercise_id
        where se.session_id = $1 order by se.position, st.set_number`,
      [session],
    )
  ).rows.map((r) => r.id);
}

async function complete(uid: string, setId: string, reps: number, load: number) {
  await asUser(db, uid);
  await db.query("update public.workout_sets set reps = $2, load_kg = $3, completed = true where id = $1", [setId, reps, load]);
}

async function dropSession(uid: string, session: string) {
  await asUser(db, uid);
  await db.query("delete from public.workout_sessions where id = $1", [session]);
}

/** Deixa todos sem treino em andamento e sem encontro aberto, para o próximo teste. */
async function reset() {
  await asSuperuser(db);
  await db.exec("delete from public.workout_sessions; delete from public.joint_sessions;");
}

beforeAll(async () => {
  db = await createTestDb();
  ana = await createUser(db, "Ana");
  bia = await createUser(db, "Bia");
  carlos = await createUser(db, "Carlos");
  dana = await createUser(db, "Dana");
  eva = await createUser(db, "Eva");
  fabio = await createUser(db, "Fabio");

  async function pair(admin: string, partner: string, name: string) {
    await asUser(db, admin);
    const c = (await db.query<{ c: string }>("select public.create_couple($1) as c", [name])).rows[0]!.c;
    const code = (await db.query<{ code: string }>("select * from public.create_invitation($1)", [c])).rows[0]!.code;
    await asUser(db, partner);
    await db.query("select public.accept_invitation($1)", [code]);
  }
  await pair(ana, bia, "C1");
  await pair(dana, eva, "C2");
  await asUser(db, fabio);
  await db.query("select public.create_couple('Solo')");

  await asSuperuser(db);
  supino = (await db.query<{ id: string }>("select id from public.exercises where name = 'Supino reto com barra'")).rows[0]!.id;
  agacho = (await db.query<{ id: string }>("select id from public.exercises where name = 'Agachamento livre'")).rows[0]!.id;

  dayAna = await createPlanWithDay(ana, "Plano Ana", [
    [supino, 3, "8-12", 40],
    [agacho, 2, "10", 60],
  ]);
  dayBia = await createPlanWithDay(bia, "Plano Bia", [[supino, 3, "10-12", 20]]);
  dayDana = await createPlanWithDay(dana, "Plano Dana", [[supino, 2, "10", 30]]);
  dayEva = await createPlanWithDay(eva, "Plano Eva", [[supino, 2, "10", 15]]);
  dayFabio = await createPlanWithDay(fabio, "Plano Fabio", [[supino, 2, "10", 30]]);
});

afterAll(async () => {
  await db.close();
});

describe("quem pode chamar para treinar junto", () => {
  it("sem casal não dá", async () => {
    const dayCarlos = await createPlanWithDay(carlos, "Plano Carlos", [[supino, 2, "10", 20]]);
    await asUser(db, carlos);
    expect(await errorOf(() => db.query("select * from public.start_joint_session($1)", [dayCarlos]))).toMatch(/no_couple/);
  });

  it("casal com uma pessoa só não dá (sem parceiro(a) para treinar junto)", async () => {
    await asUser(db, fabio);
    expect(await errorOf(() => db.query("select * from public.start_joint_session($1)", [dayFabio]))).toMatch(/no_partner/);
    // E nada ficou pela metade: nenhuma sessão criada.
    expect((await db.query("select 1 from public.workout_sessions")).rows).toHaveLength(0);
  });

  it("não aceita dia de plano que a pessoa não pode ver", async () => {
    await asUser(db, ana);
    expect(await errorOf(() => db.query("select * from public.start_joint_session($1)", [dayDana]))).toMatch(/forbidden/);
    expect((await jointsSeenBy(ana)).length).toBe(0);
  });

  it("anônimo não executa as funções", async () => {
    await asAnon(db);
    expect(await errorOf(() => db.query("select * from public.start_joint_session($1)", [dayAna]))).toMatch(/permission denied/);
    expect(await errorOf(() => db.query("select public.cancel_joint_session(gen_random_uuid())"))).toMatch(/permission denied/);
  });
});

describe("criar o encontro e entrar", () => {
  let joint: string;
  let sAna: string;
  let sBia: string;

  it("quem chama já começa o próprio treino e o encontro fica aguardando", async () => {
    const r = await startJoint(ana, dayAna);
    joint = r.joint;
    sAna = r.session;
    expect(await statusOf(joint)).toBe("waiting");
    const parts = await partsSeenBy(ana, joint);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ user_id: ana, status: "training", sets_done: 0, sets_total: 5, exercises_total: 2, current_exercise: "Supino reto com barra" });
  });

  it("o parceiro vê o convite; estranhos e outro casal não veem nada", async () => {
    expect((await jointsSeenBy(bia)).map((j) => j.id)).toEqual([joint]);
    expect((await jointsSeenBy(carlos)).length).toBe(0);
    expect((await jointsSeenBy(dana)).length).toBe(0);
    expect((await jointsSeenBy(eva)).length).toBe(0);
    expect((await partsSeenBy(carlos, joint)).length).toBe(0);
    expect((await partsSeenBy(dana, joint)).length).toBe(0);
    await asAnon(db);
    expect(await errorOf(() => db.query("select * from public.joint_sessions"))).toMatch(/permission denied/);
  });

  it("só um encontro aberto por casal", async () => {
    await asUser(db, bia);
    expect(await errorOf(() => db.query("select * from public.start_joint_session($1)", [dayBia]))).toMatch(/joint_open_exists/);
    await asUser(db, ana);
    expect(await errorOf(() => db.query("select * from public.start_joint_session($1)", [dayAna]))).toMatch(/joint_open_exists|session_in_progress/);
  });

  it("não dá para entrar no próprio convite nem em convite de outro casal", async () => {
    await asUser(db, ana);
    expect(await errorOf(() => db.query("select * from public.join_joint_session($1, $2)", [joint, dayAna]))).toMatch(/cannot_join_own|session_in_progress/);
    await asUser(db, dana);
    expect(await errorOf(() => db.query("select * from public.join_joint_session($1, $2)", [joint, dayDana]))).toMatch(/forbidden/);
    await asUser(db, carlos);
    expect(await errorOf(() => db.query("select * from public.join_joint_session($1, $2)", [joint, dayAna]))).toMatch(/forbidden/);
    expect(await statusOf(joint)).toBe("waiting");
  });

  it("a parceira entra escolhendo o próprio treino; a sessão dela é dela", async () => {
    sBia = await joinJoint(bia, joint, dayBia);
    expect(await statusOf(joint)).toBe("active");
    await asUser(db, bia);
    const s = await db.query<{ user_id: string; plan_name: string }>("select user_id, plan_name from public.workout_sessions where id = $1", [sBia]);
    expect(s.rows[0]).toMatchObject({ user_id: bia, plan_name: "Plano Bia" });
    const parts = await partsSeenBy(bia, joint);
    expect(parts.map((p) => p.user_id).sort()).toEqual([ana, bia].sort());
  });

  it("não dá para entrar duas vezes nem depois de ativo", async () => {
    await asUser(db, bia);
    expect(await errorOf(() => db.query("select * from public.join_joint_session($1, $2)", [joint, dayBia]))).toMatch(/joint_not_waiting/);
  });

  it("o progresso de um aparece para o outro, mas só como resumo", async () => {
    const [s1] = await setIds(ana, sAna);
    await complete(ana, s1!, 10, 40);

    const seenByBia = (await partsSeenBy(bia, joint)).find((p) => p.user_id === ana)!;
    expect(seenByBia).toMatchObject({ sets_done: 1, sets_total: 5, exercises_done: 0, current_exercise: "Supino reto com barra" });
    expect(Number(seenByBia.volume_kg)).toBe(400);

    // Desmarcar atualiza também.
    await asUser(db, ana);
    await db.query("update public.workout_sets set completed = false where id = $1", [s1]);
    expect((await partsSeenBy(bia, joint)).find((p) => p.user_id === ana)!.sets_done).toBe(0);
    await complete(ana, s1!, 10, 40);
  });

  it("concluir todas as séries de um exercício avança o 'exercício atual'", async () => {
    const ids = await setIds(ana, sAna);
    await complete(ana, ids[1]!, 10, 40);
    await complete(ana, ids[2]!, 8, 40);
    const p = (await partsSeenBy(bia, joint)).find((x) => x.user_id === ana)!;
    expect(p).toMatchObject({ sets_done: 3, exercises_done: 1, current_exercise: "Agachamento livre" });
  });

  it("pular exercício tira ele do total", async () => {
    await asUser(db, ana);
    await db.query(
      "update public.workout_session_exercises set status = 'skipped' where session_id = $1 and exercise_name = 'Agachamento livre'",
      [sAna],
    );
    const p = (await partsSeenBy(bia, joint)).find((x) => x.user_id === ana)!;
    expect(p).toMatchObject({ sets_total: 3, exercises_total: 1, exercises_done: 1, current_exercise: null });
  });

  it("os dados completos do treino continuam PRIVADOS (sessões, exercícios e séries do parceiro)", async () => {
    await asUser(db, bia);
    expect((await db.query("select 1 from public.workout_sessions where id = $1", [sAna])).rows).toHaveLength(0);
    expect((await db.query("select 1 from public.workout_session_exercises where session_id = $1", [sAna])).rows).toHaveLength(0);
    const sets = await db.query(
      `select 1 from public.workout_sets st join public.workout_session_exercises se on se.id = st.session_exercise_id where se.session_id = $1`,
      [sAna],
    );
    expect(sets.rows).toHaveLength(0);
  });

  it("o parceiro não consegue alterar as séries nem o treino do outro", async () => {
    const [s1] = await setIds(ana, sAna);
    await asUser(db, bia);
    const upd = await db.query("update public.workout_sets set reps = 999, load_kg = 999 where id = $1 returning id", [s1]);
    expect(upd.rows).toHaveLength(0);
    expect(await errorOf(() => db.query("delete from public.workout_sessions where id = $1", [sAna]))).toBeNull();
    await asSuperuser(db);
    expect((await db.query("select 1 from public.workout_sessions where id = $1", [sAna])).rows).toHaveLength(1);
    await asUser(db, bia);
    expect(await errorOf(() => db.query("select public.finish_workout_session($1, null)", [sAna]))).toMatch(/forbidden/);
  });

  it("o cliente não escreve nas tabelas do encontro (nem forja progresso)", async () => {
    await asUser(db, bia);
    expect(await errorOf(() => db.query("update public.joint_participants set sets_done = 99, sets_total = 99 where joint_id = $1", [joint]))).toMatch(/permission denied/);
    expect(await errorOf(() => db.query("update public.joint_sessions set status = 'completed' where id = $1", [joint]))).toMatch(/permission denied/);
    expect(await errorOf(() => db.query("delete from public.joint_sessions where id = $1", [joint]))).toMatch(/permission denied/);
    expect(
      await errorOf(() => db.query("insert into public.joint_sessions (couple_id, created_by) select couple_id, $1 from public.couple_members where user_id = $1", [bia])),
    ).toMatch(/permission denied/);
    expect(
      await errorOf(() => db.query("insert into public.joint_participants (joint_id, user_id, day_name) values ($1, $2, 'x')", [joint, bia])),
    ).toMatch(/permission denied/);
  });

  it("funções internas não são chamáveis pelo cliente", async () => {
    await asUser(db, bia);
    expect(await errorOf(() => db.query("select public.create_session_from_day($1, $2)", [bia, dayBia]))).toMatch(/permission denied/);
    expect(await errorOf(() => db.query("select public.refresh_joint_progress($1)", [sAna]))).toMatch(/permission denied/);
    expect(await errorOf(() => db.query("select public.settle_joint($1)", [joint]))).toMatch(/permission denied/);
  });

  it("não dá para sair do encontro de outra pessoa", async () => {
    await asUser(db, carlos);
    expect(await errorOf(() => db.query("select public.leave_joint_session($1)", [joint]))).toMatch(/forbidden/);
    await asUser(db, dana);
    expect(await errorOf(() => db.query("select public.leave_joint_session($1)", [joint]))).toMatch(/forbidden/);
    expect(await statusOf(joint)).toBe("active");
  });

  it("quem sai continua treinando sozinho; o encontro segue enquanto o outro treina", async () => {
    await asUser(db, bia);
    await db.query("select public.leave_joint_session($1)", [joint]);
    const parts = await partsSeenBy(ana, joint);
    expect(parts.find((p) => p.user_id === bia)!.status).toBe("left");
    expect(await statusOf(joint)).toBe("active");
    await asUser(db, bia);
    expect((await db.query("select status from public.workout_sessions where id = $1", [sBia])).rows[0]).toMatchObject({ status: "in_progress" });
  });

  it("quando o último que treina finaliza, o encontro é concluído com o resumo guardado", async () => {
    await asUser(db, ana);
    await db.query("select public.finish_workout_session($1, null)", [sAna]);
    expect(await statusOf(joint)).toBe("completed");
    const p = (await partsSeenBy(bia, joint)).find((x) => x.user_id === ana)!;
    expect(p).toMatchObject({ status: "finished", sets_done: 3, current_exercise: null });
    expect(Number(p.volume_kg)).toBe(10 * 40 + 10 * 40 + 8 * 40);
  });

  it("encontro concluído não é mais atualizado, e o casal pode iniciar outro", async () => {
    const [s1] = await setIds(bia, sBia);
    await complete(bia, s1!, 12, 20); // Bia segue treinando sozinha
    const bPart = (await partsSeenBy(ana, joint)).find((x) => x.user_id === bia)!;
    expect(bPart.sets_done).toBe(0); // quem saiu não aparece mais atualizando
    await reset();
    const r = await startJoint(bia, dayBia);
    expect(await statusOf(r.joint)).toBe("waiting");
  });
});

describe("desistir, recusar e descartar", () => {
  it("o parceiro pode recusar um convite em espera; o treino de quem chamou continua", async () => {
    await reset();
    const { joint, session } = await startJoint(ana, dayAna);
    await asUser(db, bia);
    await db.query("select public.cancel_joint_session($1)", [joint]);
    expect(await statusOf(joint)).toBe("cancelled");
    await asUser(db, ana);
    expect((await db.query("select status from public.workout_sessions where id = $1", [session])).rows[0]).toMatchObject({ status: "in_progress" });
    expect((await partsSeenBy(ana, joint))[0]!.status).toBe("left");
  });

  it("não dá para entrar num convite cancelado", async () => {
    await asSuperuser(db);
    const j = (await db.query<{ id: string }>("select id from public.joint_sessions where status = 'cancelled' limit 1")).rows[0]!.id;
    await asUser(db, bia);
    expect(await errorOf(() => db.query("select * from public.join_joint_session($1, $2)", [j, dayBia]))).toMatch(/joint_not_waiting/);
  });

  it("estranho e outro casal não cancelam convite alheio; ninguém cancela encontro já ativo", async () => {
    await reset();
    const { joint } = await startJoint(ana, dayAna);
    await asUser(db, carlos);
    expect(await errorOf(() => db.query("select public.cancel_joint_session($1)", [joint]))).toMatch(/forbidden/);
    await asUser(db, dana);
    expect(await errorOf(() => db.query("select public.cancel_joint_session($1)", [joint]))).toMatch(/forbidden/);
    await joinJoint(bia, joint, dayBia);
    await asUser(db, ana);
    expect(await errorOf(() => db.query("select public.cancel_joint_session($1)", [joint]))).toMatch(/joint_not_waiting/);
  });

  it("descartar o próprio treino em andamento tira a pessoa do encontro", async () => {
    await reset();
    const { joint, session } = await startJoint(ana, dayAna);
    const sBia = await joinJoint(bia, joint, dayBia);
    await dropSession(bia, sBia);
    expect((await partsSeenBy(ana, joint)).find((p) => p.user_id === bia)!.status).toBe("left");
    expect(await statusOf(joint)).toBe("active");
    await dropSession(ana, session);
    expect(await statusOf(joint)).toBe("cancelled"); // ninguém terminou
  });

  it("quem chama e descarta antes de a outra pessoa entrar cancela o convite", async () => {
    await reset();
    const { joint, session } = await startJoint(ana, dayAna);
    await dropSession(ana, session);
    expect(await statusOf(joint)).toBe("cancelled");
  });

  it("os dois finalizando: concluído com os dois resumos visíveis ao casal", async () => {
    await reset();
    const { joint, session } = await startJoint(ana, dayAna);
    const sBia = await joinJoint(bia, joint, dayBia);
    await complete(ana, (await setIds(ana, session))[0]!, 10, 50);
    await complete(bia, (await setIds(bia, sBia))[0]!, 12, 20);
    await asUser(db, bia);
    await db.query("select public.finish_workout_session($1, null)", [sBia]);
    expect(await statusOf(joint)).toBe("active"); // Ana ainda treina
    await asUser(db, ana);
    await db.query("select public.finish_workout_session($1, null)", [session]);
    expect(await statusOf(joint)).toBe("completed");
    const parts = await partsSeenBy(bia, joint);
    expect(parts.map((p) => p.status)).toEqual(["finished", "finished"]);
    expect(parts.map((p) => Number(p.volume_kg)).sort((a, b) => a - b)).toEqual([240, 500]);
  });

  it("excluir do histórico um treino finalizado não apaga o resumo do encontro", async () => {
    await asSuperuser(db);
    const { rows } = await db.query<{ id: string; session_id: string }>(
      `select j.id, p.session_id from public.joint_sessions j join public.joint_participants p on p.joint_id = j.id
        where j.status = 'completed' and p.user_id = $1`,
      [ana],
    );
    await dropSession(ana, rows[0]!.session_id);
    const parts = await partsSeenBy(bia, rows[0]!.id);
    expect(parts).toHaveLength(2);
    expect(parts.every((p) => p.status === "finished")).toBe(true);
    expect(parts.find((p) => p.user_id === ana)!.session_id).toBeNull();
  });
});

describe("casais isolados e saída do casal", () => {
  it("encontros de casais diferentes coexistem e não se enxergam", async () => {
    await reset();
    const a = await startJoint(ana, dayAna);
    const d = await startJoint(dana, dayDana);
    expect((await jointsSeenBy(ana)).map((j) => j.id)).toEqual([a.joint]);
    expect((await jointsSeenBy(bia)).map((j) => j.id)).toEqual([a.joint]);
    expect((await jointsSeenBy(dana)).map((j) => j.id)).toEqual([d.joint]);
    expect((await jointsSeenBy(eva)).map((j) => j.id)).toEqual([d.joint]);
    expect((await partsSeenBy(eva, a.joint)).length).toBe(0);
    await asUser(db, eva);
    expect(await errorOf(() => db.query("select * from public.join_joint_session($1, $2)", [a.joint, dayEva]))).toMatch(/forbidden/);
    await joinJoint(eva, d.joint, dayEva);
    expect(await statusOf(d.joint)).toBe("active");
    expect(await statusOf(a.joint)).toBe("waiting");
  });

  it("sair do casal encerra o encontro aberto, sem derrubar o treino individual", async () => {
    // Estado do teste anterior: Dana e Eva em encontro ativo.
    await asSuperuser(db);
    const j = (await db.query<{ id: string }>("select j.id from public.joint_sessions j join public.couple_members m on m.couple_id = j.couple_id where m.user_id = $1 and j.status = 'active'", [eva])).rows[0]!.id;
    await asUser(db, eva);
    await db.query("select public.leave_couple()");
    expect(await statusOf(j)).toBe("cancelled");
    await asUser(db, dana);
    expect((await db.query("select status from public.workout_sessions where user_id = $1", [dana])).rows[0]).toMatchObject({ status: "in_progress" });
    // Quem saiu não enxerga mais nada do antigo casal.
    expect((await jointsSeenBy(eva)).length).toBe(0);
  });
});

describe("hardening de funções", () => {
  it("nenhuma função do schema public é executável pelo role anon", async () => {
    await asSuperuser(db);
    const r = await db.query<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')`,
    );
    expect(r.rows.map((x) => x.proname)).toEqual([]);
  });

  it("anônimo não acessa nenhuma tabela do treino conjunto", async () => {
    await asAnon(db);
    expect(await errorOf(() => db.query("select 1 from public.joint_participants"))).toMatch(/permission denied/);
  });
});
