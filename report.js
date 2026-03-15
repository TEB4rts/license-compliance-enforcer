// src/cli/commands/report.js
'use strict';

const path = require('path');
const fs = require('fs');
const { LicenseEnforcer } = require('../../index');
const Reporter = require('../../core/reporter');
const logger = require('../../utils/logger');

module.exports = function registerReport(program) {
  program
    .command('report [dir]')
    .description('Generate a full compliance report')
    .option('-p, --policy <file>', 'Policy file', './policy.yml')
    .option('-f, --format <fmt>', 'Format: html|markdown|json|text', 'html')
    .option('-o, --output <file>', 'Output file (default: compliance-report.<ext>)')
    .option('--open', 'Open HTML report in browser after generation')
    .action(async (dir, opts) => {
      const targetDir = path.resolve(dir || process.cwd());
      const spinner = logger.spinner('Building compliance report...');
      spinner.start();

      try {
        const enforcer = new LicenseEnforcer({ policy: opts.policy });
        const report = await enforcer.scan(targetDir);
        const reporter = new Reporter();
        spinner.stop();

        let content, ext;
        switch (opts.format) {
          case 'html':
            content = reporter.html(report);
            ext = 'html';
            break;
          case 'markdown':
            content = reporter.markdown(report);
            ext = 'md';
            break;
          case 'json':
            content = JSON.stringify(report.toJSON(), null, 2);
            ext = 'json';
            break;
          default:
            content = reporter.text(report);
            ext = 'txt';
        }

        const outFile = opts.output || `compliance-report.${ext}`;
        fs.writeFileSync(outFile, content, 'utf8');
        logger.success(`✅ Report written to ${outFile}`);

        if (opts.open && opts.format === 'html') {
          const { exec } = require('child_process');
          const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
          exec(`${open} ${outFile}`);
        }
      } catch (err) {
        spinner.stop();
        logger.error(`Report generation failed: ${err.message}`);
        process.exit(1);
      }
    });
};
