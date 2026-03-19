import cliProgress from 'cli-progress';
import colors from 'ansi-colors';

/**
 * Standardized progress logger for long-running scripts.
 */
export class ProgressLogger {
    private multibar: cliProgress.MultiBar;
    private bars: Map<string, cliProgress.SingleBar> = new Map();

    constructor() {
        this.multibar = new cliProgress.MultiBar({
            clearOnComplete: false,
            hideCursor: true,
            format: ' {bar} | {percentage}% | {value}/{total} | ETA: {eta}s | {status}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
        }, cliProgress.Presets.shades_grey);
    }

    /**
     * Create a new progress bar
     */
    createBar(name: string, total: number, initialStatus: string = '') {
        const bar = this.multibar.create(total, 0, { status: initialStatus });
        this.bars.set(name, bar);
        return bar;
    }

    /**
     * Update an existing progress bar
     */
    update(name: string, current: number, status?: string) {
        const bar = this.bars.get(name);
        if (bar) {
            bar.update(current, status ? { status } : undefined);
        }
    }

    /**
     * Increment an existing progress bar
     */
    increment(name: string, amount: number = 1, status?: string) {
        const bar = this.bars.get(name);
        if (bar) {
            bar.increment(amount, status ? { status } : undefined);
        }
    }

    /**
     * Stop all bars
     */
    stop() {
        this.multibar.stop();
    }

    /**
     * Log a message without interfering with bars (if possible, though multibar handles this ok)
     */
    log(message: string) {
        this.multibar.log(colors.blue(message) + '\n');
    }

    error(message: string) {
        this.multibar.log(colors.red('ERROR: ' + message) + '\n');
    }
}

export const progressLogger = new ProgressLogger();
