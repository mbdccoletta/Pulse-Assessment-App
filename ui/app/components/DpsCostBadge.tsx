// ui/app/components/DpsCostBadge.tsx
//
// "Run details": what the last run read from Grail, shown on hover next to
// the environment name. Volumes only. The GiB a query scans is the load on
// Grail; what is billed is a different figure that depends on the
// environment's licensing and on who runs the query (measured on a production
// estate: ~1.25 million GiB scanned in 48 hours, ~229 GiB billed). A list
// price times the scanned volume would read as a bill, so no money is shown.

import React from 'react';
import { Text } from '@dynatrace/strato-components/typography';
import { Tooltip } from './Tooltip';
import type { QueryStats, CoverageData } from '../hooks/useCoverageData';

interface DpsCostBadgeProps {
  /** Final run stats. Null while the run is in flight; we fall back to live
   *  byte counters in that case. */
  stats: QueryStats | null;
  /** Live scanned-bytes counter from useCoverageData — updates during the
   *  run so the badge climbs in real time. */
  liveScannedBytes: number;
  /** Last run metadata so we can surface cache savings. */
  lastRunMeta: CoverageData['lastRunMeta'];
  /** Whether the run is in flight (we show "running…" instead of stale numbers). */
  loading: boolean;
  /** Strato text colors injected by the host so the badge follows theme. */
  textColor: string;
  textSecColor: string;
  /** Extra disclosure appended to the tooltip (economy mode). */
  note?: string;
  /** Criteria whose read stopped at the scan ceiling on this run. */
  partialCount?: number;
}

/** Format a bytes count compactly: <1 GiB → MB, <1024 GiB → GB, else TB. */
function fmtBytes(bytes: number): string {
  const gb = bytes / (1024 ** 3);
  if (gb < 0.01) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (gb < 1) return `${gb.toFixed(2)} GB`;
  if (gb < 1024) return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)} GB`;
  return `${(gb / 1024).toFixed(1)} TB`;
}

export const DpsCostBadge: React.FC<DpsCostBadgeProps> = ({
  stats,
  liveScannedBytes,
  lastRunMeta,
  loading,
  textColor,
  textSecColor,
  note,
  partialCount = 0,
}) => {
  void textColor;
  const scannedBytes = stats?.scannedBytes ?? liveScannedBytes ?? 0;
  const savedBytes = lastRunMeta?.cachedBytesSaved ?? 0;
  const cacheHits = lastRunMeta?.cacheHits ?? 0;
  const cacheMisses = lastRunMeta?.cacheMisses ?? 0;
  const cacheTotal = cacheHits + cacheMisses;
  const liveTag = loading && cacheTotal === 0 ? 'Running…' : '';

  const lines = [
    ...(stats
      ? [
          `${stats.succeeded} of ${stats.total} queries ran.${stats.failed > 0 ? ` ${stats.failed} failed.` : ''}`,
          partialCount > 0
            ? `${partialCount} ${partialCount === 1 ? 'reading' : 'readings'} stopped at the 50 GB scan ceiling and show with ≈.`
            : 'Every reading is complete.',
          '',
        ]
      : []),
    `Read from Grail: ${fmtBytes(scannedBytes)}${stats ? ` (${stats.scannedRecords.toLocaleString()} records)` : ''}.`,
    cacheTotal > 0
      ? `Cache: ${cacheHits} of ${cacheTotal} queries served from the 24h cache${savedBytes > 0 ? `, ${fmtBytes(savedBytes)} not read again` : ''}.`
      : 'Cache: not used on this run (first run of the day or Refresh).',
    '',
    'Volume read is the load on Grail. What is billed depends on the environment\'s licensing.',
    ...(note ? ['', note] : []),
    ...(liveTag ? ['', liveTag] : []),
  ];

  return (
    <Tooltip text={lines.join('\n')} position="bottom">
      <Text style={{ marginLeft: 8, fontSize: 12, color: textSecColor, borderBottom: `1px dotted ${textSecColor}`, cursor: 'help' }}>
        Run details
      </Text>
    </Tooltip>
  );
};
