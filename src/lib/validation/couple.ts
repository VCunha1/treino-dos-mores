import { z } from "zod";

// Alfabeto do código de convite (ver create_invitation): sem 0/O/1/I.
export const inviteCodeSchema = z
  .string({ required_error: "Informe o código do convite." })
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{10}$/, "Código inválido. Ele tem 10 caracteres.");

export const coupleNameSchema = z
  .string()
  .trim()
  .min(1, "Informe um nome para o casal.")
  .max(60, "O nome pode ter no máximo 60 caracteres.");

/** Traduz os códigos de erro das RPCs do banco para mensagens amigáveis. */
export function coupleErrorMessage(message: string | undefined): string {
  switch (true) {
    case message?.includes("already_in_couple"):
      return "Você já faz parte de um casal.";
    case message?.includes("invalid_invitation"):
      return "Convite inválido, expirado ou já utilizado.";
    case message?.includes("own_invitation"):
      return "Você não pode aceitar o convite que você mesmo criou.";
    case message?.includes("couple_full"):
      return "Este casal já está completo.";
    case message?.includes("forbidden"):
      return "Você não tem permissão para essa ação.";
    default:
      return "Não foi possível concluir a ação. Tente novamente.";
  }
}
