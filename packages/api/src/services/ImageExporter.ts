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
      // Pass userId as URL param so the frontend's getUserId() resolves the correct
      // identity instead of falling back to 'default-user' (headless Chrome has no localStorage)
      exportUrl.searchParams.set('userId', userId);

      // Navigate to target page, wait for network idle
      await page.goto(exportUrl.toString(), {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Wait for messages to actually render (networkidle2 doesn't wait for React).
      // Export mode doesn't render [data-chat-container], so just wait for any message.
      await page.waitForSelector('[data-message-id]', { timeout: 15000 });

      // Give React one more render cycle to settle after messages mount
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

      // Diagnostic: log what the page actually loaded
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const diag = await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = globalThis as any;
        const msgEls = g.document.querySelectorAll('[data-message-id]') ?? [];
        return {
          url: g.window?.location?.href,
          search: g.window?.location?.search,
          messageCount: msgEls.length,
          docHeight: g.document.documentElement.scrollHeight,
        };
      });
      console.log('[ImageExporter] diagnostics:', JSON.stringify(diag));

      // Frontend export mode (?export=true) renders a print-friendly layout:
      // - No h-screen (uses min-h-screen)
      // - No overflow-y-auto (natural flow)
      // - No sidebar, header, or input bar
      // Just use fullPage screenshot — the page is already in flow layout.
      console.log('[ImageExporter] docHeight=%d (fullPage)', diag.docHeight);

      const screenshot = await page.screenshot({ type: 'png', fullPage: true });

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
