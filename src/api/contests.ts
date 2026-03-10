/**
 * Contests API 客户端
 */

import fetch from 'node-fetch';
import type { Contest, FetchOptions, ContestSummary } from '../types/index.js';
import { ApiError, RateLimitError } from '../utils/errors.js';

const BASE_URL = 'https://fantasy.grandarena.gg/api';

export interface FetchContestsResult {
  contests: Contest[];
  hasMore: boolean;
  nextOffset?: number;
}

/**
 * Contests API 客户端
 */
export class ContestsApi {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = BASE_URL, timeout: number = 10000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * 获取竞赛列表（支持分页）
   */
  async fetchContests(options: FetchOptions = {}): Promise<FetchContestsResult> {
    const { status = null, limit = 50, offset = 0 } = options;

    let url = `${this.baseUrl}/contests?limit=${limit}&offset=${offset}`;
    
    if (status) {
      url += `&status=${encodeURIComponent(status)}`;
    }
    
    url += '&includeUserContext=true&hidePrivate=true';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
          throw new RateLimitError('API 频率限制', retryAfter);
        }
        throw new ApiError(`获取竞赛失败：${response.status}`, response.status, url);
      }

      const data = await response.json();
      const contests = (data.contests || data || []) as Contest[];

      return {
        contests,
        hasMore: contests.length >= limit,
        nextOffset: contests.length >= limit ? offset + limit : undefined
      };
    } catch (error) {
      if (error instanceof ApiError || error instanceof RateLimitError) {
        throw error;
      }
      throw new ApiError(`网络错误：${error instanceof Error ? error.message : String(error)}`, 0, url);
    }
  }

  /**
   * 分页获取全部竞赛
   */
  async fetchAll(options?: { 
    limit?: number; 
    batchSize?: number; 
    batchDelay?: number;
    onProgress?: (page: number, total: number) => void;
  }): Promise<Contest[]> {
    const { 
      limit = 50, 
      batchSize = 1,
      batchDelay = 500,
      onProgress 
    } = options || {};

    const allContests: Contest[] = [];
    let offset = 0;
    let pageCount = 0;

    while (true) {
      pageCount++;
      const result = await this.fetchContests({ limit, offset });
      
      allContests.push(...result.contests);
      
      if (onProgress) {
        onProgress(pageCount, allContests.length);
      }

      if (!result.hasMore) {
        break;
      }

      offset = result.nextOffset || offset + limit;
      
      // 批量控制
      if (pageCount % batchSize === 0 && result.hasMore) {
        await this.sleep(batchDelay);
      }
    }

    return allContests;
  }

  /**
   * 获取单个竞赛详情
   */
  async fetchById(contestId: string): Promise<Contest> {
    const result = await this.fetchContests({ limit: 1, offset: 0 });
    
    const contest = result.contests.find(c => c._id === contestId);
    
    if (!contest) {
      throw new ApiError(`竞赛不存在：${contestId}`, 404, `${this.baseUrl}/contests/${contestId}`);
    }

    return contest;
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 将竞赛转换为摘要格式
 */
export function toContestSummary(contest: Contest): ContestSummary {
  return {
    _id: contest._id,
    name: contest.name,
    contestStatus: contest.contestStatus,
    startDate: contest.startDate,
    endDate: contest.endDate,
    entries: contest.entries,
    prizePool: contest.prizePool,
    format: contest.format
  };
}

export default ContestsApi;
