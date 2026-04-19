/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import {
  getDisplayString,
} from '@google/gemini-cli-core';
import process from 'node:process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { useUIState } from '../contexts/UIStateContext.js';
import { useConfig } from '../contexts/ConfigContext.js';
import { useSettings } from '../contexts/SettingsContext.js';

export interface FooterRowItem {
  key: string;
  header: string;
  element: React.ReactNode;
  flexGrow: number;
  flexShrink: number;
  alignItems: 'flex-start' | 'flex-end' | 'center';
}

export const FooterRow: React.FC<{
  items: FooterRowItem[];
  showLabels: boolean;
}> = ({ items, showLabels }) => {
  return (
    <Box flexWrap="nowrap" width="100%">
      {items.map((item, index) => (
        <Box
          key={item.key}
          flexGrow={item.flexGrow}
          flexShrink={item.flexShrink}
          alignItems={item.alignItems}
          marginRight={index < items.length - 1 ? 2 : 0}
        >
          {showLabels && item.header && (
            <Text color={theme.ui.comment}>{item.header}: </Text>
          )}
          {item.element}
        </Box>
      ))}
    </Box>
  );
};

// --- Persistence Helper ---
const STATS_DIR = path.join(os.homedir(), '.gemini');
const STATS_FILE = path.join(STATS_DIR, 'daily_hud_stats.json');

interface DailyStatsData {
  date: string;
  calls: number;
}

const getDailyStats = (): number => {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const content = fs.readFileSync(STATS_FILE, 'utf-8');
      const data = JSON.parse(content) as DailyStatsData;
      const today = new Date().toISOString().split('T')[0];
      if (data.date === today) return data.calls || 0;
    }
  } catch {
    // Ignore error
  }
  return 0;
};

const saveDailyStats = (count: number) => {
  try {
    if (!fs.existsSync(STATS_DIR)) fs.mkdirSync(STATS_DIR, { recursive: true });
    const today = new Date().toISOString().split('T')[0];
    fs.writeFileSync(STATS_FILE, JSON.stringify({ date: today, calls: count }));
  } catch {
    // Ignore error
  }
};

interface TranslationSet {
  output: string;
  cost: string;
  context: string;
  memory: string;
  calls: string;
  today: string;
  files: string;
  tokens: string;
  in: string;
  out: string;
  cache: string;
  hitRate: string;
  units: string;
}

// --- Translations ---
const TRANSLATIONS: Record<string, TranslationSet> = {
  en: {
    output: 'Output',
    cost: 'Cost',
    context: 'Context',
    memory: 'Mem',
    calls: 'Calls',
    today: 'today',
    files: 'files',
    tokens: 'Tokens',
    in: 'in',
    out: 'out',
    cache: 'cache',
    hitRate: 'hit rate',
    units: '',
  },
  zh: {
    output: '输出',
    cost: '费用',
    context: '上下文',
    memory: '内存',
    calls: '调用',
    today: '今日',
    files: '文件',
    tokens: 'Tokens',
    in: '进',
    out: '出',
    cache: '缓存',
    hitRate: '命中率',
    units: '次',
  }
};

// --- Model Context Limits ---
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'gemini-3.1-pro': 2000000,
  'gemini-3-pro': 2000000,
  'gemini-2.5-pro': 2000000,
  'gemini-3.1-flash': 1000000,
  'gemini-3-flash': 1000000,
  'gemini-2.5-flash': 1000000,
  'gemini-2.5-flash-lite': 1000000,
  'gemini-3.1-flash-lite': 1000000,
  'pro': 2000000,
  'flash': 1000000,
  'flash-lite': 1000000,
};

const getContextLimit = (modelId: string) => {
  const lowerId = modelId.toLowerCase();
  for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
    if (lowerId.includes(key)) return limit;
  }
  return 1000000; // Default fallback
};

interface HudSettings {
  enabled?: boolean;
  language?: string;
}

interface UiSettings {
  footer?: {
    hud?: HudSettings;
  };
}

