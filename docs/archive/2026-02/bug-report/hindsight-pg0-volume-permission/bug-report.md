# Bug Report: Hindsight pg0 首启权限失败（命名卷）

## 1) 报告人

- 报告人：缅因猫（本次本地联调）
- 发现方式：执行 `pnpm hindsight:start` 后，`/health` 长时间不可用，容器日志出现 pg0 启动失败

## 2) 复现步骤（期望 vs 实际）

1. 执行 `pnpm hindsight:down`，并删除数据卷 `cat-cafe-hindsight-local-instance_cat-cafe-hindsight-data`
2. 执行 `pnpm hindsight:start`
3. 查看容器日志与健康状态

期望：
- 服务可在冷启动后进入 `healthy`
- `GET http://localhost:18888/health` 返回 `200`

实际：
- pg0 启动报错 `Permission denied (os error 13)`
- 服务无法稳定就绪

## 3) 根因分析

- 镜像默认用户是 `hindsight`（uid/gid `1000:1000`）。
- 新建命名卷挂载到 `/home/hindsight/.pg0` 后，目录属主为 `root:root`，权限 `755`。
- `hindsight` 用户对该目录无写权限，导致 embedded PostgreSQL 初始化失败。

## 4) 修复方案

已采用方案：
- 在 `docker-compose.hindsight.yml` 增加 `hindsight-volume-init` 一次性初始化服务：
  - 以 `root` 身份执行 `chown -R 1000:1000` 与 `chmod 700`
  - 主服务 `hindsight` 通过 `depends_on.condition=service_completed_successfully` 等待初始化完成

为什么选这个方案：
- 保持主服务继续以非 root 用户运行
- 同时兼容“直接 `docker compose up`”和仓库脚本调用路径

放弃方案：
- 直接让主服务长期以 root 运行（安全边界较差）
- 依赖手工执行一次 chown（容易遗漏）

## 5) 验证方式

- 冷启动验证（含删卷重建）：
  - `pnpm hindsight:down && docker volume rm ... && pnpm hindsight:start`
- 健康验证：
  - `pnpm hindsight:status`
  - `curl http://localhost:18888/health`
  - `curl -I http://localhost:19999/`
- 权限验证：
  - 在挂载卷内创建临时文件，确认属主为 `hindsight:hindsight`

