# Cursor Project Rules for food-ordering-agent

This directory contains project-specific rules for Cursor AI, following best practices for maintainability, clarity, and automation. Rules here guide the AI agent and Cmd-K workflows, ensuring consistent behavior and standards across the codebase.

## Structure

- Each rule is a `.mdc` file with YAML frontmatter and actionable content.
- Rules are grouped by domain in subfolders (e.g., `core-rules`, `ts-rules`, `tool-rules`, `testing-rules`, `ui-rules`).
- Use the `@` symbol to reference files or templates in rules.

## Rule Types

- **Always**: Always included in context (`alwaysApply: true`).
- **Auto-Attach**: Included when files matching a glob are referenced (`globs: ...`).
- **Agent**: Available to the agent for context, not auto-attached (`description: ...`).
- **Manual**: Only included when explicitly referenced.

## Best Practices

- Keep rules concise and focused (prefer < 500 lines).
- Use actionable, clear language.
- Provide examples of valid and invalid applications.
- Reference templates or best practices docs with `@filename`.
- Organize rules in subfolders by domain or technology.
- Update or prune rules as the codebase evolves.

## Adding a Rule

1. Use `Cmd+Shift+P > New Cursor Rule` or add a `.mdc` file here.
2. Follow the template below:

```mdc
---
description: Short, clear context for when this rule applies
globs: src/**/*.ts, test/**/*.ts
alwaysApply: false
---

# Rule Title

## Critical Rules
- List actionable rules the agent must follow

## Examples
<example>
  {valid rule application}
</example>
<example type="invalid">
  {invalid rule application}
</example>
```

## Example Folders
- `.cursor/rules/core-rules/` – agent and rule system behavior
- `.cursor/rules/ts-rules/` – TypeScript standards
- `.cursor/rules/testing-rules/` – testing conventions
- `.cursor/rules/tool-rules/` – tool usage (e.g., pnpm, Fastify)
- `.cursor/rules/ui-rules/` – UI/Chainlit/React rules

For more, see [Cursor Rules Documentation](https://docs.cursor.com/context/rules). 