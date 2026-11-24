export function jointErrorMessage(message: string | undefined): string {
  const m = message ?? "";
  if (m.includes("no_couple")) return "Vincule sua conta a um casal para treinar junto.";
  if (m.includes("no_partner")) return "Seu casal ainda não tem a outra pessoa. Envie o convite primeiro.";
  if (m.includes("joint_open_exists") || m.includes("joint_sessions_one_open"))
    return "Já existe um treino em conjunto aberto para vocês.";
  if (m.includes("joint_not_waiting")) return "Esse convite não está mais disponível.";
  if (m.includes("cannot_join_own")) return "Você criou este convite; é a outra pessoa quem entra.";
  if (m.includes("session_in_progress"))
    return "Você já tem um treino em andamento. Finalize ou descarte antes de treinar junto.";
  if (m.includes("empty_day")) return "Este dia ainda não tem exercícios. Adicione ao menos um para treinar.";
  if (m.includes("forbidden") || m.includes("row-level security")) return "Você não tem permissão para essa ação.";
  return "Não foi possível concluir a ação. Tente novamente.";
}
