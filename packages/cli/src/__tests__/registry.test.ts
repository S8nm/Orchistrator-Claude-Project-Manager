import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Registry } from "../registry.js";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("Registry", () => {
  let testDir: string;
  let registryPath: string;
  let registry: Registry;

  beforeEach(() => {
    testDir = join(tmpdir(), `orch-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    registryPath = join(testDir, "projects.json");
    writeFileSync(registryPath, JSON.stringify({ projects: [], locations: [] }));
    registry = new Registry(registryPath);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("loads an empty registry", () => {
    const data = registry.load();
    expect(data.projects).toEqual([]);
    expect(data.locations).toEqual([]);
  });

  it("adds a project", () => {
    registry.addProject({
      id: "test-proj",
      name: "Test Project",
      path: "/tmp/test",
      type: "web-app",
      stack: ["typescript"],
      status: "active",
      tags: [],
      commands: {},
    });
    const data = registry.load();
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].id).toBe("test-proj");
  });

  it("removes a project by id", () => {
    registry.addProject({
      id: "to-remove",
      name: "Remove Me",
      path: "/tmp/remove",
      type: "cli",
      stack: [],
      status: "active",
      tags: [],
      commands: {},
    });
    registry.removeProject("to-remove");
    const data = registry.load();
    expect(data.projects).toHaveLength(0);
  });

  it("lists projects filtered by tag", () => {
    registry.addProject({
      id: "frontend",
      name: "Frontend",
      path: "/tmp/fe",
      type: "web-app",
      stack: [],
      status: "active",
      tags: ["frontend"],
      commands: {},
    });
    registry.addProject({
      id: "backend",
      name: "Backend",
      path: "/tmp/be",
      type: "api",
      stack: [],
      status: "active",
      tags: ["backend"],
      commands: {},
    });
    const filtered = registry.listProjects({ tag: "frontend" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("frontend");
  });

  it("prevents duplicate project ids", () => {
    const proj = {
      id: "dupe",
      name: "Dupe",
      path: "/tmp/dupe",
      type: "app",
      stack: [],
      status: "active" as const,
      tags: [],
      commands: {},
    };
    registry.addProject(proj);
    expect(() => registry.addProject(proj)).toThrow("already exists");
  });
});
