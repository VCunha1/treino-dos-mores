import Link from "next/link";
import { FormField } from "@/components/ui/form-field";
import { PageAlert } from "@/components/ui/page-alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { createPlan } from "@/features/plans/actions";
import { SPLITS } from "@/lib/training";
import { getCoupleContext, requireUser } from "@/services/session";

export const metadata = { title: "Novo plano" };

export default async function NewPlanPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const [user, ctx] = await Promise.all([requireUser(), getCoupleContext()]);

  // Só o administrador do casal pode criar planos para a parceira.
  const canCreateForPartner = ctx?.myRole === "admin" && Boolean(ctx.partner);
  const partnerId = ctx?.members.find((m) => m.user_id !== user.id)?.user_id;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/treinos" className="text-sm text-ink-muted hover:text-brand">
          ← Treinos
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold">Novo plano</h1>
      </div>

      <PageAlert error={erro} />

      <form action={createPlan} className="space-y-5">
        {canCreateForPartner && partnerId ? (
          <FormField label="Plano de quem?" name="ownerId">
            <select id="ownerId" name="ownerId" defaultValue={user.id} className="field">
              <option value={user.id}>Meu</option>
              <option value={partnerId}>{ctx?.partner?.display_name ?? "Parceira"}</option>
            </select>
          </FormField>
        ) : (
          <input type="hidden" name="ownerId" value={user.id} />
        )}

        <FormField label="Nome do plano" name="name">
          <input id="name" name="name" required maxLength={80} className="field" placeholder="Ex.: Hipertrofia 2026" />
        </FormField>

        <FormField label="Divisão" name="split" hint="Os dias são criados automaticamente e você pode renomear, adicionar ou remover depois.">
          <select id="split" name="split" defaultValue="abc" className="field">
            {SPLITS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Descrição (opcional)" name="description">
          <textarea id="description" name="description" rows={3} maxLength={500} className="field-area" />
        </FormField>

        <SubmitButton size="lg" className="w-full" pendingText="Criando...">
          Criar plano
        </SubmitButton>
      </form>
    </div>
  );
}
