# Global Language Setting

> **Added in:** Preview release **Related:** [Settings](settings.md),
> [UI Localization](ui-localization.md),
> [Settings Localization](settings-localization.md)

Set a global language to control the display language for all Gemini CLI UI
components, model reasoning output, and configuration dialogs.

## Quick Start

Add to your `settings.json`:

```json
{
  "general": {
    "language": "zh"
  }
}
```

## Supported Values

| Value  | Language       | Notes                            |
| ------ | -------------- | -------------------------------- |
| `"en"` | English        | Default, source language         |
| `"zh"` | 中文 (Chinese) | Full UI + reasoning localization |

## What Gets Localized

The `general.language` setting affects:

### 1. UI Components

All interactive UI elements use translated labels:

- **Footer HUD** — Status bar labels (output, cost, context, memory, calls,
  etc.)
- **Stats Display** — `/stats` command panel
- **Model Stats** — Per-model token and API statistics
- **Settings Dialog** — `/settings` command categories, labels, and descriptions
- **Model Dialog** — `/model` selection panel options
- **Thinking Phrases** — Model state indicators (thinking, working, loading)

### 2. Model Reasoning

When supported models are active, their reasoning output and contextual messages
are delivered in the configured language. This includes:

- System-level prompts that guide model behavior
- Tool descriptions presented to the model
- Status and progress messages shown during task execution

### 3. System Messages

Auto-generated messages from Gemini CLI (e.g., session start, checkpoint
created, tool execution results) are translated.

## Configuration Levels

The language setting can be set at multiple levels:

| Level     | Path                      | Scope                |
| --------- | ------------------------- | -------------------- |
| User      | `~/.gemini/settings.json` | All projects         |
| Workspace | `.gemini/settings.json`   | Current project only |

Workspace settings override user settings.

## Fallback Behavior

If a string is not available in the configured language, the system falls back
to English. This ensures the UI always renders correctly, even if some
components have not been fully translated yet.

```typescript
const t = TRANSLATIONS[language] || TRANSLATIONS['en'];
// Individual missing keys also fall back:
const label = t.specificKey || TRANSLATIONS['en'].specificKey;
```

## Interaction with HUD Language Setting

The HUD dashboard has its own `language` setting at `ui.footer.hud.language`. If
both are specified:

- `ui.footer.hud.language` takes precedence for the HUD footer only
- `general.language` controls all other UI components

If only `general.language` is set, the HUD uses that value.

## Model Reasoning Localization

The deep localization feature goes beyond simple UI string translation. It
affects how models reason about and discuss code:

1. **Tool Descriptions** — When tools are registered, their names and
   descriptions are presented to the model in the configured language, enabling
   the model to reference them naturally in its responses.

2. **System Prompts** — Contextual instructions sent to the model are
   translated, ensuring the model's internal reasoning aligns with the user's
   language.

3. **Status Messages** — Progress updates, error descriptions, and completion
   messages are localized for better readability.

This creates a cohesive experience where both the terminal UI and the model's
communication are in the same language.

## Example Configuration

Full user settings with Chinese language:

```json
{
  "general": {
    "language": "zh",
    "vimMode": false,
    "defaultApprovalMode": "default"
  },
  "ui": {
    "footer": {
      "hud": {
        "enabled": true
      }
    }
  }
}
```

With this configuration, the HUD footer, stats display, settings dialog, model
selection, and all system messages will appear in Chinese.
