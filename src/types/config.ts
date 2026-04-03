import { z } from "zod";

const optionalNonEmptyString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().min(1).optional());

export const zentaoConfigSchema = z
  .object({
    baseUrl: z.string().url("baseUrl 必须是合法的 http/https 地址"),
    token: optionalNonEmptyString,
    account: optionalNonEmptyString,
    password: optionalNonEmptyString,
    timeoutMs: z.number().int().positive().max(120000).default(15000)
  })
  .superRefine((value, ctx) => {
    if (!value.token && !(value.account && value.password)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "必须提供 token，或同时提供 account 和 password"
      });
    }
  });

export type ZenTaoConfig = z.infer<typeof zentaoConfigSchema>;
