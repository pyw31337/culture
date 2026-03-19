const cliProgress = require('cli-progress');
const colors = require('ansi-colors');

class ProgressLogger {
    constructor() {
        this.multibar = new cliProgress.MultiBar({
            clearOnComplete: false,
            hideCursor: true,
            format: ' {bar} | {percentage}% | {value}/{total} | ETA: {eta}s | {status}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
        }, cliProgress.Presets.shades_grey);
        this.bars = new Map();
    }

    createBar(name, total, initialStatus = '') {
        const bar = this.multibar.create(total, 0, { status: initialStatus });
        this.bars.set(name, bar);
        return bar;
    }

    update(name, current, status) {
        const bar = this.bars.get(name);
        if (bar) {
            bar.update(current, status ? { status } : undefined);
        }
    }

    increment(name, amount = 1, status) {
        const bar = this.bars.get(name);
        if (bar) {
            bar.increment(amount, status ? { status } : undefined);
        }
    }

    stop() {
        this.multibar.stop();
    }

    log(message) {
        this.multibar.log(colors.blue(message) + '\n');
    }

    error(message) {
        this.multibar.log(colors.red('ERROR: ' + message) + '\n');
    }
}

module.exports = {
    ProgressLogger,
    progressLogger: new ProgressLogger()
};
