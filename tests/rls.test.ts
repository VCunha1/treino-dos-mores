import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asSuperuser, asUser, createTestDb, createUser, errorOf, type Db } from "./helpers/db";

let db: Db;
let ana: string; // admin do casal 1
let bia: string; // parceira do casal 1
let carlos: string; // estranho (sem casal)
let dani: string; // admin do casal 2
let edu: string; // parceiro do casal 2
let couple1: string;
let couple2: string;
let code1: string;

async function createCoupleFor(uid: string, name: string) {
  await asUser(db, uid);
  const r = await db.query<{ create_couple: string }>("select public.create_couple($1)", [name]);
  return r.rows[0]!.create_couple;
}

async function invite(uid: string, coupleId: string) {
  await asUser(db, uid);
  const r = await db.query<{ code: string }>("select * from public.create_invitation($1)", [coupleId]);
  return r.rows[0]!.code;
}

beforeAll(async () => {
  db = await createTestDb();
  ana = await createUser(db, "Ana");
  bia = await createUser(db, "Bia");
  carlos = await createUser(db, "Carlos");
  dani = await createUser(db, "Dani");
  edu = await createUser(db, "Edu");
});

afterAll(async () => {
  await db.close();
});

describe("cadastro e perfil", () => {
  it("cria perfil e preferências automaticamente ao criar o usuário", async () => {
    await asSuperuser(db);
    const p = await db.query("select display_name, onboarding_completed from public.profiles where id = $1", [ana]);
    expect(p.rows).toEqual([{ display_name: "Ana", onboarding_completed: false }]);
    const prefs = await db.query("select 1 from public.user_preferences where user_id = $1", [ana]);
    const notif = await db.query("select 1 from public.notification_preferences where user_id = $1", [ana]);
    expect(prefs.rows).toHaveLength(1);
    expect(notif.rows).toHaveLength(1);
  });

  it("usuário edita o próprio perfil", async () => {
    await asUser(db, ana);
    const r = await db.query("update public.profiles set display_name = 'Ana Souza', onboarding_completed = true where id = $1 returning id", [ana]);
    expect(r.rows).toHaveLength(1);
  });

  it("usuário não edita o perfil de outra pessoa", async () => {
    await asUser(db, carlos);
    const r = await db.query("update public.profiles set display_name = 'hackeado' where id = $1 returning id", [ana]);
    expect(r.rows).toHaveLength(0);
    await asSuperuser(db);
    const p = await db.query<{ display_name: string }>("select display_name from public.profiles where id = $1", [ana]);
    expect(p.rows[0]?.display_name).toBe("Ana Souza");
  });

  it("não é possível trocar o id do perfil (coluna não atualizável)", async () => {
    await asUser(db, carlos);
    const err = await errorOf(() => db.query("update public.profiles set id = $1 where id = $2", [ana, carlos]));
    expect(err).toMatch(/permission denied/i);
  });

  it("anônimo não lê nem escreve nada", async () => {
    await asAnon(db);
    expect(await errorOf(() => db.query("select * from public.profiles"))).toMatch(/permission denied/i);
    expect(await errorOf(() => db.query("select * from public.couples"))).toMatch(/permission denied/i);
    expect(await errorOf(() => db.query("select public.create_couple('x')"))).toMatch(/permission denied/i);
  });
});

