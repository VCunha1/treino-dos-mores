import { describe, expect, it } from "vitest";
import { newPasswordSchema, signInSchema, signUpSchema } from "@/lib/validation/auth";
import { coupleErrorMessage, inviteCodeSchema } from "@/lib/validation/couple";
import { profileSchema } from "@/lib/validation/profile";

describe("validação de autenticação", () => {
  it("normaliza o e-mail e aceita um cadastro válido", () => {
    const r = signUpSchema.safeParse({
      displayName: " Ana ",
      email: " ANA@Exemplo.com ",
      password: "senha-forte-123",
      confirmPassword: "senha-forte-123",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("ana@exemplo.com");
      expect(r.data.displayName).toBe("Ana");
    }
  });

  it("rejeita senha curta, senhas diferentes e e-mail inválido", () => {
    expect(signUpSchema.safeParse({ displayName: "Ana", email: "ana@x.com", password: "123", confirmPassword: "123" }).success).toBe(false);
    expect(signUpSchema.safeParse({ displayName: "Ana", email: "ana@x.com", password: "12345678", confirmPassword: "87654321" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "nao-e-email", password: "x" }).success).toBe(false);
  });

  it("exige confirmação igual na nova senha", () => {
    expect(newPasswordSchema.safeParse({ password: "12345678", confirmPassword: "12345678" }).success).toBe(true);
    expect(newPasswordSchema.safeParse({ password: "12345678", confirmPassword: "outra-coisa" }).success).toBe(false);
  });
});

describe("validação de perfil", () => {
  const base = {
    displayName: "Bia",
    birthDate: "",
    heightCm: "",
    weightKg: "",
    trainingGoals: "",
    trainingPreferences: "",
    availableEquipment: "",
  };

  it("campos opcionais vazios viram null", () => {
    const r = profileSchema.parse(base);
    expect(r.heightCm).toBeNull();
    expect(r.birthDate).toBeNull();
    expect(r.trainingGoals).toBeNull();
  });

  it("aceita vírgula decimal e converte para número", () => {
    const r = profileSchema.parse({ ...base, heightCm: "170,5", weightKg: "62.3" });
    expect(r.heightCm).toBe(170.5);
    expect(r.weightKg).toBe(62.3);
  });

  it("rejeita valores fora do intervalo e datas futuras", () => {
    expect(profileSchema.safeParse({ ...base, heightCm: "999" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, weightKg: "abc" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, birthDate: "2999-01-01" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, displayName: "A" }).success).toBe(false);
  });
});

describe("convite", () => {
  it("aceita o código em minúsculas e normaliza", () => {
    const r = inviteCodeSchema.safeParse(" abcd234567 ");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("ABCD234567");
  });

  it("rejeita tamanho errado e caracteres ambíguos (0, O, 1, I)", () => {
    expect(inviteCodeSchema.safeParse("ABC").success).toBe(false);
    expect(inviteCodeSchema.safeParse("ABCD0O1I23").success).toBe(false);
  });

  it("traduz erros das RPCs", () => {
    expect(coupleErrorMessage("already_in_couple")).toMatch(/já faz parte/);
    expect(coupleErrorMessage("invalid_invitation")).toMatch(/inválido/);
    expect(coupleErrorMessage("algo inesperado")).toMatch(/Tente novamente/);
  });
});
