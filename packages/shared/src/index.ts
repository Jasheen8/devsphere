import { z } from 'zod';

export const FeatureFlags = z.object({
  enablePuzzleReveal: z.boolean().default(true),
  enableGiftBox: z.boolean().default(true),
  enableCustomDomains: z.boolean().default(false),
  enableVideoUploads: z.boolean().default(true),
  enableSubscriptions: z.boolean().default(false)
});

export const SectionSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  title: z.string().optional(),
  enabled: z.boolean().default(true),
  props: z.record(z.unknown()).default({})
});

export const FieldSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['text','longText','date','number','email','image','images','video','audio','color','font','select','radio','checkbox','repeater','timeline']),
  label: z.string().min(1),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  defaultValue: z.unknown().optional(),
  options: z.array(z.object({label:z.string(),value:z.string()})).optional(),
  validation: z.record(z.unknown()).optional(),
  itemFields: z.array(z.lazy(()=>FieldSchema)).optional()
});

export const TemplateSchema = z.object({
  sections: z.array(SectionSchema),
  fields: z.array(FieldSchema),
  customization: z.object({colors:z.boolean(),fonts:z.boolean(),animations:z.boolean(),music:z.boolean(),backgrounds:z.boolean()}).default({colors:true,fonts:true,animations:true,music:true,backgrounds:true})
});

export type TemplateDefinition = z.infer<typeof TemplateSchema>;
export type ProjectData = Record<string, unknown>;
export type RevealMethod = 'NORMAL'|'QR'|'PIN'|'LETTER'|'GIFT'|'PUZZLE';
