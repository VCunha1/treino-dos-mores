import Link from "next/link";
import { Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { PageAlert } from "@/components/ui/page-alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { DayPicker } from "@/features/joint/day-picker";
import { cancelJoint, joinJoint, leaveJoint, startJoint } from "@/features/joint/actions";
import { JointLiveCard } from "@/features/joint/joint-live-card";
import { participantStatusText } from "@/lib/joint-client";
import { formatVolume } from "@/lib/workout-client";
import { getCoupleContext, requireUser } from "@/services/session";
import { getOpenJoint, listCompletedJoints, listTrainableDays } from "@/services/joint";
import { getActiveSession } from "@/services/workouts";
import type { JointPerson } from "@/types/joint";

export const metadata = { title: "Treinar juntos" };

export default async function JointPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const couple = await getCoupleContext();

  if (!couple || !couple.partner) {
    return (
      <div className="space-y-5">
        <Header />
        <PageAlert error={sp.erro} />
        <Card className="border-brand/40">
          <CardTitle>{couple ? "Falta a outra pessoa" : "Vincule sua conta"}</CardTitle>
          <CardDescription>
            {couple
              ? "Quando a outra pessoa aceitar o convite, vocês poderão treinar juntos aqui."
              : "Crie o casal ou aceite um convite para treinar junto."}
          </CardDescription>
          <Link href="/casal" className="mt-4 flex h-12 items-center justify-center rounded-xl bg-brand font-semibold text-bg">
            Ir para Casal
          </Link>
        </Card>
      </div>
    );
  }

  const meMember = couple.members.find((m) => m.user_id === user.id);
  const me: JointPerson = {
    id: user.id,
    name: meMember?.profile?.display_name ?? "Você",
    avatarUrl: meMember?.profile?.avatar_url ?? null,
  };
  const partner: JointPerson = {
    id: couple.partner.id,
    name: couple.partner.display_name,
    avatarUrl: couple.partner.avatar_url,
  };
  const people = new Map([[me.id, me], [partner.id, partner]]);

  const [open, history, active] = await Promise.all([getOpenJoint(), listCompletedJoints(8), getActiveSession()]);
  const days = !open || (open.joint.status === "waiting" && open.joint.created_by !== user.id) ? await listTrainableDays() : [];
  const myPart = open?.participants.find((p) => p.user_id === user.id);

  return (
    <div className="space-y-6">
      <Header />
      <PageAlert error={sp.erro} />

      {active && !open ? (
        <p role="status" className="rounded-xl border border-brand/40 bg-brand/10 px-4 py-3 text-sm text-brand">
          Você tem um treino individual em andamento. Finalize ou descarte para começar um treino em conjunto.{" "}
          <Link href={`/treino/${active.id}`} className="font-semibold underline">
            Abrir treino
          </Link>
        </p>
      ) : null}

      {/* 1) Nenhum encontro aberto: escolher o treino e chamar */}
      {!open ? (
        <section className="space-y-3">
          <Card>
            <CardTitle>Chamar {partner.name} para treinar</CardTitle>
            <CardDescription>
              Cada um faz o seu treino, com as suas cargas. Vocês só acompanham o progresso um do outro ao vivo.
            </CardDescription>
          </Card>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Escolha o seu treino</h2>
          <DayPicker days={days} action={startJoint} buttonLabel="Chamar" />
        </section>
      ) : null}

      {/* 2) Convite aguardando: eu chamei */}
      {open && open.joint.status === "waiting" && open.joint.created_by === user.id ? (
        <section className="space-y-4">
          <JointLiveCard
            jointId={open.joint.id}
            initialStatus={open.joint.status}
            initialParticipants={open.participants}
            me={me}
            partner={partner}
          />
          <div className="grid gap-2">
            {myPart?.session_id ? (
              <Link href={`/treino/${myPart.session_id}`} className="flex h-14 items-center justify-center rounded-xl bg-brand text-lg font-semibold text-bg">
                Ir para o meu treino
              </Link>
            ) : null}
            <ConfirmButton
              action={cancelJoint}
              fields={{ jointId: open.joint.id }}
              label="Cancelar convite"
              message={`Cancelar o convite para ${partner.name}? O seu treino continua normalmente, só que sozinho(a).`}
              confirmLabel="Cancelar convite"
              variant="secondary"
            />
          </div>
        </section>
      ) : null}

      {/* 3) Convite aguardando: fui chamado(a) */}
      {open && open.joint.status === "waiting" && open.joint.created_by !== user.id ? (
        <section className="space-y-4">
          <Card className="border-brand/40">
            <div className="flex items-center gap-3">
              <Avatar name={partner.name} src={partner.avatarUrl} />
              <div>
                <CardTitle>{partner.name} chamou você!</CardTitle>
                <CardDescription>
                  Está treinando <strong>{open.participants.find((p) => p.user_id === partner.id)?.day_name ?? "agora"}</strong>. Escolha o seu treino para entrar.
                </CardDescription>
              </div>
            </div>
          </Card>
          <DayPicker days={days} action={joinJoint} fields={{ jointId: open.joint.id }} buttonLabel="Entrar" />
          <form action={cancelJoint}>
            <input type="hidden" name="jointId" value={open.joint.id} />
            <SubmitButton variant="ghost" className="w-full">
              Agora não
            </SubmitButton>
          </form>
        </section>
      ) : null}

      {/* 4) Encontro ativo */}
      {open && open.joint.status === "active" ? (
        <section className="space-y-4">
          <JointLiveCard
            jointId={open.joint.id}
            initialStatus={open.joint.status}
            initialParticipants={open.participants}
            me={me}
            partner={partner}
          />
          <div className="grid gap-2">
            {myPart?.status === "training" && myPart.session_id ? (
              <>
                <Link href={`/treino/${myPart.session_id}`} className="flex h-14 items-center justify-center rounded-xl bg-brand text-lg font-semibold text-bg">
                  Ir para o meu treino
                </Link>
                <ConfirmButton
                  action={leaveJoint}
                  fields={{ jointId: open.joint.id, sessionId: myPart.session_id }}
                  label="Sair do encontro"
                  message="Sair do encontro? O seu treino continua, mas vocês deixam de ver o progresso um do outro."
                  confirmLabel="Sair"
                  variant="secondary"
                />
              </>
            ) : (
              <p className="text-center text-sm text-ink-muted">
                {myPart ? participantStatusText(myPart.status) : "Você não está neste encontro"}. Quando todos terminarem, o encontro é encerrado.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {/* Histórico */}
      {history.length > 0 ? (
        <section className="space-y-3" aria-labelledby="hist">
          <h2 id="hist" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Treinos em conjunto anteriores
          </h2>
          <ul className="space-y-3">
            {history.map(({ joint, participants }) => (
              <li key={joint.id} className="rounded-2xl border border-line/70 bg-card p-4">
                <p className="text-xs text-ink-muted">
                  {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date(joint.created_at))}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {participants.map((p) => (
                    <li key={p.user_id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">
                        <span className="font-semibold">{p.user_id === user.id ? "Você" : (people.get(p.user_id)?.name ?? "Parceiro(a)")}</span>{" "}
                        <span className="text-ink-muted">· {p.day_name}</span>
                      </span>
                      <span className="shrink-0 text-xs text-ink-muted">
                        {p.status === "finished" ? `${p.sets_done} séries · ${formatVolume(p.volume_kg)}` : participantStatusText(p.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

    </div>
  );
}

function Header() {
  return (
    <header className="flex items-center gap-3">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
        <Users className="h-6 w-6" aria-hidden />
      </span>
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Treinar juntos</h1>
        <p className="text-sm text-ink-muted">Cada um no seu treino, os dois acompanhando ao vivo.</p>
      </div>
    </header>
  );
}
