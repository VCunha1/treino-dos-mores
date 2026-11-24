import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PARTICIPANT_COLUMNS, normalizeParticipant } from "@/lib/joint-client";
import { requireUser } from "@/services/session";
import type { JointParticipant, JointSession, JointWithParticipants, TrainableDay } from "@/types/joint";

const JOINT_COLUMNS = "id, couple_id, created_by, status, created_at, started_at, ended_at";

async function participantsOf(jointIds: string[]): Promise<Map<string, JointParticipant[]>> {
  const out = new Map<string, JointParticipant[]>();
  if (jointIds.length === 0) return out;
  const supabase = await createClient();
  const { data } = await supabase
    .from("joint_participants")
    .select(`joint_id, ${PARTICIPANT_COLUMNS}`)
    .in("joint_id", jointIds)
    .order("joined_at", { ascending: true });
  for (const row of data ?? []) {
    const p = normalizeParticipant(row as unknown as Record<string, unknown>);
    if (!p) continue;
    const id = (row as unknown as { joint_id: string }).joint_id;
    out.set(id, [...(out.get(id) ?? []), p]);
  }
  return out;
}

/** Encontro aberto (aguardando ou em andamento) do casal do usuário. A RLS limita ao próprio casal. */
export async function getOpenJoint(): Promise<JointWithParticipants | null> {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("joint_sessions")
    .select(JOINT_COLUMNS)
    .in("status", ["waiting", "active"])
    .maybeSingle();
  if (!data) return null;
  const parts = await participantsOf([data.id]);
  return { joint: data as JointSession, participants: parts.get(data.id) ?? [] };
}

/** Encontro aberto ao qual a sessão de treino informada pertence (para mostrar o parceiro durante o treino). */
export async function getJointForSession(sessionId: string): Promise<JointWithParticipants | null> {
  await requireUser();
  const supabase = await createClient();
  const { data: link } = await supabase
    .from("joint_participants")
    .select("joint_id")
    .eq("session_id", sessionId)
    .eq("status", "training")
    .maybeSingle();
  if (!link) return null;
  const { data } = await supabase
    .from("joint_sessions")
    .select(JOINT_COLUMNS)
    .eq("id", link.joint_id)
    .in("status", ["waiting", "active"])
    .maybeSingle();
  if (!data) return null;
  const parts = await participantsOf([data.id]);
  return { joint: data as JointSession, participants: parts.get(data.id) ?? [] };
}

export async function listCompletedJoints(limit = 10): Promise<JointWithParticipants[]> {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("joint_sessions")
    .select(JOINT_COLUMNS)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(limit);
  const joints = (data ?? []) as JointSession[];
  const parts = await participantsOf(joints.map((j) => j.id));
  return joints.map((joint) => ({ joint, participants: parts.get(joint.id) ?? [] }));
}

/** Dias de treino que o usuário pode iniciar: planos ativos visíveis a ele, com ao menos um exercício. */
export async function listTrainableDays(): Promise<TrainableDay[]> {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("workout_plan_days")
    .select("id, name, focus, position, plan:workout_plans!inner(id, name, is_archived), exercises:workout_plan_exercises(id)")
    .eq("plan.is_archived", false)
    .order("position", { ascending: true });

  type Row = {
    id: string;
    name: string;
    focus: string | null;
    plan: { id: string; name: string } | { id: string; name: string }[] | null;
    exercises: { id: string }[] | null;
  };
  const days: TrainableDay[] = [];
  for (const r of (data ?? []) as unknown as Row[]) {
    const plan = Array.isArray(r.plan) ? r.plan[0] : r.plan;
    const count = r.exercises?.length ?? 0;
    if (!plan || count === 0) continue;
    days.push({ dayId: r.id, dayName: r.name, focus: r.focus, planId: plan.id, planName: plan.name, exerciseCount: count });
  }
  return days.sort((a, b) => a.planName.localeCompare(b.planName, "pt-BR"));
}
