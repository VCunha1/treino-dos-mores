export type JointStatus = "waiting" | "active" | "completed" | "cancelled";
export type ParticipantStatus = "training" | "finished" | "left";

export type JointSession = {
  id: string;
  couple_id: string;
  created_by: string;
  status: JointStatus;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

/** Resumo de progresso que o parceiro enxerga. Nunca contém cargas ou repetições individuais. */
export type JointParticipant = {
  user_id: string;
  session_id: string | null;
  status: ParticipantStatus;
  day_name: string;
  sets_done: number;
  sets_total: number;
  exercises_done: number;
  exercises_total: number;
  current_exercise: string | null;
  volume_kg: number;
  updated_at: string;
};

export type JointPerson = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type JointWithParticipants = {
  joint: JointSession;
  participants: JointParticipant[];
};

export type TrainableDay = {
  dayId: string;
  dayName: string;
  focus: string | null;
  planId: string;
  planName: string;
  exerciseCount: number;
};
