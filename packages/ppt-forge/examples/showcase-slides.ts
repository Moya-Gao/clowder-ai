/**
 * Slide content specifications for the "three days productization" compressed showcase.
 * Each slide is a self-contained HTML string built from the shared shell template.
 */

import { resolve } from 'node:path';

import { type SlideSpec, shell } from './showcase-shell.js';

const DIR = import.meta.dirname;
const ROOT = resolve(DIR, '../../..');
const ASSET_DIR = resolve(ROOT, 'docs/stories/three-days-productization/tutorial/assets');

function assetUrl(name: string): string {
  return `file://${resolve(ASSET_DIR, name)}`;
}

export function buildSlides(): SlideSpec[] {
  const hubPanorama = assetUrl('hub-panorama-coral.png');
  const imDialog = assetUrl('im-hub-dialog-center.png');
  const decisionFunnel = assetUrl('decision-funnel.png');
  const featureLoop = assetUrl('feature-lifecycle-loop.png');
  const a2a = assetUrl('a2a-collaboration-layers.png');
  const gateway = assetUrl('f088-gateway-architecture.png');
  const memory = assetUrl('memory-search-evidence.png');
  const projectStats = assetUrl('project-stats-terminal.png');
  const sign = assetUrl('git-log-cat-signature.png');

  return [
    {
      id: '01-thesis',
      title: 'Cat Café 不是 AI 工具，而是一支被你领养的 AI 团队',
      intent: 'cover',
      html: shell({
        title: 'Cat Café 不是 AI 工具，而是一支被你领养的 AI 团队',
        subtitle: '把"一个人的想法"稳定磨成 Feature、PR、PPT、Review、交付链路，而不是一次性生成结果。',
        badge: '三天产品化 · 压缩版',
        kicker: '5 页讲清楚',
        dark: true,
        body: `
          <div class="band">
            <div class="kpi-grid">
              <div class="kpi"><div class="n">167</div><div class="l">Feature 已走过完整决策漏斗</div></div>
              <div class="kpi"><div class="n">4,383</div><div class="l">Git commits 证明这不是 demo，而是持续生产系统</div></div>
              <div class="kpi"><div class="n">1,922</div><div class="l">文档真相源 + 记忆索引，跨 session 不断档</div></div>
              <div class="kpi"><div class="n">5</div><div class="l">Hub / 飞书 / Telegram / 微信 / 小艺，多入口同一 Thread</div></div>
            </div>
          </div>
          <div class="main">
            <div style="display:grid;grid-template-rows:1fr auto;gap:6px;height:100%">
              <div class="split">
                <div class="stack">
                  <div class="card" style="height:314px">
                    <div class="hd">一句话概括</div>
                    <div class="bd" style="display:grid;gap:8px">
                      <div class="callout"><div class="t">AI 团队，不是 AI 工具</div><div class="d">它的最小单位不是一个回答，而是一支能持续分工、交接、审查、沉淀知识的团队。</div></div>
                      <div class="callout"><div class="t">需求要先被逼清楚</div><div class="d">从 signal 到 spec 的决策漏斗，决定了后面 167 个 Feature 为什么没有变成一次性 demo。</div></div>
                    </div>
                  </div>
                  <div class="card" style="height:110px">
                    <div class="hd">为什么这页要先讲"团队"</div>
                    <div class="bd" style="font-size:11px;line-height:1.5;color:#4B5563">
                      因为所有后续能力：多入口聊天、记忆系统、PPT/代码/视频产线、社区治理，都是"团队协作"这个定义向外长出来的结果。
                    </div>
                  </div>
                </div>
                <div class="card" style="height:430px">
                  <div class="hd">真实界面证据：Hub + 多猫状态 + 右侧能力面板</div>
                  <img class="img-cover" src="${hubPanorama}" alt="Hub panorama" />
                  <div class="caption">真实素材：Hub Panorama。它不是一页 landing page，而是把 Thread、计划、Workspace、配额、工具调用都放在同一张控制面板里。</div>
                </div>
              </div>
              <div class="evidence-strip">
                <div class="evidence"><div class="t">对外看见的是产品</div><div class="d">统一入口、流式对话、图片语音文件互传、富消息和游戏交互。</div></div>
                <div class="evidence"><div class="t">对内跑的是流程</div><div class="d">Worktree、TDD、Cross-model Review、Vision Guard，不让"快"吃掉"对"。</div></div>
                <div class="evidence"><div class="t">长期留下的是知识</div><div class="d">docs 真相源、SQLite recall、Knowledge Feed，把每次翻车和成功都变成系统护栏。</div></div>
              </div>
            </div>
          </div>`,
        summary: 'Cat Café 的产品定义不是"更会写代码的 AI"，而是"一个人也能带着 AI 团队把想法做成产品"。',
        footerLeft: 'Cat Café · three-days productization showcase',
        footerRight: '1 / 5',
      }),
    },
    {
      id: '02-user-value',
      title: '用户真正感知到的，不是模型名，而是入口统一、协作可见、记忆不断档',
      intent: 'content',
      html: shell({
        title: '用户真正感知到的，不是模型名，而是入口统一、协作可见、记忆不断档',
        subtitle: '把用户视角 showcase 压成一页：入口、能力、特殊交互，不再分散成八个章节页。',
        badge: '用户视角',
        kicker: 'Smart 结构：产品截图 + 平台矩阵 + 交互卡',
        body: `
          <div class="band">
            <div class="legend">
              <div class="lg"><div class="t">统一入口</div><div class="d">任何平台发的消息都回到同一个 Thread，Hub 和 IM 是同一场对话的不同窗。</div></div>
              <div class="lg"><div class="t">多猫协作可见</div><div class="d">你能看到谁在做、谁在 Review、谁在交接，而不是一个黑箱回复。</div></div>
              <div class="lg"><div class="t">记忆跨对话延续</div><div class="d">架构决策、教训、禁忌和风格会在新 session 自动被搜出来。</div></div>
            </div>
          </div>
          <div class="main">
            <div class="two-col">
              <div class="stack">
                <div class="card" style="height:286px">
                  <div class="hd">主界面：Hub 不是聊天框，而是多猫协作控制台</div>
                  <img class="img-cover" src="${imDialog}" alt="IM hub dialog center" />
                  <div class="caption">真实素材：Hub / IM 对话中心。左边是 Thread，右边是计划/代码/配额，猫在同一个视图里持续工作。</div>
                </div>
                <div class="icon-row">
                  <div class="icon-card"><div class="i">🎙️</div><div class="t">语音条</div><div class="d">每只猫独立声线，支持听你说、给你回语音。</div></div>
                  <div class="icon-card"><div class="i">🧩</div><div class="t">富消息</div><div class="d">卡片、清单、Diff、HTML 组件，不再只有纯文字。</div></div>
                  <div class="icon-card"><div class="i">🧠</div><div class="t">Knowledge Feed</div><div class="d">决策/教训自动浮现，等你确认后沉淀为系统行为。</div></div>
                </div>
              </div>
              <div class="card" style="height:100%">
                <div class="hd">入口矩阵：AI 被放回你的日常，而不是让你特地"去找它"</div>
                <div class="bd" style="display:grid;grid-template-rows:auto auto;gap:8px;height:100%">
                  <div class="mini-grid">
                    <div class="platform" style="background:#F5F5F5"><div class="n">Hub</div><div class="d">主控台。多 Thread、多猫并行、代码浏览和工具调用都在这里。</div></div>
                    <div class="platform" style="background:#FEF2F2"><div class="n">飞书 / Telegram</div><div class="d">群聊、私聊、流式更新、图片文件语音双向传输。</div></div>
                    <div class="platform" style="background:#FFF7E6"><div class="n">微信个人号</div><div class="d">通过 iLink 接入，做真正"住在日常工具里"的 AI 入口。</div></div>
                    <div class="platform" style="background:#F5F5F5"><div class="n">小艺 / 更多渠道</div><div class="d">把 AI 团队放进更多自然交互场景，不再只剩网页窗口。</div></div>
                  </div>
                  <div class="evidence-strip">
                    <div class="evidence" style="background:#F5F5F5"><div class="t">入口统一</div><div class="d">飞书、微信、Hub 只是窗不同，回到的还是同一个 Thread。</div></div>
                    <div class="evidence" style="background:#FEF2F2"><div class="t">协作可见</div><div class="d">你能看到谁在写、谁在审、谁在接棒，而不是只看见一条回复。</div></div>
                    <div class="evidence" style="background:#FFF7E6"><div class="t">记忆延续</div><div class="d">下一次打开时先 recall，再继续，不会把重要决定丢在上个窗口里。</div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>`,
        summary: '用户感知到的是"AI 团队住进了我的日常工具里"，而不是"我又打开了一个新的 AI 产品"。',
        footerLeft: '来源：showcase-user-facing.md + tutorial assets',
        footerRight: '2 / 5',
      }),
    },
    {
      id: '03-funnel',
      title: '一句话到 Feature，不靠"直接写代码"，靠决策漏斗把隐藏需求逼出来',
      intent: 'content',
      html: shell({
        title: '一句话到 Feature，不靠"直接写代码"，靠决策漏斗把隐藏需求逼出来',
        subtitle: '这是我们和普通 AI coding 工具最核心的结构差异：先澄清意图，再交付实现。',
        badge: '决策漏斗',
        kicker: 'Smart 结构：双证据图 + 横向流程链',
        body: `
          <div class="band">
            <div class="smart-flow">
              <div class="step"><div class="n">01</div><div class="t">CVO 采访</div><div class="d">铲屎官的一句话是信号，不是 spec。猫负责追问隐藏需求和真正想达成的效果。</div></div>
              <div class="step"><div class="n">02</div><div class="t">独立调研</div><div class="d">多猫各自去搜、去看、去提出方案，先保持彼此独立，不让第一个观点压死后面判断。</div></div>
              <div class="step"><div class="n">03</div><div class="t">讨论收敛</div><div class="d">保留分歧与 tradeoff，把共识结晶为 Feature spec、ADR、SOP 约束。</div></div>
              <div class="step"><div class="n">04</div><div class="t">交付管线</div><div class="d">Design Gate → Worktree → TDD → Review → Vision Guard → Merge，避免需求和实现漂移。</div></div>
            </div>
          </div>
          <div class="main">
            <div class="two-col">
              <div class="card" style="height:340px">
                <div class="hd">证据 1：Decision Funnel 可视化</div>
                <img class="img-contain" src="${decisionFunnel}" alt="decision funnel" />
                <div class="caption">真实素材：从"飞书和微信能不能直接聊"到"零摩擦入口"的隐藏需求挖掘，不是把第一句话当完整需求。</div>
              </div>
              <div class="stack">
                <div class="card" style="height:192px">
                  <div class="hd">证据 2：Feature Loop 是可重复的交付协议</div>
                  <img class="img-contain" src="${featureLoop}" alt="feature loop" />
                </div>
                <div class="evidence-strip">
                  <div class="evidence"><div class="t">167 个 Feature</div><div class="d">不是"聊聊看"，而是每个 Feature 都留下了 Spec、PR、Review 和 lesson 证据链。</div></div>
                  <div class="evidence"><div class="t">50 条 lessons</div><div class="d">同类错误不会只变成"下次注意"，而是沉淀成新的规则、Skill 和门禁。</div></div>
                  <div class="evidence"><div class="t">双层 Review</div><div class="d">同个体不能自审，局部门禁不能压过愿景，这些都来自真实翻车之后的制度化修正。</div></div>
                </div>
              </div>
            </div>
          </div>`,
        summary: '真正让系统越做越稳的，不是模型本身，而是"信号 → 决策 → 交付"的漏斗被制度化了。',
        footerLeft: '来源：showcase-developer-facing.md / tutorial/03-feature-loop.md',
        footerRight: '3 / 5',
      }),
    },
    {
      id: '04-system',
      title: '多猫协作能跑稳，是因为 A2A、记忆和 Chat Gateway 三层系统咬在一起',
      intent: 'content',
      html: shell({
        title: '多猫协作能跑稳，是因为 A2A、记忆和 Chat Gateway 三层系统咬在一起',
        subtitle: '不是单个"大脑"在调度，而是对等判断 + 统一路由 + 可审计记忆的组合系统。',
        badge: '系统架构',
        kicker: 'Smart 结构：三联证据板',
        body: `
          <div class="band">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
              <div style="background:#F5F5F5;border-top:3px solid #C7020E;padding:8px 10px;min-height:86px">
                <div style="font-size:11px;font-weight:900;color:#181818">入口层：用户在哪儿，猫就住在哪儿</div>
                <div style="font-size:10px;line-height:1.42;color:#4B5563;margin-top:5px">
                  Hub / 飞书 / Telegram / 微信 / 小艺先进入统一的消息归一化层，不让入口差异污染协作逻辑。
                </div>
              </div>
              <div style="background:#FEF2F2;border-top:3px solid #C7020E;padding:8px 10px;min-height:86px">
                <div style="font-size:11px;font-weight:900;color:#181818">协作层：判断分布在猫，不在中央 orchestrator</div>
                <div style="font-size:10px;line-height:1.42;color:#4B5563;margin-top:5px">
                  Dispatch Queue、@mention、side-dispatch、resume/restart 共同决定"谁该上"，而不是一颗中心大脑调度全部。
                </div>
              </div>
              <div style="background:#FFF7E6;border-top:3px solid #C7020E;padding:8px 10px;min-height:86px">
                <div style="font-size:11px;font-weight:900;color:#181818">记忆层：从即时上下文升级为长期知识</div>
                <div style="font-size:10px;line-height:1.42;color:#4B5563;margin-top:5px">
                  docs 真相源、evidence.sqlite recall、Knowledge Feed 让下一次对话先从历史结论起步，而不是从零再猜一遍。
                </div>
              </div>
            </div>
          </div>
          <div class="main">
            <div style="display:grid;grid-template-rows:1fr auto;gap:6px;height:100%">
              <div class="three-col">
                <div style="display:grid;grid-template-rows:auto 148px auto;height:100%;background:#F5F5F5;border:1px solid #D4D4D4">
                  <div class="hd">A2A：对等判断，不靠中央 orchestrator</div>
                  <img class="img-contain" src="${a2a}" alt="a2a layers" />
                  <div style="padding:10px 10px 8px;font-size:10px;line-height:1.46;color:#4B5563">
                    <div style="font-weight:800;color:#181818;margin-bottom:4px">用户 @猫 和 猫 @猫 走同一个队列</div>
                    <div>Dispatch Queue 同时承接用户路由、猫间 @mention、并发 side-dispatch 和重启恢复，不需要一个中央大脑替大家做判断。</div>
                  </div>
                </div>
                <div style="display:grid;grid-template-rows:auto 148px auto;height:100%;background:#FEF2F2;border:1px solid #FCA5A5">
                  <div class="hd">记忆：从"记住"到"学会"</div>
                  <img class="img-contain" src="${memory}" alt="memory search evidence" />
                  <div style="padding:10px 10px 8px;font-size:10px;line-height:1.46;color:#4B5563">
                    <div style="font-weight:800;color:#181818;margin-bottom:4px">文档真相源 + SQLite recall + Knowledge Feed</div>
                    <div>不是把上下文硬塞进 prompt，而是把决策、教训和术语沉淀成可搜索、可审核、可版本化的长期知识系统。</div>
                  </div>
                </div>
                <div style="display:grid;grid-template-rows:auto 148px auto;height:100%;background:#FFF7E6;border:1px solid #F9D39B">
                  <div class="hd">Gateway：多平台消息归一回同一个 Thread</div>
                  <img class="img-contain" src="${gateway}" alt="gateway architecture" />
                  <div style="padding:10px 10px 8px;font-size:10px;line-height:1.46;color:#4B5563">
                    <div style="font-weight:800;color:#181818;margin-bottom:4px">入口越多，真相源越要统一</div>
                    <div>飞书、Telegram、微信、小艺先过 Connector Adapter 和归一化层，再回到同一个 Thread；用户看到的是"入口自由"，系统内部看到的是"一条事实链"。</div>
                  </div>
                </div>
              </div>
              <div class="evidence-strip">
                <div class="evidence" style="background:#F5F5F5"><div class="t">A2A 解决判断分布</div><div class="d">谁应该上、什么时候拉队友、如何并发，不靠一只中央猫单点决策。</div></div>
                <div class="evidence" style="background:#FEF2F2"><div class="t">记忆解决上下文延续</div><div class="d">每次新 session 先 recall，避免同一类错误在新窗口里从头再犯一次。</div></div>
                <div class="evidence" style="background:#FFF7E6"><div class="t">Gateway 解决入口碎片化</div><div class="d">外部世界越分散，内部 Thread 越需要唯一真相源，这正是多入口产品的护城河。</div></div>
              </div>
            </div>
          </div>`,
        summary: '"像家一样"的体验不是玄学，而是三层系统把入口统一、状态可见和长期记忆锁在了一起。',
        footerLeft: '来源：F088 / F102 / A2A tutorial assets',
        footerRight: '4 / 5',
      }),
    },
    {
      id: '05-patterns',
      title: '这套系统真正能偷走的，不只是 UI，而是让 AI 团队持续产出的工程方法',
      intent: 'content',
      html: shell({
        title: '这套系统真正能偷走的，不只是 UI，而是让 AI 团队持续产出的工程方法',
        subtitle: '把开发者视角 showcase 收成最后一页：哪些模式值得拿走，为什么它们不是 demo 技巧。',
        badge: '可迁移模式',
        kicker: 'Smart 结构：证据面板 + Pattern 矩阵 + 数字条',
        body: `
          <div class="band">
            <div class="bars">
              <div class="bar-row"><div class="lb">Feature</div><div class="track"><div class="fill" style="width:100%"></div></div><div class="val">167</div></div>
              <div class="bar-row"><div class="lb">Docs</div><div class="track"><div class="fill" style="width:92%"></div></div><div class="val">1,922</div></div>
              <div class="bar-row"><div class="lb">Lessons</div><div class="track"><div class="fill" style="width:68%"></div></div><div class="val">50</div></div>
            </div>
          </div>
          <div class="main">
            <div class="two-col">
              <div class="stack">
                <div class="card" style="height:202px;background:#F5F5F5">
                  <div class="hd">证据：持续产出不是口号</div>
                  <img class="img-contain" src="${projectStats}" alt="project stats terminal" />
                </div>
                <div class="card" style="height:138px;background:#FEF2F2">
                  <div class="hd">证据：连 commit 签名都在强化"谁做的、谁负责"</div>
                  <img class="img-contain" src="${sign}" alt="git signature" />
                </div>
              </div>
              <div class="pattern-grid">
                <div class="pattern" style="background:#F5F5F5"><div class="t">Cross-model Review</div><div class="d">不同模型盲区不同，Claude 写、GPT 审，比同模型 self-review 更稳定。</div></div>
                <div class="pattern" style="background:#F5F5F5"><div class="t">Decision Funnel</div><div class="d">用户第一句话不是 spec。先挖意图，再结晶 Feature 和 ADR，方向正确胜过写得快。</div></div>
                <div class="pattern" style="background:#FEF2F2"><div class="t">三层记忆架构</div><div class="d">文档 → 索引 → 知识晋升，让长期上下文可检索、可版本化、可审计。</div></div>
                <div class="pattern" style="background:#FEF2F2"><div class="t">Skill = 行为协议</div><div class="d">定义"什么场景按什么流程办"，而不是只定义"有什么工具"。</div></div>
                <div class="pattern" style="background:#FFF7E6"><div class="t">门禁管线</div><div class="d">自检 → 跨猫审查 → 愿景守护 → Merge，不让局部门禁压过用户视角。</div></div>
                <div class="pattern" style="background:#FFF7E6"><div class="t">AI 共居</div><div class="d">把 AI 放进用户日常入口和通知里，交互从"调用工具"变成"和团队一起生活"。</div></div>
              </div>
            </div>
          </div>`,
        summary: '真正的 moat 不在单个模型，而在被团队反复磨出来、还能被复制和迁移的协作协议。',
        footerLeft: '来源：showcase-developer-facing.md + tutorial assets',
        footerRight: '5 / 5',
      }),
    },
  ];
}
