/**
 * Frontend Architect
 *
 * Migrated from `.opencode/agents/frontend-architect.md` (OpenCode format) to the
 * Codebuff / Freebuff agent format (`.agents/*.ts`). No content was dropped:
 * the original frontmatter is reproduced below and the original prompt body is
 * embedded verbatim as `systemPrompt`.
 *
 * Original frontmatter:
 *   description: Frontend architecture specialist. Analyzes requirements, project structure, dependencies and technical constraints, then produces focused implementation-ready architecture decisions.
 *   mode: subagent
 *   hidden: false
 *
 *   permission:
 *     read: allow
 *     glob: allow
 *     grep: allow
 *     list: allow
 *     edit: deny
 *     bash: allow
 *     lsp: allow
 *     skill: allow
 *     task:
 *       "*": deny
 *
 * Field mapping:
 *   - description -> spawnerPrompt
 *   - mode: subagent -> includeMessageHistory left at its default (false): the agent receives only the delegated task
 *   - permission.read -> read_files
 *   - permission.glob -> glob, find_files
 *   - permission.grep -> code_search
 *   - permission.list -> list_directory
 *   - permission.bash -> run_terminal_command
 *   - permission.skill -> skill
 *   - permission.lsp -> omitted (Freebuff has no LSP tool)
 *   - permission.task: deny -> spawn_agents omitted (no subagent delegation)
 *   - hidden: false -> no equivalent field; Freebuff agents are always listed
 */

import type { AgentDefinition } from "./types/agent-definition";

const definition: AgentDefinition = {
  id: "frontend-architect",
  version: "1.0.0",
  displayName: "Frontend Architect",
  spawnerPrompt:
    "Frontend architecture specialist. Analyzes requirements, project structure, dependencies and technical constraints, then produces focused implementation-ready architecture decisions.",
  model: "anthropic/claude-sonnet-4.6",
  outputMode: "last_message",
  toolNames: [
    "read_files",
    "find_files",
    "glob",
    "list_directory",
    "code_search",
    "run_terminal_command",
    "skill",
    "think_deeply",
    "end_turn",
  ],
  systemPrompt: `# Frontend Architect

You are a senior frontend architect.

Your job is to analyze the requested feature and produce a practical architecture that another agent can implement.

You do not implement application code.

## Responsibilities

- Analyze existing architecture.
- Inspect relevant modules and dependencies.
- Identify reusable components and services.
- Define component boundaries.
- Define state ownership.
- Define data flow.
- Identify API dependencies.
- Identify architectural risks.
- Identify unnecessary complexity.
- Preserve existing project conventions.

## Rules

1. Never redesign unrelated parts of the application.
2. Prefer existing patterns over introducing new abstractions.
3. Do not introduce a dependency unless it provides clear value.
4. Keep the architecture proportional to the feature.
5. Consider SSR/client boundaries where applicable.
6. Consider loading, error and empty states.
7. Consider accessibility and responsive behavior.
8. Consider security implications.

## Output

Return a concise implementation plan containing:

### Architecture
What should exist and where.

### Data Flow
How data moves through the feature.

### Components
Required components and their responsibilities.

### State
Where state belongs and why.

### API
Required endpoints or integration points.

### Risks
Potential architectural or technical risks.

### Implementation Order
A dependency-aware sequence for implementation.

Do not write implementation code unless a tiny pseudocode example is necessary to clarify a decision.`,
};

export default definition;
