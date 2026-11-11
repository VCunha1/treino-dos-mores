import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asSuperuser, asUser, createTestDb, createUser, errorOf, type Db } from "./helpers/db";

let db: Db;
let ana: string; // admin do casal 1
let bia: string; // parceira do casal 1
let carlos: string; // estranho
let dani: string; // admin do casal 2
let edu: string; // parceiro do casal 2
let supino: string; // exercício do sistema
let agacho: string;
let planAna: string;
let planBia: string;
let planCarlos: string;

async function newPlan(uid: string, owner: string, name: string, days = ["Treino A", "Treino B"]) {
  await asUser(db, uid);
  const r = await db.query<{ create_workout_plan: string }>(
    "select public.create_workout_plan($1, $2, 'abc', null, $3::text[])",
    [owner, name, days],
  );
  return r.rows[0]!.create_workout_plan;
}

async function firstDay(uid: string, plan: string) {
  await asUser(db, uid);
  const r = await db.query<{ id: string }>(
    "select id from public.workout_plan_days where plan_id = $1 order by position limit 1",
    [plan],
  );
  return r.rows[0]?.id;
}

async function addExercise(uid: string, day: string, exercise: string) {
  await asUser(db, uid);
  const r = await db.query<{ id: string }>(
    "insert into public.workout_plan_exercises (day_id, exercise_id, position) values ($1, $2, 1) returning id",
    [day, exercise],
  );
  return r.rows[0]!.id;
}

beforeAll(async () => {
  db = await createTestDb();
  ana = await createUser(db, "Ana");
  bia = await createUser(db, "Bia");
  carlos = await createUser(db, "Carlos");
  dani = await createUser(db, "Dani");
  edu = await createUser(db, "Edu");

  // Casal 1: Ana (admin) + Bia
  await asUser(db, ana);
  const c1 = (await db.query<{ create_couple: string }>("select public.create_couple('C1')")).rows[0]!.create_couple;
  const inv1 = (await db.query<{ code: string }>("select * from public.create_invitation($1)", [c1])).rows[0]!.code;
  await asUser(db, bia);
  await db.query("select public.accept_invitation($1)", [inv1]);

  // Casal 2: Dani (admin) + Edu
  await asUser(db, dani);
  const c2 = (await db.query<{ create_couple: string }>("select public.create_couple('C2')")).rows[0]!.create_couple;
  const inv2 = (await db.query<{ code: string }>("select * from public.create_invitation($1)", [c2])).rows[0]!.code;
  await asUser(db, edu);
  await db.query("select public.accept_invitation($1)", [inv2]);

  await asSuperuser(db);
  supino = (await db.query<{ id: string }>("select id from public.exercises where name = 'Supino reto com barra'")).rows[0]!.id;
  agacho = (await db.query<{ id: string }>("select id from public.exercises where name = 'Agachamento livre'")).rows[0]!.id;
});

afterAll(async () => {
  await db.close();
});

