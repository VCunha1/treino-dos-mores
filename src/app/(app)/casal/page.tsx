import { Avatar } from "@/components/ui/avatar";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { publicEnv } from "@/lib/env";
import { AcceptInviteForm, CreateCoupleForm, InvitePanel, LeaveCoupleButton } from "@/features/couple/couple-forms";
import { getCoupleContext } from "@/services/session";

export const metadata = { title: "Casal" };

export default async function CouplePage({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const { codigo } = await searchParams;
  const ctx = await getCoupleContext();

  if (!ctx) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold">Casal</h1>
        <Card className={codigo ? "border-brand/50" : undefined}>
          <CardTitle>Recebeu um convite?</CardTitle>
          <CardDescription>Digite o código (ou abra o link) para entrar no casal.</CardDescription>
          <div className="mt-4">
            <AcceptInviteForm defaultCode={(codigo ?? "").slice(0, 10)} />
          </div>
        </Card>
        <Card>
          <CardTitle>Criar um casal</CardTitle>
          <CardDescription>Você será o administrador e poderá convidar a outra pessoa.</CardDescription>
          <div className="mt-4">
            <CreateCoupleForm />
          </div>
        </Card>
      </div>
    );
  }

  const isAdmin = ctx.myRole === "admin";
  const complete = ctx.members.length >= 2;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">{ctx.couple.name}</h1>

      <Card>
        <CardTitle>Membros</CardTitle>
        <ul className="mt-4 space-y-3">
          {ctx.members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3">
              <Avatar name={m.profile?.display_name} src={m.profile?.avatar_url} className="h-10 w-10 text-sm" />
              <div className="flex-1">
                <p className="font-semibold">{m.profile?.display_name || "Sem nome"}</p>
                <p className="text-xs text-ink-muted">{m.role === "admin" ? "Administrador" : "Parceira(o)"}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {isAdmin && !complete ? (
        <Card>
          <CardTitle>Convidar</CardTitle>
          <CardDescription>Envie o código ou o link para a outra pessoa. Ela precisa aceitar explicitamente.</CardDescription>
          <div className="mt-4">
            <InvitePanel coupleId={ctx.couple.id} invitation={ctx.pendingInvitation} siteUrl={publicEnv.siteUrl} />
          </div>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Privacidade</CardTitle>
        <CardDescription>
          Estar no mesmo casal não dá acesso aos dados privados um do outro. Informações físicas e (no futuro) de
          saúde só são vistas se a própria pessoa compartilhar.
        </CardDescription>
      </Card>

      <LeaveCoupleButton />
    </div>
  );
}
