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

      // Wait for chat container to load
      await page.waitForSelector('[data-chat-container]', { timeout: 10000 });

      // Wait for messages to actually render (networkidle2 doesn't wait for React).
      // Poll until at least one [data-message-id] element appears or timeout after 15s.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.waitForFunction(
        () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const container = (globalThis as any).document.querySelector('[data-chat-container]');
          const msgs = container?.querySelectorAll('[data-message-id]') ?? [];
          return msgs.length > 0;
        },
        { timeout: 15000 },
      );

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

      // Inject CSS to convert the scroll-based layout into a flow layout for fullPage capture.
      // Layout chain: h-screen h-dvh > flex-1 overflow-hidden > h-full overflow-y-auto
      // All three layers must be unset so content flows naturally for Puppeteer's fullPage.
      await page.addStyleTag({
        content: `
          /* Remove viewport height constraint from outermost container */
          .h-screen, .h-dvh { height: auto !important; }
          /* Remove overflow clip from chat area wrapper */
          .overflow-hidden { overflow: visible !important; }
          /* Convert chat container from scroll to flow */
          [data-chat-container] {
            height: auto !important;
            overflow: visible !important;
          }
          /* Hide sidebar and input bar in export */
          [data-sidebar], [data-chat-input] { display: none !important; }
        `,
      });

      // Wait for layout reflow after CSS injection
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

      // Log final document height (no 16384 cap — fullPage captures in tiles)
      const docHeight = await page.evaluate(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => (globalThis as any).document.documentElement.scrollHeight as number,
      );
      console.log('[ImageExporter] docHeight=%d (fullPage, no cap)', docHeight);

      // fullPage: true captures the entire document by tiling — no GPU texture limit
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
