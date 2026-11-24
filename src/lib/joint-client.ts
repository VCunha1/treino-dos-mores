import type { JointParticipant, JointStatus, ParticipantStatus } from "@/types/joint";

/** Colunas lidas do resumo de progresso (compartilhadas com o servidor e com o Realtime). */
export const PARTICIPANT_COLUMNS =
  "user_id, session_id, status, day_name, sets_done, sets_total, exercises_done, exercises_total, current_exercise, volume_kg, updated_at";

const PARTICIPANT_STATUS: ParticipantStatus[] = ["training", "finished", "left"];
const JOINT_STATUS: JointStatus[] = ["waiting", "active", "completed", "cancelled"];

function int(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

/** Converte uma linha vinda do banco/Realtime em um participante válido, ou null se estiver incompleta. */
export function normalizeParticipant(raw: Record<string, unknown> | null | undefined): JointParticipant | null {
  if (!raw || typeof raw.user_id !== "string") return null;
  if (!PARTICIPANT_STATUS.includes(raw.status as ParticipantStatus)) return null;
  const volume = Number(raw.volume_kg);
  return {
    user_id: raw.user_id,
    session_id: typeof raw.session_id === "string" ? raw.session_id : null,
    status: raw.status as ParticipantStatus,
    day_name: typeof raw.day_name === "string" ? raw.day_name : "",
    sets_done: int(raw.sets_done),
    sets_total: int(raw.sets_total),
    exercises_done: int(raw.exercises_done),
    exercises_total: int(raw.exercises_total),
    current_exercise: typeof raw.current_exercise === "string" ? raw.current_exercise : null,
    volume_kg: Number.isFinite(volume) ? volume : 0,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : new Date(0).toISOString(),
  };
}

export function normalizeJointStatus(v: unknown): JointStatus | null {
  return JOINT_STATUS.includes(v as JointStatus) ? (v as JointStatus) : null;
}

export type ChangePayload = {
  eventType: string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

/** Aplica uma mudança do Realtime à lista de participantes (insere, atualiza ou remove por user_id). */
export function applyParticipantChange(list: JointParticipant[], payload: ChangePayload): JointParticipant[] {
  if (payload.eventType === "DELETE") {
    const id = payload.old?.user_id;
    return typeof id === "string" ? list.filter((p) => p.user_id !== id) : list;
  }
  const next = normalizeParticipant(payload.new);
  if (!next) return list;
  const exists = list.some((p) => p.user_id === next.user_id);
  return exists ? list.map((p) => (p.user_id === next.user_id ? next : p)) : [...list, next];
}

/** Troca a lista inteira (usado na releitura de segurança), normalizando e descartando linhas inválidas. */
export function replaceParticipants(rows: Record<string, unknown>[] | null | undefined): JointParticipant[] | null {
  if (!rows) return null;
  return rows.map((r) => normalizeParticipant(r)).filter((p): p is JointParticipant => p !== null);
}

export function progressPct(p: Pick<JointParticipant, "status" | "sets_done" | "sets_total">): number {
  if (p.status === "finished") return 100;
  if (p.sets_total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((p.sets_done / p.sets_total) * 100)));
}

export function participantStatusText(status: ParticipantStatus): string {
  switch (status) {
    case "training":
      return "Treinando";
    case "finished":
      return "Terminou";
    case "left":
      return "Saiu do encontro";
  }
}

export function isOpenJoint(status: JointStatus): boolean {
  return status === "waiting" || status === "active";
}

/** "agora", "há 2 min", "há 1 h" — a partir de uma data ISO e do instante atual. */
export function formatAgo(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 20) return "agora";
  if (s < 3600) return `há ${Math.max(1, Math.round(s / 60))} min`;
  return `há ${Math.round(s / 3600)} h`;
}
