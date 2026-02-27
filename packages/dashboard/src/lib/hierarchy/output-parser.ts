/**
 * Parse structured JSON messages from Claude's text output.
 * Looks for fenced ```json blocks or <json> tags containing known message types.
 */

export interface DispatchPlan {
  type: "dispatch_plan";
  taskId: string;
  subtasks: Array<{
    role: string;
    title: string;
    prompt: string;
    deps: string[];
    priority: number;
  }>;
}

export interface TaskComplete {
  type: "task_complete";
  taskId: string;
  summary: string;
}

export interface SpawnEmployeeRequest {
  type: "spawn_employee";
  parentLeaderRole: string;
  task: string;
  role: string;
}

export type StructuredMessage = DispatchPlan | TaskComplete | SpawnEmployeeRequest;

const KNOWN_TYPES = new Set(["dispatch_plan", "task_complete", "spawn_employee"]);

/**
 * Extract all structured JSON messages from Claude's text output.
 * Supports ```json fenced blocks and <json> tags.
 */
export function parseStructuredOutput(text: string): StructuredMessage[] {
  const messages: StructuredMessage[] = [];

  // Match ```json ... ``` blocks
  const fencedPattern = /```json\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fencedPattern.exec(text)) !== null) {
    const parsed = tryParseMessage(match[1].trim());
    if (parsed) messages.push(parsed);
  }

  // Match <json>...</json> tags
  const tagPattern = /<json>([\s\S]*?)<\/json>/g;
  while ((match = tagPattern.exec(text)) !== null) {
    const parsed = tryParseMessage(match[1].trim());
    if (parsed) messages.push(parsed);
  }

  return messages;
}

function tryParseMessage(raw: string): StructuredMessage | null {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj.type === "string" && KNOWN_TYPES.has(obj.type)) {
      return obj as StructuredMessage;
    }
  } catch {
    // Not valid JSON, skip
  }
  return null;
}
