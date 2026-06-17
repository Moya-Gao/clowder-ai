# _sanitize-rules.pl — Shared sanitizer rules for sync-to-opensource.sh and sync-hotfix.sh
# This file is the single source of truth for all outbound sanitization transforms.
# Used via: perl -pi scripts/_sanitize-rules.pl <file1> [file2] ...
# Or via:   cat scripts/_sanitize-rules.pl | perl -pi /dev/stdin <files>
#
# Conditional logic uses $ARGV (the current filename being processed by perl -pi).
# Files under docs/ or cat-cafe-skills/ get additional transforms (cat names, internal links).

# ── Personal info (all files) ──
# Most personal identifiers are scrubbed globally. Role-language cleanup for
# docs/ and skill refs happens in the docs/skills block below so package fixtures
# can keep deliberate user-mention test strings.
s/\@Landy/\@co-creator/g;
s/\@landy/\@co-creator/g;
s/\@Lysander/\@co-creator/g;
s/\@lysander/\@co-creator/g;
s/\@l\.s\./\@co-creator/g;
s/"Landy"/"You"/g;
s/'Landy'/'You'/g;
s/name: "Landy"/name: "You"/g;
s/'landy'/'you'/g;
s/'l\.s\.'/'you'/g;
s/Landy/You/g;
s/lysander/you/g;
s/suces-MacBook[^ ]*/dev-machine/g;

# ── Redis ports ──
# Opensource uses same ports as internal (6399 prod, 6398 dev).
# Only the Chinese label needs translation.
s/6399 圣域/production Redis (sacred)/g;

# ── F203 native L0 prompt template ──
# This file is governance-like content. Token-level sanitization can leave
# broken or home-only rules behind, so rewrite the public-only rules explicitly.
if ($ARGV =~ m{assets/system-prompts/system-prompt-l0\.md$}) {
  s/^# Cat Café L0 — Native System Prompt（压缩免疫层）$/# Clowder AI L0 — Native System Prompt/;
  s/^> \*\*决策来源\*\*：.*$/> **Decision source**: public agent collaboration protocol and runtime safety contract./;
  s/^> \*\*F203 Phase A 实测验证\*\*：.*$/> **Validation**: public sync runs compiler smoke tests before export./;
  s/Cat Café 的护城河是情感壁垒不是技术壁垒（IKEA 效应 \+ 自我延伸 \+ 安全依恋）/Clowder AI 的价值来自可验证、可持续的长期协作，而不是一次性的工具调用/g;
  s/Cat Café/Clowder AI/g;
  s/Cat Cafe/Clowder AI/g;
  s/铲屎官/co-creator/g;
  # F238: CVO in L0 governance text (assets/ path doesn't match docs/skills block)
  s/\bCVO\b/operator/g;
  s/改 Redis 圣域/修改生产数据边界/g;
  # F238: Standalone "Redis 圣域" in decision tree / escalation contexts (O4)
  # Must run AFTER "改 Redis 圣域" to avoid partial match.
  s/Redis 圣域/production data boundary/g;

  if (/^1\. \*\*(?:Redis 6399 圣域|Redis production Redis \(sacred\))\*\* — /) {
    $_ = "1. **Runtime data safety** — Use isolated development/test data stores; never point local experiments at production user data\n";
  }
  if (/^4\. \*\*Alpha 验收通道\*\* — /) {
    $_ = "4. **Release acceptance channel** — Validate merged changes in an isolated acceptance environment; test unmerged work in a feature checkout\n";
  }
}

# ── F238: L4 cultural terms (all managed files, after L0 block) ──
# Standalone "Redis 圣域" for non-L0 files (L0 handled above with ordering guard).
# Must be AFTER L0 block so L0's "改 Redis 圣域" → specific rewrite wins.
s/Redis 圣域/production data boundary/g;

