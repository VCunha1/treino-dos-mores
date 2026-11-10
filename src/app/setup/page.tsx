import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { Logo } from "@/components/brand/logo";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Configuração pendente" };

export default function SetupPage() {
  if (isSupabaseConfigured()) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10">
      <Logo />
      <Card>
        <CardTitle>Configuração pendente</CardTitle>
        <CardDescription>
          O app ainda não está conectado a um projeto Supabase. Defina as variáveis abaixo em <code>.env.local</code>{" "}
          (ou na Vercel) e reinicie o servidor:
        </CardDescription>
        <ul className="mt-4 space-y-2 font-mono text-sm text-brand">
          <li>NEXT_PUBLIC_SUPABASE_URL</li>
          <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
          <li>NEXT_PUBLIC_SITE_URL</li>
        </ul>
        <p className="mt-4 text-sm text-ink-muted">
          Depois, aplique as migrations de <code>supabase/migrations</code>. O passo a passo está no README.
        </p>
      </Card>
    </main>
  );
}
