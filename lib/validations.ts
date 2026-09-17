import { z } from "zod";

export const searchFormSchema = z.object({
  address: z
    .string()
    .min(5, "Address must be at least 5 characters")
    .max(200, "Address is too long")
    .regex(/[a-zA-Z]/, "Address must contain letters"),
  radius: z
    .number()
    .min(1, "Radius must be at least 1 mile")
    .max(50, "Radius cannot exceed 50 miles"),
  competitorCount: z
    .number()
    .min(1, "Must analyze at least 1 competitor")
    .max(50, "Cannot analyze more than 50 competitors"),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export type SearchFormData = z.infer<typeof searchFormSchema>;