export const Footer: React.FC = () => {
  const uiState = useUIState();
  const config = useConfig();
  const settings = useSettings();

  // --- Configuration-driven Visibility & Language ---
  const ui = (settings as any).ui as UiSettings | undefined;
  const hudEnabled = ui?.footer?.hud?.enabled ?? true;
  const hudLang = ui?.footer?.hud?.language || 'en';
  const t = TRANSLATIONS[hudLang] || TRANSLATIONS.en;

  const {
    model,
    targetDir,
    branchName,
    promptTokenCount,
    terminalWidth,
  } = {
    model: uiState.currentModel,
    targetDir: config.getTargetDir(),
    branchName: uiState.branchName,
    promptTokenCount: uiState.sessionStats.lastPromptTokenCount,
    terminalWidth: uiState.terminalWidth,
  };

  // --- Real-time Speed (tok/s) Logic ---
  const [streamToks, setStreamToks] = useState('--');
  const [stickyToks, setStickyToks] = useState('--');
  const lastRespondingRef = useRef(false);
  const startTimeRef = useRef(0);
  const hasFirstCharRef = useRef(false);
  const stickyTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!hudEnabled) return;
    const isResponding = uiState.streamingState === 'responding';
    const pendingText = uiState.pendingGeminiHistoryItems.map(i => i.text).join('');
    
    if (isResponding && !lastRespondingRef.current) {
      lastRespondingRef.current = true;
      hasFirstCharRef.current = false;
      if (stickyTimerRef.current) clearTimeout(stickyTimerRef.current);
    } else if (isResponding && !hasFirstCharRef.current && pendingText.length > 0) {
      startTimeRef.current = Date.now();
      hasFirstCharRef.current = true;
    } else if (!isResponding && lastRespondingRef.current) {
      lastRespondingRef.current = false;
      setStickyToks(prev => prev !== '--' ? prev : streamToks);
      stickyTimerRef.current = setTimeout(() => {
        setStickyToks('--');
        setStreamToks('--');
      }, 5000);
    }

    if (isResponding && hasFirstCharRef.current) {
      const interval = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const estimatedTokens = Math.floor(pendingText.length / 1.1); 
        if (elapsed > 0.05 && estimatedTokens > 0) {
          const speed = (estimatedTokens / elapsed).toFixed(1);
          setStreamToks(speed);
          setStickyToks(speed);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [uiState.streamingState, uiState.pendingGeminiHistoryItems, hudEnabled, streamToks]);

  // --- Daily Calls Persistence ---
  const [dailyCalls, setDailyCalls] = useState(() => getDailyStats());
  const lastTurnIdRef = useRef(0);

  useEffect(() => {
    if (!hudEnabled) return;
    const currentCount = uiState.sessionStats.promptCount;
    if (uiState.streamingState === 'responding' && lastTurnIdRef.current !== currentCount) {
      setDailyCalls(prev => {
        const newVal = prev + 1;
        saveDailyStats(newVal);
        return newVal;
      });
      lastTurnIdRef.current = currentCount;
    }
  }, [uiState.streamingState, uiState.sessionStats.promptCount, hudEnabled]);

  // If HUD is disabled, fallback
  if (!hudEnabled) {
    return (
      <Box paddingX={1} width={terminalWidth}>
        <Text color={theme.ui.comment}>Gemini CLI Footer (HUD Disabled)</Text>
      </Box>
    );
  }

  // --- Dynamic Context Logic ---
  const activeModel = config.getActiveModel();
  const contextLimit = getContextLimit(activeModel);
  const contextUsagePercent = Math.min(100, Math.round(((promptTokenCount || 0) / contextLimit) * 100));
  const progressChars = 5;
  const filledChars = Math.round((contextUsagePercent / 100) * progressChars);
  const contextProgressBar = '█'.repeat(filledChars) + '░'.repeat(progressChars - filledChars);
  const contextLimitStr = contextLimit >= 1000000 ? `${(contextLimit / 1000000).toFixed(1)}M` : `${Math.round(contextLimit / 1000)}k`;

  // --- UI Calculations ---
  const sessionModels = uiState?.sessionStats?.metrics?.models || {};
  let hudPromptTokens = 0;
  let hudCandidatesTokens = 0;
  let hudCachedTokens = 0;
  for (const m of Object.values(sessionModels)) {
    hudPromptTokens += m?.tokens?.prompt || 0;
    hudCandidatesTokens += m?.tokens?.candidates || 0;
    hudCachedTokens += m?.tokens?.cached || 0;
  }
  const hudTotalTokens = hudPromptTokens + hudCandidatesTokens;
  const hudTotalCost = (hudPromptTokens / 1000000) * 1.25 + (hudCandidatesTokens / 1000000) * 3.75;
  
  const formatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
  const fTotal = formatter.format(hudTotalTokens).toLowerCase();
  const fIn = formatter.format(hudPromptTokens).toLowerCase();
  const fOut = formatter.format(hudCandidatesTokens).toLowerCase();
  const fCache = formatter.format(hudCachedTokens).toLowerCase();
  const fContext = formatter.format(promptTokenCount || 0).toLowerCase();

  const memUsage = process.memoryUsage();
  const memStr = `${Math.round((memUsage?.rss || 0) / 1024 / 1024)} MB`;
  const workspaceName = targetDir?.split(/[/\\]/).pop() || 'workspace';
  
  const added = uiState?.sessionStats?.diff?.added || 0;
  const removed = uiState?.sessionStats?.diff?.removed || 0;
  const gitStr = branchName ? `git:(${branchName}* [+${added} -${removed}])` : '';
  const numFiles = uiState?.contextFileNames?.length || 0;
  const reqCount = uiState.sessionStats.promptCount;
  const hitRate = hudPromptTokens > 0 ? ((hudCachedTokens / hudPromptTokens) * 100).toFixed(1) : '0.0';
  
  const modelDisplay = activeModel.includes(model.replace('auto-', '')) 
    ? getDisplayString(activeModel, config)
    : `${getDisplayString(model, config)} ➜ ${getDisplayString(activeModel, config)}`;

  return (
    <Box flexDirection="column" width={terminalWidth} paddingX={1}>
      {/* Line 1 */}
      <Box width="100%">
        <Text wrap="none">
          <Text color="green" bold>[{modelDisplay}]</Text>
          <Text color={theme.ui.comment}> │ </Text>
          <Text color="white">{workspaceName} {gitStr}</Text>
          <Text color={theme.ui.comment}> │ </Text>
          <Text color="gray">{t.output}: </Text><Text color="white">{stickyToks} tok/s</Text>
          <Text color={theme.ui.comment}> │ </Text>
          <Text color="white">⏱️  &lt;1m</Text>
          <Text color={theme.ui.comment}> │ </Text>
          <Text color="magenta">{t.cost} ${hudTotalCost.toFixed(4)}</Text>
        </Text>
      </Box>

      {/* Line 2 */}
      <Box width="100%">
        <Text wrap="none">
          <Text color="gray">{t.context} </Text><Text color={theme.ui.comment}>{contextProgressBar} </Text>
          <Text color="white">{contextUsagePercent}% ({fContext}/{contextLimitStr})</Text>
          <Text color={theme.ui.comment}> │ </Text>
          <Text color="gray">{t.memory} </Text><Text color={theme.ui.comment}>█░░░░ </Text>
          <Text color="white">{memStr}</Text>
          <Text color={theme.ui.comment}> │ </Text>
          <Text color="gray">{t.calls} </Text><Text color={theme.ui.comment}>{'█'.repeat(Math.min(reqCount, 5)) + '░'.repeat(Math.max(0, 5-reqCount))} </Text>
          <Text color="white">{reqCount}{t.units} ({t.today}: {dailyCalls})</Text>
          <Text color={theme.ui.comment}> │ </Text>
          <Text color="white">{numFiles} {t.files}</Text>
        </Text>
      </Box>

      {/* Line 3 */}
      <Box width="100%">
        <Text wrap="none">
          <Text color="gray">{t.tokens} </Text>
          <Text color="white">{fTotal}</Text>
          <Text color="gray"> ({t.in}: </Text>
          <Text color="white">{fIn}</Text>
          <Text color="gray">, {t.out}: </Text>
          <Text color="white">{fOut}</Text>
          <Text color="gray">, {t.cache}: </Text>
          <Text color="white">{fCache}</Text>
          <Text color="gray">, {t.hitRate}: </Text>
          <Text color="white">{hitRate}%</Text>
          <Text color="gray">)</Text>
        </Text>
      </Box>
    </Box>
  );
};
