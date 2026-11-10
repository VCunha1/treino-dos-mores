import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Banco de teste: Postgres real (PGlite) + stubs mínimos do que o Supabase fornece
 * (schema auth, auth.uid(), roles anon/authenticated, storage). As migrations do
 * repositório são aplicadas SEM alterações, então as políticas testadas são as de produção.
 */
const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public to anon, authenticated;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;

  create schema storage;
  create table storage.buckets (
    id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (bucket_id text, name text);
  create function storage.foldername(name text) returns text[]
    language sql immutable as $$ select string_to_array(name, '/') $$;
`;

export async function createTestDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);

  const dir = path.resolve(__dirname, "../../supabase/migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    await db.exec(readFileSync(path.join(dir, f), "utf8"));
  }
  return db;
}

export type Db = Awaited<ReturnType<typeof createTestDb>>;

/** Cria um usuário (o trigger gera perfil e preferências). Executa como superusuário. */
export async function createUser(db: Db, name: string): Promise<string> {
  await db.exec("reset role");
  const res = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data)
     values ($1, jsonb_build_object('display_name', $2::text)) returning id`,
    [`${name.toLowerCase()}@teste.local`, name],
  );
  return res.rows[0]!.id;
}

/** Passa a executar como o usuário autenticado `uid` (RLS ativa). */
export async function asUser(db: Db, uid: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
  await db.exec("set role authenticated");
}

export async function asAnon(db: Db) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await db.exec("set role anon");
}

export async function asSuperuser(db: Db) {
  await db.exec("reset role");
}

/** Retorna a mensagem de erro de uma query que deve falhar, ou null se ela passou. */
export async function errorOf(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
