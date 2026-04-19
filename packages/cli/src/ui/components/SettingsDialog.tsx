/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import type React from 'react';
import { Text } from 'ink';
import { AsyncFzf } from 'fzf';
import { type Key } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import {
  SettingScope,
  type LoadableSettingScope,
  type Settings,
} from '../../config/settings.js';
import { getScopeMessageForSetting } from '../../utils/dialogScopeUtils.js';
import {
  getDialogSettingKeys,
  getDisplayValue,
  getSettingDefinition,
  getDialogRestartRequiredSettings,
  getEffectiveValue,
  isInSettingsScope,
  getEditValue,
  parseEditedValue,
} from '../../utils/settingsUtils.js';
import {
  useSettingsStore,
  type SettingsState,
} from '../contexts/SettingsContext.js';
import { getCachedStringWidth } from '../utils/textUtils.js';
import {
  type SettingsType,
  type SettingsValue,
  TOGGLE_TYPES,
} from '../../config/settingsSchema.js';
import { debugLogger } from '@google/gemini-cli-core';

import { useSearchBuffer } from '../hooks/useSearchBuffer.js';
import {
  BaseSettingsDialog,
  type SettingsDialogItem,
} from './shared/BaseSettingsDialog.js';
import { useKeyMatchers } from '../hooks/useKeyMatchers.js';
import { Command, KeyBinding } from '../key/keyBindings.js';

interface FzfResult {
  item: string;
  start: number;
  end: number;
  score: number;
  positions?: number[];
}

interface SettingsDialogProps {
  onSelect: (settingName: string | undefined, scope: SettingScope) => void;
  onRestartRequest?: () => void;
  availableTerminalHeight?: number;
}

const MAX_ITEMS_TO_SHOW = 8;

const KEY_UP = new KeyBinding('up');
const KEY_CTRL_P = new KeyBinding('ctrl+p');
const KEY_DOWN = new KeyBinding('down');
const KEY_CTRL_N = new KeyBinding('ctrl+n');

// --- Detailed Settings Translations ---
const SETTINGS_ZH: Record<string, { label: string; description?: string; options?: Record<string | number, string> }> = {
  'general.vimMode': { label: 'Vim 模式', description: '启用 Vim 快捷键绑定' },
  'general.defaultApprovalMode': { 
    label: '默认审批模式', 
    description: '工具执行的默认审批策略',
    options: { 'default': '默认 (询问)', 'auto_edit': '自动修改', 'plan': '规划模式 (只读)' }
  },
  'ui.theme': { label: '界面主题', description: 'CLI 的颜色主题' },
  'ui.footer.hud.enabled': { label: '开启 HUD 仪表盘', description: '启用多行实时监控状态栏' },
  'ui.footer.hud.language': { 
    label: '界面语言', 
    description: '设置 HUD 和系统文本语言',
    options: { 'en': 'English', 'zh': '简体中文' }
  },
  'ui.footer.hideCWD': { label: '隐藏工作路径', description: '在页脚隐藏当前目录路径' },
  'ui.footer.hideModelInfo': { label: '隐藏模型信息', description: '在页脚隐藏模型名称和上下文' },
  'ui.showLineNumbers': { label: '显示行号', description: '在渲染代码块时显示行号' },
  'model.name': { label: '对话模型', description: '设置默认使用的 Gemini 模型' },
  'model.compressionThreshold': { label: '上下文压缩阈值', description: '触发上下文压缩的使用率比例' },
  'context.discoveryMaxDirs': { label: '最大搜索目录深度', description: '搜索 GEMINI.md 文件的最大目录数' },
  'tools.useRipgrep': { label: '使用 Ripgrep', description: '使用 ripgrep 提高文件搜索速度' },
  'security.folderTrust.enabled': { label: '文件夹信任管理', description: '启用或禁用文件夹信任检查' },
  'advanced.autoConfigureMemory': { label: '自动配置内存上限', description: '自动根据系统配置 Node.js 内存限制' },
};

function getActiveRestartRequiredSettings(
  settings: SettingsState,
): Map<string, Map<string, string>> {
  const snapshot = new Map<string, Map<string, string>>();
  const scopes: Array<[string, Settings]> = [
    ['User', settings.user.settings],
    ['Workspace', settings.workspace.settings],
    ['System', settings.system.settings],
  ];

  for (const key of getDialogRestartRequiredSettings()) {
    const scopeMap = new Map<string, string>();
    for (const [scopeName, scopeSettings] of scopes) {
      const value = isInSettingsScope(key, scopeSettings)
        ? getEffectiveValue(key, scopeSettings)
        : undefined;
      scopeMap.set(scopeName, JSON.stringify(value));
    }
    snapshot.set(key, scopeMap);
  }
  return snapshot;
}

