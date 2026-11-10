import { ProfileForm } from "@/features/profile/profile-form";
import { getProfile, getProfileDetails } from "@/services/session";

export const metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const [profile, details] = await Promise.all([getProfile(), getProfileDetails()]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Perfil</h1>
      <ProfileForm profile={profile} details={details} intent="edit" />
    </div>
  );
}