describe("biblioteca de exercícios", () => {
  it("vem com exercícios do sistema para todas as categorias musculares", async () => {
    await asUser(db, carlos);
    const r = await db.query<{ primary_muscle: string }>(
      "select distinct primary_muscle from public.exercises where owner_id is null",
    );
    expect(r.rows).toHaveLength(12);
  });

  it("qualquer usuário autenticado lê os exercícios do sistema", async () => {
    await asUser(db, carlos);
    const r = await db.query("select * from public.exercises where owner_id is null");
    expect(r.rows.length).toBeGreaterThan(50);
  });

  it("ninguém altera ou apaga exercícios do sistema", async () => {
    await asUser(db, ana);
    const upd = await db.query("update public.exercises set name = 'hackeado' where id = $1 returning id", [supino]);
    expect(upd.rows).toHaveLength(0);
    const del = await db.query("delete from public.exercises where id = $1 returning id", [supino]);
    expect(del.rows).toHaveLength(0);
  });

  it("não é possível criar exercício do sistema (owner_id nulo) nem em nome de outro", async () => {
    await asUser(db, ana);
    expect(
      await errorOf(() => db.query("insert into public.exercises (owner_id, name, primary_muscle) values (null, 'Falso', 'peitoral')")),
    ).toMatch(/row-level security/i);
    expect(
      await errorOf(() => db.query("insert into public.exercises (owner_id, name, primary_muscle) values ($1, 'Falso', 'peitoral')", [bia])),
    ).toMatch(/row-level security/i);
  });

  it("usuário cria exercício personalizado; o parceiro o vê e o estranho não", async () => {
    await asUser(db, ana);
    await db.query("insert into public.exercises (owner_id, name, primary_muscle) values ($1, 'Remada da Ana', 'costas')", [ana]);
    await asUser(db, bia);
    expect((await db.query("select 1 from public.exercises where name = 'Remada da Ana'")).rows).toHaveLength(1);
    await asUser(db, carlos);
    expect((await db.query("select 1 from public.exercises where name = 'Remada da Ana'")).rows).toHaveLength(0);
  });

  it("o parceiro não edita nem apaga o exercício personalizado do outro", async () => {
    await asUser(db, bia);
    const upd = await db.query("update public.exercises set name = 'x' where name = 'Remada da Ana' returning id");
    expect(upd.rows).toHaveLength(0);
    const del = await db.query("delete from public.exercises where name = 'Remada da Ana' returning id");
    expect(del.rows).toHaveLength(0);
  });

  it("grupo muscular inválido é rejeitado", async () => {
    await asUser(db, ana);
    expect(
      await errorOf(() => db.query("insert into public.exercises (owner_id, name, primary_muscle) values ($1, 'Inválido', 'cabeca')", [ana])),
    ).toMatch(/check constraint/i);
  });

  it("link de mídia precisa ser http(s)", async () => {
    await asUser(db, ana);
    expect(
      await errorOf(() =>
        db.query("insert into public.exercises (owner_id, name, primary_muscle, media_url) values ($1, 'Link ruim', 'costas', 'javascript:alert(1)')", [ana]),
      ),
    ).toMatch(/check constraint/i);
  });
});

describe("criação de planos", () => {
  it("usuário cria o próprio plano com os dias informados", async () => {
    planAna = await newPlan(ana, ana, "Plano da Ana", ["A", "B", "C"]);
    await asUser(db, ana);
    const r = await db.query<{ name: string; position: number }>(
      "select name, position from public.workout_plan_days where plan_id = $1 order by position",
      [planAna],
    );
    expect(r.rows).toEqual([
      { name: "A", position: 1 },
      { name: "B", position: 2 },
      { name: "C", position: 3 },
    ]);
  });

  it("ADMIN cria plano para a parceira e ela é a dona", async () => {
    planBia = await newPlan(ana, bia, "Plano da Bia");
    await asUser(db, bia);
    const r = await db.query<{ owner_id: string; created_by: string }>(
      "select owner_id, created_by from public.workout_plans where id = $1",
      [planBia],
    );
    expect(r.rows).toEqual([{ owner_id: bia, created_by: ana }]);
  });

  it("PARCEIRA não cria plano para o admin", async () => {
    expect(await errorOf(() => newPlan(bia, ana, "Invasão"))).toMatch(/forbidden/);
  });

  it("estranho não cria plano para ninguém além de si", async () => {
    expect(await errorOf(() => newPlan(carlos, ana, "x"))).toMatch(/forbidden/);
    expect(await errorOf(() => newPlan(carlos, bia, "x"))).toMatch(/forbidden/);
    planCarlos = await newPlan(carlos, carlos, "Plano do Carlos");
    expect(planCarlos).toBeTruthy();
  });

  it("admin de outro casal não cria plano para a parceira deste casal", async () => {
    expect(await errorOf(() => newPlan(dani, bia, "x"))).toMatch(/forbidden/);
  });

  it("INSERT direto em workout_plans é negado (só via RPC)", async () => {
    await asUser(db, ana);
    expect(
      await errorOf(() => db.query("insert into public.workout_plans (owner_id, created_by, name) values ($1, $1, 'direto')", [ana])),
    ).toMatch(/permission denied/i);
  });

  it("quantidade de dias e divisão inválidas são rejeitadas", async () => {
    expect(await errorOf(() => newPlan(ana, ana, "x", []))).toMatch(/invalid_days|permission|null/i);
    expect(await errorOf(() => newPlan(ana, ana, "x", ["1", "2", "3", "4", "5", "6", "7", "8"]))).toMatch(/invalid_days/);
    await asUser(db, ana);
    expect(
      await errorOf(() => db.query("select public.create_workout_plan($1, 'x', 'invalido', null, array['A'])", [ana])),
    ).toMatch(/invalid_split/);
  });
});

