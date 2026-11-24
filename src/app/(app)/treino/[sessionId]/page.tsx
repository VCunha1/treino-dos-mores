import { notFound, redirect } from "next/navigation";
import { JointLiveCard } from "@/features/joint/joint-live-card";
import { WorkoutRunner } from "@/features/workout/workout-runner";
import { uuid } from "@/lib/validation/plan";
import { getJointForSession } from "@/services/joint";
import { getCoupleContext, requireUser } from "@/services/session";
import { getPreferences, getSessionDetail } from "@/services/workouts";

export const metadata = { title: "Treino em andamento" };

export default async function WorkoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ erro?: string; aviso?: string }>;
}) {
  const { sessionId } = await params;
  const sp = await searchParams;
  if (!uuid.safeParse(sessionId).success) notFound();

  // A RLS garante que só o dono enxerga a sessão; qualquer outro recebe "não encontrado".
  const [detail, prefs] = await Promise.all([getSessionDetail(sessionId), getPreferences()]);
  if (!detail) notFound();
  if (detail.status === "completed") redirect(`/historico/${sessionId}`);

  // Treino em conjunto: mostra o progresso do(a) parceiro(a) fixo no topo (só um resumo; a RLS mantém o resto privado).
  const [user, couple, joint] = await Promise.all([requireUser(), getCoupleContext(), getJointForSession(sessionId)]);
  const partner = couple?.partner ?? null;
  const meProfile = couple?.members.find((m) => m.user_id === user.id)?.profile ?? null;

  return (
    <>
      {joint && partner ? (
        <JointLiveCard
            jointId={joint.joint.id}
            initialStatus={joint.joint.status}
            initialParticipants={joint.participants}
            me={{ id: user.id, name: meProfile?.display_name ?? "Você", avatarUrl: meProfile?.avatar_url ?? null }}
            partner={{ id: partner.id, name: partner.display_name, avatarUrl: partner.avatar_url }}
            variant="compact"
          />
      ) : null}
      <WorkoutRunner
        session={{ id: detail.id, planName: detail.plan_name, dayName: detail.day_name, startedAt: detail.started_at }}
        exercises={detail.exercises}
        defaultRestSeconds={prefs.default_rest_seconds}
        soundEnabled={prefs.sound_enabled}
        notice={sp.aviso === "em-andamento" ? "Você já tinha um treino em andamento. Retomamos ele para você." : undefined}
        error={sp.erro}
      />
    </>
  );
}
