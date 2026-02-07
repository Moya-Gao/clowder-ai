#!/bin/bash

# Cat Cafe 开发服务器启动脚本
# 用法:
#   pnpm start          — 正常启动 (清理缓存 + rebuild + 启动)
#   pnpm start --quick  — 跳过 rebuild，仅清缓存后启动

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo "🐱 Cat Café 开发服务器"
echo "====================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 解析参数
QUICK_MODE=false
for arg in "$@"; do
    case $arg in
        --quick|-q) QUICK_MODE=true ;;
    esac
done

# 加载环境变量 (放最前面，后续函数需要端口号)
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# 默认端口
API_PORT=${API_SERVER_PORT:-3002}
WEB_PORT=${FRONTEND_PORT:-3001}

# 杀掉占用端口的进程
kill_port() {
    local port=$1
    local name=$2
    local pids
    pids=$(lsof -nP -i ":$port" -sTCP:LISTEN -t 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}  端口 $port ($name) 被占用，正在终止进程...${NC}"
        echo "$pids" | xargs kill 2>/dev/null || true
        sleep 1
        # 确认已死
        pids=$(lsof -nP -i ":$port" -sTCP:LISTEN -t 2>/dev/null || true)
        if [ -n "$pids" ]; then
            echo -e "${YELLOW}  强制终止...${NC}"
            echo "$pids" | xargs kill -9 2>/dev/null || true
            sleep 1
        fi
        echo -e "${GREEN}  ✓ 端口 $port 已释放${NC}"
    fi
}

# 清理缓存
clean_cache() {
    echo ""
    echo -e "${CYAN}清理缓存...${NC}"

    # Next.js 缓存 — 这是最容易出问题的
    if [ -d "packages/web/.next" ]; then
        /bin/rm -rf packages/web/.next
        echo -e "${GREEN}  ✓ 清理 .next 缓存${NC}"
    fi

    # Next.js tsbuildinfo
    if [ -f "packages/web/tsconfig.tsbuildinfo" ]; then
        /bin/rm -f packages/web/tsconfig.tsbuildinfo
        echo -e "${GREEN}  ✓ 清理 web tsconfig.tsbuildinfo${NC}"
    fi
}

# 构建 API (tsc)
build_api() {
    echo ""
    echo -e "${CYAN}构建 API...${NC}"
    (cd packages/api && pnpm run build) 2>&1 | tail -3
    echo -e "${GREEN}  ✓ API 构建完成${NC}"
}

# 检查 Redis (非阻塞 — 没有 Redis 也能跑，只是用内存存储)
check_redis() {
    if redis-cli ping &> /dev/null; then
        echo -e "${GREEN}  ✓ Redis 已运行${NC}"
    else
        echo -e "${YELLOW}  ⚠ Redis 未运行 (将使用内存存储，重启丢数据)${NC}"
    fi
}

# 清理函数 — Ctrl+C 时杀所有子进程
cleanup() {
    echo ""
    echo "正在关闭服务..."
    kill $(jobs -p) 2>/dev/null || true
    wait 2>/dev/null || true
    echo "再见！🐾"
}

trap cleanup EXIT INT TERM

# 主函数
main() {
    # 1. 杀掉残余进程
    echo ""
    echo -e "${CYAN}检查端口...${NC}"
    kill_port $API_PORT "API"
    kill_port $WEB_PORT "Frontend"

    # 2. 清理缓存
    clean_cache

    # 3. 构建 API (除非 --quick)
    if [ "$QUICK_MODE" = false ]; then
        build_api
    else
        echo ""
        echo -e "${YELLOW}跳过 API 构建 (--quick 模式)${NC}"
    fi

    # 4. 检查外部依赖
    echo ""
    echo -e "${CYAN}检查依赖...${NC}"
    check_redis

    # 5. 启动服务
    echo ""
    echo -e "${CYAN}启动服务...${NC}"

    # API Server
    echo "  启动 API Server (端口 $API_PORT)..."
    (cd packages/api && pnpm run dev) &
    sleep 2

    # Frontend (Next.js dev server — PORT env var controls the port)
    echo "  启动 Frontend (端口 $WEB_PORT)..."
    (cd packages/web && PORT=$WEB_PORT pnpm exec next dev -p $WEB_PORT) &
    sleep 3

    echo ""
    echo "========================"
    echo -e "${GREEN}🎉 Cat Café 已启动！${NC}"
    echo ""
    echo "服务地址："
    echo "  - Frontend: http://localhost:$WEB_PORT"
    echo "  - API:      http://localhost:$API_PORT"
    echo ""
    echo "按 Ctrl+C 停止所有服务"
    echo ""

    # 等待所有后台进程
    wait
}

main "$@"
