# Settings Localization

> **Added in:** Preview release **Related:** [Settings](settings.md),
> [UI Localization](ui-localization.md)

The `/settings` dialog and common setting metadata are fully localized. This
ensures users can configure Gemini CLI in their preferred language.

## Localized Setting Categories

The settings dialog categories are translated:

| English               | 中文       |
| --------------------- | ---------- |
| General               | 通用       |
| Output                | 输出       |
| UI                    | 界面       |
| Accessibility         | 辅助功能   |
| Security & Sandboxing | 安全与沙箱 |
| Commands              | 命令       |
| Context               | 上下文     |
| Models                | 模型       |
| Memory                | 内存       |
| Notifications         | 通知       |

## Localized Setting Labels

Each setting's UI label and description are translated. Key examples:

### General Settings

| English Label                | 中文 Label           |
| ---------------------------- | -------------------- |
| Vim Mode                     | Vim 模式             |
| Default Approval Mode        | 默认审批模式         |
| Enable Auto Update           | 启用自动更新         |
| Terminal Notification Method | 终端通知方式         |
| Plan Mode                    | 规划模式             |
| Plan Directory               | 规划目录             |
| Plan Model Routing           | 规划模型路由         |
| Max Chat Model Attempts      | 最大聊天模型尝试次数 |

### UI Settings

| English Label          | 中文 Label       |
| ---------------------- | ---------------- |
| Auto Theme Switching   | 自动主题切换     |
| Inline Thinking        | 内联思考         |
| Show Thoughts in Title | 在标题中显示思考 |
| Dynamic Window Title   | 动态窗口标题     |
| Compact Tool Output    | 紧凑工具输出     |
| Hide Banner            | 隐藏横幅         |
| Show Memory Usage      | 显示内存使用     |
| Show Line Numbers      | 显示行号         |
| Show Citations         | 显示引用         |

### Security Settings

| English Label                   | 中文 Label       |
| ------------------------------- | ---------------- |
| Enable Sandboxed Code Execution | 启用沙箱代码执行 |
| Sandbox Provider                | 沙箱提供商       |
| Sandbox Image                   | 沙箱镜像         |

## Description Translations

Setting descriptions explain what each option does. These are translated
alongside labels so users understand the impact of each setting:

| Setting               | English Description                                                                   | 中文 Description               |
| --------------------- | ------------------------------------------------------------------------------------- | ------------------------------ |
| Vim Mode              | Enable Vim keybindings                                                                | 启用 Vim 键绑定                |
| Default Approval Mode | The default approval mode for tool execution                                          | 工具执行的默认审批模式         |
| Enable Auto Update    | Enable automatic updates                                                              | 启用自动更新                   |
| Plan Mode             | Enable Plan Mode for read-only safety during planning                                 | 启用规划模式的只读安全保护     |
| Auto Theme Switching  | Automatically switch between light and dark themes based on terminal background color | 根据终端背景色自动切换明暗主题 |

## Metadata Structure

Settings are defined with metadata objects that include localized strings:

```typescript
interface SettingMetadata {
  label: string; // Translated label
  description: string; // Translated description
  setting: string; // JSON config key
  // ... other fields
}
```

The settings dialog renders these metadata objects dynamically, so adding a new
language only requires providing the translated metadata set.

## Configuration

The settings dialog language follows the global language setting:

```json
{
  "general": {
    "language": "zh"
  }
}
```

## Model Routing Dialog

The `/model` dialog (model selection panel) is also localized:

| English                  | 中文                      |
| ------------------------ | ------------------------- |
| Select a model           | 选择模型                  |
| Pro                      | Pro                       |
| Flash                    | Flash                     |
| Flash Lite               | Flash Lite                |
| Auto (recommended)       | 自动 (推荐)               |
| Use Gemini API           | 使用 Gemini API           |
| Use Google AI Studio API | 使用 Google AI Studio API |

## Troubleshooting

**Labels appear in English despite Chinese setting:** Ensure `language` is set
to `"zh"` in your `settings.json`. Check both user settings
(`~/.gemini/settings.json`) and workspace settings (`.gemini/settings.json`).

**Newly added settings not translated:** When adding new settings, update the
metadata with both `en` and `zh` translations in the setting definition.
