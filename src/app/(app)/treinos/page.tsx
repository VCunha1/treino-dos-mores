import Link from "next/link";
import { ChevronRight, Plus, Share2 } from "lucide-react";
import { PageAlert } from "@/components/ui/page-alert";
import { splitLabel } from "@/lib/training";
import { getCoupleContext, requireUser } from "@/services/session";
import { listPlans } from "@/services/plans";
import type { WorkoutPlan } from "@/types/training";

export const metadata = { title: "Meus treinos" };

function PlanRow({ plan, subtitle }: { plan: WorkoutPlan; subtitle?: string }) {
  return (
    <li>
      <Link
        href={`/treinos/${plan.id}`}
        className="flex items-center gap-3 rounded-2xl border border-line/70 bg-card p-4 transition active:scale-[0.99]"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{plan.name}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {splitLabel(plan.split_type)}
            {subtitle ? ` · ${subtitle}` : ""}
          </p>
        </div>
        {plan.is_shared ? (
          <span className="flex items-center gap-1 rounded-full border border-brand/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
            <Share2 className="h-3 w-3" aria-hidden /> Compartilhado
          </span>
        ) : null}
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden />
      </Link>
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{title}</h2>
      {children}
    </section>
  );
}

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const [user, ctx, plans] = await Promise.all([requireUser(), getCoupleContext(), listPlans()]);

  const mine = plans.filter((p) => p.owner_id === user.id);
  const others = plans.filter((p) => p.owner_id !== user.id);
  const active = mine.filter((p) => !p.is_archived);
  const archived = mine.filter((p) => p.is_archived);
  const partnerName = ctx?.partner?.display_name ?? "Parceiro(a)";
  const othersActive = others.filter((p) => !p.is_archived);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Treinos</h1>
        <Link
          href="/treinos/novo"
          className="flex h-11 items-center gap-1.5 rounded-xl bg-brand px-4 font-semibold text-bg transition active:scale-[0.98]"
        >
          <Plus className="h-5 w-5" aria-hidden /> Novo
        </Link>
      </header>

      <PageAlert error={erro} />

      <Section title="Meus planos">
        {active.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-6 text-center">
            <p className="text-sm text-ink-muted">Você ainda não tem nenhum plano de treino.</p>
            <Link href="/treinos/novo" className="mt-3 inline-block font-semibold text-brand">
              Criar meu primeiro plano
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {active.map((p) => (
              <PlanRow key={p.id} plan={p} />
            ))}
          </ul>
        )}
      </Section>

      {othersActive.length > 0 ? (
        <Section title={`Planos de ${partnerName}`}>
          <ul className="space-y-3">
            {othersActive.map((p) => (
              <PlanRow
                key={p.id}
                plan={p}
                subtitle={ctx?.myRole === "admin" ? "você administra" : "somente leitura"}
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {archived.length > 0 ? (
        <details className="space-y-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-ink-muted marker:content-none">
            Arquivados ({archived.length})
          </summary>
          <ul className="mt-3 space-y-3 opacity-80">
            {archived.map((p) => (
              <PlanRow key={p.id} plan={p} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
