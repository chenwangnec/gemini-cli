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
  useSessionStats,
  type ModelMetrics,
} from '../contexts/SessionContext.js';
import {
  calculateCacheHitRate,
  calculateErrorRate,
} from '../utils/computeStats.js';
import { getDisplayString, LlmRole } from '@google/gemini-cli-core';
import { useConfig } from '../contexts/ConfigContext.js';
import { useSettings } from '../contexts/SettingsContext.js';

const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    noApi: 'No API calls yet',
    req: 'req',
    err: 'err',
    tokens: 'tokens',
    in: 'in',
    out: 'out',
    cache: 'cache',
    thought: 'thought',
    tool: 'tool',
    total: 'total',
    speed: 'speed',
  },
  zh: {
    noApi: '暂无 API 调用',
    req: '次',
    err: '错误',
    tokens: '令牌',
    in: '输入',
    out: '输出',
    cache: '缓存',
    thought: '推理',
    tool: '工具',
    total: '总计',
    speed: '速度',
  },
};

interface Snapshot {
  models: Record<string, ModelMetrics>;
  promptCount: number;
}

export const ModelStatsBar: React.FC = () => {
  const { stats } = useSessionStats();
  const config = useConfig();
  const settings = useSettings();
  const lang = settings.merged.general?.language || 'zh';
  const t = TRANSLATIONS[lang] || TRANSLATIONS['zh'];
  const gt = (key: keyof typeof t) => t[key];

  // Real-time snapshot tracking
  const [prevSnapshot, setPrevSnapshot] = useState<Snapshot | null>(null);
  const [deltaPerSec, setDeltaPerSec] = useState<
    Record<string, { reqDelta: number; tokenDelta: number }>
  >({});
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const elapsed = (now - lastUpdateRef.current) / 1000;
    if (elapsed < 0.5) return; // throttle to 2Hz

    const current: Snapshot = {
      models: stats.metrics.models,
      promptCount: stats.promptCount,
    };

    if (prevSnapshot && elapsed > 0) {
      const deltas: Record<string, { reqDelta: number; tokenDelta: number }> =
        {};
      for (const [name, metrics] of Object.entries(current.models)) {
        const prev = prevSnapshot.models[name];
        if (!prev) continue;

        const currTotal = metrics.tokens.total;
        const prevTotal = prev.tokens.total;
        const reqDelta = metrics.api.totalRequests - prev.api.totalRequests;
        const tokenDelta = currTotal - prevTotal;

        if (reqDelta > 0 || tokenDelta > 0) {
          deltas[name] = {
            reqDelta: reqDelta / elapsed,
            tokenDelta: tokenDelta / elapsed,
          };
        }
      }
      if (Object.keys(deltas).length > 0) {
        setDeltaPerSec(deltas);
      }
    }

    setPrevSnapshot(current);
    lastUpdateRef.current = now;
  }, [stats.metrics.models, stats.promptCount, prevSnapshot]);

  const { models } = stats.metrics;

  const activeModels = Object.entries(models).filter(
    ([, metrics]) => metrics.api.totalRequests > 0,
  );

  if (activeModels.length === 0) {
    return (
      <Box>
        <Text color={theme.text.secondary}>{gt('noApi')}</Text>
      </Box>
    );
  }

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
  };

  const fmtMs = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <Box flexDirection="column">
      {activeModels.map(([name, metrics]) => {
        const cacheHitRate = calculateCacheHitRate(metrics);
        const errorRate = calculateErrorRate(metrics);
        const avgLatency =
          metrics.api.totalRequests > 0
            ? metrics.api.totalLatencyMs / metrics.api.totalRequests
            : 0;

        const subRoles = Object.entries(metrics.roles || {})
          .filter(
            ([role, r]) =>
              role !== LlmRole.MAIN && r !== undefined && r.totalRequests > 0,
          )
          .map(([role, r]) => [role, r] as const);

        const delta = deltaPerSec[name];
        const tokPerSec = delta ? `${fmt(delta.tokenDelta)}/s` : '';
        const reqPerSec = delta
          ? `+${delta.reqDelta.toFixed(1)}${gt('req')}/s`
          : '';

        return (
          <Box key={name} flexDirection="column">
            {/* Model header */}
            <Box>
              <Text bold color={theme.text.accent}>
                {getDisplayString(name, config)}
              </Text>
              <Text color={theme.text.secondary}> │ </Text>
              <Text color={theme.text.primary}>
                {metrics.api.totalRequests} {gt('req')}
              </Text>
              {delta && (reqPerSec || tokPerSec) && (
                <>
                  <Text color={theme.text.secondary}> │ </Text>
                  <Text color="green">{tokPerSec}</Text>
                  <Text color={theme.text.secondary}> │ </Text>
                  <Text color={theme.text.secondary}>{reqPerSec}</Text>
                </>
              )}
              {metrics.api.totalErrors > 0 && (
                <>
                  <Text color={theme.text.secondary}> │ </Text>
                  <Text color={theme.status.error}>
                    ✕ {metrics.api.totalErrors} {gt('err')} (
                    {errorRate.toFixed(0)}%)
                  </Text>
                </>
              )}
              <Text color={theme.text.secondary}> │ </Text>
              <Text color={theme.text.secondary}>⏱ {fmtMs(avgLatency)}</Text>
            </Box>

            {/* Token row */}
            <Box>
              <Text color={theme.text.secondary}>{gt('tokens')}:</Text>
              <Text color={theme.text.primary}>
                {' '}
                {gt('total')} {fmt(metrics.tokens.total)}
              </Text>
              <Text color={theme.text.secondary}> │ </Text>
              <Text color={theme.text.primary}>
                {gt('in')} {fmt(metrics.tokens.input)}
              </Text>
              <Text color={theme.text.secondary}> │ </Text>
              <Text color={theme.text.primary}>
                {gt('out')} {fmt(metrics.tokens.candidates)}
              </Text>
              {metrics.tokens.cached > 0 && (
                <>
                  <Text color={theme.text.secondary}> │ </Text>
                  <Text color={theme.text.secondary}>
                    {gt('cache')} {fmt(metrics.tokens.cached)} (
                    {cacheHitRate.toFixed(0)}%)
                  </Text>
                </>
              )}
              {metrics.tokens.thoughts > 0 && (
                <>
                  <Text color={theme.text.secondary}> │ </Text>
                  <Text color={theme.text.secondary}>
                    {gt('thought')} {fmt(metrics.tokens.thoughts)}
                  </Text>
                </>
              )}
              {metrics.tokens.tool > 0 && (
                <>
                  <Text color={theme.text.secondary}> │ </Text>
                  <Text color={theme.text.secondary}>
                    {gt('tool')} {fmt(metrics.tokens.tool)}
                  </Text>
                </>
              )}
            </Box>

            {/* Subagent roles */}
            {subRoles.map(([role, roleMetrics]) => (
              <Box key={`${name}-${role}`}>
                <Text color={theme.text.secondary}> ↳ {role} </Text>
                <Text color={theme.text.primary}>
                  {roleMetrics.totalRequests} {gt('req')}
                </Text>
                <Text color={theme.text.secondary}> │ </Text>
                <Text color={theme.text.primary}>
                  {gt('in')} {fmt(roleMetrics.tokens.input)}
                </Text>
                <Text color={theme.text.secondary}> │ </Text>
                <Text color={theme.text.primary}>
                  {gt('out')} {fmt(roleMetrics.tokens.candidates)}
                </Text>
                {roleMetrics.tokens.cached > 0 && (
                  <>
                    <Text color={theme.text.secondary}> │ </Text>
                    <Text color={theme.text.secondary}>
                      {gt('cache')} {fmt(roleMetrics.tokens.cached)}
                    </Text>
                  </>
                )}
              </Box>
            ))}
          </Box>
        );
      })}
    </Box>
  );
};
