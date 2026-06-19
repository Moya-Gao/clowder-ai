-- Convention Graph Engine schema (F242, domain-agnostic)
-- 引擎不认任何特定 domain；MCP tool / skill / route 等由 domain plugin 提供。
-- 每条 edge 必须带 provenance（砚砚 OQ-8：错边比漏边危险，可追源）。

CREATE TABLE IF NOT EXISTS nodes (
  id          TEXT PRIMARY KEY,        -- scope_key 派生（见 domain plugin scopeKey）
  domain_id   TEXT NOT NULL,           -- 哪个 domain plugin 产的
  kind        TEXT NOT NULL,           -- plugin 声明的 node kind
  name        TEXT NOT NULL,           -- display name（不作 identity）
  scope_key   TEXT NOT NULL,           -- repo+package+lang+file+kind+domain 复合 key（消歧核心）
  file_path   TEXT,
  start_line  INTEGER,
  end_line    INTEGER,
  lang        TEXT,
  metadata    TEXT                     -- JSON, domain 特定
);

CREATE TABLE IF NOT EXISTS edges (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  source            TEXT NOT NULL,
  target            TEXT NOT NULL,
  kind              TEXT NOT NULL,
  domain_id         TEXT NOT NULL,
  -- provenance（每条边可追到 source span + extractor）
  extractor         TEXT NOT NULL,
  extractor_version TEXT NOT NULL,
  source_file       TEXT,
  source_line       INTEGER,
  confidence        TEXT NOT NULL DEFAULT 'static',  -- static | heuristic
  FOREIGN KEY (source) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (target) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS files (
  path          TEXT NOT NULL,
  domain_id     TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  indexed_at    INTEGER NOT NULL,
  PRIMARY KEY (path, domain_id)
);

-- 漏识别（砚砚 OQ-5 / AC-B2：不静默 0 命中）
CREATE TABLE IF NOT EXISTS gaps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id  TEXT NOT NULL,
  reason     TEXT NOT NULL,
  file_path  TEXT
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source, kind);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target, kind);
CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_unique ON edges(source, target, kind, domain_id, extractor, extractor_version);
CREATE INDEX IF NOT EXISTS idx_nodes_scope  ON nodes(scope_key);
CREATE INDEX IF NOT EXISTS idx_nodes_domain ON nodes(domain_id);
CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
CREATE INDEX IF NOT EXISTS idx_files_domain ON files(domain_id);
