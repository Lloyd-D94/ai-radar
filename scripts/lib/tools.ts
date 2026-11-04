import type { Priority, ToolInfo } from "./types.ts";

export const TOOLS: ToolInfo[] = [
  { id: "grok-build", label: "Grok Build", priority: "primair" },
  { id: "grok-bot", label: "Grok Bot", priority: "primair" },
  { id: "xai-api", label: "xAI API", priority: "secundair" },
  { id: "xai", label: "xAI", priority: "secundair" },
  { id: "cursor", label: "Cursor", priority: "secundair" },
  { id: "claude-code", label: "Claude Code", priority: "secundair" },
  { id: "codex", label: "Codex", priority: "secundair" },
  { id: "gemini-cli", label: "Gemini CLI", priority: "secundair" },
  { id: "copilot", label: "GitHub Copilot", priority: "secundair" },
  { id: "openai", label: "OpenAI", priority: "secundair" },
  { id: "lovable", label: "Lovable", priority: "secundair" },
  { id: "replit", label: "Replit", priority: "secundair" },
  { id: "hacker-news", label: "Hacker News", priority: "community" },
  { id: "simon-willison", label: "Simon Willison", priority: "community" },
];

const LABELS = new Map(TOOLS.map((tool) => [tool.id, tool.label]));

export function toolLabel(tool: string): string {
  return LABELS.get(tool) ?? tool;
}

export function priorityOfTool(tool: string, fallback: Priority): Priority {
  return TOOLS.find((item) => item.id === tool)?.priority ?? fallback;
}
