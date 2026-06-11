# F231 Phase A 实现计划：USER_CAPSULE 注入 + fixture 隔离测试

> **Spec**: `docs/features/F231-user-profile-capsule.md`（读 KD-1/KD-4/KD-5/KD-6/KD-7 + AC-A2/A3/A4/B3）
> **Design Gate 出口物**: `docs/discussions/2026-06-11-f231-design-gate.md`（OQ-1 closure：L0 编译时注入）
> **Plan author**: 宪宪/Fable-5 | **实现**: opus 家族 | **创建**: 2026-06-11
> **⚠️ Merge gate**: 开发全部完成 + 测试绿后 **PR 挂起不合**，等 ADR-038 PR-C 落地（gpt52 fresh build ≤6000，ETA 06-13，opus-47 背）后 rebase 合入。AC-A2 写明此前置条件。开发本身不被 gate，现在就做。

## 一、要做什么（一句话）

给 L0 编译链加 `{{USER_CAPSULE}}` 槽位：capsule 文件存在 → 每只猫的 L0 注入"主人画像段"；不存在 → 照常编译（社区向后兼容）；超 300 字 → 编译报错。全部测试用 fixture，永不依赖真实私有文件。

## 二、改动面（预计 4 文件 + 测试 + fixtures）

| 文件 | 改动 |
|------|------|
| `assets/system-prompts/system-prompt-l0.md` | §1 身份块之后加 `{{USER_CAPSULE}}` 模板变量行（醒来顺序：我是谁 → **主人是谁** → 队友是谁） |
| `scripts/compile-system-prompt-l0.mjs` | 新增 capsule 读取 + 校验 + 替换逻辑（见契约） |
| `scripts/compile-system-prompt-l0.test.mjs` | 三态测试 + 泄漏检测 + 锚点回归（fixture 隔离） |
| `test/fixtures/profile/`（新建，tracked） | fixture capsule + fixture primer（**虚构数据**，见 KD-6 红线） |

## 三、编译契约（核心）

```
resolveUserCapsule(profileDir):
  profileDir 来源优先级: 函数参数 > env CAT_CAFE_PROFILE_DIR > 默认 'private/profile'
  capsulePath = join(profileDir, 'landy-capsule.md')   # v1 单用户文件约定，命名先固定
  三态:
    不存在/不可读  → 返回 null（编译照常，{{USER_CAPSULE}} 替换为空串，不留悬空标题）
    存在且 ≤300 字 → 返回正文（剥离 frontmatter/引用块元数据，只取 '---' 分隔后的正文）
    存在且 >300 字 → throw（错误信息含实际字数与上限，编译失败要响）
  字数定义: 正文 Unicode 字符数（含标点，不含 markdown 元数据行）。实现时在测试里
            用边界 fixture（恰好 300 / 301 字）锁定语义，避免口径漂移。
  primer 指针: 若 join(profileDir, 'relationship/{catId}-primer.md') 存在，
            在 capsule 段尾追加单行:
            「关系轨迹: private/profile/relationship/{catId}-primer.md（开局可读，按需 recall）」
            不存在则不加。指针行不计入 300 字（它不是 capsule 内容）。
  注入格式: '## 主人画像\n\n' + 正文 + (primer 行)。capsule 为 null 时整段为空串。
```

不做的事（Phase A 边界）：不做多用户寻址（OQ-2）、不动 `cat-template.json`、不做 capsule 热更新、不加 feature flag（merge gate 即开关）。

## 四、TDD 步骤

1. **Red**: fixture 基建——`test/fixtures/profile/landy-capsule.md`（虚构 owner 画像，~100 字）+ `relationship/codex-primer.md`（两行虚构 trajectory）+ 边界 fixtures（300/301 字）。写三态测试断言（注入含 fixture 锚点句 / 缺失编译照常且产物无"主人画像"标题 / 超长 throw 含字数），跑红。
2. **Green**: 实现 `resolveUserCapsule` + 模板替换，三态测试转绿。
3. **Red→Green**: 泄漏检测——baseline 编译（profileDir 指向空 fixture 目录）产物断言：不含 fixture 锚点字符串、不含"主人画像"段标题。**此测试同时守 AC-A3 后半句。**
4. **Red→Green**: 锚点回归（AC-B3）——fixture instance catalog（虚构 personality 含锚点句"先接住真实问题"）编译 codex 产物断言锚点出现 = overlay 机制生效。公共 baseline 不断言任何真实私有锚点。
5. **全量**: `node --test scripts/compile-system-prompt-l0.test.mjs` + `node --test test/system-prompt-builder.test.js`（CLAUDE.md 守护规则：动了 L0 真相源/编译器必跑）+ `pnpm check`。
6. **AC-A4**: 跑 outbound sync dry-run，断言输出不含 `private/profile/`（命令输出贴 PR）。
7. **本机 smoke（不进 CI）**: 不传 profileDir 用默认值编译 codex，肉眼确认真实 capsule + primer 指针注入正确 + 砚砚新 personality 在产物里。截图/输出贴 PR 作 dogfood 证据，**产物本身不提交**。

## 五、KD-6 红线（review 会卡的点）

- fixture 内容必须**虚构**（"Test Owner 喜欢清晰的验收标准"这类），禁止复制真实 capsule/primer 任何句子——tracked 资产含真实关系锚点 = 泄漏，砚砚 R1 就是为这个退稿的
- tracked 测试禁止读默认路径 `private/profile/`（CI/社区 clone 无此目录，且不该依赖）——一律显式传 fixture 路径
- 编译产物（含真实 capsule 的）不得写进任何 tracked 位置

## 六、验收对照

| AC | 本 plan 覆盖 |
|----|-------------|
| AC-A2 | 步骤 1-2（三态全绿）+ merge gate 前置条件（PR-C） |
| AC-A3 | 步骤 3（缺失照常 + 泄漏检测） |
| AC-A4 | 步骤 6（dry-run 断言） |
| AC-B3 | 步骤 4（fixture overlay 锚点回归） |

完成后 merge-gate 流程照家规（跨猫 review：建议 @gpt52 或 @codex），Phase A 收口时 AC 打勾 + Timeline 由 merge 执行者同步（merge-gate Step 7.5）。
