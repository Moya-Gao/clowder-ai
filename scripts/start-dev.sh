#!/bin/bash

# Cat Cafe 开发服务器启动脚本
# 用法:
#   pnpm start            — 正常启动 (Redis 持久化 + rebuild)
#   pnpm start --quick    — 跳过 rebuild
#   pnpm start --memory   — 使用内存存储 (重启丢数据)
#   pnpm start --no-redis — 同 --memory

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
USE_REDIS=true
for arg in "$@"; do
    case $arg in
        --quick|-q) QUICK_MODE=true ;;
        --memory|--no-redis) USE_REDIS=false ;;
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
REDIS_PORT=${REDIS_PORT:-6399}

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

# 检查/启动 Redis
# USE_REDIS=true (默认): 尝试启动 Redis, 失败则回退内存
# USE_REDIS=false (--memory): 跳过 Redis, 强制内存存储
setup_storage() {
    if [ "$USE_REDIS" = false ]; then
        echo -e "${YELLOW}  ⚡ 内存模式 (--memory)，重启丢数据${NC}"
        unset REDIS_URL
        return
    fi

    # 默认: 尝试 Redis 持久化 (专属端口，避免与系统 Redis 冲突)
    if redis-cli -p $REDIS_PORT ping &> /dev/null; then
        echo -e "${GREEN}  ✓ Redis 已运行 (端口 $REDIS_PORT)${NC}"
        export REDIS_URL="redis://localhost:$REDIS_PORT"
        return
    fi

    echo -e "${YELLOW}  ⚠ Redis 未运行，尝试在端口 $REDIS_PORT 启动...${NC}"
    if command -v redis-server &> /dev/null; then
        redis-server --port $REDIS_PORT --daemonize yes 2>/dev/null || true
        sleep 1
        if redis-cli -p $REDIS_PORT ping &> /dev/null; then
            echo -e "${GREEN}  ✓ Redis 已启动 (端口 $REDIS_PORT)${NC}"
            export REDIS_URL="redis://localhost:$REDIS_PORT"
        else
            echo -e "${RED}  ✗ Redis 启动失败 (回退内存存储)${NC}"
            unset REDIS_URL
        fi
    else
        echo -e "${RED}  ✗ Redis 未安装 (回退内存存储)${NC}"
        echo -e "${YELLOW}    安装: brew install redis${NC}"
        unset REDIS_URL
    fi
}

# 清理函数 — Ctrl+C 时杀所有子进程 + 关闭专属 Redis
cleanup() {
    echo ""
    echo "正在关闭服务..."
    kill $(jobs -p) 2>/dev/null || true
    # 关闭我们启动的专属 Redis (不影响系统默认 6379)
    if [ "$USE_REDIS" = true ] && redis-cli -p $REDIS_PORT ping &> /dev/null 2>&1; then
        redis-cli -p $REDIS_PORT shutdown nosave &> /dev/null || true
        echo "  Redis (端口 $REDIS_PORT) 已关闭"
    fi
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
    setup_storage

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

    # 显示存储模式
    if [ -n "$REDIS_URL" ]; then
        STORAGE_INFO="${GREEN}Redis 持久化${NC} ($REDIS_URL)"
    else
        STORAGE_INFO="${YELLOW}内存模式${NC} (重启丢数据)"
    fi

    echo ""
    echo "========================"
    echo -e "${GREEN}🎉 Cat Café 已启动！${NC}"
    echo ""
    echo "服务地址："
    echo "  - Frontend: http://localhost:$WEB_PORT"
    echo "  - API:      http://localhost:$API_PORT"
    echo -e "  - 存储:     $STORAGE_INFO"
    echo ""
    echo "按 Ctrl+C 停止所有服务"
    echo ""

    # 等待所有后台进程
    wait
}

main "$@"
