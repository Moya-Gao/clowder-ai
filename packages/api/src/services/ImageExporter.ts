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

      // Get full height of the chat container
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const height = await page.evaluate(() => {
        const doc = (globalThis as any).document;
        const container = doc?.querySelector('[data-chat-container]');
        return (container?.scrollHeight as number) ?? 720;
      });

      // Adjust viewport to include all content (limit to 50000px to avoid memory issues)
      await page.setViewport({ width: 1280, height: Math.min(height, 50000) });

      // Take screenshot
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: true,
      });

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
