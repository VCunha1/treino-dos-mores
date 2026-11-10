import { redirect } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { getProfile } from "@/services/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile.onboarding_completed) redirect("/onboarding");

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md px-5 pb-28 pt-6">
      {children}
      <BottomNav />
    </div>
  );
}