describe("edição: admin gerencia o plano da parceira", () => {
  it("admin adiciona exercício ao plano da parceira", async () => {
    const day = await firstDay(ana, planBia);
    expect(day).toBeTruthy();
    const id = await addExercise(ana, day!, supino);
    expect(id).toBeTruthy();
  });

  it("a parceira (dona) enxerga e edita o que o admin criou", async () => {
    await asUser(db, bia);
    const r = await db.query("update public.workout_plan_exercises set sets = 4, reps = '6-8' returning id");
    expect(r.rows).toHaveLength(1);
  });

  it("admin renomeia, arquiva e reordena dias do plano da parceira", async () => {
    await asUser(db, ana);
    expect((await db.query("update public.workout_plans set name = 'Plano Bia v2' where id = $1 returning id", [planBia])).rows).toHaveLength(1);
    expect((await db.query("update public.workout_plans set is_archived = true where id = $1 returning id", [planBia])).rows).toHaveLength(1);
    expect((await db.query("update public.workout_plans set is_archived = false where id = $1 returning id", [planBia])).rows).toHaveLength(1);
    expect((await db.query("update public.workout_plan_days set position = 9 where plan_id = $1 returning id", [planBia])).rows.length).toBeGreaterThan(0);
  });

  it("owner_id e created_by não podem ser alterados (ninguém toma o plano)", async () => {
    await asUser(db, ana);
    expect(await errorOf(() => db.query("update public.workout_plans set owner_id = $1 where id = $2", [ana, planBia]))).toMatch(/permission denied/i);
    expect(await errorOf(() => db.query("update public.workout_plans set created_by = $1 where id = $2", [bia, planBia]))).toMatch(/permission denied/i);
  });

  it("a parceira NÃO edita o plano do admin, mesmo vendo-o compartilhado", async () => {
    await asUser(db, ana);
    await db.query("update public.workout_plans set is_shared = true where id = $1", [planAna]);
    const dayAna = await firstDay(ana, planAna);
    await addExercise(ana, dayAna!, agacho);

    await asUser(db, bia);
    expect((await db.query("select 1 from public.workout_plans where id = $1", [planAna])).rows).toHaveLength(1);
    expect((await db.query("update public.workout_plans set name = 'x' where id = $1 returning id", [planAna])).rows).toHaveLength(0);
    expect((await db.query("update public.workout_plan_exercises set sets = 20 where day_id = $1 returning id", [dayAna])).rows).toHaveLength(0);
    expect((await db.query("delete from public.workout_plan_exercises where day_id = $1 returning id", [dayAna])).rows).toHaveLength(0);
    expect((await db.query("delete from public.workout_plans where id = $1 returning id", [planAna])).rows).toHaveLength(0);
    expect(
      await errorOf(() => db.query("insert into public.workout_plan_days (plan_id, name) values ($1, 'Z')", [planAna])),
    ).toMatch(/row-level security/i);
    expect(
      await errorOf(() => db.query("insert into public.workout_plan_exercises (day_id, exercise_id) values ($1, $2)", [dayAna, supino])),
    ).toMatch(/row-level security/i);
  });
});

