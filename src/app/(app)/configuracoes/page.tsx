import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { signOut } from "@/features/auth/actions";
import { requireUser } from "@/services/session";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Configurações</h1>

      <Card>
        <CardTitle>Conta</CardTitle>
        <CardDescription>{user.email}</CardDescription>
      </Card>

      <Card>
        <CardTitle>Notificações e preferências</CardTitle>
        <CardDescription>Disponíveis nas próximas fases.</CardDescription>
      </Card>

      <form action={signOut}>
        <Button type="submit" variant="secondary" size="lg" className="w-full">
          <LogOut className="h-5 w-5" aria-hidden />
          Sair
        </Button>
      </form>
    </div>
  );
}
