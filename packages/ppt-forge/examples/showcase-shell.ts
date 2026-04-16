/**
 * Shared HTML shell template and types for showcase generators.
 * Encapsulates the CSS design system and slide wrapper.
 */

export type SlideSpec = {
  id: string;
  title: string;
  intent: 'cover' | 'content';
  html: string;
};

export function shell(opts: {
  title: string;
  badge: string;
  kicker?: string;
  subtitle?: string;
  body: string;
  summary: string;
  footerLeft: string;
  footerRight: string;
  dark?: boolean;
}): string {
  const mode = opts.dark ? 'dark' : 'light';
  const subtitle = opts.subtitle ? `<div class="subtitle">${opts.subtitle}</div>` : '';
  const kicker = opts.kicker ? `<span class="kicker">${opts.kicker}</span>` : '';
  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#dadada}
body{font-family:'Noto Sans SC','Microsoft YaHei',Arial,sans-serif}
.ppt-slide{width:1280px;height:720px;overflow:hidden;display:grid;grid-template-rows:4px auto 1fr auto auto}
.ppt-slide.light{background:#FAFAFA;color:#181818}
.ppt-slide.dark{background:linear-gradient(180deg,#171717 0%,#262626 100%);color:#fff}
.topbar{background:#C7020E}
.header{display:flex;align-items:flex-start;gap:12px;padding:16px 24px 10px}
.header .dot{width:7px;height:7px;border-radius:50%;background:#C7020E;margin-top:10px;flex-shrink:0}
.title-wrap{display:flex;flex-direction:column;gap:4px;min-width:0}
.title{font-size:28px;line-height:1.1;font-weight:900;letter-spacing:-0.02em}
.ppt-slide.dark .title{color:#fff}
.subtitle{font-size:12px;line-height:1.45;color:#6B7280;max-width:860px}
.ppt-slide.dark .subtitle{color:#D1D5DB}
.badge-row{margin-left:auto;display:flex;gap:8px;align-items:center;padding-top:2px}
.badge{background:#C7020E;color:#fff;font-size:10px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap}
.kicker{font-size:10px;color:#9CA3AF;white-space:nowrap}
.band{padding:0 24px 8px}
.summary{display:flex;align-items:center;gap:8px;padding:8px 24px 10px;background:#111;color:#fff;font-size:11px;line-height:1.45}
.summary .label{color:#FF7474;font-weight:800;flex-shrink:0}
.footer{display:flex;justify-content:space-between;padding:4px 24px 8px;background:#fff;border-top:1px solid #E5E7EB;font-size:9px;color:#6B7280}
.ppt-slide.dark .footer{background:rgba(255,255,255,0.06);border-top-color:rgba(255,255,255,0.12);color:#D1D5DB}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.kpi{background:#fff;border-top:3px solid #C7020E;padding:8px 10px;min-height:74px}
.dark .kpi{background:#262626}
.kpi .n{font-size:28px;line-height:1;font-weight:900;color:#C7020E}
.kpi .l{font-size:10px;line-height:1.35;color:#6B7280;margin-top:4px}
.dark .kpi .l{color:#E5E7EB}
.main{padding:0 24px 0;min-height:0;overflow:hidden}
.card{background:#fff;border:1px solid #E5E7EB;overflow:hidden}
.dark .card{background:#262626;border-color:#4B5563}
.card .hd{background:#C7020E;color:#fff;font-size:11px;font-weight:800;padding:6px 10px}
.card .bd{padding:10px}
.img-cover{width:100%;height:100%;object-fit:cover;display:block}
.img-contain{width:100%;height:100%;object-fit:contain;display:block;background:#fff}
.dark .img-contain{background:#111}
.two-col{display:grid;grid-template-columns:1.15fr 0.85fr;gap:6px;height:100%}
.three-col{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;height:100%}
.stack{display:grid;gap:6px;align-content:start}
.mini-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}
.platform{background:#fff;border-left:4px solid #C7020E;padding:8px 10px}
.platform .n{font-size:13px;font-weight:800}
.platform .d{font-size:10px;line-height:1.45;color:#6B7280;margin-top:4px}
.smart-flow{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.step{background:#fff;border:1px solid #E5E7EB;padding:10px;min-height:94px;position:relative}
.step::after{content:'▶';position:absolute;right:-11px;top:50%;transform:translateY(-50%);color:#C7020E;font-size:18px;font-weight:900}
.step:last-child::after{display:none}
.step .n{font-size:11px;font-weight:800;color:#C7020E}
.step .t{font-size:13px;font-weight:800;margin-top:4px}
.step .d{font-size:10px;line-height:1.4;color:#6B7280;margin-top:4px}
.evidence-strip{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
.evidence{background:#fff;border-left:4px solid #C7020E;padding:8px 10px;min-height:84px}
.evidence .t{font-size:12px;font-weight:800}
.evidence .d{font-size:10px;line-height:1.4;color:#6B7280;margin-top:4px}
.bars{display:grid;gap:8px}
.bar-row{display:grid;grid-template-columns:96px 1fr 56px;gap:8px;align-items:center}
.bar-row .lb{font-size:10px;font-weight:700}
.track{height:16px;background:#F3F4F6;position:relative;overflow:hidden}
.fill{height:100%;background:linear-gradient(90deg,#C7020E 0%,#FF7875 100%)}
.val{font-size:10px;font-weight:800;color:#C7020E;text-align:right}
.pattern-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}
.pattern{background:#fff;border-top:3px solid #C7020E;padding:8px 10px;min-height:88px}
.pattern .t{font-size:11px;font-weight:800}
.pattern .d{font-size:10px;line-height:1.45;color:#6B7280;margin-top:4px}
.icon-row{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.icon-card{background:#fff;padding:8px 10px;border:1px solid #E5E7EB}
.icon-card .i{font-size:18px}
.icon-card .t{font-size:11px;font-weight:800;margin-top:2px}
.icon-card .d{font-size:10px;line-height:1.4;color:#6B7280;margin-top:3px}
.caption{font-size:9px;color:#6B7280;padding:6px 10px;border-top:1px solid #E5E7EB;background:#fff}
.dark .caption{background:rgba(255,255,255,0.08);border-top-color:rgba(255,255,255,0.12);color:#D1D5DB}
.split{display:grid;grid-template-columns:0.9fr 1.1fr;gap:6px;height:100%}
.callout{background:#fff;border-left:4px solid #C7020E;padding:10px}
.dark .callout{background:#2B2B2B}
.callout .t{font-size:12px;font-weight:800}
.callout .d{font-size:10px;line-height:1.48;color:#6B7280;margin-top:6px}
.legend{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.legend .lg{background:#fff;padding:8px 10px;border-top:2px solid #C7020E}
.dark .legend .lg{background:#262626}
.legend .lg .t{font-size:11px;font-weight:800}
.legend .lg .d{font-size:10px;color:#6B7280;line-height:1.42;margin-top:4px}
</style></head>
<body>
<div class="ppt-slide ${mode}">
  <div class="topbar"></div>
  <div class="header">
    <div class="dot"></div>
    <div class="title-wrap">
      <div class="title">${opts.title}</div>
      ${subtitle}
    </div>
    <div class="badge-row"><span class="badge">${opts.badge}</span>${kicker}</div>
  </div>
  ${opts.body}
  <div class="summary"><span class="label">▎结论</span><span>${opts.summary}</span></div>
  <div class="footer"><span>${opts.footerLeft}</span><span>${opts.footerRight}</span></div>
</div>
</body></html>`;
}