describe("compartilhamento e isolamento", () => {
  it("plano do admin NÃO compartilhado é invisível para a parceira", async () => {
    await asUser(db, ana);
    await db.query("update public.workout_plans set is_shared = false where id = $1", [planAna]);
    await asUser(db, bia);
    expect((await db.query("select 1 from public.workout_plans where id = $1", [planAna])).rows).toHaveLength(0);
    expect((await db.query("select 1 from public.workout_plan_days where plan_id = $1", [planAna])).rows).toHaveLength(0);
  });

  it("o plano da parceira é visível ao admin (ele gerencia)", async () => {
    await asUser(db, ana);
    expect((await db.query("select 1 from public.workout_plans where id = $1", [planBia])).rows).toHaveLength(1);
  });

  it("estranho não vê planos, dias nem exercícios de nenhum casal", async () => {
    await asUser(db, carlos);
    const plans = await db.query<{ id: string }>("select id from public.workout_plans");
    expect(plans.rows.map((r) => r.id)).toEqual([planCarlos]);
    expect((await db.query("select * from public.workout_plan_days where plan_id in ($1, $2)", [planAna, planBia])).rows).toHaveLength(0);
    expect((await db.query("select * from public.workout_plan_exercises")).rows).toHaveLength(0);
  });

  it("outro casal não vê nem edita planos deste casal, mesmo compartilhado", async () => {
    await asUser(db, ana);
    await db.query("update public.workout_plans set is_shared = true where id = $1", [planAna]);
    await asUser(db, dani);
    expect((await db.query("select 1 from public.workout_plans where id in ($1, $2)", [planAna, planBia])).rows).toHaveLength(0);
    expect((await db.query("update public.workout_plans set name = 'x' where id = $1 returning id", [planBia])).rows).toHaveLength(0);
    expect((await db.query("delete from public.workout_plans where id = $1 returning id", [planBia])).rows).toHaveLength(0);
    await asUser(db, edu);
    expect((await db.query("select 1 from public.workout_plans where id = $1", [planAna])).rows).toHaveLength(0);
    await asUser(db, ana);
    await db.query("update public.workout_plans set is_shared = false where id = $1", [planAna]);
  });

  it("estranho não consegue apagar o plano de outra pessoa", async () => {
    await asUser(db, carlos);
    expect((await db.query("delete from public.workout_plans where id in ($1, $2) returning id", [planAna, planBia])).rows).toHaveLength(0);
  });

  it("gerenciar o plano NÃO dá acesso aos dados privados da parceira", async () => {
    await asUser(db, bia);
    await db.query("insert into public.profile_details (user_id, weight_kg, training_goals) values ($1, 60, 'privado')", [bia]);
    await asUser(db, ana); // admin, gerencia os planos da Bia
    expect((await db.query("select * from public.profile_details where user_id = $1", [bia])).rows).toHaveLength(0);
    expect((await db.query("select * from public.user_preferences where user_id = $1", [bia])).rows).toHaveLength(0);
    expect((await db.query("select * from public.notification_preferences where user_id = $1", [bia])).rows).toHaveLength(0);
  });

  it("ao sair do casal, o ex-admin perde o acesso ao plano da ex-parceira", async () => {
    // Cria um casal descartável só para este teste, para não afetar os demais.
    const x = await createUser(db, "Xavier");
    const y = await createUser(db, "Yara");
    await asUser(db, x);
    const c = (await db.query<{ create_couple: string }>("select public.create_couple('tmp')")).rows[0]!.create_couple;
    const code = (await db.query<{ code: string }>("select * from public.create_invitation($1)", [c])).rows[0]!.code;
    await asUser(db, y);
    await db.query("select public.accept_invitation($1)", [code]);
    const p = await newPlan(x, y, "Plano da Yara");
    await asUser(db, x);
    expect((await db.query("select 1 from public.workout_plans where id = $1", [p])).rows).toHaveLength(1);
    await db.query("select public.leave_couple()");
    expect((await db.query("select 1 from public.workout_plans where id = $1", [p])).rows).toHaveLength(0);
    expect((await db.query("update public.workout_plans set name = 'x' where id = $1 returning id", [p])).rows).toHaveLength(0);
  });
});

