import Link from "next/link";
import { AuthForm } from "@/features/auth/auth-form";
import { signUp } from "@/features/auth/actions";

export const metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return (
    <div className="space-y-6">
      <AuthForm
        action={signUp}
        submitLabel="Criar conta"
        pendingText="Criando conta..."
        fields={[
          { name: "displayName", label: "Seu nome", autoComplete: "name" },
          { name: "email", label: "E-mail", type: "email", autoComplete: "email" },
          {
            name: "password",
            label: "Senha",
            type: "password",
            autoComplete: "new-password",
            hint: "Mínimo de 8 caracteres.",
          },
          { name: "confirmPassword", label: "Confirmar senha", type: "password", autoComplete: "new-password" },
        ]}
      />
      <p className="text-center text-sm text-ink-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-semibold text-brand">
          Entrar
        </Link>
      </p>
    </div>
  );
}