# ── Port remapping (all files) ──
# Convention: internal 3001(Frontend)→3003, internal 3002(API)→3004
# So that API = Frontend + 1 holds in both environments.
s#http://localhost:3002#http://localhost:3004#g;
s#http://localhost:3001#http://localhost:3003#g;
s#http://127\.0\.0\.1:3002#http://127.0.0.1:3004#g;
s#http://127\.0\.0\.1:3001#http://127.0.0.1:3003#g;
s#http://\[::1\]:3002#http://[::1]:3004#g;
s#http://\[::1\]:3001#http://[::1]:3003#g;
s#localhost:3002#localhost:3004#g;
s#localhost:3001#localhost:3003#g;
s#127\.0\.0\.1:3002#127.0.0.1:3004#g;
s#127\.0\.0\.1:3001#127.0.0.1:3003#g;
s#\[::1\]:3002#[::1]:3004#g;
s#\[::1\]:3001#[::1]:3003#g;
s#3002/3001#3004/3003#g;
s#3001/3002#3003/3004#g;
# Bare port defaults in shell scripts and config (context-aware: bash ${:-N}, env defaults, port assignments)
s#\bFRONTEND_PORT:-3001\b#FRONTEND_PORT:-3003#g;
s#\bFRONTEND_PORT:-3002\b#FRONTEND_PORT:-3004#g;
s#\bFRONTEND_PORT=3001\b#FRONTEND_PORT=3003#g;
s#\bAPI_SERVER_PORT:-3002\b#API_SERVER_PORT:-3004#g;
s#\bAPI_SERVER_PORT=3002\b#API_SERVER_PORT=3004#g;
# Uppercase PORT= assignment (e.g. PORT=3002 in SKILL.md runtime examples)
s#\bPORT=3002\b#PORT=3004#g;
s#\bPORT=3001\b#PORT=3003#g;
s#\bport 3001\b#port 3003#gi;
s#\bport 3002\b#port 3004#gi;
# Chinese port annotation (e.g. "3001=前端")
s#3001=前端#3003=前端#g;
s#3002=API#3004=API#g;
# Port in quoted string defaults (env-registry pattern: defaultValue: '3002')
s#defaultValue: '3002'#defaultValue: '3004'#g;
s#defaultValue: '3001'#defaultValue: '3003'#g;
# JS nullish coalescing defaults (?? '3002' in template literals like SessionBootstrap)
s#\?\? '3002'#?? '3004'#g;
s#\?\? '3001'#?? '3003'#g;
# JS const assignment defaults (platform-status.mjs: DEFAULT_API_PORT = '3002')
s#DEFAULT_API_PORT = '3002'#DEFAULT_API_PORT = '3004'#g;
s#DEFAULT_WEB_PORT = '3001'#DEFAULT_WEB_PORT = '3003'#g;
s#localhost:18060#<local-integration-endpoint>#g;
s#localhost:9000#<local-browser-automation-endpoint>#g;

