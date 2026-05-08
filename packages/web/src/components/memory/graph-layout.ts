export function forceLayout(
  nodes: Array<{ anchor: string }>,
  edges: Array<{ from: string; to: string }>,
  center: string | undefined,
  width: number,
  height: number,
): Map<string, { x: number; y: number }> {
  if (nodes.length === 0) return new Map();
  const cx = width / 2;
  const cy = height / 2;
  const sim = nodes.map((n, i) => {
    if (n.anchor === center) return { x: cx, y: cy, vx: 0, vy: 0 };
    const a = (2 * Math.PI * i) / Math.max(nodes.length, 1);
    return { x: cx + 120 * Math.cos(a), y: cy + 120 * Math.sin(a), vx: 0, vy: 0 };
  });
  const idx = new Map<string, number>();
  for (let i = 0; i < nodes.length; i++) idx.set(nodes[i].anchor, i);

  for (let t = 0; t < 120; t++) {
    for (let i = 0; i < sim.length; i++) {
      for (let j = i + 1; j < sim.length; j++) {
        const dx = sim[i].x - sim[j].x;
        const dy = sim[i].y - sim[j].y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const f = 5000 / (d * d);
        sim[i].vx += (dx / d) * f;
        sim[i].vy += (dy / d) * f;
        sim[j].vx -= (dx / d) * f;
        sim[j].vy -= (dy / d) * f;
      }
    }
    for (const e of edges) {
      const ai = idx.get(e.from);
      const bi = idx.get(e.to);
      if (ai === undefined || bi === undefined) continue;
      const dx = sim[bi].x - sim[ai].x;
      const dy = sim[bi].y - sim[ai].y;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const disp = d - 160;
      sim[ai].vx += 0.01 * disp * (dx / d);
      sim[ai].vy += 0.01 * disp * (dy / d);
      sim[bi].vx -= 0.01 * disp * (dx / d);
      sim[bi].vy -= 0.01 * disp * (dy / d);
    }
    const pad = 40;
    for (const p of sim) {
      p.vx = (p.vx + (cx - p.x) * 0.01) * 0.8;
      p.vy = (p.vy + (cy - p.y) * 0.01) * 0.8;
      p.x = Math.max(pad, Math.min(width - pad, p.x + p.vx));
      p.y = Math.max(pad, Math.min(height - pad, p.y + p.vy));
    }
  }

  const result = new Map<string, { x: number; y: number }>();
  for (let i = 0; i < nodes.length; i++) result.set(nodes[i].anchor, { x: sim[i].x, y: sim[i].y });
  return result;
}
