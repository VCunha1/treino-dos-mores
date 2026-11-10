"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField, FormMessage } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  acceptInvitation,
  createCouple,
  createInvitation,
  leaveCouple,
  revokeInvitation,
} from "@/features/couple/actions";
import type { ActionState } from "@/types";

const initial: ActionState = {};

export function CreateCoupleForm() {
  const [state, action] = useActionState(createCouple, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormField label="Nome do casal" name="name" error={state.fieldErrors?.name}>
        <input id="name" name="name" defaultValue="Nosso casal" className="field" maxLength={60} />
      </FormField>
      <FormMessage error={state.error} success={state.success} />
      <SubmitButton size="lg" className="w-full" pendingText="Criando...">
        Criar casal e convidar
      </SubmitButton>
    </form>
  );
}

export function AcceptInviteForm({ defaultCode = "" }: { defaultCode?: string }) {
  const [state, action] = useActionState(acceptInvitation, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormField label="Código do convite" name="code" error={state.fieldErrors?.code}>
        <input
          id="code"
          name="code"
          defaultValue={defaultCode}
          className="field font-mono uppercase tracking-[0.25em]"
          maxLength={10}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
        />
      </FormField>
      <FormMessage error={state.error} success={state.success} />
      <SubmitButton size="lg" className="w-full" pendingText="Aceitando...">
        Aceitar convite
      </SubmitButton>
    </form>
  );
}

export function InvitePanel({
  coupleId,
  invitation,
  siteUrl,
}: {
  coupleId: string;
  invitation: { id: string; code: string; expires_at: string | null } | null;
  siteUrl: string;
}) {
  const [createState, createAction] = useActionState(createInvitation, initial);
  const [revokeState, revokeAction] = useActionState(revokeInvitation, initial);
  const [copied, setCopied] = useState(false);

  const link = invitation ? `${siteUrl}/casal?codigo=${invitation.code}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Navegadores sem acesso à área de transferência: o link continua visível para cópia manual.
    }
  }

  return (
    <div className="space-y-4">
      {invitation ? (
        <>
          <div className="rounded-xl border border-brand/40 bg-surface p-4 text-center">
            <p className="text-xs uppercase tracking-wider text-ink-muted">Código do convite</p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-brand">{invitation.code}</p>
            <p className="mt-2 text-xs text-ink-muted">
              {invitation.expires_at
                ? `Válido até ${new Date(invitation.expires_at).toLocaleDateString("pt-BR")}`
                : "Não expira. Vale até ser aceito ou revogado."}
            </p>
          </div>
          <p className="break-all rounded-xl bg-surface px-3 py-2 text-xs text-ink-muted">{link}</p>
          <Button variant="secondary" className="w-full" onClick={copy}>
            {copied ? <Check className="h-5 w-5" aria-hidden /> : <Copy className="h-5 w-5" aria-hidden />}
            {copied ? "Link copiado" : "Copiar link do convite"}
          </Button>
          <form action={revokeAction}>
            <input type="hidden" name="invitationId" value={invitation.id} />
            <SubmitButton variant="ghost" className="w-full" pendingText="Revogando...">
              Revogar convite
            </SubmitButton>
          </form>
          <FormMessage error={revokeState.error} success={revokeState.success} />
        </>
      ) : (
        <form action={createAction} className="space-y-3">
          <input type="hidden" name="coupleId" value={coupleId} />
          <FormMessage error={createState.error} success={createState.success} />
          <SubmitButton size="lg" className="w-full" pendingText="Gerando...">
            Gerar convite
          </SubmitButton>
        </form>
      )}
    </div>
  );
}

export function LeaveCoupleButton() {
  const [confirming, setConfirming] = useState(false);
  const [state, action] = useActionState(leaveCouple, initial);

  if (!confirming) {
    return (
      <Button variant="danger" className="w-full" onClick={() => setConfirming(true)}>
        Sair do casal
      </Button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-xl border border-danger/40 bg-danger/5 p-4">
      <p className="text-sm">
        Ao sair, o vínculo é desfeito e vocês deixam de ver as informações compartilhadas. Seus dados pessoais continuam
        na sua conta.
      </p>
      <FormMessage error={state.error} />
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
        <SubmitButton variant="danger" pendingText="Saindo...">
          Confirmar saída
        </SubmitButton>
      </div>
    </form>
  );
}
