import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { PageAlert } from "@/components/ui/page-alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { signOut } from "@/features/auth/actions";
import { updatePreferences } from "@/features/workout/actions";
import { requireUser } from "@/services/session";
import { getPreferences } from "@/services/workouts";

export const metadata = { title: "Configurações" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ erro?: string; salvo?: string }> }) {
  const sp = await searchParams;
  const [user, prefs] = await Promise.all([requireUser(), getPreferences()]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Configurações</h1>

      <PageAlert error={sp.erro} notice={sp.salvo ? "Preferências salvas." : undefined} />

      <Card>
        <CardTitle>Conta</CardTitle>
        <CardDescription>{user.email}</CardDescription>
      </Card>

      <Card>
        <CardTitle>Treino</CardTitle>
        <CardDescription>Ajustes do cronômetro de descanso durante o treino.</CardDescription>
        <form action={updatePreferences} className="mt-4 space-y-4">
          <FormField label="Descanso padrão (segundos)" name="defaultRestSeconds" hint="Entre 10 e 600. Cada exercício usa o descanso definido no plano; este valor é o ponto de partida do cronômetro.">
            <input
              id="defaultRestSeconds"
              name="defaultRestSeconds"
              inputMode="numeric"
              defaultValue={prefs.default_rest_seconds}
              required
              className="field"
            />
          </FormField>
          <label className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4">
            <input
              type="checkbox"
              name="soundEnabled"
              defaultChecked={prefs.sound_enabled}
              className="h-5 w-5 accent-[#E5AE36]"
            />
            <span>
              <span className="block font-medium">Aviso sonoro e vibração</span>
              <span className="block text-xs text-ink-muted">Toca um alerta quando o descanso termina. Desligado por padrão.</span>
            </span>
          </label>
          <SubmitButton className="w-full" pendingText="Salvando...">
            Salvar preferências
          </SubmitButton>
        </form>
      </Card>

      <Card>
        <CardTitle>Notificações</CardTitle>
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
