import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Couple, CoupleInvitation, CoupleMember, Profile, ProfileDetails } from "@/types";

export type CoupleContext = {
  couple: Couple;
  myRole: CoupleMember["role"];
  members: (CoupleMember & { profile: Pick<Profile, "id" | "display_name" | "avatar_url"> | null })[];
  partner: Pick<Profile, "id" | "display_name" | "avatar_url"> | null;
  pendingInvitation: CoupleInvitation | null;
};

/** Usuário autenticado (validado no servidor do Supabase) ou redireciona ao login. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
});

export const getProfile = cache(async (): Promise<Profile> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, onboarding_completed")
    .eq("id", user.id)
    .single();
  if (error || !data) throw new Error("Perfil não encontrado. Verifique se as migrations foram aplicadas.");
  return data as Profile;
});

export const getProfileDetails = cache(async (): Promise<ProfileDetails | null> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile_details")
    .select("user_id, birth_date, height_cm, weight_kg, training_goals, training_preferences, available_equipment")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as ProfileDetails | null) ?? null;
});

export const getCoupleContext = cache(async (): Promise<CoupleContext | null> => {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id, user_id, role, joined_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return null;

  const [{ data: couple }, { data: members }] = await Promise.all([
    supabase.from("couples").select("id, name, created_by").eq("id", membership.couple_id).single(),
    supabase.from("couple_members").select("couple_id, user_id, role, joined_at").eq("couple_id", membership.couple_id),
  ]);
  if (!couple || !members) return null;

  const ids = members.map((m) => m.user_id);
  const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);

  const withProfile = (members as CoupleMember[]).map((m) => ({
    ...m,
    profile: profiles?.find((p) => p.id === m.user_id) ?? null,
  }));

  let pendingInvitation: CoupleInvitation | null = null;
  if (membership.role === "admin") {
    const { data: inv } = await supabase
      .from("couple_invitations")
      .select("id, couple_id, code, status, expires_at")
      .eq("couple_id", membership.couple_id)
      .eq("status", "pending")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle();
    pendingInvitation = (inv as CoupleInvitation | null) ?? null;
  }

  return {
    couple: couple as Couple,
    myRole: membership.role as CoupleMember["role"],
    members: withProfile,
    partner: withProfile.find((m) => m.user_id !== user.id)?.profile ?? null,
    pendingInvitation,
  };
});
