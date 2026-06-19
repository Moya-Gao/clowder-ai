/**
 * skill-manifest domain extractor（F242 第二个 cat-cafe convention domain）。
 *
 * 抽取 `cat-cafe-skills/<skill>/SKILL.md` frontmatter：
 *  - `name` → skill_manifest 节点
 *  - `triggers[]` → skill_trigger 节点 + triggers 边
 *
 * 这是 Phase A 的第二类约定：不把 skill 文件当普通 markdown 搜索结果，而是把
 * “什么时候该加载哪个 skill”建成可追 provenance 的约定边。
 */
import type { ConventionEdge, ConventionNode } from '../engine.ts';
import type {
  ConventionDomainPlugin,
  ExtractCtx,
  ExtractResult,
  Gap,
  NegativeFixture,
  RawNodeIdentity,
} from '../plugin.ts';
import { standardScopeKey } from '../plugin.ts';

const DOMAIN_ID = 'skill-manifest';
const EXTRACTOR = 'skill-manifest-extractor';
const VERSION = '0.1.0';

function baseName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] ?? filePath;
}

function skillPackage(filePath: string): string {
  const m = filePath.match(/^cat-cafe-skills\/([^/]+)\//);
  return m ? `skill:${m[1]!}` : 'unknown';
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

interface ParsedSkillManifest {
  name: string;
  nameLine: number;
  triggers: { value: string; line: number }[];
}

function parseSkillManifest(content: string): ParsedSkillManifest | null {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') return null;
  const end = lines.findIndex((line, idx) => idx > 0 && line === '---');
  if (end < 0) return null;

  let name: string | null = null;
  let nameLine = 0;
  const triggers: { value: string; line: number }[] = [];

  for (let i = 1; i < end; i += 1) {
    const line = lines[i]!;
    const nameMatch = line.match(/^name:\s*(.+?)\s*$/);
    if (nameMatch) {
      name = unquote(nameMatch[1]!);
      nameLine = i + 1;
      continue;
    }
    if (/^triggers:\s*$/.test(line)) {
      for (let j = i + 1; j < end; j += 1) {
        const triggerMatch = lines[j]!.match(/^\s*-\s*(.+?)\s*$/);
        if (!triggerMatch) {
          if (/^\S/.test(lines[j]!)) break;
          continue;
        }
        triggers.push({ value: unquote(triggerMatch[1]!), line: j + 1 });
      }
    }
  }

  return name ? { name, nameLine, triggers } : null;
}

const NEGATIVE_FIXTURES: readonly NegativeFixture[] = [
  {
    description: '普通 markdown 即使含 name: 字样，也不能被误抽成 skill_manifest',
    files: [{ path: 'docs/random/SKILL.md', content: '# Not a skill\n\nname: fake\n' }],
    mustNotConnect: { from: '写代码', to: 'fake' },
  },
];

function extract(ctx: ExtractCtx): ExtractResult {
  const nodes: ConventionNode[] = [];
  const edges: ConventionEdge[] = [];
  const gaps: Gap[] = [];

  for (const f of ctx.files) {
    if (!/(^|\/)cat-cafe-skills\/[^/]+\/SKILL\.md$/.test(f.path)) continue;
    const parsed = parseSkillManifest(f.content);
    if (!parsed) {
      gaps.push({
        domainId: DOMAIN_ID,
        reason: 'SKILL.md 缺少可解析的 YAML frontmatter name',
        filePath: f.path,
      });
      continue;
    }

    const skillId: RawNodeIdentity = {
      repo: ctx.repo,
      pkg: skillPackage(f.path),
      lang: 'markdown',
      file: baseName(f.path),
      kind: 'skill_manifest',
      domainId: DOMAIN_ID,
      name: parsed.name,
    };
    const skillScopeKey = standardScopeKey(skillId);
    const skillNode: ConventionNode = {
      id: skillScopeKey,
      domainId: DOMAIN_ID,
      kind: 'skill_manifest',
      name: parsed.name,
      scopeKey: skillScopeKey,
      filePath: f.path,
      startLine: parsed.nameLine,
      lang: 'markdown',
      metadata: { triggers: parsed.triggers.map((t) => t.value) },
    };
    nodes.push(skillNode);

    for (const t of parsed.triggers) {
      const triggerId: RawNodeIdentity = {
        repo: ctx.repo,
        pkg: skillPackage(f.path),
        lang: 'markdown',
        file: baseName(f.path),
        kind: 'skill_trigger',
        domainId: DOMAIN_ID,
        name: t.value,
      };
      const triggerScopeKey = standardScopeKey(triggerId);
      const triggerNode: ConventionNode = {
        id: triggerScopeKey,
        domainId: DOMAIN_ID,
        kind: 'skill_trigger',
        name: t.value,
        scopeKey: triggerScopeKey,
        filePath: f.path,
        startLine: t.line,
        lang: 'markdown',
      };
      nodes.push(triggerNode);
      edges.push({
        source: triggerNode.id,
        target: skillNode.id,
        kind: 'triggers',
        domainId: DOMAIN_ID,
        provenance: {
          extractor: EXTRACTOR,
          extractorVersion: VERSION,
          sourceFile: f.path,
          sourceLine: t.line,
          confidence: 'static',
        },
      });
    }
  }

  return { nodes, edges, gaps };
}

export const skillManifestPlugin: ConventionDomainPlugin = {
  domainId: DOMAIN_ID,
  nodeKinds: ['skill_manifest', 'skill_trigger'],
  edgeKinds: ['triggers'],
  scopeKey: standardScopeKey,
  extractorInputs: {
    globs: ['cat-cafe-skills/*/SKILL.md'],
    needsTypeScript: false,
  },
  invalidationScope: (changedFile) => /(^|\/)cat-cafe-skills\/[^/]+\/SKILL\.md$/.test(changedFile),
  negativeFixtures: NEGATIVE_FIXTURES,
  extract,
};
