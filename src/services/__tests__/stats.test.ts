/**
 * 测试筛选功能
 */

import { describe, it, expect } from 'vitest';
import {
  getDateRanges,
  filterByDateRange,
  filterByContestName,
  applyFilters
} from '../services/stats';
import type { Contest, FilterOptions } from '../types/index.js';

describe('Stats Filters', () => {
  const mockContests: Contest[] = [
    {
      _id: '1',
      name: 'Test Contest 1',
      contestStatus: 'COMPLETED',
      format: 'FIFTY_FIFTY',
      entryFee: 1000,
      prizePool: 5000,
      entries: 100,
      startDate: '2026-03-09T00:00:00.000Z',
      endDate: '2026-03-09T23:59:59.000Z',
      featured: false,
      isPrivate: false,
      leaderboardFetched: false,
      fetchedAt: new Date().toISOString()
    },
    {
      _id: '2',
      name: 'Test Contest 2',
      contestStatus: 'COMPLETED',
      format: 'TOP_20_PCT',
      entryFee: 2000,
      prizePool: 10000,
      entries: 200,
      startDate: '2026-03-08T00:00:00.000Z',
      endDate: '2026-03-08T23:59:59.000Z',
      featured: false,
      isPrivate: false,
      leaderboardFetched: false,
      fetchedAt: new Date().toISOString()
    }
  ];

  describe('getDateRanges', () => {
    it('should return all time ranges', () => {
      const ranges = getDateRanges();
      expect(ranges).toHaveProperty('today');
      expect(ranges).toHaveProperty('yesterday');
      expect(ranges).toHaveProperty('last_7_days');
      expect(ranges).toHaveProperty('last_30_days');
      expect(ranges).toHaveProperty('all');
      expect(ranges).toHaveProperty('custom');
    });
  });

  describe('filterByContestName', () => {
    it('should filter by keyword', () => {
      const filtered = filterByContestName(mockContests, 'Contest 1');
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toContain('Contest 1');
    });

    it('should be case insensitive', () => {
      const filtered = filterByContestName(mockContests, 'contest 2');
      expect(filtered.length).toBe(1);
    });

    it('should return all when keyword is empty', () => {
      const filtered = filterByContestName(mockContests, '');
      expect(filtered.length).toBe(2);
    });
  });

  describe('applyFilters', () => {
    it('should apply time range filter', () => {
      const filtered = applyFilters(mockContests, {
        timeRange: 'last_7_days'
      });
      expect(filtered.length).toBeGreaterThan(0);
    });

    it('should apply format filter', () => {
      const filtered = applyFilters(mockContests, {
        contestFormat: ['FIFTY_FIFTY']
      });
      expect(filtered.length).toBe(1);
      expect(filtered[0].format).toBe('FIFTY_FIFTY');
    });

    it('should apply minPrizePool filter', () => {
      const filtered = applyFilters(mockContests, {
        minPrizePool: 8000
      });
      expect(filtered.length).toBe(1);
      expect(filtered[0].prizePool).toBeGreaterThanOrEqual(8000);
    });

    it('should chain multiple filters', () => {
      const filtered = applyFilters(mockContests, {
        timeRange: 'last_7_days',
        contestFormat: ['FIFTY_FIFTY'],
        minPrizePool: 4000
      });
      expect(filtered.length).toBe(1);
    });
  });
});