# ── /Users/ path scrubbing (all files) ──
# directory-picker-modal.test collapses the project path to a generic
# '/path/to/project' (basename 'project') so its toContain('project') / toBe('project')
# assertions match. Keep that transform ONLY for that file.
#
# Other files MUST preserve the basename: fixtures whose logic depends on
# basename === repository stay consistent after sanitization. Example:
# sop-predicate-evaluator.test's git_state_predicate scope gate checks
# `worktreeRoot.includes(repository)`. The repository field 'cat-cafe' is NOT
# scrubbed (repo names are intentionally preserved, see brand-name note below), so
# the worktreeRoot must keep its 'cat-cafe' basename. It falls through to the
# cat-cafe-aware rule below: /Users/dev/cat-cafe → /home/user/cat-cafe → includes('cat-cafe') ✓.
# (Previously line 96 unconditionally rewrote it to /path/to/project → basename
# 'project' → includes('cat-cafe') false → violation silently degraded to pass.)
if ($ARGV =~ m{directory-picker-modal\.test\.(ts|js)$}) {
  s#/Users/[^\s,"'}\]]+/cat-cafe\b#/path/to/project#g;
  s#toContain\('cat-cafe'\)#toContain('project')#g;
  s#toBe\('cat-cafe'\)#toBe('project')#g;
}
# cat-cafe-aware scrub (cloud codex P1 2026-05-28): scrub the /Users/<dev> prefix but
# PRESERVE the 'cat-cafe' basename AND any remaining subpath. Two consumers depend on this:
#   1. sop-predicate-evaluator.test: worktreeRoot.includes('cat-cafe') must stay true.
#   2. mcp-config-adapters.test / deprecated-managed-servers.test: assert that user forks
#      like /Users/alice/forks/cat-cafe/packages/mcp-server/dist/index.js keep their
#      cat-cafe/packages/... suffix (proves fork-path preservation). The bare multi-segment
#      rule below would collapse those to just the leaf (/home/user/index.js) — regression.
# Must run BEFORE the multi-segment rule so the cat-cafe path is captured first.
s#/Users/[^\s,"'}\]/]+/(?:[^\s,"'}\]/]+/)*cat-cafe\b#/home/user/cat-cafe#g;
# First: multi-segment paths → keep last segment
s#/Users/(?:[^\s,"'}\]/]+/)+([^\s,"'}\]/]+)#/home/user/$1#g;
# Fallback: bare /Users/username (only 2 segments) → /home/user
s#/Users/[^\s,"'}\]/]+#/home/user#g;

# ── Internal repo URL → public repo URL (all files) ──
# F179: desktop installer references the internal repo for AppPublisherURL etc.
# When syncing to clowder-ai, those URLs must point to the public repo.
#
# Boundary: use (?![\w-]) instead of \b so we don't over-match repos that
# legitimately start with `cat-cafe-` (e.g. cat-cafe-tutorials, cat-cafe-skills).
# Match cases (rewrite):
#   https://github.com/zts212653/cat-cafe              # bare repo URL (EOL)
#   https://github.com/zts212653/cat-cafe/issues/1     # path
#   https://github.com/zts212653/cat-cafe.git          # git URL
#   https://github.com/zts212653/cat-cafe#readme       # anchor
# Non-match (preserve):
#   https://github.com/zts212653/cat-cafe-tutorials    # different repo
#   https://github.com/zts212653/cat-cafe-skills/...   # different repo
s#https://github\.com/zts212653/cat-cafe(?![\w-])#https://github.com/zts212653/clowder-ai#g;
s#git\@github\.com:zts212653/cat-cafe(?![\w-])#git\@github.com:zts212653/clowder-ai#g;

# ── *.opensource.md → *.md link rewriting (all files) ──
# The sync script copies README.opensource.md → README.md, SETUP.opensource.md → SETUP.md, etc.
# Cross-references inside these files must follow suit.
s/SETUP\.opensource\.md/SETUP.md/g;
s/SETUP\.opensource\.zh-CN\.md/SETUP.zh-CN.md/g;
s/README\.opensource\.md/README.md/g;
s/README\.opensource\.zh-CN\.md/README.zh-CN.md/g;
s/CONTRIBUTING\.opensource\.md/CONTRIBUTING.md/g;

