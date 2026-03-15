// src/utils/logger.js
'use strict';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const noColor = process.env.NO_COLOR || !process.stdout.isTTY;
const c = (code, text) => noColor ? text : `${code}${text}${RESET}`;

const logger = {
  info: (msg) => console.error(c(CYAN, 'ℹ ') + msg),
  success: (msg) => console.error(c(GREEN, '✓ ') + msg),
  warn: (msg) => console.error(c(YELLOW, '⚠ ') + msg),
  error: (msg) => console.error(c(RED, '✖ ') + msg),

  banner(dir) {
    console.error('');
    console.error(c(BOLD, '⚖️  license-compliance-enforcer') + c(DIM, ' v' + require('../../package.json').version));
    console.error(c(DIM, `   Scanning: ${dir}`));
    console.error('');
  },

  packageInfo(info) {
    console.log('');
    console.log(c(BOLD, `📦 ${info.name}@${info.version}`));
    console.log(`   Ecosystem : ${info.ecosystem}`);
    console.log(`   License   : ${c(info.license ? CYAN : RED, info.license || 'UNKNOWN')}`);
    if (info.description) console.log(`   Desc      : ${info.description}`);
    if (info.homepage) console.log(`   Homepage  : ${info.homepage}`);
    if (info.repositoryUrl) console.log(`   Repo      : ${info.repositoryUrl}`);
    console.log('');
  },

  spinner(text) {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    let timer = null;
    let active = false;

    return {
      start() {
        if (noColor || !process.stderr.isTTY) {
          process.stderr.write(text + '\n');
          return;
        }
        active = true;
        timer = setInterval(() => {
          process.stderr.write(`\r${c(CYAN, frames[i++ % frames.length])} ${text}`);
        }, 80);
      },
      stop() {
        if (!active) return;
        clearInterval(timer);
        if (process.stderr.isTTY) {
          process.stderr.write('\r\x1b[K');
        }
        active = false;
      },
    };
  },
};

module.exports = logger;
