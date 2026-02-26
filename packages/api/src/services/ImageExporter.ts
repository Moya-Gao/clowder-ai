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
      // AND triggers one-shot full message loading (EXPORT_LIMIT=10000 in useChatHistory)
      const exportUrl = new URL(url);
      exportUrl.searchParams.set('export', 'true');

      // Navigate to target page, wait for network idle
      await page.goto(exportUrl.toString(), {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Wait for chat container to load
      await page.waitForSelector('[data-chat-container]', { timeout: 10000 });

      // Diagnostic: log what the page actually loaded
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const diag = await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = globalThis as any;
        const container = g.document.querySelector('[data-chat-container]');
        const msgEls = container?.querySelectorAll('[data-message-id]') ?? [];
        return {
          url: g.window?.location?.href,
          search: g.window?.location?.search,
          messageCount: msgEls.length,
          scrollHeight: container?.scrollHeight ?? 0,
          clientHeight: container?.clientHeight ?? 0,
        };
      });
      console.log('[ImageExporter] diagnostics:', JSON.stringify(diag));

      // Get the chat container's full content height (scrollHeight includes overflow)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scrollHeight = await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const container = (globalThis as any).document.querySelector('[data-chat-container]');
        return (container?.scrollHeight as number) ?? 720;
      });

      // Set viewport tall enough so h-screen expands and chat container can
      // show all content without overflow. The flex layout deducts header (~48px)
      // and input bar (~64px) from h-screen to size the chat container, so we
      // add a generous buffer to ensure all content fits.
      const LAYOUT_BUFFER = 200;
      const targetHeight = Math.min(scrollHeight + LAYOUT_BUFFER, 16384);

      console.log('[ImageExporter] scrollHeight=%d targetHeight=%d', scrollHeight, targetHeight);

      await page.setViewport({ width: 1280, height: targetHeight });

      // Wait for layout to stabilize after viewport resize
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.evaluate(() =>
        new Promise<void>(resolve =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globalThis as any).requestAnimationFrame(() =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).requestAnimationFrame(() => resolve())
          )
        )
      );

      // Capture viewport-sized screenshot (no fullPage to avoid stitching artifacts)
      const screenshot = await page.screenshot({ type: 'png' });

      console.log('[ImageExporter] captured %d bytes', screenshot.length);

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
