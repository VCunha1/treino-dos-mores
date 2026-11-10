export type ActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  onboarding_completed: boolean;
};

export type ProfileDetails = {
  user_id: string;
  birth_date: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  training_goals: string | null;
  training_preferences: string | null;
  available_equipment: string | null;
};

export type CoupleRole = "admin" | "partner";

export type Couple = {
  id: string;
  name: string;
  created_by: string;
};

export type CoupleMember = {
  couple_id: string;
  user_id: string;
  role: CoupleRole;
  joined_at: string;
};

export type CoupleInvitation = {
  id: string;
  couple_id: string;
  code: string;
  status: "pending" | "accepted" | "revoked";
  expires_at: string | null;
};
