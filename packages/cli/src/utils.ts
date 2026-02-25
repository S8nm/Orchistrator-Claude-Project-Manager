import { resolve } from "path";
import { existsSync } from "fs";

export function findRegistryPath(): string {
  let dir = process.cwd();
  while (dir) {
    const candidate = resolve(dir, "projects.json");
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd(), "projects.json");
}