# ── BACKLOG.md → ROADMAP.md (source + test files) ──
# The actual file is renamed by sync-to-opensource.sh (docs/BACKLOG.md → docs/ROADMAP.md).
# All code references must follow suit so gitShowFile / readBacklogContent find the right file.
#
# IMPORTANT: Only transform the docs/-prefixed path, NOT bare 'BACKLOG.md'.
# Bare references are used by governance templates (methodology-templates.ts) and
# test fixtures (governance-bootstrap.test.js, backlog-routes.test.js) for scaffolding
# new projects — those MUST stay as BACKLOG.md.
#
# Five patterns to catch:
#   1. 'docs/BACKLOG.md'  → 'docs/ROADMAP.md'  (string path literals)
#   2. 'docs', 'BACKLOG.md' → 'docs', 'ROADMAP.md'  (join(root, 'docs', 'BACKLOG.md'))
#   3. docs\/BACKLOG\.md → docs\/ROADMAP\.md  (regex patterns like SHARED_STATE_PATTERN)
#   4. '../BACKLOG.md' → '../ROADMAP.md' (relative links from docs/features tests)
#   5. Comments mentioning docs/BACKLOG.md also get updated for consistency
if ($ARGV =~ m{\.(tsx?|js)$}) {
  s#docs/BACKLOG\.md#docs/ROADMAP.md#g;
  s#'docs', 'BACKLOG\.md'#'docs', 'ROADMAP.md'#g;
  s#docs\\/BACKLOG\\\.md#docs\\/ROADMAP\\.md#g;
  s#\.\./BACKLOG\.md#../ROADMAP.md#g;
}

# ── Brand name: UI-facing "Cat Cafe" → "Clowder AI" (source + test + data + shell files) ──
# Applies to .ts/.tsx/.js/.mjs/.json/.yaml/.yml/.sh files — user-visible strings.
# F238: Extended from .ts/.tsx/.js to cover manifest.json, compile-system-prompt-l0.mjs,
# sop-definitions/*.yaml, plugin manifests, and generated configs.
# F228 Round 2 outbound sync blocker: extended to .sh — exported shell scripts
# (e.g., scripts/alpha-worktree.sh help banner) had their "Cat Cafe ... Manager"
# string surviving export while .js test expectations were already sanitized to
# "Clowder AI ... Manager", producing test gate failure. Sanitizer only ever sees
# files that survive sync exclusion filtering ($FILTERED_DIR), so internal-only
# .sh files (sync-to-opensource.sh, intake-from-opensource.sh, sync-to-tutorials.sh)
# are not touched because they are excluded from export before perl runs.
# Does NOT touch: @cat-cafe/* imports, cat-cafe-skills/, cat-cafe: keys, cat_cafe_* tools.
if ($ARGV =~ m{\.(tsx?|js|mjs|json|ya?ml|sh)$}) {
  # Page metadata and header titles
  s/title: 'Cat Cafe'/title: 'Clowder AI'/g;
  s/'Cat Cafe'/'Clowder AI'/g;
  # Double-quoted variants
  s/"Cat Cafe"/"Clowder AI"/g;
  # Template literals and display strings
  s/Cat Cafe 运行配置/Clowder AI Config/g;
  # Thread indicator default text
  s/三只 AI 猫猫的协作空间/Your AI team collaboration space/g;
  # Pixel brawl demo label
  s/Cat Caf\&eacute; Fighting Demo/Clowder AI Fighting Demo/g;
  # Voice input context (whisper prompt)
  s/这是 Cat Cafe 猫猫协作项目的对话。宪宪是布偶猫（Claude Opus），砚砚是缅因猫（Codex）。/This is a Clowder AI team conversation./g;
  # Story export label and JSX content
  s/>Cat Cafe</>Clowder AI</g;
  # "Cat Café" with accent (Hub labels, aria-labels, titles, warnings)
  s/Cat Café Hub/Clowder AI Hub/g;
  s/Cat Café/Clowder AI/g;
  # F238: Bare "Cat Cafe" (no accent) within larger strings — must run AFTER
  # quoted and accented patterns above so specific matches win first.
  # Safe: lowercase "cat-cafe" (imports, paths, keys) does not match.
  s/Cat Cafe/Clowder AI/g;
  # Chinese welcome message (unquoted in JSX)
  s/欢迎来到 Cat Cafe!/Welcome to Clowder AI!/g;
  # Push settings Chinese text → English
  s/iPhone 用户请将 Cat Cafe 添加到主屏幕后再开启推送（Safari 普通标签页不支持 Web Push）。/On iPhone, add Clowder AI to your home screen before enabling push (Safari tabs do not support Web Push)./g;
  s/开启后，猫猫回复、权限请求等会推送到系统通知栏（即使不在 Cat Cafe 页面）。/When enabled, replies and permission requests push to system notifications (even when not on the Clowder AI page)./g;
  # JSDoc comments
  s/Unified API client for Cat Cafe frontend/Unified API client for Clowder AI frontend/g;
  # Capability tab skill category labels
  s/Cat Cafe Skills/Clowder AI Skills/g;
  # F238: Role, L4, and Chinese product terms for all managed text extensions
  # (dictionary: assets/brand-dictionary.yaml — role.co_creator, role.cvo, product.primary)
  # docs/cat-cafe-skills paths have their own 铲屎官→operator mapping below;
  # for source/config/data files, co-creator is the dictionary canonical.
  # Guard: skip docs/skills paths (their operator mapping wins — cloud P2).
  s/铲屎官/co-creator/g unless $ARGV =~ m{/(docs|cat-cafe-skills)/};
  s/\bCVO\b/operator/g;
  # Chinese product name (manifest short_name, UI labels)
  s/"猫猫"/"Clowder AI"/g;
}

