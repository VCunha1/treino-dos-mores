import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, Plus } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { FormField } from "@/components/ui/form-field";
import { PageAlert } from "@/components/ui/page-alert";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  addDay,
  deletePlan,
  duplicatePlan,
  setPlanArchived,
  setPlanShared,
  updatePlan,
} from "@/features/plans/actions";
import { PlanDayCard } from "@/features/plans/plan-day-card";
import { uuid } from "@/lib/validation/plan";
import { splitLabel } from "@/lib/training";
import { getPlan } from "@/services/plans";
import { getCoupleContext, requireUser } from "@/services/session";

export const metadata = { title: "Plano de treino" };

export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ erro?: string; adicionado?: string }>;
}) {
  const { planId } = await params;
  const sp = await searchParams;
  if (!uuid.safeParse(planId).success) notFound();

  const [user, ctx, plan] = await Promise.all([requireUser(), getCoupleContext(), getPlan(planId)]);
  if (!plan) notFound();

  const isOwner = plan.owner_id === user.id;
  // Espelha a regra do banco (manages_user): dono, ou admin do casal gerenciando a parceira.
  // A autorização real continua sendo feita pela RLS; isto só decide o que mostrar.
  const adminOfOwner = ctx?.myRole === "admin" && ctx.members.some((m) => m.user_id === plan.owner_id);
  const canManage = isOwner || Boolean(adminOfOwner);
  const ownerName = isOwner
    ? "você"
    : (ctx?.members.find((m) => m.user_id === plan.owner_id)?.profile?.display_name ?? "parceiro(a)");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/treinos" className="text-sm text-ink-muted hover:text-brand">
          ← Treinos
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold leading-tight">{plan.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {splitLabel(plan.split_type)} · plano de {ownerName}
          {plan.is_archived ? " · arquivado" : ""}
          {plan.is_shared ? " · compartilhado" : ""}
        </p>
        {plan.goal ? <p className="mt-1 text-sm">Objetivo: {plan.goal}</p> : null}
        {plan.description ? <p className="mt-1 text-sm text-ink-muted">{plan.description}</p> : null}
      </div>

      <PageAlert error={sp.erro} notice={sp.adicionado ? "Exercício adicionado. Ajuste séries e repetições em Editar." : undefined} />

      {!canManage ? (
        <div className="space-y-3 rounded-2xl border border-line/70 bg-card p-4">
          <p className="text-sm text-ink-muted">
            Este plano é somente leitura. Você pode copiá-lo para a sua conta e editar a sua cópia.
          </p>
          <ActionForm action={duplicatePlan} fields={{ planId: plan.id }} variant="primary" size="md" className="w-full">
            <Copy className="h-5 w-5" aria-hidden /> Copiar para meus planos
          </ActionForm>
        </div>
      ) : (
        <details className="rounded-2xl border border-line/70 bg-card p-4">
          <summary className="cursor-pointer font-semibold marker:content-none">Editar informações do plano</summary>
          <form action={updatePlan} className="mt-4 space-y-4">
            <input type="hidden" name="planId" value={plan.id} />
            <FormField label="Nome" name="name">
              <input id="name" name="name" defaultValue={plan.name} required maxLength={80} className="field" />
            </FormField>
            <FormField label="Objetivo (opcional)" name="goal">
              <input id="goal" name="goal" defaultValue={plan.goal ?? ""} maxLength={200} className="field" />
            </FormField>
            <FormField label="Descrição (opcional)" name="description">
              <textarea id="description" name="description" rows={3} defaultValue={plan.description ?? ""} maxLength={500} className="field-area" />
            </FormField>
            <SubmitButton className="w-full" pendingText="Salvando...">
              Salvar informações
            </SubmitButton>
          </form>
        </details>
      )}

      {plan.days.map((day, i) => (
        <PlanDayCard
          key={day.id}
          day={day}
          planId={plan.id}
          canManage={canManage}
          isFirst={i === 0}
          isLast={i === plan.days.length - 1}
          isOnlyDay={plan.days.length === 1}
        />
      ))}

      {canManage && plan.days.length < 7 ? (
        <ActionForm action={addDay} fields={{ planId: plan.id }} variant="secondary" size="md" className="w-full">
          <Plus className="h-5 w-5" aria-hidden /> Adicionar dia de treino
        </ActionForm>
      ) : null}

      {canManage ? (
        <section className="space-y-3 border-t border-line/60 pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Gerenciar plano</h2>

          {isOwner && ctx?.partner ? (
            <ActionForm
              action={setPlanShared}
              fields={{ planId: plan.id, value: String(!plan.is_shared) }}
              className="w-full"
            >
              {plan.is_shared ? "Deixar de compartilhar com o parceiro(a)" : "Compartilhar com o parceiro(a) (leitura)"}
            </ActionForm>
          ) : null}

          <ActionForm action={duplicatePlan} fields={{ planId: plan.id }} className="w-full">
            <Copy className="h-4 w-4" aria-hidden /> Duplicar plano
          </ActionForm>

          <ActionForm
            action={setPlanArchived}
            fields={{ planId: plan.id, value: String(!plan.is_archived) }}
            className="w-full"
          >
            {plan.is_archived ? "Restaurar plano" : "Arquivar plano"}
          </ActionForm>

          <ConfirmButton
            action={deletePlan}
            fields={{ planId: plan.id }}
            label="Excluir plano"
            message="Excluir este plano, todos os dias e exercícios? Esta ação não pode ser desfeita."
            confirmLabel="Excluir definitivamente"
            size="md"
            className="w-full"
          />
        </section>
      ) : null}
    </div>
  );
}
