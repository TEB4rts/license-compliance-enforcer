// src/cli/commands/scan.js
'use strict';

const path = require('path');
const { LicenseEnforcer } = require('../../index');
const { loadPolicy } = require('../../core/policy-loader');
const Reporter = require('../../core/reporter');
const logger = require('../../utils/logger');

module.exports = function registerScan(program) {
  program
    .command('scan [dir]')
    .description('Scan dependencies for license violations')
    .option('-p, --policy <file>', 'Path to policy.yml or preset name', './policy.yml')
    .option('-e, --ecosystems <list>', 'Comma-separated ecosystems or "auto"', 'auto')
    .option('-f, --format <fmt>', 'Output format: text|json|junit|sarif|markdown', 'text')
    .option('-o, --output <file>', 'Write report to file instead of stdout')
    .option('--no-fail-on-violation', 'Do not exit 1 on violations')
    .option('--no-scan-transitive', 'Only scan direct dependencies')
    .option('--depth <n>', 'Max transitive depth (default: unlimited)', parseInt)
    .option('--no-cache', 'Skip the dependency cache')
    .option('--quiet', 'Suppress output except errors and final status')
    .option('--verbose', 'Verbose output including all dep info')
    .option('--summary-only', 'Print summary only, no package list')
    .action(async (dir, opts) => {
      const targetDir = path.resolve(dir || process.cwd());

      if (!opts.quiet) {
        logger.banner(targetDir);
      }

      try {
        const ecosystems = opts.ecosystems === 'auto'
          ? ['auto']
          : opts.ecosystems.split(',').map(e => e.trim());

        const enforcer = new LicenseEnforcer({
          policy: opts.policy,
          ecosystems,
          scanTransitive: opts.scanTransitive !== false,
          depth: opts.depth,
          cache: opts.cache !== false,
          verbose: opts.verbose,
        });

        const spinner = opts.quiet ? null : logger.spinner('Scanning dependencies...');
        if (spinner) spinner.start();

        const report = await enforcer.scan(targetDir);

        if (spinner) spinner.stop();

        const reporter = new Reporter({ verbose: opts.verbose, summaryOnly: opts.summaryOnly });
        let output;

        switch (opts.format) {
          case 'json':
            output = JSON.stringify(report.toJSON(), null, 2);
            break;
          case 'junit':
            output = report.toJUnit();
            break;
          case 'sarif':
            output = JSON.stringify(report.toSarif(), null, 2);
            break;
          case 'markdown':
            output = reporter.markdown(report);
            break;
          default:
            output = reporter.text(report);
        }

        if (opts.output) {
          const fs = require('fs');
          fs.writeFileSync(opts.output, output, 'utf8');
          if (!opts.quiet) {
            logger.success(`Report written to ${opts.output}`);
          }
        } else {
          process.stdout.write(output + '\n');
        }

        if (report.hasViolations && opts.failOnViolation !== false) {
          if (!opts.quiet) {
            logger.error(`\n❌ ${report.violations.length} violation(s) found. Failing.`);
          }
          process.exit(1);
        }

        if (!opts.quiet && !report.hasViolations) {
          logger.success('\n✅ All dependencies comply with the license policy.');
        }

      } catch (err) {
        logger.error(`Scan failed: ${err.message}`);
        if (opts.verbose) {
          console.error(err.stack);
        }
        process.exit(2);
      }
    });
};