describe("informações físicas privadas (profile_details)", () => {
  it("o dono salva e lê os próprios detalhes", async () => {
    await asUser(db, ana);
    await db.query(
      "insert into public.profile_details (user_id, height_cm, weight_kg, training_goals) values ($1, 170, 65, 'força')",
      [ana],
    );
    const r = await db.query("select height_cm from public.profile_details where user_id = $1", [ana]);
    expect(r.rows).toHaveLength(1);
  });

  it("não é possível criar detalhes em nome de outro usuário", async () => {
    await asUser(db, carlos);
    const err = await errorOf(() =>
      db.query("insert into public.profile_details (user_id, height_cm) values ($1, 180)", [bia]),
    );
    expect(err).toMatch(/row-level security/i);
  });

  it("valores fisicamente impossíveis são rejeitados por constraint", async () => {
    await asUser(db, bia);
    const err = await errorOf(() =>
      db.query("insert into public.profile_details (user_id, height_cm) values ($1, 999)", [bia]),
    );
    expect(err).toMatch(/check constraint/i);
  });

  it("estranho não enxerga nem altera detalhes de outra pessoa", async () => {
    await asUser(db, carlos);
    const sel = await db.query("select * from public.profile_details where user_id = $1", [ana]);
    expect(sel.rows).toHaveLength(0);
    const upd = await db.query("update public.profile_details set weight_kg = 1 where user_id = $1 returning user_id", [ana]);
    expect(upd.rows).toHaveLength(0);
    const del = await db.query("delete from public.profile_details where user_id = $1 returning user_id", [ana]);
    expect(del.rows).toHaveLength(0);
  });
});

describe("casal e convite", () => {
  it("cria o casal e o criador vira admin", async () => {
    couple1 = await createCoupleFor(ana, "Casal Ana");
    await asUser(db, ana);
    const m = await db.query("select role from public.couple_members where couple_id = $1 and user_id = $2", [couple1, ana]);
    expect(m.rows).toEqual([{ role: "admin" }]);
  });

  it("não permite criar um segundo casal", async () => {
    await asUser(db, ana);
    const err = await errorOf(() => db.query("select public.create_couple('outro')"));
    expect(err).toMatch(/already_in_couple/);
  });

  it("INSERT/DELETE direto em couples, couple_members e couple_invitations é negado", async () => {
    await asUser(db, carlos);
    expect(await errorOf(() => db.query("insert into public.couples (name, created_by) values ('x', $1)", [carlos]))).toMatch(/permission denied/i);
    expect(
      await errorOf(() =>
        db.query("insert into public.couple_members (couple_id, user_id, role) values ($1, $2, 'partner')", [couple1, carlos]),
      ),
    ).toMatch(/permission denied/i);
    expect(
      await errorOf(() =>
        db.query(
          "insert into public.couple_invitations (couple_id, invited_by, code, expires_at) values ($1, $2, 'AAAAAAAAAA', now() + interval '1 day')",
          [couple1, carlos],
        ),
      ),
    ).toMatch(/permission denied/i);
    await asUser(db, ana);
    expect(await errorOf(() => db.query("delete from public.couple_members where user_id = $1", [ana]))).toMatch(/permission denied/i);
  });

  it("estranho não consegue gerar convite para o casal de outra pessoa", async () => {
    await asUser(db, carlos);
    const err = await errorOf(() => db.query("select * from public.create_invitation($1)", [couple1]));
    expect(err).toMatch(/forbidden/);
  });

  it("admin gera convite com código de 10 caracteres que não expira", async () => {
    code1 = await invite(ana, couple1);
    expect(code1).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    await asUser(db, ana);
    const r = await db.query<{ expires_at: string | null }>(
      "select expires_at from public.couple_invitations where code = $1",
      [code1],
    );
    expect(r.rows[0]?.expires_at).toBeNull();
  });

  it("convite sem validade segue pendente mesmo muito tempo depois", async () => {
    await asSuperuser(db);
    await db.query("update public.couple_invitations set created_at = now() - interval '2 years' where code = $1", [code1]);
    const r = await db.query("select 1 from public.couple_invitations where code = $1 and status = 'pending' and expires_at is null", [code1]);
    expect(r.rows).toHaveLength(1);
  });

  it("gerar novo convite revoga o anterior", async () => {
    const old = code1;
    code1 = await invite(ana, couple1);
    expect(code1).not.toBe(old);
    await asUser(db, bia);
    const err = await errorOf(() => db.query("select public.accept_invitation($1)", [old]));
    expect(err).toMatch(/invalid_invitation/);
  });

  it("estranho não enxerga o convite pendente (nem o código)", async () => {
    await asUser(db, carlos);
    const r = await db.query("select * from public.couple_invitations");
    expect(r.rows).toHaveLength(0);
  });

  it("o próprio criador não aceita o próprio convite", async () => {
    // Ana já está em um casal, então a verificação de casal vem primeiro; o resultado é recusa de qualquer forma.
    await asUser(db, ana);
    const err = await errorOf(() => db.query("select public.accept_invitation($1)", [code1]));
    expect(err).toMatch(/already_in_couple|own_invitation/);
  });

  it("código inexistente é recusado", async () => {
    await asUser(db, bia);
    const err = await errorOf(() => db.query("select public.accept_invitation('ZZZZZZZZZZ')"));
    expect(err).toMatch(/invalid_invitation/);
  });

  it("convite legado com data de validade vencida continua sendo recusado", async () => {
    await asSuperuser(db);
    await db.query("update public.couple_invitations set expires_at = now() - interval '1 minute' where code = $1", [code1]);
    await asUser(db, bia);
    const err = await errorOf(() => db.query("select public.accept_invitation($1)", [code1]));
    expect(err).toMatch(/invalid_invitation/);
    // Volta ao estado "sem validade" para os próximos testes.
    await asSuperuser(db);
    await db.query("update public.couple_invitations set expires_at = null where code = $1", [code1]);
  });

  it("convite revogado é recusado", async () => {
    await asUser(db, ana);
    const inv = await db.query<{ id: string }>("select id from public.couple_invitations where code = $1", [code1]);
    await db.query("select public.revoke_invitation($1)", [inv.rows[0]!.id]);
    await asUser(db, bia);
    const err = await errorOf(() => db.query("select public.accept_invitation($1)", [code1]));
    expect(err).toMatch(/invalid_invitation/);
    code1 = await invite(ana, couple1);
  });

  it("a parceira aceita o convite (aceitação explícita) e vira partner", async () => {
    await asUser(db, bia);
    const r = await db.query<{ accept_invitation: string }>("select public.accept_invitation($1)", [code1.toLowerCase()]);
    expect(r.rows[0]?.accept_invitation).toBe(couple1);
    const m = await db.query("select role from public.couple_members where user_id = $1", [bia]);
    expect(m.rows).toEqual([{ role: "partner" }]);
  });

  it("o convite aceito não pode ser reutilizado por um terceiro", async () => {
    await asUser(db, carlos);
    const err = await errorOf(() => db.query("select public.accept_invitation($1)", [code1]));
    expect(err).toMatch(/invalid_invitation/);
  });

  it("casal completo não gera novo convite", async () => {
    await asUser(db, ana);
    const err = await errorOf(() => db.query("select * from public.create_invitation($1)", [couple1]));
    expect(err).toMatch(/couple_full/);
  });

  it("a parceira não administra convites do casal", async () => {
    await asUser(db, bia);
    expect(await errorOf(() => db.query("select * from public.create_invitation($1)", [couple1]))).toMatch(/forbidden/);
    const r = await db.query("select * from public.couple_invitations");
    expect(r.rows).toHaveLength(0);
  });
});

