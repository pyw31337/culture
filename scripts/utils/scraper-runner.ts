/**
 * Shared scraper execution wrapper.
 * Individual scrapers can call `runScraperJob` so timeouts, health logging,
 * and exit codes stay consistent across local + CI.
 */
import { appendScraperHealth, type ScraperHealthEntry } from './scraper-utils';

export type ScraperJobOptions = {
  name: string;
  /** Optional hard timeout in ms (process-level). */
  timeoutMs?: number;
  run: () => Promise<{ itemCount?: number } | void>;
};

export async function runScraperJob(options: ScraperJobOptions): Promise<void> {
  const started = Date.now();
  const finishedAt = () => new Date().toISOString();

  const record = (partial: Omit<ScraperHealthEntry, 'name' | 'finishedAt' | 'durationMs'>) => {
    appendScraperHealth({
      name: options.name,
      finishedAt: finishedAt(),
      durationMs: Date.now() - started,
      ...partial,
    });
  };

  let timer: NodeJS.Timeout | undefined;
  try {
    const work = options.run();
    const result = options.timeoutMs
      ? await Promise.race([
          work,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error(`Scraper ${options.name} timed out after ${options.timeoutMs}ms`)),
              options.timeoutMs,
            );
          }),
        ])
      : await work;

    record({
      status: 'success',
      itemCount: result && typeof result === 'object' ? result.itemCount : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${options.name}] failed:`, message);
    record({ status: 'failure', error: message });
    // Non-zero exit so outer CI timeout wrapper can detect failure
    process.exitCode = 1;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
