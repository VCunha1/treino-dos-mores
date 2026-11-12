export type WorkoutSet = {
  id: string;
  session_exercise_id: string;
  set_number: number;
  reps: number | null;
  load_kg: number | null;
  completed: boolean;
  completed_at: string | null;
};

export type SessionExercise = {
  id: string;
  session_id: string;
  exercise_id: string | null;
  exercise_name: string;
  primary_muscle: string;
  position: number;
  planned_sets: number;
  planned_reps: string;
  planned_load_kg: number | null;
  rest_seconds: number;
  special_technique: string | null;
  plan_notes: string | null;
  status: "pending" | "skipped";
  notes: string | null;
  sets: WorkoutSet[];
};

export type WorkoutSession = {
  id: string;
  user_id: string;
  plan_id: string | null;
  day_id: string | null;
  plan_name: string;
  day_name: string;
  status: "in_progress" | "completed";
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  total_volume_kg: number | null;
  sets_completed: number | null;
};

export type SessionDetail = WorkoutSession & { exercises: SessionExercise[] };

export type UserPreferences = {
  weight_unit: "kg" | "lb";
  default_rest_seconds: number;
  sound_enabled: boolean;
};

export type SaveSetResult = { ok: true } | { ok: false; final?: boolean; error: string };
