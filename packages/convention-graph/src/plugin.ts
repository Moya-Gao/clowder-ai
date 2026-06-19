/**
 * ConventionDomainPlugin 接口（F242 Design Gate §2）。
 *
 * 引擎 domain-agnostic（engine.ts）；每个 domain（mcp-tool / skill-manifest /
 * workflow-callback）由一个 plugin 提供「怎么抽节点和边」。真正沉淀成 skill 的是
 * discovery protocol 方法论，不是任何具体 plugin（两轮 brainstorm 收敛）。
 *
 * 铁律（砚砚 OQ-2 / OQ-8）：
 *  - node identity 走 scope_key 复合键（含 name），不靠裸 display name → 消歧
 *  - 跨 domain 边必须来自显式约定锚点或 typed import，禁 name-only 跨域合并
 *  - 每条 edge 带 provenance（错边比漏边危险，可追到 source span + extractor）
 */
import type { ConventionEdge, ConventionNode } from './engine.ts';

/**
 * scope_key 的输入维度（消歧核心）。
 *
 * Design Gate §2 列的维度（repo|pkg|lang|file|kind|domainId）解「同名不同位置」，
 * 但同 file 同 kind 的多个节点（如一个 tools 文件里的多个 tool）还需 `name` 才能
 * 区分「同位置不同名」。完整 identity = 全维度 including name（spec 列表的合理修正，
 * 由 owner 实现时补 —— 见 commit / Design Gate §2 注脚）。
 */
export interface RawNodeIdentity {
  repo: string;
  pkg: string;
  lang: string;
  file: string;
  kind: string;
  domainId: string;
  name: string;
}

/** 标准 scope_key：7 段 `|` 复合键，唯一标识一个 node。 */
export function standardScopeKey(id: RawNodeIdentity): string {
  return [id.repo, id.pkg, id.lang, id.file, id.kind, id.domainId, id.name].join('|');
}

/** extractor 的输入需求（glob 选文件 + 是否需要 TS compiler AST）。 */
export interface ExtractorInput {
  globs: readonly string[];
  needsTypeScript: boolean;
}

/** 待解析的源文件（path 相对 repo root）。 */
export interface SourceFile {
  path: string;
  content: string;
}

/**
 * extract 的上下文：纯输入。
 * 文件内容由外层（discovery protocol / 测试）按 extractorInputs.globs 准备好传入，
 * extractor 不直接碰文件系统 → 纯函数，可用 in-memory fixture 测。
 */
export interface ExtractCtx {
  repo: string;
  files: readonly SourceFile[];
}

/** 漏识别（schema gaps 表，砚砚 OQ-5 / AC-B2：不静默 0 命中）。 */
export interface Gap {
  domainId: string;
  reason: string;
  filePath?: string;
}

export interface ExtractResult {
  nodes: ConventionNode[];
  edges: ConventionEdge[];
  gaps: Gap[];
}

/**
 * 同名跨域不误连的对抗测试（hard 门禁，砚砚 OQ-2）。
 * 抽完后 `mustNotConnect.from`/`to` 对应的 node 之间不应有任何 edge，
 * 且 `to`（同名非约定对象）不应被误抽成本 domain 的节点。
 */
export interface NegativeFixture {
  description: string;
  files: SourceFile[];
  mustNotConnect: { from: string; to: string };
}

export interface ConventionDomainPlugin {
  domainId: string;
  nodeKinds: readonly string[];
  edgeKinds: readonly string[];
  scopeKey(id: RawNodeIdentity): string;
  extractorInputs: ExtractorInput;
  /** 改这个文件要不要重抽本 domain（freshness 增量，报告 §17）。 */
  invalidationScope(changedFile: string): boolean;
  negativeFixtures: readonly NegativeFixture[];
  extract(ctx: ExtractCtx): ExtractResult;
}
