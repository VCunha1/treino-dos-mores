import { Logo } from "@/components/brand/logo";
import { AuthForm } from "@/features/auth/auth-form";
import { updatePassword } from "@/features/auth/actions";

export const metadata = { title: "Nova senha" };

// Rota privada: o usuário chega aqui já autenticado pelo link de recuperação (/auth/callback).
export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 py-10">
      <Logo />
      <p className="text-center text-sm text-ink-muted">Escolha uma nova senha para a sua conta.</p>
      <AuthForm
        action={updatePassword}
        submitLabel="Salvar nova senha"
        pendingText="Salvando..."
        fields={[
          { name: "password", label: "Nova senha", type: "password", autoComplete: "new-password", hint: "Mínimo de 8 caracteres." },
          { name: "confirmPassword", label: "Confirmar nova senha", type: "password", autoComplete: "new-password" },
        ]}
      />
    </main>
  );
}
