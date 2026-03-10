# Moki-Stats Phase 1 完成报告

**生成时间:** 2026-03-10 20:34:55
**数据目录:** `/Users/yujian/aicoding/moki-stats/docs/data/`

## 1. 数据结构概览

| 数据源 | 文件数 | 核心字段 |
|--------|--------|----------|
| contests | 525 个 | `_id`, `name`, `entryFee`, `prizePool`, `entries`, `format`, `contestStatus`, `lineupConfig`, `prizeStructure`, `matchGroups`, `startDate`, `endDate` |
| leaderboards | 482 个 | `contestId`, `contestName`, `top50[]`, `endDate`, `fetchedAt`, `totalEntries` |
| stats | 1 个 | `period`, `fromDate`, `toDate`, `totalContests`, `totalPlayers`, `mokiAppearances`, `topCompositions`, `generatedAt` |

### 字段关联关系

```
contests._id  →  leaderboards.contestId  (一对一对应)
leaderboards.top50[].cardImages[]  →  mokiId (从 URL 提取)
stats.mokiAppearances[mokiId]  →  imageUrl, count, avgRank
```

## 2. 竞赛类型映射字典（基于 name 字段）

| 类型标识 | 出现次数 | 示例名称 |
|----------|----------|----------|
| 50/50 | 340 次 | "50/50 Open 10-Round Tanuki Tim..."; "50/50 Basic or Rare Only Half-Day Tama Mart..." |
| Top 20% | 118 次 | "Top 20% Basic Only 10-Round Badlands Gacha..."; "Top 20% Rare Only Half-Day Island Syndicate..." |
| Free Entry | 56 次 | "Free Basic/Rare Only Daily Wart Shinobu..."; "Free No Legendary Daily Sora Incense..." |
| Other | 11 次 | "Backdate Test Contest..."; "Top 10% 2B + 2R 10-Round Mart Syndicate..." |

### 补充：基于 format 字段的类型分布

| format 值 | 出现次数 | 对应类型标识 |
|-----------|----------|--------------|
| FIFTY_FIFTY | 343 个 | 50/50 |
| TOP_20_PCT | 117 个 | Top 20% |
| FREE_ENTRY | 56 个 | Free Entry |
| TOP_10_PCT | 5 个 | Other |
| WINNER_TAKE_ALL | 4 个 | Other |

## 3. 报名费枚举

| 报名费 (GEMs) | 竞赛数量 | 占比 |
|---------------|----------|------|
| 0 | 56 | 10.7% |
| 100 | 61 | 11.6% |
| 200 | 56 | 10.7% |
| 300 | 97 | 18.5% |
| 400 | 41 | 7.8% |
| 500 | 54 | 10.3% |
| 600 | 2 | 0.4% |
| 700 | 8 | 1.5% |
| 1000 | 62 | 11.8% |
| 1200 | 2 | 0.4% |
| 1500 | 10 | 1.9% |
| 2000 | 37 | 7.0% |
| 2500 | 9 | 1.7% |
| 3000 | 16 | 3.0% |
| 3500 | 1 | 0.2% |
| 4000 | 6 | 1.1% |
| 5000 | 7 | 1.3% |

**总计:** 525 个竞赛

## 4. 卡牌映射

- **总卡牌数量:** 3751 张
- **mokiId → image URL 映射表:** ✅ 已建立 (3751 条)

### 映射示例（前 10 张）

| mokiId | image URL |
|--------|-----------|
| `c58b9aae6e1d660c` | `https://fhs9t4t52f1kkfmo.public.blob.vercel-storage.com/seas...` |
| `7f00aaed17547d86` | `https://fhs9t4t52f1kkfmo.public.blob.vercel-storage.com/seas...` |
| `6261c128f3d0cd1b` | `https://fhs9t4t52f1kkfmo.public.blob.vercel-storage.com/seas...` |
| `38f8c9a1ef2d9fe0` | `https://fhs9t4t52f1kkfmo.public.blob.vercel-storage.com/seas...` |
| `702747599bc4a095` | `https://fhs9t4t52f1kkfmo.public.blob.vercel-storage.com/seas...` |
| `8f46dca732ecbde6` | `https://fhs9t4t52f1kkfmo.public.blob.vercel-storage.com/seas...` |
| `556e823eeff39097` | `https://fhs9t4t52f1kkfmo.public.blob.vercel-storage.com/seas...` |
| `2c2bff7109a79a67` | `https://fhs9t4t52f1kkfmo.public.blob.vercel-storage.com/seas...` |
| `19ea331038789d07` | `https://fhs9t4t52f1kkfmo.public.blob.vercel-storage.com/seas...` |
| `6ff151a54891134b` | `https://fhs9t4t52f1kkfmo.public.blob.vercel-storage.com/seas...` |

### 卡牌 URL 规律

```
URL 格式：https://fhs9t4t52f1kkfmo.public.blob.vercel-storage.com/season1-launch/{mokiId}_thumb.webp
mokiId 提取：从 URL 路径中提取倒数第二个段（去掉 _thumb 后缀）
```

## 5. 遇到的问题

1. **mokis/manifest.json 为空壳文件**
   - 实际卡牌数据存储在 `stats/summary.json` 的 `mokiAppearances` 字段中
   - manifest.json 仅包含 `{"total": 1, "mokis": [{}]}` 占位内容

2. **leaderboard 数据中的卡牌标识为 URL 而非 mokiId**
   - `top50[].cardImages[]` 存储完整 URL
   - 需要通过解析 URL 提取 mokiId

3. **竞赛名称格式不完全统一**
   - 大部分遵循「类型标识 + 描述」格式
   - 建议使用 `format` 字段作为主要分类依据，`name` 字段作为辅助

## 6. 下一步建议

### Phase 2: 数据关联与聚合

1. **建立完整的 contest ↔ leaderboard 关联**
   - 通过 `contests._id = leaderboards.contestId` 进行关联
   - 统计每个竞赛的参赛人数、奖金池、获奖分布

2. **构建 mokiId 完整映射字典**
   - 从 `stats/summary.json` 提取所有 mokiId → imageUrl
   - 从 `leaderboards` 的 cardImages URL 验证映射关系
   - 输出为 JSON 文件供后续分析使用

3. **竞赛类型 × 报名费交叉分析**
   - 统计每种竞赛类型 (50/50, Top 20%, Free Entry) 的报名费分布
   - 分析不同报名费档位的竞赛数量与参赛人数关系

4. **卡牌出现频率统计**
   - 基于 `stats.mokiAppearances` 的 count 字段
   - 识别高频率卡牌（热门）与低频率卡牌（稀有）
