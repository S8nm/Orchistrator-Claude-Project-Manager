<<<<<<< C:/Users/PC/Desktop/Claude/packages/cli/src/registry.ts
import { readFileSync, writeFileSync } from "fs";
import { RegistrySchema } from "@orchestrator/shared";
import type { Project, ProjectRegistry } from "@orchestrator/shared";

export class Registry {
  constructor(private registryPath: string) {}

  load(): ProjectRegistry {
    const raw = readFileSync(this.registryPath, "utf-8");
    return RegistrySchema.parse(JSON.parse(raw));
  }

  private save(data: ProjectRegistry): void {
    writeFileSync(this.registryPath, JSON.stringify(data, null, 2));
  }

  addProject(project: Omit<Project, "remote"> & { remote?: string }): void {
    const data = this.load();
    if (data.projects.some((p) => p.id === project.id)) {
      throw new Error(`Project "${project.id}" already exists`);
    }
    data.projects.push(project as Project);
    this.save(data);
  }

  removeProject(id: string): void {
    const data = this.load();
    data.projects = data.projects.filter((p) => p.id !== id);
    this.save(data);
  }

  getProject(id: string): Project | undefined {
    return this.load().projects.find((p) => p.id === id);
  }

  listProjects(filter?: { tag?: string; status?: string }): Project[] {
    let projects = this.load().projects;
    if (filter?.tag) {
      projects = projects.filter((p) => p.tags.includes(filter.tag!));
    }
    if (filter?.status) {
      projects = projects.filter((p) => p.status === filter.status);
    }
    return projects;
  }

  addLocation(location: string): void {
    const data = this.load();
    if (!data.locations.includes(location)) {
      data.locations.push(location);
      this.save(data);
    }
  }
}
=======
import { readFileSync, writeFileSync } from "fs";
import { RegistrySchema } from "@orchestrator/shared";
import type { Project, ProjectRegistry } from "@orchestrator/shared";

export class Registry {
  constructor(private registryPath: string) {}

  load(): ProjectRegistry {
    const raw = readFileSync(this.registryPath, "utf-8");
    return RegistrySchema.parse(JSON.parse(raw));
  }

  private save(data: ProjectRegistry): void {
    writeFileSync(this.registryPath, JSON.stringify(data, null, 2));
  }

  addProject(project: Omit<Project, "remote"> & { remote?: string }): void {
    const data = this.load();
    if (data.projects.some((p: Project) => p.id === project.id)) {
      throw new Error(`Project "${project.id}" already exists`);
    }
    data.projects.push(project as Project);
    this.save(data);
  }

  removeProject(id: string): void {
    const data = this.load();
    data.projects = data.projects.filter((p: Project) => p.id !== id);
    this.save(data);
  }

  getProject(id: string): Project | undefined {
    return this.load().projects.find((p: Project) => p.id === id);
  }

  listProjects(filter?: { tag?: string; status?: string }): Project[] {
    let projects = this.load().projects;
    if (filter?.tag) {
      projects = projects.filter((p: Project) => p.tags.includes(filter.tag!));
    }
    if (filter?.status) {
      projects = projects.filter((p: Project) => p.status === filter.status);
    }
    return projects;
  }

  addLocation(location: string): void {
    const data = this.load();
    if (!data.locations.includes(location)) {
      data.locations.push(location);
      this.save(data);
    }
  }
}
>>>>>>> C:/Users/PC/.windsurf/worktrees/Claude/Claude-443cfaf1/packages/cli/src/registry.ts
