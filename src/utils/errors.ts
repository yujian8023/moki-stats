/**
 * 统一错误处理
 */

import type { ErrorContext } from '../types/index.js';

/**
 * 基础错误类
 */
export class MokiError extends Error {
  public code: string;
  public context?: Record<string, any>;
  public timestamp: string;

  constructor(message: string, code: string, context?: Record<string, any>) {
    super(message);
    this.name = 'MokiError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }

  toJSON(): ErrorContext {
    return {
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp
    };
  }
}

/**
 * API 请求错误
 */
export class ApiError extends MokiError {
  public statusCode: number;
  public endpoint: string;

  constructor(message: string, statusCode: number, endpoint: string) {
    super(message, 'API_ERROR', { statusCode, endpoint });
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
  }
}

/**
 * 频率限制错误
 */
export class RateLimitError extends MokiError {
  public retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message, 'RATE_LIMIT', { retryAfter });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * 数据验证错误
 */
export class ValidationError extends MokiError {
  public field?: string;

  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', { field });
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * 文件系统错误
 */
export class FileSystemError extends MokiError {
  public path?: string;

  constructor(message: string, path?: string) {
    super(message, 'FILE_SYSTEM_ERROR', { path });
    this.name = 'FileSystemError';
    this.path = path;
  }
}

/**
 * 任务执行错误
 */
export class TaskExecutionError extends MokiError {
  public taskId: string;
  public taskType: string;

  constructor(message: string, taskId: string, taskType: string) {
    super(message, 'TASK_EXECUTION_ERROR', { taskId, taskType });
    this.name = 'TaskExecutionError';
    this.taskId = taskId;
    this.taskType = taskType;
  }
}

/**
 * 错误日志格式化
 */
export function formatError(error: unknown): string {
  if (error instanceof MokiError) {
    return `[${error.name}] ${error.code}: ${error.message}${
      error.context ? ` | Context: ${JSON.stringify(error.context)}` : ''
    }`;
  }
  
  if (error instanceof Error) {
    return `[Error] ${error.message}`;
  }
  
  return `[Unknown Error] ${String(error)}`;
}

/**
 * 安全执行函数（捕获错误并返回）
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  defaultValue?: T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    console.error(formatError(error));
    return defaultValue;
  }
}
