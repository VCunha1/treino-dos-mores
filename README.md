# TREINO DOS MORES

> Juntos na rotina, mais fortes na evolução.

Aplicativo web de treinamento físico para casais: cada pessoa tem seus treinos, histórico e metas, e
podem treinar juntas acompanhando o progresso uma da outra. Arquitetura preparada para vários casais
com isolamento total de dados.

## Status

| Fase | Escopo | Estado |
|---|---|---|
| 1 | Fundação: auth, perfis, casal/convite, RLS, layout e identidade visual | **Concluída** |
| 2 | Biblioteca de exercícios e planejamento | **Concluída** |
| 3 | Treino individual | Pendente |
| 4 | Treinar Juntos (Realtime) | Pendente |
| 5 | Evolução e estatísticas | Pendente |
| 6 | Notificações | Pendente |
| 7 | AI Coach | Pendente |
| 8 | Cycle Sync | Pendente |
| 9 | Finalização | Pendente |

### O que a Fase 1 entrega

- Cadastro, login, recuperação e redefinição de senha (Supabase Auth)
- Perfil com foto e informações físicas opcionais (privadas: nem o parceiro vê)
- Casal: criar, convidar por código/link (sem validade, uso único, revogável), aceitar, sair
- Migrations versionadas com RLS e testes que rodam as políticas reais
- Layout mobile-first com navegação inferior e a paleta da marca
- Tela `/setup` clara quando as variáveis do Supabase não estão configuradas

### O que a Fase 2 entrega

- Biblioteca com 63 exercícios do sistema (12 grupos musculares), busca e filtro, e exercícios personalizados
- Planos de treino: criar (ABC, ABCD, ABCDE, Upper/Lower, Push/Pull/Legs, Full Body, personalizada), editar,
  duplicar, arquivar, compartilhar (leitura) e excluir com confirmação
- Dias de treino (renomear, dia da semana, foco, reordenar) e exercícios por dia (séries, repetições, carga inicial,
  descanso, técnica especial, objetivo, observações, reordenar)
- O administrador do casal cria e edita os planos da parceira, sem acesso aos dados privados dela

## Tecnologias

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS 3 · Lucide · Supabase (Postgres,
Auth, Storage, RLS) · Zod · Vitest + PGlite.

## Requisitos

- Node.js 20+ (testado com 22)
- Um projeto no [Supabase](https://supabase.com)
- (Opcional) [Supabase CLI](https://supabase.com/docs/guides/cli) para aplicar migrations por linha de comando

## Instalação

```bash
npm install
cp .env.example .env.local
```

## Configuração do Supabase

1. Crie um projeto no Supabase.
2. Em **Project Settings → API**, copie a *Project URL* e a chave *anon public* para `.env.local`.
3. Aplique as migrations (escolha uma opção):
   - **CLI:** `supabase link --project-ref <ref>` e depois `supabase db push`
   - **Painel:** abra o **SQL Editor** e execute os arquivos de `supabase/migrations/` em ordem de nome.
4. Em **Authentication → URL Configuration**, defina:
   - *Site URL*: a URL do app (`http://localhost:3000` em desenvolvimento)
   - *Redirect URLs*: adicione `<site>/auth/callback`
5. Em **Authentication → Providers → Email**, mantenha a confirmação de e-mail ligada em produção.
   Para testar localmente sem e-mail, você pode desligá-la temporariamente.

## Variáveis de ambiente

| Variável | Obrigatória | Onde roda | Descrição |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | navegador + servidor | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | navegador + servidor | Chave anon (protegida pela RLS) |
| `NEXT_PUBLIC_SITE_URL` | Sim | navegador + servidor | URL pública do app (links de e-mail e convite) |
| `SUPABASE_SERVICE_ROLE_KEY` | Não (Fase 1) | **somente servidor** | Nunca expor ao navegador |
| `AI_PROVIDER`, `AI_API_KEY` | Fase 7 | **somente servidor** | Provedor e chave do AI Coach |

## Execução local

```bash
npm run dev      # http://localhost:3000
```

## Testes e qualidade

```bash
npm test             # RLS (migrations reais em Postgres/PGlite) + validações
npm run typecheck
npm run lint
npm run build
```

Os testes de RLS provam, entre outras coisas, que: um estranho não lê perfil/casal de ninguém; o
parceiro **não** lê as informações físicas privadas; casais distintos são isolados; escritas diretas
em tabelas de casal são negadas; convites expirados, revogados ou já usados são recusados.
Veja [docs/permissions.md](docs/permissions.md).

## Deploy (Vercel)

1. Suba o repositório para o GitHub (`treino-dos-mores`).
2. Importe o projeto na Vercel e defina as variáveis `NEXT_PUBLIC_*` (e as de servidor, se usar).
3. Atualize *Site URL* e *Redirect URLs* no Supabase para o domínio da Vercel.
4. Faça o deploy. Aplique novas migrations antes de publicar versões que dependam delas.

## Estrutura

```
src/
  app/           rotas (App Router): (auth), (app), onboarding, setup, auth/callback
  components/    UI reutilizável (ui/, layout/, brand/)
  features/      módulos por domínio (auth, profile, couple)
  lib/           supabase (client/server/middleware), validação (zod), utilitários
  services/      leitura de dados no servidor (sessão, perfil, casal)
  types/         tipos compartilhados
supabase/migrations/   SQL versionado (schema + RLS)
tests/                 RLS e validações
docs/                  documentação de permissões
```

## Convenções

- Toda nova tabela: migration + RLS + `GRANT` explícito + testes de isolamento.
- Autorização sempre no banco/servidor; esconder botão nunca é controle de acesso.
- Nada de chaves privadas em código que roda no navegador.
