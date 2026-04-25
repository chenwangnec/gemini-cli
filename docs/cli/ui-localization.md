# UI Localization

> **Added in:** Preview release **Related:** [HUD Dashboard](hud-dashboard.md),
> [Settings](settings.md), [Global Language](language.md)

Gemini CLI supports localized UI strings for terminal output, dialogs, and
status displays.

## Supported Languages

| Language       | Code | Coverage      |
| -------------- | ---- | ------------- |
| English        | `en` | Full (source) |
| 中文 (Chinese) | `zh` | Full          |

## Localized Components

### Thinking and Loading Phrases

Model thinking states and loading indicators are translated:

| Context    | English    | 中文   |
| ---------- | ---------- | ------ |
| Thinking   | Thinking   | 思考中 |
| Working    | Working    | 工作中 |
| Loading    | Loading    | 加载中 |
| Waiting    | Waiting    | 等待中 |
| Processing | Processing | 处理中 |

### HUD Footer Labels

All HUD dashboard labels are localized:

| English     | 中文         |
| ----------- | ------------ |
| Output      | 输出         |
| Cost        | 费用         |
| Context     | 上下文       |
| Memory      | 内存         |
| Calls       | 调用         |
| Today       | 今日         |
| Files       | 文件         |
| Tokens      | Tokens       |
| In          | 进           |
| Out         | 出           |
| Cache       | 缓存         |
| Hit rate    | 命中率       |
| Model usage | 模型使用情况 |
| Resets      | 重置         |

### Model Stats Bar Labels

Real-time model stats below the input prompt:

| English          | 中文          |
| ---------------- | ------------- |
| No API calls yet | 暂无 API 调用 |
| req              | 次            |
| err              | 错误          |
| tokens           | 令牌          |
| total            | 总计          |
| in               | 输入          |
| out              | 输出          |
| cache            | 缓存          |
| thought          | 推理          |
| tool             | 工具          |
| speed            | 速度          |

### Stats Display Labels

Session statistics panel labels:

| English             | 中文           |
| ------------------- | -------------- |
| Session Stats       | 会话统计       |
| Interaction Summary | 互动摘要       |
| Session ID          | 会话 ID        |
| Auth Method         | 认证方式       |
| Tier                | 账号层级       |
| Google AI Credits   | Google AI 积分 |
| Tool Calls          | 工具调用       |
| Success Rate        | 成功率         |
| User Agreement      | 用户一致性     |
| Code Changes        | 代码变更       |
| Performance         | 性能指标       |
| Wall Time           | 实际用时       |
| Agent Active        | 代理活跃时长   |
| API Time            | API 耗时       |
| Tool Time           | 工具耗时       |
| Model Usage         | 模型使用情况   |

### Model Stats Display

Detailed per-model statistics labels:

| English         | 中文     |
| --------------- | -------- |
| Stats For Nerds | 详细统计 |
| Requests        | 请求数   |
| Errors          | 错误数   |
| Avg Latency     | 平均延迟 |
| Input           | 输入     |
| Output          | 输出     |
| Cache Reads     | 缓存读取 |
| Thoughts        | 推理     |
| Tool            | 工具     |
| Roles           | 角色     |

### Settings Dialog

The `/settings` dialog labels are localized. See
[Settings Localization](settings-localization.md) for details.

### Model Dialog

The `/model` selection dialog options and descriptions are translated for
supported languages.

## Configuration

Set the UI language via the global language setting:

```json
{
  "general": {
    "language": "zh"
  }
}
```

Or use the HUD-specific override:

```json
{
  "ui": {
    "footer": {
      "hud": {
        "language": "zh"
      }
    }
  }
}
```

## Translation Architecture

Localized strings are defined inline within each component file using a
`TRANSLATIONS` record:

```typescript
const TRANSLATIONS: Record<string, TranslationSet> = {
  en: {
    /* English strings */
  },
  zh: {
    /* Chinese strings */
  },
};
```

Components select the active translation set based on the configured language:

```typescript
const lang = settings.merged.general?.language || 'zh';
const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];
const gt = (key: keyof typeof t) => t[key];
```

This approach keeps translations close to the components they belong to, making
it easy to add new strings when modifying UI components.

## Adding a New Language

To add support for a new language:

1. Add the language code to all `TRANSLATIONS` records in the relevant component
   files
2. Update the `language` setting type definitions to include the new code
3. Test the UI with the new language selected
