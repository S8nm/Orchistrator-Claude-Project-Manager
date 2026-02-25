import { z } from "zod";

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  path: z.string().default(""),
  type: z.string().default("unknown"),
  stack: z.array(z.string()).default([]),
  remote: z.string().optional(),
  status: z.enum(["active", "archived", "paused"]).default("active"),
  tags: z.array(z.string()).default([]),
  commands: z.record(z.string()).default({}),
});

export const RegistrySchema = z.object({
  projects: z.array(ProjectSchema).default([]),
  locations: z.array(z.string()).default([]),
});
