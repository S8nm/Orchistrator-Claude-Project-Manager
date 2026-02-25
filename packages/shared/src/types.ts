export interface Project {
  id: string;
  name: string;
  path: string;
  type: string;
  stack: string[];
  remote?: string;
  status: "active" | "archived" | "paused";
  tags: string[];
  commands: Record<string, string>;
}

export interface ProjectRegistry {
  projects: Project[];
  locations: string[];
}

export interface TaskDispatch {
  task: string;
  projectId?: string;
  tags?: string[];
}

export interface ProjectStatus {
  id: string;
  name: string;
  gitBranch?: string;
  gitDirty?: boolean;
  lastCommit?: string;
  lastCommitDate?: string;
  exists: boolean;
}
