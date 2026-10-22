import { z } from "zod";
export const credentials = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(6).max(72)
});
export const registration = credentials.extend({ name: z.string().trim().min(1).max(100) });
