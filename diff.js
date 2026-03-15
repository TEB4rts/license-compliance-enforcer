// src/cli/commands/diff.js
'use strict';

const fs = require('fs');
const logger = require('../../utils/logger');

module.exports = function registerDiff(program) {
  program
    .command('diff <before> <after>')
    .description('Compare two scan results to show new violations introduced')
    .option('--json', 'Output as JSON')
    .action(async (beforeFile, afterFile, opts) => {
      try {
        const before = JSON.parse(fs.readFileSync(beforeFile, 'utf8'));
        const after = JSON.parse(fs.readFileSync(afterFile, 'utf8'));

        const beforeViolationNames = new Set(before.violations.map(v => `${v.ecosystem}:${v.name}@${v.version}`));
        const afterViolationNames = new Set(after.violations.map(v => `${v.ecosystem}:${v.name}@${v.version}`));

        const newViolations = after.violations.filter(v =>
          !beforeViolationNames.has(`${v.ecosystem}:${v.name}@${v.version}`)
        );
        const resolvedViolations = before.violations.filter(v =>
          !afterViolationNames.has(`${v.ecosystem}:${v.name}@${v.version}`)
        );

        const result = {
          newViolations,
          resolvedViolations,
          totalBefore: before.violations.length,
          totalAfter: after.violations.length,
          delta: after.violations.length - before.violations.length,
        };

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          if (newViolations.length === 0 && resolvedViolations.length === 0) {
            logger.success('No change in violations between scans.');
          } else {
            if (newViolations.length > 0) {
              logger.error(`\n❌ ${newViolations.length} NEW violation(s) introduced:`);
              for (const v of newViolations) {
                logger.error(`  • ${v.name}@${v.version} [${v.license}] — ${v.ecosystem}`);
              }
            }
            if (resolvedViolations.length > 0) {
              logger.success(`\n✅ ${resolvedViolations.length} violation(s) resolved:`);
              for (const v of resolvedViolations) {
                logger.success(`  • ${v.name}@${v.version} [${v.license}] — ${v.ecosystem}`);
              }
            }
          }
        }

        if (newViolations.length > 0) process.exit(1);
      } catch (err) {
        logger.error(`Diff failed: ${err.message}`);
        process.exit(2);
      }
    });
};


// src/cli/commands/audit.js (appended as separate export below)
