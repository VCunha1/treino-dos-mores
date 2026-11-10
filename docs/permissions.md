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

## Decisões de segurança tomadas

- **Aleatoriedade do convite** vem de `gen_random_uuid()` (nativo). Evitei `pgcrypto` porque no
  Supabase ele fica no schema `extensions` e não é alcançável com `search_path` vazio.
- **Bucket `avatars` é público para leitura.** O caminho contém o UUID do usuário e a foto é dado de
  perfil (visível ao casal). Se preferir foto privada, troque para bucket privado + URLs assinadas.
- **Novas tabelas precisam de `GRANT` explícito.** A migration revoga os privilégios padrão; toda
  migration futura deve conceder somente o necessário a `authenticated` junto com as políticas RLS.
- **Dados de saúde/Cycle Sync (Fase 8)** não existem ainda. Quando forem criados, devem seguir o mesmo
  padrão de `profile_details`: privados por padrão, com compartilhamento por categoria validado no banco.

## O que ainda não está coberto

- Rate limiting de tentativas de código de convite (recomendado habilitar proteção de brute force do
  Supabase Auth e considerar limitar `accept_invitation` por usuário numa fase posterior).
- Os testes simulam `auth.uid()` e os roles `anon`/`authenticated`; o comportamento de JWT, Storage e
  Auth do Supabase real não é exercitado por eles.