describe("itens do plano", () => {
  it("só aceita exercícios que o usuário enxerga (exercício personalizado de estranho é recusado)", async () => {
    await asUser(db, carlos);
    const r = await db.query<{ id: string }>(
      "insert into public.exercises (owner_id, name, primary_muscle) values ($1, 'Secreto do Carlos', 'costas') returning id",
      [carlos],
    );
    const secreto = r.rows[0]!.id;
    const day = await firstDay(ana, planAna);
    await asUser(db, ana);
    expect(
      await errorOf(() => db.query("insert into public.workout_plan_exercises (day_id, exercise_id) values ($1, $2)", [day, secreto])),
    ).toMatch(/row-level security/i);
  });

  it("limites de séries, descanso e carga são validados", async () => {
    const day = await firstDay(ana, planAna);
    await asUser(db, ana);
    for (const [col, val] of [
      ["sets", 0],
      ["sets", 99],
      ["rest_seconds", -1],
      ["rest_seconds", 5000],
      ["initial_load_kg", -5],
      ["initial_load_kg", 5000],
    ] as const) {
      const err = await errorOf(() =>
        db.query(`insert into public.workout_plan_exercises (day_id, exercise_id, ${col}) values ($1, $2, $3)`, [day, supino, val]),
      );
      expect(err, `${col}=${val}`).toMatch(/check constraint/i);
    }
  });

  it("exercício em uso por um plano não pode ser apagado da biblioteca", async () => {
    await asUser(db, ana);
    const r = await db.query<{ id: string }>(
      "insert into public.exercises (owner_id, name, primary_muscle) values ($1, 'Em uso', 'costas') returning id",
      [ana],
    );
    const id = r.rows[0]!.id;
    const day = await firstDay(ana, planAna);
    await addExercise(ana, day!, id);
    expect(await errorOf(() => db.query("delete from public.exercises where id = $1", [id]))).toMatch(/foreign key|violates/i);
  });

  it("apagar o plano apaga dias e exercícios em cascata", async () => {
    const p = await newPlan(ana, ana, "Descartável");
    const d = await firstDay(ana, p);
    await addExercise(ana, d!, supino);
    await asUser(db, ana);
    await db.query("delete from public.workout_plans where id = $1", [p]);
    await asSuperuser(db);
    expect((await db.query("select 1 from public.workout_plan_days where plan_id = $1", [p])).rows).toHaveLength(0);
    expect((await db.query("select 1 from public.workout_plan_exercises where day_id = $1", [d])).rows).toHaveLength(0);
  });
});

describe("duplicar plano", () => {
  it("dono duplica o próprio plano, com dias e exercícios", async () => {
    await asUser(db, bia);
    const r = await db.query<{ duplicate_workout_plan: string }>("select public.duplicate_workout_plan($1, 'Cópia da Bia')", [planBia]);
    const copy = r.rows[0]!.duplicate_workout_plan;
    expect(copy).not.toBe(planBia);
    const days = await db.query("select * from public.workout_plan_days where plan_id = $1", [copy]);
    const items = await db.query(
      "select e.* from public.workout_plan_exercises e join public.workout_plan_days d on d.id = e.day_id where d.plan_id = $1",
      [copy],
    );
    expect(days.rows).toHaveLength(2);
    expect(items.rows).toHaveLength(1);
    const own = await db.query<{ owner_id: string }>("select owner_id from public.workout_plans where id = $1", [copy]);
    expect(own.rows[0]?.owner_id).toBe(bia);
  });

  it("admin duplica plano da parceira e a cópia continua sendo da parceira", async () => {
    await asUser(db, ana);
    const r = await db.query<{ duplicate_workout_plan: string }>("select public.duplicate_workout_plan($1)", [planBia]);
    const own = await db.query<{ owner_id: string }>("select owner_id from public.workout_plans where id = $1", [r.rows[0]!.duplicate_workout_plan]);
    expect(own.rows[0]?.owner_id).toBe(bia);
  });

  it("parceira copia o plano COMPARTILHADO do admin e a cópia vira dela (editável)", async () => {
    await asUser(db, ana);
    await db.query("update public.workout_plans set is_shared = true where id = $1", [planAna]);
    await asUser(db, bia);
    const r = await db.query<{ duplicate_workout_plan: string }>("select public.duplicate_workout_plan($1)", [planAna]);
    const copy = r.rows[0]!.duplicate_workout_plan;
    const own = await db.query<{ owner_id: string }>("select owner_id from public.workout_plans where id = $1", [copy]);
    expect(own.rows[0]?.owner_id).toBe(bia);
    expect((await db.query("update public.workout_plans set name = 'minha' where id = $1 returning id", [copy])).rows).toHaveLength(1);
    await asUser(db, ana);
    await db.query("update public.workout_plans set is_shared = false where id = $1", [planAna]);
  });

  it("não é possível duplicar plano que não se pode ver", async () => {
    await asUser(db, bia);
    expect(await errorOf(() => db.query("select public.duplicate_workout_plan($1)", [planAna]))).toMatch(/forbidden/);
    await asUser(db, carlos);
    expect(await errorOf(() => db.query("select public.duplicate_workout_plan($1)", [planBia]))).toMatch(/forbidden/);
    await asUser(db, dani);
    expect(await errorOf(() => db.query("select public.duplicate_workout_plan($1)", [planBia]))).toMatch(/forbidden/);
  });
});
