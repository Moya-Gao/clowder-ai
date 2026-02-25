import puppeteer, { type Browser } from 'puppeteer';

/**
 * ImageExporter service for capturing screenshots of web pages using Chrome headless.
 * Reuses browser instance for better performance.
 */
export class ImageExporter {
  private browser: Browser | null = null;

  /**
   * Capture a screenshot of the given URL.
   * @param url - The URL to capture
   * @param userId - User ID for authentication (sets X-Cat-Cafe-User header)
   * @returns PNG image buffer
   */
  async capture(url: string, userId: string): Promise<Buffer> {
    try {
      // Launch browser if not already running
      if (!this.browser) {
        this.browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Avoid running out of memory
          ],
        });
      }

      const page = await this.browser.newPage();

      // Set user identity header for authentication
      await page.setExtraHTTPHeaders({
        'X-Cat-Cafe-User': userId,
      });

      // Set initial viewport
      await page.setViewport({ width: 1280, height: 720 });

      // Append export=true so the frontend expands collapsible content (e.g. ThinkingContent)
      const exportUrl = new URL(url);
      exportUrl.searchParams.set('export', 'true');

      // Navigate to target page, wait for network idle
      await page.goto(exportUrl.toString(), {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Wait for chat container to load
      await page.waitForSelector('[data-chat-container]', { timeout: 10000 });

      // Remove height/overflow constraints so chat content flows naturally.
      // The default h-screen + overflow-y:auto layout traps messages in a
      // scroll container; fullPage capture on such layouts can produce
      // duplicated or clipped segments due to viewport/layout feedback loops.
      await page.addStyleTag({
        content: `
          .h-screen, .h-dvh { height: auto !important; }
          .overflow-hidden { overflow: visible !important; }
          [data-chat-container] {
            height: auto !important;
            overflow: visible !important;
          }
        `,
      });

      // Double-rAF to ensure layout reflow completes after CSS injection
      // (page.evaluate runs in browser context where rAF is available)
      await page.evaluate(() =>
        new Promise<void>(resolve =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globalThis as any).requestAnimationFrame(() =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).requestAnimationFrame(() => resolve())
          )
        )
      );

      // Wait for any network requests triggered by layout change
      // (e.g. scroll-based pagination loading older messages)
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {
        /* timeout is acceptable — proceed with capture */
      });

      // Measure full content height with constraints removed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const height = await page.evaluate(() => (globalThis as any).document.documentElement.scrollHeight);

      // Set viewport to match content (cap at 50000px to avoid OOM)
      await page.setViewport({ width: 1280, height: Math.min(height, 50000) });

      // Final layout stabilization after viewport resize
      await page.evaluate(() =>
        new Promise<void>(resolve =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globalThis as any).requestAnimationFrame(() =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).requestAnimationFrame(() => resolve())
          )
        )
      );

      // Capture viewport-sized screenshot (no fullPage — avoids stitching
      // artifacts from Puppeteer internally re-measuring/re-sizing the viewport)
      const screenshot = await page.screenshot({ type: 'png' });

      await page.close();

      return screenshot as Buffer;
    } catch (error) {
      throw new Error(`Screenshot capture failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Close the browser instance.
   * Call this when the exporter is no longer needed.
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
