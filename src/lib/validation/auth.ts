import { z } from "zod";

const email = z
  .string({ required_error: "Informe o e-mail." })
  .trim()
  .toLowerCase()
  .email("E-mail inválido.");

const password = z
  .string({ required_error: "Informe a senha." })
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(72, "A senha pode ter no máximo 72 caracteres.");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Informe a senha."),
});

export const signUpSchema = z
  .object({
    displayName: z
      .string({ required_error: "Informe seu nome." })
      .trim()
      .min(2, "O nome precisa ter pelo menos 2 caracteres.")
      .max(60, "O nome pode ter no máximo 60 caracteres."),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "As senhas não conferem.",
    path: ["confirmPassword"],
  });

export const resetRequestSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: "As senhas não conferem.",
    path: ["confirmPassword"],
  });