describe("isolamento entre usuários do mesmo casal e entre casais", () => {
  it("parceiros enxergam nome/foto um do outro", async () => {
    await asUser(db, bia);
    const r = await db.query<{ display_name: string }>("select display_name from public.profiles where id = $1", [ana]);
    expect(r.rows).toHaveLength(1);
  });

  it("parceiros NÃO enxergam as informações físicas privadas um do outro", async () => {
    await asUser(db, bia);
    const r = await db.query("select * from public.profile_details where user_id = $1", [ana]);
    expect(r.rows).toHaveLength(0);
  });

  it("parceiros não enxergam preferências um do outro", async () => {
    await asUser(db, bia);
    expect((await db.query("select * from public.user_preferences where user_id = $1", [ana])).rows).toHaveLength(0);
    expect((await db.query("select * from public.notification_preferences where user_id = $1", [ana])).rows).toHaveLength(0);
    const upd = await db.query("update public.user_preferences set sound_enabled = true where user_id = $1 returning user_id", [ana]);
    expect(upd.rows).toHaveLength(0);
  });

  it("parceira não edita o perfil do admin (nem o admin o da parceira)", async () => {
    await asUser(db, bia);
    expect((await db.query("update public.profiles set display_name = 'x' where id = $1 returning id", [ana])).rows).toHaveLength(0);
    await asUser(db, ana);
    expect((await db.query("update public.profiles set display_name = 'x' where id = $1 returning id", [bia])).rows).toHaveLength(0);
  });

  it("estranho não enxerga perfil, casal nem membros do casal 1", async () => {
    await asUser(db, carlos);
    expect((await db.query("select * from public.profiles where id in ($1, $2)", [ana, bia])).rows).toHaveLength(0);
    expect((await db.query("select * from public.couples")).rows).toHaveLength(0);
    expect((await db.query("select * from public.couple_members")).rows).toHaveLength(0);
  });

  it("casais distintos são totalmente isolados", async () => {
    couple2 = await createCoupleFor(dani, "Casal Dani");
    const code2 = await invite(dani, couple2);
    await asUser(db, edu);
    await db.query("select public.accept_invitation($1)", [code2]);

    await asUser(db, ana);
    const mine = await db.query<{ id: string }>("select id from public.couples");
    expect(mine.rows.map((r) => r.id)).toEqual([couple1]);
    expect((await db.query("select * from public.profiles where id in ($1, $2)", [dani, edu])).rows).toHaveLength(0);
    expect((await db.query("select * from public.couple_members where couple_id = $1", [couple2])).rows).toHaveLength(0);

    await asUser(db, dani);
    const theirs = await db.query<{ id: string }>("select id from public.couples");
    expect(theirs.rows.map((r) => r.id)).toEqual([couple2]);
    expect((await db.query("select * from public.profiles where id in ($1, $2)", [ana, bia])).rows).toHaveLength(0);
  });

  it("admin de um casal não administra outro casal", async () => {
    await asUser(db, dani);
    expect(await errorOf(() => db.query("select * from public.create_invitation($1)", [couple1]))).toMatch(/forbidden/);
    const upd = await db.query("update public.couples set name = 'invadido' where id = $1 returning id", [couple1]);
    expect(upd.rows).toHaveLength(0);
  });

  it("somente o admin renomeia o casal; a parceira não", async () => {
    await asUser(db, bia);
    expect((await db.query("update public.couples set name = 'x' where id = $1 returning id", [couple1])).rows).toHaveLength(0);
    await asUser(db, ana);
    expect((await db.query("update public.couples set name = 'Nosso lar' where id = $1 returning id", [couple1])).rows).toHaveLength(1);
  });

  it("as colunas created_by/id de couples não são atualizáveis", async () => {
    await asUser(db, ana);
    const err = await errorOf(() => db.query("update public.couples set created_by = $1 where id = $2", [bia, couple1]));
    expect(err).toMatch(/permission denied/i);
  });
});