# ── F238: Quote co-creator at unquoted JS/TS key position (cloud P1 + gpt52 delta P2) ──
# Two-pass fix: the brand block above replaces ALL 铲屎官→co-creator (including
# in strings with colons). This second pass then quotes "co-creator" when it
# appears as an unquoted object key — "co-creator:" is invalid JS/TS syntax.
# Matches: line-start/whitespace/comma/brace + co-creator + colon.
# Does NOT match: 'co-creator:' (preceded by quote, not whitespace/brace).
if ($ARGV =~ m{\.(tsx?|jsx?|mjs)$}) {
  s/(^|[\s,{])co-creator(\s*:)/$1'co-creator'$2/g;
}

# ── F238: cat-template.json mentionPatterns dedupe (P2 review finding) ──
# 铲屎官→co-creator above creates duplicate @co-creator in mentionPatterns
# arrays that already had @co-creator. Dedupe by removing the trailing duplicate
# on mentionPatterns lines. Must run AFTER the brand block.
if ($ARGV =~ m{cat-template\.json$} && /mentionPatterns/) {
  # Remove second @co-creator when first already present in same array.
  # Note: \@ required — bare @ is Perl array interpolation in regex.
  while (s/("\@co-creator".*?),\s*"\@co-creator"/$1/) {}
}

# ── api-client-resolve test: bare-IP port assertions ──
if ($ARGV =~ m{api-client-resolve\.test\.(ts|js)$}) {
  # Test uses non-loopback IPs (10.x, 192.168.x) with internal ports
  s#(\d+\.\d+\.\d+\.\d+):3002#$1:3004#g;
  s#(\d+\.\d+\.\d+\.\d+):3001#$1:3003#g;
  s#port: '3001'#port: '3003'#g;
  s#3001→3002#3003→3004#g;
}

# ── review-start public guard: reserved runtime ports remap ──
if ($ARGV =~ m{scripts/review-start\.sh$}) {
  s#3001\|3002\|3011\|3012\|4111#3003|3004|3011|3012|4111#g;
}
if ($ARGV =~ m{packages/api/test/review-start-script\.test\.js$}) {
  s#\{ web: '3001', api: '3002' \}#{ web: '3003', api: '3004' }#g;
}

# ── Public package scripts ──
# desktop:* scripts removal has moved to the JSON-aware Node transform in
# sync-to-opensource.sh step 3k-3a1 (Object.keys filter on pkg.scripts).
# Line-based perl was fragile: it assumed desktop: immediately followed
# check:start-profile-isolation and broke when check:brand-dictionary /
# check:brand-guard were inserted between (produced invalid JSON).
# Perl is now intentionally a no-op for package.json.

# ── security-headers (source + test): Host header port references ──
if ($ARGV =~ m{security-headers[^/]*\.(ts|js)$}) {
  # Host headers use various hostnames with internal ports (IPv6 loopback, evil.com, etc.)
  s#:3002\b#:3004#g;
  s#:3001\b#:3003#g;
}

# ── Governance-pack test: port assertions align with sync'd source ──
if ($ARGV =~ m{governance-pack\.test\.(js|ts)$}) {
  s/block\.includes\('3001'\)/block.includes('3003')/g;
  s/internal port 3001/port 3003/g;
  s/block\.includes\('reserved'\)/block.includes('local defaults')/g;
  s/Port reservation concept should be present/Port defaults guidance should be present/g;
}

# ── KD-5: Remove opensource-ops from public-facing files ──
if ($ARGV =~ m{cat-cafe-skills/manifest\.yaml$}) {
  $_ = "" if /^  # ── .*(?:opensource-ops|开源社区运营)/;
  s/,\s*"opensource-ops"//g;
  s/"opensource-ops"\s*,\s*//g;
  s/\[\s*"opensource-ops"\s*\]/[]/g;
  if (/^  opensource-ops:\s*$/) { $__skip_oo = 1; $_ = ""; }
  if ($__skip_oo && $_ ne "") {
    if (/^  \S/ || /^\S/) { $__skip_oo = 0; }
    else { $_ = ""; }
  }
}
if ($ARGV =~ m{BOOTSTRAP\.md$}) {
  $_ = "" if /\bopensource-ops\b/;
}

# ── Cat names + BACKLOG ref (docs + skills only) ──
if ($ARGV =~ m{/(docs|cat-cafe-skills)/}) {
  s/铲屎官原话/operator experience/g;
  s/铲屎官/operator/g;
  s/布偶猫/Ragdoll/g;
  s/缅因猫/Maine Coon/g;
  s/暹罗猫/Siamese/g;
  s/孟加拉猫/Bengal/g;
  s/宪宪/Ragdoll/g;
  s/砚砚/Maine Coon/g;
  s/烁烁/Siamese/g;
  s/\bthread_(?=[a-z0-9_]*[0-9])[a-z0-9_]{8,}\b/[thread-id]/g if $ARGV =~ m{\.(md|mdx|txt)$};
  s/\$[1-9][0-9]+(?:-[1-9][0-9]+)?\b/operational cost/g if $ARGV =~ m{\.(md|mdx|txt)$};
  s/\b[0-9]+\s*轮云端 review/multiple remote review rounds/g;
  s/云端 review/remote review/g;
  s/\bCVO\b/operator/g;
  s/BACKLOG\.md/ROADMAP.md/g;
  s/lessons-learned\.md/public-lessons.md/g;
}

# ── Internal link stripping + path remapping (docs + skills only) ──
if ($ARGV =~ m{/(docs|cat-cafe-skills)/}) {
  # Remove list-item lines that are pure internal links
  $_ = "" if /^- \[.*?\]\((?:\.\.\/?|docs\/|\.\/)?(?:archive|plans|mailbox|discussions|research|reflections|evidence|runbooks|episodes|guides|phases|methods|evolution-proposals|stories|prompts|lessons)\//;
  # Convert inline links to private dirs into plain text
  s/\[([^\]]*?)\]\((?:\.\.\/?|docs\/|\.\/)?(?:archive|plans|mailbox|discussions|research|reflections|evidence|runbooks|episodes|guides|phases|methods|evolution-proposals|stories|prompts|lessons)\/[^)]*\)/$1 (internal)/g;
  # Backtick-quoted internal paths (#682): remap structural dirs, then mask specific dated files
  # Step 1: Remap directory prefix in backticks (structural → public equivalent)
  s/`(?:docs\/)?discussions\//`feature-discussions\//g;
  s/`(?:docs\/)?plans\//`feature-specs\//g;
  s/`(?:docs\/)?mailbox\//`review-notes\//g;
  s/`(?:docs\/)?archive\//`internal-archive\//g;
  s/`(?:docs\/)?research\//`project-research\//g;
  s/`(?:docs\/)?reflections\//`project-reflections\//g;
  s/`(?:docs\/)?evidence\//`project-evidence\//g;
  s/`(?:docs\/)?runbooks\//`project-runbooks\//g;
  # Step 2: Fail-closed masking of remapped backtick paths
  # 2a: Mask paths containing real dates (YYYY-MM-DD with or without trailing segment)
  s/`[^`]*(?:feature-discussions|feature-specs|review-notes|internal-archive|project-research|project-reflections|project-evidence|project-runbooks)\/[^`]*\d{4}-\d{2}-\d{2}[^`]*`/*(internal reference removed)*/g;
  # 2b: Mask paths with non-template subdirectories followed by / (e.g. knowledge-enginnering/file.md)
  # Template subdirs contain { < * so [^`{<*\/]+ only matches specific named subdirs
  s/`[^`]*(?:feature-discussions|feature-specs|review-notes|internal-archive|project-research|project-reflections|project-evidence|project-runbooks)\/[^`{<*\/]+\/[^`]*`/*(internal reference removed)*/g;
  # 2c: Mask bare subdir refs without trailing / (no file extension = directory name, not a file)
  s/`[^`]*(?:feature-discussions|feature-specs|review-notes|internal-archive|project-research|project-reflections|project-evidence|project-runbooks)\/[^`{<*\/\.]+`/*(internal reference removed)*/g;
  # Specific path templates
  s#docs/mailbox/YYYY-MM-DD-\{topic\}-review-request\.md#review request note#g;
  s#docs/plans/YYYY-MM-DD-<feature-name>\.md#feature spec or implementation note#g;
  s#docs/plans/YYYY-MM-DD-xxx\.md#feature spec or implementation note#g;
  s#docs/plans/\{date\}-\{topic\}\.md 或 docs/phases/\{name\}\.md#the active feature spec or implementation plan#g;
  s#docs/discussions/YYYY-MM-DD-\{topic\}/README\.md#feature discussion#g;
  s#docs/discussions/\{date\}-\{fid\}-design/#feature discussion record/#g;
  # Path remapping
  s#docs/mailbox/#review-notes/#g;
  s#docs/plans/#feature-specs/#g;
  s#docs/discussions/#feature-discussions/#g;
  s#docs/archive/#internal-archive/#g;
  s#docs/research/#project-research/#g;
  s#docs/reflections/#project-reflections/#g;
  s#docs/evidence/#project-evidence/#g;
  s#docs/runbooks/#project-runbooks/#g;
  s#(^|[^A-Za-z])mailbox/#${1}review-notes/#g;
  s#(^|[^A-Za-z])plans/#${1}feature-specs/#g;
  s#(^|[^A-Za-z])discussions/#${1}feature-discussions/#g;
  s#(^|[^A-Za-z])archive/#${1}internal-archive/#g;
  # Note: no bare-dir remap for research/reflections/evidence/runbooks —
  # these words appear in compound names (deep-research/, cat-cafe-evidence/) (#682 P1)
  # Double-prefix fix
  s#feature-feature-discussions/#feature-discussions/#g;
  s#feature-feature-specs/#feature-specs/#g;
  s#internal-internal-archive/#internal-archive/#g;
  # No project-project-* fix needed: bare-dir remaps removed for these 4 (#682 P1)
  # Port pair normalization (ensure Frontend/API order is 3003/3004)
  s#localhost:3003/3002#localhost:3003/3004#g;
  s#localhost:3004/3003#localhost:3003/3004#g;
  s#3003/3002#3003/3004#g;
  s#3004/3003#3003/3004#g;
  # Config path normalization
  s#`\.env\.local`#`.env`#g;
  s#\.env\.local#.env#g;
  s#\.cat-cafe/\*secrets\*\.local\.json#local secrets file#g;
}
