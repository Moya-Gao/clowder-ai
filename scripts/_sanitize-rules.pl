# _sanitize-rules.pl — Shared sanitizer rules for sync-to-opensource.sh and sync-hotfix.sh
# This file is the single source of truth for all outbound sanitization transforms.
# Used via: perl -pi scripts/_sanitize-rules.pl <file1> [file2] ...
# Or via:   cat scripts/_sanitize-rules.pl | perl -pi /dev/stdin <files>
#
# Conditional logic uses $ARGV (the current filename being processed by perl -pi).
# Files under docs/ or cat-cafe-skills/ get additional transforms (cat names, internal links).

# ── Personal info (all files) ──
# 铲屎官：猫圈通用梗（猫主子的仆人），非个人信息，保留不替换
s/\@Landy/\@owner/g;
s/\@landy/\@owner/g;
s/\@Lysander/\@owner/g;
s/\@lysander/\@owner/g;
s/\@l\.s\./\@owner/g;
s/"Landy"/"Owner"/g;
s/'Landy'/'Owner'/g;
s/name: "Landy"/name: "Owner"/g;
s/'landy'/'owner'/g;
s/'l\.s\.'/'owner'/g;
s/Landy/Owner/g;
s/lysander/owner/g;
s/suces-MacBook[^ ]*/dev-machine/g;

# ── Redis ports (all files) ──
s#redis://localhost:6399#redis://localhost:6379#g;
s#redis://localhost:6398#redis://localhost:6380#g;
s/6399 圣域/production Redis (sacred)/g;

# ── Port remapping (all files) ──
s#http://localhost:3002#http://localhost:3003#g;
s#http://localhost:3001#http://localhost:3004#g;
s#http://127\.0\.0\.1:3002#your local Clowder API URL#g;
s#http://127\.0\.0\.1:3001#http://127.0.0.1:3004#g;
s#localhost:3002#localhost:3003#g;
s#localhost:3001#localhost:3004#g;
s#127\.0\.0\.1:3002#127.0.0.1:3003#g;
s#127\.0\.0\.1:3001#127.0.0.1:3004#g;
s#3002/3001#3003/3004#g;
s#3001/3002#3004/3003#g;
s#localhost:18060#<local-integration-endpoint>#g;
s#localhost:9000#<local-browser-automation-endpoint>#g;

# ── /Users/ path scrubbing (all files) ──
s#/Users/[^\s,"'}\]]+/cat-cafe\b#/path/to/project#g;
s#/Users/[^\s,"'}\]]+#/home/user#g;

# ── KD-5: Remove opensource-ops from public-facing files ──
if ($ARGV =~ m{cat-cafe-skills/manifest\.yaml$}) {
  $_ = "" if /^  # ── .*(?:opensource-ops|开源社区运营)/;
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
  s/布偶猫/Ragdoll/g;
  s/缅因猫/Maine Coon/g;
  s/暹罗猫/Siamese/g;
  s/宪宪/Ragdoll/g;
  s/砚砚/Maine Coon/g;
  s/烁烁/Siamese/g;
  s/BACKLOG\.md/ROADMAP.md/g;
}

# ── Internal link stripping + path remapping (docs + skills only) ──
if ($ARGV =~ m{/(docs|cat-cafe-skills)/}) {
  # Remove list-item lines that are pure internal links
  $_ = "" if /^- \[.*?\]\((?:\.\.\/?|docs\/|\.\/)?(?:archive|plans|mailbox|discussions|research|reflections|evidence|runbooks|episodes|guides|phases|methods|evolution-proposals|stories|prompts|lessons)\//;
  # Convert inline links to private dirs into plain text
  s/\[([^\]]*?)\]\((?:\.\.\/?|docs\/|\.\/)?(?:archive|plans|mailbox|discussions|research|reflections|evidence|runbooks|episodes|guides|phases|methods|evolution-proposals|stories|prompts|lessons)\/[^)]*\)/$1 (internal)/g;
  # Strip backtick-quoted paths referencing private dirs
  s/`(?:docs\/)?(?:archive|plans|mailbox|discussions|research|reflections|evidence|runbooks)\/[^`]*`/*(internal reference removed)*/g;
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
  s#(^|[^A-Za-z])mailbox/#${1}review-notes/#g;
  s#(^|[^A-Za-z])plans/#${1}feature-specs/#g;
  s#(^|[^A-Za-z])discussions/#${1}feature-discussions/#g;
  s#(^|[^A-Za-z])archive/#${1}internal-archive/#g;
  # Double-prefix fix
  s#feature-feature-discussions/#feature-discussions/#g;
  s#feature-feature-specs/#feature-specs/#g;
  s#internal-internal-archive/#internal-archive/#g;
  # Port pair normalization
  s#localhost:3004/3002#localhost:3004/3003#g;
  s#localhost:3003/3004#localhost:3004/3003#g;
  s#3004/3002#3004/3003#g;
  s#3003/3004#3004/3003#g;
  # Config path normalization
  s#`\.env\.local`#`.env`#g;
  s#\.env\.local#.env#g;
  s#\.cat-cafe/\*secrets\*\.local\.json#local secrets file#g;
}
