# Permissões e políticas RLS (Fase 1)

Fonte da verdade: `supabase/migrations/20261109000001_foundation.sql`.
Testes que comprovam cada regra: `tests/rls.test.ts` (rodam as migrations reais em um Postgres).

## Princípios

1. **RLS ligada em todas as tabelas.** Além disso, os privilégios de tabela são revogados de `anon` e
   `authenticated` e concedidos de volta apenas onde necessário (defesa em profundidade).
2. **O cliente nunca define o dono de um registro.** O dono é sempre `auth.uid()`; ações de servidor
   leem o usuário da sessão, nunca de um campo do formulário.
3. **Escritas sensíveis só por função `SECURITY DEFINER`** (`create_couple`, `create_invitation`,
   `revoke_invitation`, `accept_invitation`, `leave_couple`). Não existe `INSERT`/`DELETE` direto em
   `couples`, `couple_members` ou `couple_invitations`.
4. **Funções auxiliares** (`is_couple_member`, `is_couple_admin`, `shares_couple_with`) são
   `SECURITY DEFINER` com `search_path` vazio, o que evita recursão de RLS e sequestro de `search_path`.
5. **Estar no mesmo casal não dá acesso a dados privados.** O vínculo só libera nome e foto.

## Matriz de acesso

| Tabela | Próprio usuário | Parceiro(a) do casal | Admin do casal | Outro casal / estranho | Anônimo |
|---|---|---|---|---|---|
| `profiles` (nome, foto) | lê e edita nome/foto/onboarding | **lê** | só o próprio | nada | nada |
| `profile_details` (altura, peso, nascimento, objetivos) | CRUD | **nada** | **nada** | nada | nada |
| `user_preferences`, `notification_preferences` | CRUD | nada | nada | nada | nada |
| `couples` | lê | lê | lê e **renomeia** | nada | nada |
| `couple_members` | lê | lê (mesmo casal) | lê | nada | nada |
| `couple_invitations` | nada | nada | **lê** | nada | nada |
| Storage `avatars` | escreve só em `<uid>/…` | lê (bucket público) | — | lê (bucket público) | — |

Observações:

- Colunas imutáveis pelo cliente: `profiles.id`, `couples.id/created_by`. Só `display_name`,
  `avatar_url` e `onboarding_completed` são atualizáveis em `profiles`; só `name` em `couples`.
- Um usuário pertence a no máximo um casal (`unique (user_id)`) e um casal tem no máximo dois membros.
- Convites: código de 10 caracteres sem ambiguidade (sem 0/O/1/I), **sem validade** (vale até ser aceito ou revogado), um único
  convite pendente por casal (gerar outro revoga o anterior), aceitação explícita pelo convidado,
  uso único, revogável pelo admin. Não é possível aceitar o próprio convite.
- Sair do casal remove o vínculo; quem fica vira admin; se ninguém fica, o casal é apagado.

## Treinos e biblioteca (Fase 2)

Fonte: `supabase/migrations/20261109000003_workout_plans.sql`. Testes: `tests/plans.test.ts`.

| Tabela | Dono do plano | Admin do casal | Parceira (plano do admin) | Estranho / outro casal |
|---|---|---|---|---|
| `workout_plans` | CRUD (menos `owner_id`/`created_by`) | CRUD nos planos **da parceira** | **lê** só se `is_shared = true`; não edita | nada |
| `workout_plan_days` | CRUD | CRUD nos da parceira | lê se o plano é compartilhado | nada |
| `workout_plan_exercises` | CRUD | CRUD nos da parceira | lê se o plano é compartilhado | nada |
| `exercises` (sistema, `owner_id` nulo) | lê | lê | lê | lê |
| `exercises` (personalizados) | CRUD do próprio | lê os do casal | lê os do casal | nada |

Regras:

- `manages_user(owner)` é a regra central: verdadeira para o próprio dono **ou** para o admin do casal em que o dono está.
  A parceira **não** gerencia o plano do admin.
- Criar plano passa por `create_workout_plan` (o banco confere se o chamador pode criar para aquele dono).
  Não há `INSERT` direto em `workout_plans`.
- `owner_id` e `created_by` não são atualizáveis: ninguém "toma" o plano de outra pessoa.
- Duplicar (`duplicate_workout_plan`): quem gerencia o dono mantém o dono; quem só pode ver (plano compartilhado)
  recebe a cópia como dona, podendo editá-la.
- Um item de plano só aceita exercícios que o usuário consegue enxergar.
- Exercícios do sistema só mudam por migration. Exercício em uso por um plano não pode ser apagado (`on delete restrict`).
- **Gerenciar o treino da parceira não concede acesso a `profile_details`, preferências, saúde ou Cycle Sync.**
  Essas tabelas não usam `manages_user()` e seguem privadas (há teste cobrindo isso).

## Decisões de segurança tomadas

- **Aleatoriedade do convite** vem de `gen_random_uuid()` (nativo). Evitei `pgcrypto` porque no
  Supabase ele fica no schema `extensions` e não é alcançável com `search_path` vazio.
- **Bucket `avatars` é público para leitura.** O caminho contém o UUID do usuário e a foto é dado de
  perfil (visível ao casal). Se preferir foto privada, troque para bucket privado + URLs assinadas.
- **Novas tabelas precisam de `GRANT` explícito.** A migration revoga os privilégios padrão; toda
  migration futura deve conceder somente o necessário a `authenticated` junto com as políticas RLS.
- **Plano compartilhado é somente leitura.** O admin sempre enxerga e gerencia os planos da parceira; só o plano do admin precisa ser marcado como compartilhado para a parceira vê-lo.
- **Dados de saúde/Cycle Sync (Fase 8)** não existem ainda. Quando forem criados, devem seguir o mesmo
  padrão de `profile_details`: privados por padrão, com compartilhamento por categoria validado no banco.

## O que ainda não está coberto

- Rate limiting de tentativas de código de convite (recomendado habilitar proteção de brute force do
  Supabase Auth e considerar limitar `accept_invitation` por usuário numa fase posterior).
- Os testes simulam `auth.uid()` e os roles `anon`/`authenticated`; o comportamento de JWT, Storage e
  Auth do Supabase real não é exercitado por eles.
