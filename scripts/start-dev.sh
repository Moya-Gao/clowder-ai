#!/bin/bash

# Cat Cafe 开发服务器启动脚本

set -e

echo "🐱 Cat Café 开发服务器"
echo "====================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 默认端口
MCP_PORT=${MCP_SERVER_PORT:-3001}
API_PORT=${API_SERVER_PORT:-3002}
WEB_PORT=${FRONTEND_PORT:-3000}

# 检查 Redis
check_redis() {
    echo "检查 Redis..."
    if ! redis-cli ping &> /dev/null; then
        echo -e "${YELLOW}Redis 未运行，尝试启动...${NC}"
        if command -v redis-server &> /dev/null; then
            redis-server --daemonize yes
            sleep 1
            if redis-cli ping &> /dev/null; then
                echo -e "${GREEN}✓ Redis 已启动${NC}"
            else
                echo -e "${RED}错误: 无法启动 Redis${NC}"
                exit 1
            fi
        else
            echo -e "${RED}错误: 未找到 redis-server${NC}"
            echo "请安装 Redis: brew install redis (macOS)"
            exit 1
        fi
    else
        echo -e "${GREEN}✓ Redis 已运行${NC}"
    fi
}

# 检查端口
check_port() {
    local port=$1
    local name=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}警告: 端口 $port ($name) 已被占用${NC}"
        return 1
    fi
    return 0
}

# 清理函数
cleanup() {
    echo ""
    echo "正在关闭服务..."
    kill $(jobs -p) 2>/dev/null || true
    echo "再见！"
}

trap cleanup EXIT

# 主函数
main() {
    # 加载环境变量
    if [ -f .env ]; then
        set -a
        source .env
        set +a
    fi

    check_redis

    echo ""
    echo "检查端口..."
    check_port $MCP_PORT "MCP Server" || true
    check_port $API_PORT "API Server" || true
    check_port $WEB_PORT "Frontend" || true

    echo ""
    echo "启动服务..."

    # 启动 MCP Server (如果存在)
    if [ -d "packages/mcp-server" ]; then
        echo "启动 MCP Server (端口 $MCP_PORT)..."
        (cd packages/mcp-server && pnpm run dev) &
        sleep 1
    fi

    # 启动 API Server (如果存在)
    if [ -d "packages/api" ]; then
        echo "启动 API Server (端口 $API_PORT)..."
        (cd packages/api && pnpm run dev) &
        sleep 1
    fi

    # 启动 Frontend (如果存在)
    if [ -d "packages/web" ]; then
        echo "启动 Frontend (端口 $WEB_PORT)..."
        (cd packages/web && pnpm run dev) &
    fi

    echo ""
    echo "========================"
    echo -e "${GREEN}🎉 Cat Café 已启动！${NC}"
    echo ""
    echo "服务地址："
    echo "  - Frontend: http://localhost:$WEB_PORT"
    echo "  - API:      http://localhost:$API_PORT"
    echo "  - MCP:      http://localhost:$MCP_PORT"
    echo ""
    echo "按 Ctrl+C 停止所有服务"
    echo ""

    # 等待所有后台进程
    wait
}

main "$@"
