# Native HUD Dashboard

> **Added in:** Preview release **Related:** [Themes](themes.md),
> [Settings](settings.md)

The HUD (Heads-Up Display) dashboard provides real-time visibility into model
performance, resource usage, and session metrics directly in the terminal footer
and stats panels.

## Overview

The HUD dashboard consists of three layers of information:

1. **Footer HUD** — Persistent, always-visible metrics at the bottom of the
   terminal
2. **Model Stats Display** — Detailed session statistics via `/stats` command
3. **Model Stats For Nerds** — Per-model token and API breakdown

## Footer HUD

The footer displays a compact three-line dashboard:

```
[gemini-3-flash-preview] │ workspace git(main*) │ 输出: 123.4 tok/s │ ⏱️  <1m │ 费用 $3.9925
上下文 ░░░░░ 9% (93.4k/1.0M) │ 内存 █░░░░ 535 MB │ 调用 █████ 12次 (今日: 16) │ 1 文件
Tokens 3.1m (进: 3.1m, 出: 36.2k, 缓存: 2.1m, 命中率: 67.6%)
```

### Line 1: Real-time Status

| Element       | Description                                                               |
| ------------- | ------------------------------------------------------------------------- |
| Model display | Current active model with routing indicator (e.g., `auto ➜ gemini-3-pro`) |
| Workspace     | Current directory name and git branch                                     |
| Speed (tok/s) | Real-time streaming token speed, sticky for 5s after response ends        |
| Duration      | Estimated response time                                                   |
| Cost          | Estimated session cost based on token pricing                             |

### Line 2: Resource Monitoring

| Element | Description                                                      |
| ------- | ---------------------------------------------------------------- |
| Context | Context window usage with progress bar (percentage and absolute) |
| Memory  | Node.js process RSS memory usage                                 |
| Calls   | Session prompt count with daily call tracking                    |
| Files   | Number of referenced context files                               |

### Line 3: Token Breakdown

| Element       | Description                            |
| ------------- | -------------------------------------- |
| Total tokens  | Cumulative input + output tokens       |
| Input tokens  | Prompt tokens sent to the model        |
| Output tokens | Candidate tokens returned by the model |
| Cache tokens  | Tokens served from context cache       |
| Hit rate      | Cache hit percentage                   |

## Model usage section

Below the three-line footer, a **Model Usage** section shows quota consumption
for each tier (Pro, Flash, Flash Lite) with progress bars and reset times:

```
─────────────────────────────────────────────
模型使用情况
Pro         ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬    0%    重置: 4:54 PM (23h 56m)
Flash       ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬     7%    重置: 6:48 PM (1h 50m)
Flash Lite  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬     2%    重置: 6:48 PM (1h 50m)
```

## Session Stats Display

Run `/stats` to open the full session statistics panel:

- **Interaction Summary** — Session ID, auth method, tier, tool calls, success
  rate, user agreement rate, code changes
- **Performance** — Wall time, agent active time, API time, tool time
- **Model Usage Table** — Per-model request counts, token breakdown, cache reads

## Configuration

The HUD is enabled by default. Configure it in `settings.json`:

```json
{
  "ui": {
    "footer": {
      "hud": {
        "enabled": true,
        "language": "zh"
      }
    }
  }
}
```

| Setting    | Type           | Default | Description                     |
| ---------- | -------------- | ------- | ------------------------------- |
| `enabled`  | `boolean`      | `true`  | Show or hide the HUD footer     |
| `language` | `"en" \| "zh"` | `"zh"`  | Display language for HUD labels |

## Context Limits by Model

| Model                                              | Context Limit |
| -------------------------------------------------- | ------------- |
| gemini-3.1-pro, gemini-3-pro, gemini-2.5-pro       | 2,000,000     |
| gemini-3.1-flash, gemini-3-flash, gemini-2.5-flash | 1,000,000     |
| gemini-2.5-flash-lite, gemini-3.1-flash-lite       | 1,000,000     |

The HUD automatically detects the active model and adjusts the context progress
bar accordingly.

## Daily Call Tracking

The HUD tracks daily API calls in `~/.gemini/daily_hud_stats.json`. This file
stores the current date and call count, resetting automatically at midnight.
