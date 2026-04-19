/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import { theme } from '../../semantic-colors.js';
import type { LoadableSettingScope } from '../../../config/settings.js';
import type {
  SettingsType,
  SettingsValue,
} from '../../../config/settingsSchema.js';
import { getScopeItems } from '../../../utils/dialogScopeUtils.js';
import { RadioButtonSelect } from './RadioButtonSelect.js';
import { TextInput } from './TextInput.js';
import type { TextBuffer } from './text-buffer.js';
import { cpSlice, cpLen, cpIndexToOffset } from '../../utils/textUtils.js';
import { useKeypress, type Key } from '../../hooks/useKeypress.js';
import { Command, type KeyMatchers } from '../../key/keyMatchers.js';
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation.js';
import { useInlineEditBuffer } from '../../hooks/useInlineEditBuffer.js';
import { formatCommand } from '../../key/keybindingUtils.js';
import { useKeyMatchers } from '../../hooks/useKeyMatchers.js';
import { useSettings } from '../../contexts/SettingsContext.js';

/**
 * Represents a single item in the settings dialog.
 */
export interface SettingsDialogItem {
  /** Unique identifier for the item */
  key: string;
  /** Display label */
  label: string;
  /** Optional description below label */
  description?: string;
  /** Item type for determining interaction behavior */
  type: SettingsType;
  /** Pre-formatted display value (with * if modified) */
  displayValue: string;
  /** Grey out value (at default) */
  isGreyedOut?: boolean;
  /** Scope message e.g., "(Modified in Workspace)" */
  scopeMessage?: string;
  /** Raw value for edit mode initialization */
  rawValue?: SettingsValue;
  /** Optional pre-formatted edit buffer value for complex types */
  editValue?: string;
}

/**
 * Props for BaseSettingsDialog component.
 */
export interface BaseSettingsDialogProps {
  // Header
  /** Dialog title displayed at the top */
  title: string;
  /** Optional border color for the dialog */
  borderColor?: string;
  // Search (optional feature)
  /** Whether to show the search input. Default: true */
  searchEnabled?: boolean;
  /** Placeholder text for search input. Default: "Search to filter" */
  searchPlaceholder?: string;
  /** Text buffer for search input */
  searchBuffer?: TextBuffer;

  // Items - parent provides the list
  /** List of items provided by the parent */
  items: SettingsDialogItem[];

  // Scope selector
  /** Whether to show the scope selector. Default: true */
  showScopeSelector?: boolean;
  /** Currently selected scope */
  selectedScope: LoadableSettingScope;
  /** Callback when scope changes */
  onScopeChange?: (scope: LoadableSettingScope) => void;

  // Layout
  /** Maximum number of items to show at once */
  maxItemsToShow: number;
  /** Maximum label width for alignment */
  maxLabelWidth?: number;

  // Action callbacks
  /** Called when a boolean/enum item is toggled */
  onItemToggle: (key: string, item: SettingsDialogItem) => void;
  /** Called when edit mode is committed with new value */
  onEditCommit: (
    key: string,
    newValue: string,
    item: SettingsDialogItem,
  ) => void;
  /** Called when Ctrl+C is pressed to clear/reset an item */
  onItemClear: (key: string, item: SettingsDialogItem) => void;
  /** Called when dialog should close */
  onClose: () => void;
  /** Optional custom key handler for parent-specific keys. Return true if handled. */
  onKeyPress?: (
    key: Key,
    currentItem: SettingsDialogItem | undefined,
  ) => boolean;

  /** Optional override for key matchers used for navigation. */
  keyMatchers?: KeyMatchers;

  /** Available terminal height for dynamic windowing */
  availableHeight?: number;

  /** Optional footer configuration */
  footer?: {
    content: React.ReactNode;
    height: number;
  };
}

/**
 * A base settings dialog component that handles rendering, layout, and keyboard navigation.
 */
