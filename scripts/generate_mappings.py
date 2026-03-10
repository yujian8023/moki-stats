#!/usr/bin/env python3
"""
Moki-Stats Phase 1: 生成映射字典 JSON 文件
"""

import json
from pathlib import Path

DATA_DIR = Path("/Users/yujian/aicoding/moki-stats/docs/data")
STATS_DIR = DATA_DIR / "stats"
OUTPUT_DIR = Path("/Users/yujian/aicoding/moki-stats/docs/data/mappings")

OUTPUT_DIR.mkdir(exist_ok=True)

# 加载 summary.json
with open(STATS_DIR / "summary.json", 'r', encoding='utf-8') as f:
    summary = json.load(f)

# 提取 mokiId → imageUrl 映射
moki_mapping = {}
if 'mokiAppearances' in summary:
    for moki_id, info in summary['mokiAppearances'].items():
        moki_mapping[moki_id] = {
            'imageUrl': info.get('imageUrl', ''),
            'cardName': info.get('cardName', ''),
            'cardType': info.get('cardType', ''),
            'count': info.get('count', 0),
            'percentage': info.get('percentage', 0),
            'avgRank': info.get('avgRank', 0)
        }

# 保存映射字典
output_path = OUTPUT_DIR / "moki_id_mapping.json"
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump({
        'generatedAt': summary.get('generatedAt', ''),
        'totalCards': len(moki_mapping),
        'mappings': moki_mapping
    }, f, ensure_ascii=False, indent=2)

print(f"✅ mokiId 映射字典已生成：{output_path}")
print(f"   总卡牌数：{len(moki_mapping)} 张")

# 生成简化版映射（仅 ID → URL）
simple_mapping = {k: v['imageUrl'] for k, v in moki_mapping.items()}
simple_path = OUTPUT_DIR / "moki_id_to_url.json"
with open(simple_path, 'w', encoding='utf-8') as f:
    json.dump(simple_mapping, f, ensure_ascii=False, indent=2)

print(f"✅ 简化版映射已生成：{simple_path}")

# 统计卡牌类型分布
card_types = {}
for info in moki_mapping.values():
    card_type = info.get('cardType', 'unknown')
    card_types[card_type] = card_types.get(card_type, 0) + 1

print(f"\n📊 卡牌类型分布:")
for ct, count in sorted(card_types.items(), key=lambda x: -x[1]):
    print(f"   {ct}: {count} 张")
