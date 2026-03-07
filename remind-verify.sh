#!/bin/bash
# Moki Stats 验证提醒脚本
# 使用方法：./remind-verify.sh

echo "⏰ Moki 排行榜抓取验证提醒"
echo "================================"
echo ""
echo "📊 今天下午 13:00 有 8 个竞赛结束"
echo "   现在应该已经抓取了排行榜数据"
echo ""
echo "✅ 验证清单："
echo "1. 检查 GitHub Actions 是否正常运行"
echo "2. 查看 data/leaderboards/ 目录是否有新文件"
echo "3. 刷新网页看数据是否更新"
echo "4. 确认卡牌详情是否正确显示"
echo ""
echo "🔗 快速链接："
echo "- Actions: https://github.com/yujian8023/moki-stats/actions"
echo "- 网页：https://yujian8023.github.io/moki-stats/"
echo "- 竞赛数据：https://github.com/yujian8023/moki-stats/tree/main/data/contests"
echo "- 排行榜数据：https://github.com/yujian8023/moki-stats/tree/main/data/leaderboards"
echo ""
echo "如果数据没有更新，请检查 Actions 日志排查问题。"
echo ""

# 检查本地 leaderboard 数量
cd ~/aicoding/moki-stats
LB_COUNT=$(ls data/leaderboards/*.json 2>/dev/null | wc -l)
echo "📈 当前本地排行榜数量：$LB_COUNT 个"

if [ "$LB_COUNT" -eq 0 ]; then
    echo "⚠️  还没有排行榜数据，可能竞赛还未结束或抓取失败"
else
    echo "✅ 已有排行榜数据，请继续验证网页显示"
fi
