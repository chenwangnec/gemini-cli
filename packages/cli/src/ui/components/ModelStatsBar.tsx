/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { useSessionStats } from '../contexts/SessionContext.js';
import { calculateCacheHitRate } from '../utils/computeStats.js';
import { getDisplayString, LlmRole } from '@google/gemini-cli-core';
import { useConfig } from '../contexts/ConfigContext.js';

export const ModelStatsBar: React.FC = () => {
  const { stats } = useSessionStats();
  const config = useConfig();
  const { models } = stats.metrics;

  const activeModels = Object.entries(models).filter(
    ([, metrics]) => metrics.api.totalRequests > 0,
  );

  if (activeModels.length === 0) {
    return (
      <Box>
        <Text color={theme.text.secondary}>No API calls yet</Text>
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
      {activeModels.map(([name, metrics], idx) => {
        const cacheHitRate = calculateCacheHitRate(metrics);
        const errorRate =
          metrics.api.totalRequests > 0
            ? (metrics.api.totalErrors / metrics.api.totalRequests) * 100
            : 0;
        const avgLatency =
          metrics.api.totalRequests > 0
            ? metrics.api.totalLatencyMs / metrics.api.totalRequests
            : 0;

        return (
          <Box
            key={name}
            flexDirection="column"
            marginBottom={idx < activeModels.length - 1 ? 0 : undefined}
          >
            {/* Model header */}
            <Box>
              <Text bold color={theme.text.accent}>
                {getDisplayString(name, config)}
              </Text>
              <Text color={theme.text.secondary}> │ </Text>
              <Text color={theme.text.primary}>
                {metrics.api.totalRequests} req
              </Text>
              {metrics.api.totalErrors > 0 && (
                <>
                  <Text color={theme.text.secondary}> │ </Text>
                  <Text color={theme.status.error}>
                    ✕ {metrics.api.totalErrors} err ({errorRate.toFixed(0)}%)
                  </Text>
                </>
              )}
              <Text color={theme.text.secondary}> │ </Text>
              <Text color={theme.text.secondary}>⏱ {fmtMs(avgLatency)}</Text>
            </Box>

            {/* Token row */}
            <Box>
              <Text color={theme.text.secondary}>tokens:</Text>
              <Text color={theme.text.primary}>
                {' '}
                total {fmt(metrics.tokens.total)}
              </Text>
              <Text color={theme.text.secondary}> │ </Text>
              <Text color={theme.text.primary}>
                in {fmt(metrics.tokens.input)}
              </Text>
              <Text color={theme.text.secondary}> │ </Text>
              <Text color={theme.text.primary}>
                out {fmt(metrics.tokens.candidates)}
              </Text>
              {metrics.tokens.cached > 0 && (
                <>
                  <Text color={theme.text.secondary}> │ </Text>
                  <Text color={theme.text.secondary}>
                    cache {fmt(metrics.tokens.cached)} (
                    {cacheHitRate.toFixed(0)}%)
                  </Text>
                </>
              )}
              {metrics.tokens.thoughts > 0 && (
                <>
                  <Text color={theme.text.secondary}> │ </Text>
                  <Text color={theme.text.secondary}>
                    thought {fmt(metrics.tokens.thoughts)}
                  </Text>
                </>
              )}
              {metrics.tokens.tool > 0 && (
                <>
                  <Text color={theme.text.secondary}> │ </Text>
                  <Text color={theme.text.secondary}>
                    tool {fmt(metrics.tokens.tool)}
                  </Text>
                </>
              )}
            </Box>

            {/* Subagent roles */}
            {Object.entries(metrics.roles)
              .filter(
                ([role, r]) =>
                  role !== LlmRole.MAIN &&
                  r !== undefined &&
                  r.totalRequests > 0,
              )
              .map(([role, roleMetrics]) => (
                <Box key={`${name}-${role}`}>
                  <Text color={theme.text.secondary}> ↳ {role} </Text>
                  <Text color={theme.text.primary}>
                    {roleMetrics.totalRequests} req
                  </Text>
                  <Text color={theme.text.secondary}> │ </Text>
                  <Text color={theme.text.primary}>
                    in {fmt(roleMetrics.tokens.input)}
                  </Text>
                  <Text color={theme.text.secondary}> │ </Text>
                  <Text color={theme.text.primary}>
                    out {fmt(roleMetrics.tokens.candidates)}
                  </Text>
                  {roleMetrics.tokens.cached > 0 && (
                    <>
                      <Text color={theme.text.secondary}> │ </Text>
                      <Text color={theme.text.secondary}>
                        cache {fmt(roleMetrics.tokens.cached)}
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