export function SettingsDialog({
  onSelect,
  onRestartRequest,
  availableTerminalHeight,
}: SettingsDialogProps): React.JSX.Element {
  const { settings, setSetting } = useSettingsStore();
  const [selectedScope, setSelectedScope] = useState<LoadableSettingScope>(SettingScope.User);

  // @ts-ignore
  const hudLang = settings.merged.ui?.footer?.hud?.language || 'en';

  const [activeRestartRequiredSettings] = useState(() =>
    getActiveRestartRequiredSettings(settings),
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [filteredKeys, setFilteredKeys] = useState<string[]>(() =>
    getDialogSettingKeys(),
  );

  const { fzfInstance, searchMap } = useMemo(() => {
    const keys = getDialogSettingKeys();
    const map = new Map<string, string>();
    const searchItems: string[] = [];

    keys.forEach((key) => {
      const def = getSettingDefinition(key);
      let label = def?.label || key;
      if (hudLang === 'zh' && SETTINGS_ZH[key]) {
        label = SETTINGS_ZH[key].label;
      }
      searchItems.push(label);
      map.set(label.toLowerCase(), key);
    });

    const fzf = new AsyncFzf(searchItems, { fuzzy: 'v2', casing: 'case-insensitive' });
    return { fzfInstance: fzf, searchMap: map };
  }, [hudLang]);

  useEffect(() => {
    let active = true;
    if (!searchQuery.trim() || !fzfInstance) {
      setFilteredKeys(getDialogSettingKeys());
      return;
    }

    const doSearch = async () => {
      const results = await fzfInstance.find(searchQuery);
      if (!active) return;
      const matchedKeys = new Set<string>();
      results.forEach((res: FzfResult) => {
        const key = searchMap.get(res.item.toLowerCase());
        if (key) matchedKeys.add(key);
      });
      setFilteredKeys(Array.from(matchedKeys));
    };

    void doSearch();
    return () => { active = false; };
  }, [searchQuery, fzfInstance, searchMap]);

  const pendingRestartRequiredSettings = useMemo(() => {
    const changed = new Set<string>();
    const scopes: Array<[string, Settings]> = [
      ['User', settings.user.settings],
      ['Workspace', settings.workspace.settings],
      ['System', settings.system.settings],
    ];

    for (const [key, initialScopeMap] of activeRestartRequiredSettings) {
      for (const [scopeName, scopeSettings] of scopes) {
        const currentValue = isInSettingsScope(key, scopeSettings)
          ? getEffectiveValue(key, scopeSettings)
          : undefined;
        const initialJson = initialScopeMap.get(scopeName);
        if (JSON.stringify(currentValue) !== initialJson) {
          changed.add(key);
          break;
        }
      }
    }
    return changed;
  }, [settings, activeRestartRequiredSettings]);

  const showRestartPrompt = pendingRestartRequiredSettings.size > 0;

  const maxLabelOrDescriptionWidth = useMemo(() => {
    const allKeys = getDialogSettingKeys();
    let max = 0;
    for (const key of allKeys) {
      const def = getSettingDefinition(key);
      if (!def) continue;

      const scopeMessage = getScopeMessageForSetting(key, selectedScope, settings);
      let label = def.label || key;
      let description = def.description;
      if (hudLang === 'zh' && SETTINGS_ZH[key]) {
        label = SETTINGS_ZH[key].label;
        description = SETTINGS_ZH[key].description || description;
      }

      const labelFull = label + (scopeMessage ? ` ${scopeMessage}` : '');
      const lWidth = getCachedStringWidth(labelFull);
      const dWidth = description ? getCachedStringWidth(description) : 0;
      max = Math.max(max, lWidth, dWidth);
    }
    return max;
  }, [selectedScope, settings, hudLang]);

  const searchBuffer = useSearchBuffer({ initialText: '', onChange: setSearchQuery });

  const settingKeys = searchQuery ? filteredKeys : getDialogSettingKeys();
  const items: SettingsDialogItem[] = useMemo(() => {
    const scopeSettings = settings.forScope(selectedScope).settings;
    const mergedSettings = settings.merged;

    return settingKeys.map((key) => {
      const definition = getSettingDefinition(key);
      const type: SettingsType = definition?.type ?? 'string';
      
      let displayValue = getDisplayValue(key, scopeSettings, mergedSettings);
      
      // Localize enum display values
      if (hudLang === 'zh' && SETTINGS_ZH[key]?.options) {
        const rawVal = getEffectiveValue(key, scopeSettings);
        const translatedLabel = (SETTINGS_ZH[key].options as any)[String(rawVal)];
        if (translatedLabel) {
          displayValue = isInSettingsScope(key, scopeSettings) ? `${translatedLabel}*` : translatedLabel;
        }
      }

      const scopeMessage = getScopeMessageForSetting(key, selectedScope, settings);
      const isGreyedOut = !isInSettingsScope(key, scopeSettings);
      const rawValue = getEffectiveValue(key, scopeSettings);
      const editValue = getEditValue(type, rawValue);

      let label = definition?.label || key;
      let description = definition?.description;
      if (hudLang === 'zh' && SETTINGS_ZH[key]) {
        label = SETTINGS_ZH[key].label;
        description = SETTINGS_ZH[key].description || description;
      }

      return { key, label, description, type, displayValue, isGreyedOut, scopeMessage, rawValue, editValue };
    });
  }, [settingKeys, selectedScope, settings, hudLang]);

  const handleScopeChange = useCallback((scope: LoadableSettingScope) => { setSelectedScope(scope); }, []);

  const handleItemToggle = useCallback(
    (key: string, _item: SettingsDialogItem) => {
      const definition = getSettingDefinition(key);
      if (!TOGGLE_TYPES.has(definition?.type)) return;
      const scopeSettings = settings.forScope(selectedScope).settings;
      const currentValue = getEffectiveValue(key, scopeSettings);
      let newValue: SettingsValue;

      if (definition?.type === 'boolean') {
        newValue = !currentValue;
      } else if (definition?.type === 'enum' && definition.options) {
        const options = definition.options;
        const currentIndex = options.findIndex((opt) => opt.value === currentValue);
        newValue = (currentIndex !== -1 && currentIndex < options.length - 1) 
          ? options[currentIndex + 1].value 
          : options[0].value;
      } else return;

      setSetting(selectedScope, key, newValue);
    },
    [settings, selectedScope, setSetting],
  );

  const handleEditCommit = useCallback(
    (key: string, newValue: string, _item: SettingsDialogItem) => {
      const definition = getSettingDefinition(key);
      const parsed = parseEditedValue(definition?.type ?? 'string', newValue);
      if (parsed !== null) setSetting(selectedScope, key, parsed);
    },
    [selectedScope, setSetting],
  );

  const handleItemClear = useCallback((key: string) => { setSetting(selectedScope, key, undefined); }, [selectedScope, setSetting]);

  const handleClose = useCallback(() => { onSelect(undefined, selectedScope as SettingScope); }, [onSelect, selectedScope]);

  const globalKeyMatchers = useKeyMatchers();
  const settingsKeyMatchers = useMemo(() => ({
    ...globalKeyMatchers,
    [Command.DIALOG_NAVIGATION_UP]: (key: Key) => KEY_UP.matches(key) || KEY_CTRL_P.matches(key),
    [Command.DIALOG_NAVIGATION_DOWN]: (key: Key) => KEY_DOWN.matches(key) || KEY_CTRL_N.matches(key),
  }), [globalKeyMatchers]);

  const handleKeyPress = useCallback(
    (key: Key): boolean => {
      if (showRestartPrompt && key.sequence === 'r') {
        if (onRestartRequest) onRestartRequest();
        return true;
      }
      return false;
    },
    [showRestartPrompt, onRestartRequest],
  );

  return (
    <BaseSettingsDialog
      title={hudLang === 'zh' ? '设置' : 'Settings'}
      borderColor={showRestartPrompt ? theme.status.warning : undefined}
      searchEnabled={!showRestartPrompt}
      searchBuffer={searchBuffer}
      items={items}
      showScopeSelector={settings.workspace.path !== undefined}
      selectedScope={selectedScope}
      onScopeChange={handleScopeChange}
      maxItemsToShow={MAX_ITEMS_TO_SHOW}
      availableHeight={availableTerminalHeight}
      maxLabelWidth={maxLabelOrDescriptionWidth}
      onItemToggle={handleItemToggle}
      onEditCommit={handleEditCommit}
      onItemClear={handleItemClear}
      onClose={handleClose}
      onKeyPress={handleKeyPress}
      keyMatchers={settingsKeyMatchers}
      footer={showRestartPrompt ? {
        content: (
          <Text color={theme.status.warning}>
            {hudLang === 'zh' ? '需要重启的设置已修改。按 r 退出并立即应用。' : 'Changes that require a restart have been modified. Press r to exit and apply changes now.'}
          </Text>
        ),
        height: 1,
      } : undefined}
    />
  );
}
