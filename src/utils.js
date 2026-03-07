/**
 * 工具函数库
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

/**
 * 确保目录存在
 */
export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 读取 JSON 文件
 */
export function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`读取 JSON 失败：${filePath}`, e.message);
    return null;
  }
}

/**
 * 写入 JSON 文件（格式化）
 */
export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 获取 data 目录下所有 contests
 */
export function getAllContests() {
  const contestsDir = path.join(ROOT_DIR, 'data', 'contests');
  ensureDir(contestsDir);
  
  const files = fs.readdirSync(contestsDir).filter(f => f.endsWith('.json'));
  return files.map(f => readJson(path.join(contestsDir, f))).filter(Boolean);
}

/**
 * 检查 contest 是否已存在
 */
export function contestExists(contestId) {
  const filePath = path.join(ROOT_DIR, 'data', 'contests', `${contestId}.json`);
  return fs.existsSync(filePath);
}

/**
 * 检查 leaderboard 是否已抓取
 */
export function leaderboardExists(contestId) {
  const filePath = path.join(ROOT_DIR, 'data', 'leaderboards', `${contestId}.json`);
  return fs.existsSync(filePath);
}

/**
 * 标记 leaderboard 已抓取
 */
export function markLeaderboardFetched(contestId) {
  const filePath = path.join(ROOT_DIR, 'data', 'contests', `${contestId}.json`);
  const contest = readJson(filePath);
  if (contest) {
    contest.leaderboardFetched = true;
    writeJson(filePath, contest);
  }
}

/**
 * 获取需要抓取 leaderboard 的 contests
 */
export function getContestsNeedingLeaderboard() {
  const contests = getAllContests();
  const now = Date.now();
  const sixMinutes = 6 * 60 * 1000;
  
  return contests.filter(c => {
    if (c.leaderboardFetched) return false;
    if (!c.endDate) return false;
    const endTime = new Date(c.endDate).getTime();
    // 结束后 6 分钟且未抓取
    return endTime < now - sixMinutes;
  });
}

/**
 * 扁平化 Moki 信息
 */
export function flattenMoki(moki) {
  return {
    tokenId: moki.tokenId,
    name: moki.name,
    element: moki.element,
    rarity: moki.rarity,
    role: moki.role,
    stats: moki.stats || {}
  };
}

/**
 * 扁平化 Leaderboard 记录
 */
export function flattenLeaderboardEntry(entry, index) {
  return {
    rank: index + 1,
    playerId: entry.playerId || entry.player?._id || '',
    playerName: entry.playerName || entry.player?.name || 'Unknown',
    score: entry.score || entry.points || 0,
    mokiIds: entry.mokiIds || entry.team?.map(m => m.tokenId) || []
  };
}

/**
 * 延迟函数
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 获取 ISO 日期字符串
 */
export function getISODate(date = new Date()) {
  return date.toISOString().split('T')[0];
}

/**
 * 获取 ISO 周数
 */
export function getISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

export { ROOT_DIR };
