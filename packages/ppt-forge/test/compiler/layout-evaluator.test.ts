import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

describe('layout-evaluator — evaluateLayout()', () => {
  it('extracts rect for a simple text element', async () => {
    const { evaluateLayout, closeBrowser } = await import('../../src/compiler/layout-evaluator.js');

    const html = `<!DOCTYPE html>
<html><head><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { width: 1280px; height: 720px; }</style></head>
<body>
  <div style="position: relative; width: 1280px; height: 720px;">
    <div data-ppt-role="text" data-slot-name="title"
         style="position: absolute; left: 64px; top: 38px; width: 1152px; height: 64px; font-size: 24px;">
      Hello World
    </div>
  </div>
</body></html>`;

    const nodes = await evaluateLayout(html);
    await closeBrowser();

    assert.equal(nodes.length, 1, 'should find 1 top-level node');
    assert.equal(nodes[0].role, 'text');
    assert.equal(nodes[0].slotName, 'title');
    // Rect should be close to what we set (browser may adjust slightly)
    assert.ok(Math.abs(nodes[0].rect.x - 64) < 2, `x should be ~64, got ${nodes[0].rect.x}`);
    assert.ok(Math.abs(nodes[0].rect.y - 38) < 2, `y should be ~38, got ${nodes[0].rect.y}`);
    assert.ok(Math.abs(nodes[0].rect.w - 1152) < 2, `w should be ~1152, got ${nodes[0].rect.w}`);
    assert.ok(nodes[0].textContent?.includes('Hello World'), 'should capture text content');
  });

  it('extracts nested children from group elements', async () => {
    const { evaluateLayout, closeBrowser } = await import('../../src/compiler/layout-evaluator.js');

    const html = `<!DOCTYPE html>
<html><head><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { width: 1280px; height: 720px; }</style></head>
<body>
  <div style="position: relative; width: 1280px; height: 720px;">
    <div data-ppt-role="group" data-slot-name="diagram"
         style="position: absolute; left: 38px; top: 115px; width: 1203px; height: 563px; display: flex; gap: 4px;">
      <div data-ppt-role="shape" data-box-id="box-1" style="flex: 1; background: #F5F5F5;">Box1</div>
      <div data-ppt-role="shape" data-box-id="box-2" style="flex: 1; background: #F5F5F5;">Box2</div>
    </div>
  </div>
</body></html>`;

    const nodes = await evaluateLayout(html);
    await closeBrowser();

    assert.equal(nodes.length, 1, 'should find 1 top-level group');
    assert.equal(nodes[0].role, 'group');
    assert.equal(nodes[0].children.length, 2, 'group should have 2 children');
    assert.equal(nodes[0].children[0].role, 'shape');
    assert.equal(nodes[0].children[0].boxId, 'box-1');
    // Each child should get ~half the width
    assert.ok(nodes[0].children[0].rect.w > 400, `child width should be > 400, got ${nodes[0].children[0].rect.w}`);
  });

  it('extracts computed styles (font size, color, background)', async () => {
    const { evaluateLayout, closeBrowser } = await import('../../src/compiler/layout-evaluator.js');

    const html = `<!DOCTYPE html>
<html><head><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { width: 1280px; height: 720px; }</style></head>
<body>
  <div style="position: relative; width: 1280px; height: 720px;">
    <div data-ppt-role="text" style="position: absolute; left: 64px; top: 38px; width: 500px; height: 50px;
         font-size: 24px; color: #CF0A2C; background: #F5F5F5;">
      Styled Text
    </div>
  </div>
</body></html>`;

    const nodes = await evaluateLayout(html);
    await closeBrowser();

    assert.equal(nodes[0].computedStyle.fontSize, 24);
    assert.ok(nodes[0].computedStyle.backgroundColor.length > 0, 'should have background color');
  });

  it('handles table elements — extracts table data', async () => {
    const { evaluateLayout, closeBrowser } = await import('../../src/compiler/layout-evaluator.js');

    const html = `<!DOCTYPE html>
<html><head><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { width: 1280px; height: 720px; }</style></head>
<body>
  <div style="position: relative; width: 1280px; height: 720px;">
    <div data-ppt-role="table" style="position: absolute; left: 38px; top: 115px; width: 1203px; height: 563px;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead><tr><th>Name</th><th>Status</th></tr></thead>
        <tbody><tr><td>Auth</td><td>Done</td></tr></tbody>
      </table>
    </div>
  </div>
</body></html>`;

    const nodes = await evaluateLayout(html);
    await closeBrowser();

    assert.equal(nodes[0].role, 'table');
    assert.ok(nodes[0].tableData, 'should extract table data');
    assert.deepEqual(nodes[0].tableData!.headers, ['Name', 'Status']);
    const cell0 = nodes[0].tableData!.rows[0].cells[0];
    assert.equal(typeof cell0, 'object', 'cell should be an object with styles');
    assert.equal((cell0 as { text: string }).text, 'Auth');
  });

  it('evaluateDeck processes multiple slides with shared browser', async () => {
    const { evaluateDeck, closeBrowser } = await import('../../src/compiler/layout-evaluator.js');

    const slide1 = `<!DOCTYPE html>
<html><head><style>* { margin: 0; } body { width: 1280px; height: 720px; }</style></head>
<body><div style="position: relative; width: 1280px; height: 720px;">
  <div data-ppt-role="text" style="position: absolute; left: 64px; top: 38px; width: 500px; height: 50px;">Slide 1</div>
</div></body></html>`;

    const slide2 = `<!DOCTYPE html>
<html><head><style>* { margin: 0; } body { width: 1280px; height: 720px; }</style></head>
<body><div style="position: relative; width: 1280px; height: 720px;">
  <div data-ppt-role="text" style="position: absolute; left: 64px; top: 38px; width: 500px; height: 50px;">Slide 2</div>
</div></body></html>`;

    const results = await evaluateDeck([slide1, slide2]);
    await closeBrowser();

    assert.equal(results.length, 2, 'should return results for 2 slides');
    assert.ok(results[0][0].textContent?.includes('Slide 1'));
    assert.ok(results[1][0].textContent?.includes('Slide 2'));
  });
});
