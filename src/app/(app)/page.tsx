import Link from "next/link";
import { Bot, ClipboardList, Dumbbell, HeartPulse, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getCoupleContext, getProfile } from "@/services/session";

export const metadata = { title: "Início" };

function greeting(hour: number) {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

const upcoming = [
  { icon: Dumbbell, title: "Treino em andamento", phase: "Fase 3" },
  { icon: Users, title: "Treinar juntos", phase: "Fase 4" },
  { icon: Bot, title: "AI Coach", phase: "Fase 7" },
  { icon: HeartPulse, title: "Cycle Sync", phase: "Fase 8" },
];

export default async function DashboardPage() {
  const [profile, couple] = await Promise.all([getProfile(), getCoupleContext()]);

  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(now));
  const date = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(now);
  const firstName = profile.display_name.split(" ")[0] ?? profile.display_name;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Avatar name={profile.display_name} src={profile.avatar_url} />
        <div>
          <p className="text-sm capitalize text-ink-muted">{date}</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {greeting(hour)}, <span className="text-brand">{firstName}</span>
          </h1>
        </div>
      </header>

      {!couple ? (
        <Card className="border-brand/40">
          <CardTitle>Vincule sua conta</CardTitle>
          <CardDescription>
            Crie o casal ou aceite um convite para acompanhar a evolução juntos.
          </CardDescription>
          <Link
            href="/casal"
            className="mt-4 flex h-12 items-center justify-center rounded-xl bg-brand font-semibold text-bg transition active:scale-[0.98]"
          >
            Configurar casal
          </Link>
        </Card>
      ) : (
        <Card>
          <CardTitle>{couple.couple.name}</CardTitle>
          {couple.partner ? (
            <div className="mt-3 flex items-center gap-3">
              <Avatar name={couple.partner.display_name} src={couple.partner.avatar_url} className="h-10 w-10 text-sm" />
              <p className="text-sm text-ink-muted">
                Vinculado com <span className="font-semibold text-ink">{couple.partner.display_name}</span>
              </p>
            </div>
          ) : (
            <CardDescription>Aguardando a outra pessoa aceitar o convite.</CardDescription>
          )}
        </Card>
      )}

      <Link
        href="/treinos"
        className="flex h-14 items-center justify-center gap-2 rounded-xl bg-brand text-lg font-semibold text-bg transition active:scale-[0.98]"
      >
        <ClipboardList className="h-6 w-6" aria-hidden /> Meus treinos
      </Link>

      <section aria-labelledby="soon" className="space-y-3">
        <h2 id="soon" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Próximas funcionalidades
        </h2>
        <ul className="grid grid-cols-2 gap-3">
          {upcoming.map(({ icon: Icon, title, phase }) => (
            <li key={title} className="rounded-2xl border border-dashed border-line bg-surface p-4 opacity-80">
              <Icon className="h-6 w-6 text-brand-dark" aria-hidden />
              <p className="mt-3 text-sm font-semibold">{title}</p>
              <p className="text-xs text-ink-muted">Em breve · {phase}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
