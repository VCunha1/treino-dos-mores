import Link from "next/link";
import { AuthForm } from "@/features/auth/auth-form";
import { requestPasswordReset } from "@/features/auth/actions";

export const metadata = { title: "Recuperar senha" };

export default function RecoverPasswordPage() {
  return (
    <div className="space-y-6">
      <p className="text-center text-sm text-ink-muted">
        Informe seu e-mail e enviaremos um link para você criar uma nova senha.
      </p>
      <AuthForm
        action={requestPasswordReset}
        submitLabel="Enviar link"
        pendingText="Enviando..."
        fields={[{ name: "email", label: "E-mail", type: "email", autoComplete: "email" }]}
      />
      <p className="text-center text-sm">
        <Link href="/login" className="text-ink-muted hover:text-brand">
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
