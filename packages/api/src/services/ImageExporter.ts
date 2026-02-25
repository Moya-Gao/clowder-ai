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

      // Load ALL paginated messages before capture.
      // The frontend loads messages in pages of 50 (HISTORY_PAGE_SIZE).
      // Scrolling the chat container to top triggers the next page load.
      // We repeat until scrollHeight stabilizes (no more messages to load).
      let prevScrollHeight = 0;
      let stableRounds = 0;
      for (let i = 0; i < 100; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scrollHeight = await page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const container = (globalThis as any).document.querySelector('[data-chat-container]');
          if (!container) return 0;
          container.scrollTop = 0; // triggers onScroll → fetchHistory when scrollTop < 80
          return container.scrollHeight as number;
        });

        // Wait for the pagination API response to arrive and render
        await page.waitForNetworkIdle({ idleTime: 500, timeout: 3000 }).catch(() => {});

        if (scrollHeight === prevScrollHeight) {
          stableRounds++;
          if (stableRounds >= 2) break; // 2 consecutive rounds with no change → done
        } else {
          stableRounds = 0;
        }
        prevScrollHeight = scrollHeight;
      }

      // Precisely remove height/overflow constraints on the chat container
      // and its direct ancestor chain only. Previous approach used global CSS
      // injection (.overflow-hidden { overflow: visible }) which broke sidebar
      // and panel layouts, inflating document.scrollHeight and causing Chrome's
      // 16384px GPU texture limit to silently truncate the capture.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dims = await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = globalThis as any;
        const container = g.document.querySelector('[data-chat-container]');
        if (!container) return { top: 0, height: 720 };

        // Remove chat container's h-full + overflow-y:auto
        container.style.setProperty('height', 'auto', 'important');
        container.style.setProperty('overflow', 'visible', 'important');

        // Remove direct parent's overflow-hidden (the flex-1 wrapper)
        const parent = container.parentElement;
        if (parent) {
          parent.style.setProperty('overflow', 'visible', 'important');
          parent.style.setProperty('height', 'auto', 'important');
        }

        // Walk up to find the h-screen/h-dvh ancestor and remove height constraint
        let el = parent?.parentElement;
        while (el && el !== g.document.documentElement) {
          if (el.classList?.contains('h-screen') || el.classList?.contains('h-dvh')) {
            el.style.setProperty('height', 'auto', 'important');
            break;
          }
          el = el.parentElement;
        }

        // Force synchronous layout recalc and return dimensions
        const rect = container.getBoundingClientRect();
        return { top: Math.ceil(rect.top), height: Math.ceil(rect.height) };
      });

      // Double-rAF for layout stabilization
      await page.evaluate(() =>
        new Promise<void>(resolve =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globalThis as any).requestAnimationFrame(() =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).requestAnimationFrame(() => resolve())
          )
        )
      );

      // Total height = header offset + chat content height.
      // Cap at 16384px — Chrome's max GPU texture dimension on most systems.
      // Beyond this, Page.captureScreenshot silently truncates the image.
      const totalHeight = dims.top + dims.height;
      const cappedHeight = Math.min(totalHeight, 16384);

      await page.setViewport({ width: 1280, height: cappedHeight });

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

      // Capture viewport-sized screenshot (no fullPage — avoids Puppeteer
      // internally re-measuring/re-sizing the viewport which creates
      // layout feedback loops with h-screen based layouts)
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
