export type Exercise = {
  id: string;
  owner_id: string | null;
  name: string;
  primary_muscle: string;
  secondary_muscles: string[];
  equipment: string | null;
  description: string | null;
  instructions: string | null;
  safety_notes: string | null;
  media_url: string | null;
};

export type WorkoutPlan = {
  id: string;
  owner_id: string;
  created_by: string;
  name: string;
  description: string | null;
  goal: string | null;
  split_type: string;
  is_archived: boolean;
  is_shared: boolean;
  updated_at: string;
};

export type PlanExercise = {
  id: string;
  day_id: string;
  exercise_id: string;
  position: number;
  sets: number;
  reps: string;
  initial_load_kg: number | null;
  rest_seconds: number;
  notes: string | null;
  special_technique: string | null;
  objective: string | null;
  exercise: Pick<Exercise, "id" | "name" | "primary_muscle" | "equipment"> | null;
};

export type PlanDay = {
  id: string;
  plan_id: string;
  name: string;
  weekday: number | null;
  focus: string | null;
  position: number;
  exercises: PlanExercise[];
};

export type PlanDetail = WorkoutPlan & { days: PlanDay[] };
