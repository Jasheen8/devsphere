import { z } from "zod";

/* =========================================================
   RECURSIVE FIELD TYPE
   ========================================================= */

export type FieldSchemaType = {
  id: string;

  type: string;

  label?: string;

  required?: boolean;

  placeholder?: string;

  maxItems?: number;

  itemFields?:
    FieldSchemaType[];
};



/* =========================================================
   RECURSIVE FIELD SCHEMA
   ========================================================= */

export const FieldSchema:
  z.ZodType<FieldSchemaType> =
  z.lazy(() =>
    z.object({
      id:
        z.string(),

      type:
        z.string(),

      label:
        z.string()
          .optional(),

      required:
        z.boolean()
          .optional(),

      placeholder:
        z.string()
          .optional(),

      maxItems:
        z.number()
          .optional(),

      itemFields:
        z.array(
          FieldSchema,
        )
          .optional(),
    }),
  );

/* =========================================================
   TEMPLATE SCHEMA
   ========================================================= */

export const TemplateSchema = z.object({
  fields: z.array(FieldSchema),

  sections: z.array(
    z.record(z.unknown()),
  ),

  customization: z
    .object({
      colors: z.boolean().optional(),
      fonts: z.boolean().optional(),
      animations: z.boolean().optional(),
      music: z.boolean().optional(),
      backgrounds: z.boolean().optional(),
    })
    .optional(),
});