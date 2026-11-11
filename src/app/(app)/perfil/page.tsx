import Link from "next/link";
import { ProfileForm } from "@/features/profile/profile-form";
import { getProfile, getProfileDetails } from "@/services/session";

export const metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const [profile, details] = await Promise.all([getProfile(), getProfileDetails()]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Perfil</h1>
      <ProfileForm profile={profile} details={details} intent="edit" />
      <Link
        href="/configuracoes"
        className="flex h-12 items-center justify-center rounded-xl border border-line text-sm font-semibold text-ink-muted transition hover:text-ink"
      >
        Configurações da conta e sair
      </Link>
    </div>
  );
}