describe("sair do casal", () => {
  it("após sair, o vínculo some e os perfis deixam de ser visíveis", async () => {
    await asUser(db, bia);
    await db.query("select public.leave_couple()");
    expect((await db.query("select * from public.couple_members where user_id = $1", [bia])).rows).toHaveLength(0);
    expect((await db.query("select * from public.profiles where id = $1", [ana])).rows).toHaveLength(0);

    await asUser(db, ana);
    expect((await db.query("select * from public.profiles where id = $1", [bia])).rows).toHaveLength(0);
    const roles = await db.query("select role from public.couple_members where couple_id = $1", [couple1]);
    expect(roles.rows).toEqual([{ role: "admin" }]);
  });

  it("quando o último membro sai, o casal é removido", async () => {
    await asUser(db, ana);
    await db.query("select public.leave_couple()");
    await asSuperuser(db);
    expect((await db.query("select * from public.couples where id = $1", [couple1])).rows).toHaveLength(0);
  });

  it("depois de sair, é possível entrar em outro casal", async () => {
    await asUser(db, bia);
    const code = await invite(dani, couple2).catch(() => null);
    // Casal 2 está completo, então o convite não pode ser gerado.
    expect(code).toBeNull();
    const novo = await createCoupleFor(bia, "Novo casal");
    expect(novo).toBeTruthy();
  });
});
