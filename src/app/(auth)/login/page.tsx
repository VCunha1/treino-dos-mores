import Link from "next/link";
import { AuthForm } from "@/features/auth/auth-form";
import { signIn } from "@/features/auth/actions";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;

  return (
    <div className="space-y-6">
      {erro === "link-invalido" ? (
        <p role="alert" className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          O link é inválido ou expirou. Entre com sua senha ou solicite um novo link.
        </p>
      ) : null}
      <AuthForm
        action={signIn}
        submitLabel="Entrar"
        pendingText="Entrando..."
        fields={[
          { name: "email", label: "E-mail", type: "email", autoComplete: "email" },
          { name: "password", label: "Senha", type: "password", autoComplete: "current-password" },
        ]}
      />
      <div className="flex flex-col items-center gap-3 text-sm text-ink-muted">
        <Link href="/recuperar-senha" className="hover:text-brand">
          Esqueci minha senha
        </Link>
        <p>
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="font-semibold text-brand">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