export function BaseSettingsDialog({
  title,
  borderColor,
  searchEnabled = true,
  searchPlaceholder = 'Search to filter',
  searchBuffer,
  items,
  showScopeSelector = true,
  selectedScope,
  onScopeChange,
  maxItemsToShow,
  maxLabelWidth,
  onItemToggle,
  onEditCommit,
  onItemClear,
  onClose,
  onKeyPress,
  keyMatchers: customKeyMatchers,
  availableHeight,
  footer,
}: BaseSettingsDialogProps): React.JSX.Element {
  const globalKeyMatchers = useKeyMatchers();
  const keyMatchers = customKeyMatchers ?? globalKeyMatchers;
  const settings = useSettings();

  // @ts-ignore
  const hudLang = settings.merged.ui?.footer?.hud?.language || 'en';

  const { effectiveMaxItemsToShow, finalShowScopeSelector } = useMemo(() => {
    const initialShowScope = showScopeSelector;
    const initialMaxItems = maxItemsToShow;

    if (!availableHeight) {
      return {
        effectiveMaxItemsToShow: initialMaxItems,
        finalShowScopeSelector: initialShowScope,
      };
    }

    const DIALOG_PADDING = 4;
    const SETTINGS_TITLE_HEIGHT = 1;
    const SEARCH_SECTION_HEIGHT = searchEnabled ? 5 : 1;
    const SCROLL_ARROWS_HEIGHT = 2;
    const ITEMS_SPACING_AFTER = 1;
    const SCOPE_SECTION_HEIGHT = 5;
    const HELP_TEXT_HEIGHT = 1;
    const FOOTER_CONTENT_HEIGHT = footer?.height ?? 0;
    const ITEM_HEIGHT = 3;

    const currentAvailableHeight = availableHeight - DIALOG_PADDING;

    const baseFixedHeight =
      SETTINGS_TITLE_HEIGHT +
      SEARCH_SECTION_HEIGHT +
      SCROLL_ARROWS_HEIGHT +
      ITEMS_SPACING_AFTER +
      HELP_TEXT_HEIGHT +
      FOOTER_CONTENT_HEIGHT;

    const heightWithScope = baseFixedHeight + SCOPE_SECTION_HEIGHT;
    const availableForItemsWithScope = currentAvailableHeight - heightWithScope;
    const maxItemsWithScope = Math.max(
      1,
      Math.floor(availableForItemsWithScope / ITEM_HEIGHT),
    );

    const availableForItemsWithoutScope =
      currentAvailableHeight - baseFixedHeight;
    const maxItemsWithoutScope = Math.max(
      1,
      Math.floor(availableForItemsWithoutScope / ITEM_HEIGHT),
    );

    let shouldShowScope = initialShowScope;
    let maxItems = initialShowScope ? maxItemsWithScope : maxItemsWithoutScope;

    if (initialShowScope && availableHeight < 25) {
      if (maxItemsWithoutScope > maxItemsWithScope + 1) {
        shouldShowScope = false;
        maxItems = maxItemsWithoutScope;
      }
    }

    return {
      effectiveMaxItemsToShow: Math.min(maxItems, items.length),
      finalShowScopeSelector: shouldShowScope,
    };
  }, [
    availableHeight,
    maxItemsToShow,
    items.length,
    searchEnabled,
    showScopeSelector,
    footer,
  ]);

  const { activeIndex, windowStart, moveUp, moveDown } = useSettingsNavigation({
    items,
    maxItemsToShow: effectiveMaxItemsToShow,
  });

  const { editState, editDispatch, startEditing, commitEdit, cursorVisible } =
    useInlineEditBuffer({
      onCommit: (key, value) => {
        const itemToCommit = items.find((i) => i.key === key);
        if (itemToCommit) {
          onEditCommit(key, value, itemToCommit);
        }
      },
    });

  const {
    editingKey,
    buffer: editBuffer,
    cursorPos: editCursorPos,
  } = editState;

  const [focusSection, setFocusSection] = useState<'settings' | 'scope'>(
    'settings',
  );
  const effectiveFocusSection =
    !finalShowScopeSelector && focusSection === 'scope'
      ? 'settings'
      : focusSection;

  const scopeItems = getScopeItems().map((item) => {
    let label = item.label;
    if (hudLang === 'zh') {
      if (label === 'User') label = '用户 (全局)';
      if (label === 'Workspace') label = '工作区 (当前目录)';
      if (label === 'System') label = '系统';
    }
    return {
      ...item,
      label,
      key: item.value,
    };
  });

  const visibleItems = items.slice(
    windowStart,
    windowStart + effectiveMaxItemsToShow,
  );

  const showScrollUp = items.length > effectiveMaxItemsToShow;
  const showScrollDown = items.length > effectiveMaxItemsToShow;
  const currentItem = items[activeIndex];

  const handleScopeChange = useCallback(
    (scope: LoadableSettingScope) => {
      onScopeChange?.(scope);
    },
    [onScopeChange],
  );

  useKeypress(
    (key: Key) => {
      if (!editingKey && onKeyPress?.(key, currentItem)) return;

      if (editingKey) {
        const item = items.find((i) => i.key === editingKey);
        const type = item?.type ?? 'string';

        if (keyMatchers[Command.MOVE_LEFT](key)) {
          editDispatch({ type: 'MOVE_LEFT' });
          return;
        }
        if (keyMatchers[Command.MOVE_RIGHT](key)) {
          editDispatch({ type: 'MOVE_RIGHT' });
          return;
        }
        if (keyMatchers[Command.HOME](key)) {
          editDispatch({ type: 'HOME' });
          return;
        }
        if (keyMatchers[Command.END](key)) {
          editDispatch({ type: 'END' });
          return;
        }
        if (keyMatchers[Command.DELETE_CHAR_LEFT](key)) {
          editDispatch({ type: 'DELETE_LEFT' });
          return;
        }
        if (keyMatchers[Command.DELETE_CHAR_RIGHT](key)) {
          editDispatch({ type: 'DELETE_RIGHT' });
          return;
        }
        if (keyMatchers[Command.ESCAPE](key)) {
          commitEdit();
          return;
        }
        if (keyMatchers[Command.RETURN](key)) {
          commitEdit();
          return;
        }
        if (keyMatchers[Command.DIALOG_NAVIGATION_UP](key) && !key.insertable) {
          commitEdit();
          moveUp();
          return;
        }
        if (keyMatchers[Command.DIALOG_NAVIGATION_DOWN](key) && !key.insertable) {
          commitEdit();
          moveDown();
          return;
        }
        if (key.sequence) {
          editDispatch({
            type: 'INSERT_CHAR',
            char: key.sequence,
            isNumberType: type === 'number',
          });
        }
        return;
      }

      if (effectiveFocusSection === 'settings') {
        if (keyMatchers[Command.DIALOG_NAVIGATION_UP](key)) {
          moveUp();
          return true;
        }
        if (keyMatchers[Command.DIALOG_NAVIGATION_DOWN](key)) {
          moveDown();
          return true;
        }
        if (keyMatchers[Command.RETURN](key) && currentItem) {
          if (currentItem.type === 'boolean' || currentItem.type === 'enum') {
            onItemToggle(currentItem.key, currentItem);
          } else {
            const rawVal = currentItem.rawValue;
            const initialValue = currentItem.editValue ?? (rawVal !== undefined ? String(rawVal) : '');
            startEditing(currentItem.key, initialValue);
          }
          return true;
        }
        if (keyMatchers[Command.CLEAR_SCREEN](key) && currentItem) {
          onItemClear(currentItem.key, currentItem);
          return true;
        }
        if (currentItem?.type === 'number' && /^[0-9]$/.test(key.sequence)) {
          startEditing(currentItem.key, key.sequence);
          return true;
        }
      }

      if (key.name === 'tab' && finalShowScopeSelector) {
        setFocusSection((s) => (s === 'settings' ? 'scope' : 'settings'));
        return;
      }

      if (keyMatchers[Command.ESCAPE](key)) {
        onClose();
        return;
      }
    },
    { isActive: true, priority: effectiveFocusSection === 'settings' },
  );

  const placeholder = hudLang === 'zh' ? '搜索以过滤...' : searchPlaceholder;
  const noMatches = hudLang === 'zh' ? '未找到匹配项。' : 'No matches found.';
  const applyTo = hudLang === 'zh' ? '应用到' : 'Apply To';
  const helpText = hudLang === 'zh' 
    ? `(按 Enter 选择, ${formatCommand(Command.CLEAR_SCREEN)} 重置${finalShowScopeSelector ? ', Tab 切换焦点' : ''}, Esc 关闭)`
    : `(Use Enter to select, ${formatCommand(Command.CLEAR_SCREEN)} to reset${finalShowScopeSelector ? ', Tab to change focus' : ''}, Esc to close)`;

  return (
    <Box
      borderStyle="round"
      borderColor={borderColor ?? theme.border.default}
      flexDirection="row"
      padding={1}
      width="100%"
      height="100%"
    >
      <Box flexDirection="column" flexGrow={1}>
        <Box marginX={1}>
          <Text bold={effectiveFocusSection === 'settings' && !editingKey} wrap="truncate">
            {effectiveFocusSection === 'settings' ? '> ' : '  '}
            {title}{' '}
          </Text>
        </Box>

        {searchEnabled && searchBuffer && (
          <Box
            borderStyle="round"
            borderColor={editingKey ? theme.border.default : effectiveFocusSection === 'settings' ? theme.ui.focus : theme.border.default}
            paddingX={1}
            height={3}
            marginTop={1}
          >
            <TextInput
              focus={effectiveFocusSection === 'settings' && !editingKey}
              buffer={searchBuffer}
              placeholder={placeholder}
            />
          </Box>
        )}

        <Box height={1} />

        {visibleItems.length === 0 ? (
          <Box marginX={1} height={1} flexDirection="column">
            <Text color={theme.text.secondary}>{noMatches}</Text>
          </Box>
        ) : (
          <>
            {showScrollUp && (
              <Box marginX={1}>
                <Text color={theme.text.secondary}>▲</Text>
              </Box>
            )}
            {visibleItems.map((item, idx) => {
              const globalIndex = idx + windowStart;
              const isActive = effectiveFocusSection === 'settings' && activeIndex === globalIndex;
              let displayValue: string;
              if (editingKey === item.key) {
                if (cursorVisible && editCursorPos < cpLen(editBuffer)) {
                  const beforeCursor = cpSlice(editBuffer, 0, editCursorPos);
                  const atCursor = cpSlice(editBuffer, editCursorPos, editCursorPos + 1);
                  const afterCursor = cpSlice(editBuffer, editCursorPos + 1);
                  displayValue = beforeCursor + chalk.inverse(atCursor) + afterCursor;
                } else if (editCursorPos >= cpLen(editBuffer)) {
                  displayValue = editBuffer + (cursorVisible ? chalk.inverse(' ') : ' ');
                } else displayValue = editBuffer;
              } else displayValue = item.displayValue;

              return (
                <React.Fragment key={item.key}>
                  <Box marginX={1} flexDirection="row" alignItems="flex-start" backgroundColor={isActive ? theme.background.focus : undefined}>
                    <Box minWidth={2} flexShrink={0}>
                      <Text color={isActive ? theme.ui.focus : theme.text.secondary}>{isActive ? '●' : ''}</Text>
                    </Box>
                    <Box flexDirection="row" flexGrow={1} minWidth={0} alignItems="flex-start">
                      <Box flexDirection="column" width={maxLabelWidth} minWidth={0}>
                        <Text color={isActive ? theme.ui.focus : theme.text.primary}>
                          {item.label}
                          {item.scopeMessage && <Text color={theme.text.secondary}> {item.scopeMessage}</Text>}
                        </Text>
                        <Text color={theme.text.secondary} wrap="truncate">{item.description ?? ''}</Text>
                      </Box>
                      <Box minWidth={3} />
                      <Box flexShrink={0}>
                        <Text
                          color={isActive ? theme.ui.focus : item.isGreyedOut ? theme.text.secondary : theme.text.primary}
                          terminalCursorFocus={editingKey === item.key && cursorVisible}
                          terminalCursorPosition={cpIndexToOffset(editBuffer, editCursorPos)}
                        >
                          {displayValue}
                        </Text>
                      </Box>
                    </Box>
                  </Box>
                  <Box height={1} />
                </React.Fragment>
              );
            })}
            {showScrollDown && (
              <Box marginX={1}>
                <Text color={theme.text.secondary}>▼</Text>
              </Box>
            )}
          </>
        )}

        <Box height={1} />

        {finalShowScopeSelector && (
          <Box marginX={1} flexDirection="column">
            <Text bold={effectiveFocusSection === 'scope'} wrap="truncate">
              {effectiveFocusSection === 'scope' ? '> ' : '  '}{applyTo}
            </Text>
            <RadioButtonSelect
              items={scopeItems}
              initialIndex={scopeItems.findIndex((item) => item.value === selectedScope)}
              onSelect={handleScopeChange}
              onHighlight={handleScopeChange}
              isFocused={effectiveFocusSection === 'scope'}
              showNumbers={effectiveFocusSection === 'scope'}
              priority={effectiveFocusSection === 'scope'}
            />
          </Box>
        )}

        <Box height={1} />

        <Box marginX={1}>
          <Text color={theme.text.secondary}>{helpText}</Text>
        </Box>

        {footer && <Box marginX={1}>{footer.content}</Box>}
      </Box>
    </Box>
  );
}
