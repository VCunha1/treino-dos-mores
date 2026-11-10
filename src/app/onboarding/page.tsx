import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { ProfileForm } from "@/features/profile/profile-form";
import { getProfile, getProfileDetails } from "@/services/session";

export const metadata = { title: "Configure seu perfil" };

export default async function OnboardingPage() {
  const [profile, details] = await Promise.all([getProfile(), getProfileDetails()]);
  if (profile.onboarding_completed) redirect("/");

  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-5 py-8">
      <Logo />
      <div className="text-center">
        <h1 className="font-display text-xl font-bold">Vamos configurar seu perfil</h1>
        <p className="mt-1 text-sm text-ink-muted">Só o nome é obrigatório. O resto você pode completar depois.</p>
      </div>
      <ProfileForm profile={profile} details={details} intent="onboarding" />
    </main>
  );
}
