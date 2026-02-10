import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_CLI_RAW_ARCHIVE_DIR = './data/cli-raw-archive';

export interface RawArchiveEntry {
  readonly timestamp: number;
  readonly payload: unknown;
}

export class CliRawArchive {
  private readonly archiveDir: string;
  private initialized = false;

  constructor(options?: { archiveDir?: string }) {
    this.archiveDir = options?.archiveDir ?? process.env['CLI_RAW_ARCHIVE_DIR'] ?? DEFAULT_CLI_RAW_ARCHIVE_DIR;
  }

  async append(invocationId: string, payload: unknown): Promise<void> {
    await this.ensureInitialized();

    const timestamp = Date.now();
    const day = this.formatDate(new Date(timestamp));
    const dir = join(this.archiveDir, day);
    const file = join(dir, `${invocationId}.ndjson`);
    const entry: RawArchiveEntry = { timestamp, payload };

    await mkdir(dir, { recursive: true });
    await appendFile(file, `${JSON.stringify(entry)}\n`, 'utf-8');
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await mkdir(this.archiveDir, { recursive: true });
    this.initialized = true;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

