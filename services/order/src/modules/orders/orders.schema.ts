import { z } from "zod";

export const createOrderSchema = z.object({
  userId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});