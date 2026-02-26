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

      // Convert scroll-based layout to flow layout via targeted DOM manipulation.
      // Only modify [data-chat-container] and its direct ancestor chain — NOT all
      // .overflow-hidden elements globally (which caused layout duplication).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = (globalThis as any).document;
        const container = doc.querySelector('[data-chat-container]');
        if (!container) return;

        // Layer 1: [data-chat-container] — remove scroll, expand to content
        container.style.height = 'auto';
        container.style.overflow = 'visible';
        container.style.maxHeight = 'none';

        // Layer 2: parent div.flex-1.overflow-hidden — remove clip
        const chatWrapper = container.parentElement;
        if (chatWrapper) {
          chatWrapper.style.height = 'auto';
          chatWrapper.style.overflow = 'visible';
          chatWrapper.style.flex = 'none';
        }

        // Layer 3: grandparent div.flex.flex-col.flex-1 — let it grow
        const mainCol = chatWrapper?.parentElement;
        if (mainCol) {
          mainCol.style.height = 'auto';
          mainCol.style.flex = 'none';
        }

        // Layer 4: outermost div.h-screen.h-dvh — remove viewport lock
        const root = mainCol?.parentElement;
        if (root) {
          root.style.height = 'auto';
          root.style.minHeight = 'auto';
        }
      });

      // Wait for layout reflow after DOM style changes
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

      // Log the expanded element height after DOM manipulation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elHeight = await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = (globalThis as any).document.querySelector('[data-chat-container]');
        return c ? Math.round(c.getBoundingClientRect().height) : 0;
      });
      console.log('[ImageExporter] element height=%d (after flow conversion)', elHeight);

      // Use element screenshot instead of fullPage — avoids Puppeteer's scroll-based
      // tiling which duplicates content in complex flex layouts. Element screenshot
      // captures the element's bounding rect directly, no 16384 cap, no tiling.
      const el = await page.$('[data-chat-container]');
      if (!el) throw new Error('Chat container not found for screenshot');
      const screenshot = await el.screenshot({ type: 'png' });

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
