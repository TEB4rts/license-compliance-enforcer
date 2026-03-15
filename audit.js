// src/cli/commands/audit.js
'use strict';

const path = require('path');
const { LicenseEnforcer } = require('../../index');
const logger = require('../../utils/logger');
const { SPDX_DATA } = require('../../licenses/spdx-data');

const REMEDIATION_MAP = {
  'GPL-2.0-only': 'Replace with a permissive alternative, or isolate in a separate microservice. Common alternatives: MIT-licensed forks often exist.',
  'GPL-3.0-only': 'Replace with a permissive alternative. If you must use it, isolate via subprocess/API boundary — do NOT link directly.',
  'AGPL-3.0-only': 'CRITICAL: AGPL requires you to publish ALL source code of your service. Remove immediately or get legal approval.',
  'SSPL-1.0': 'CRITICAL: Server Side Public License is not OSI-approved. Requires open-sourcing your entire stack. Remove immediately.',
  'UNLICENSED': 'No license = all rights reserved by default. Contact the package maintainer or find an alternative.',
  'UNKNOWN': 'License could not be determined. Check the package repository manually and consider pinning a safe alternative.',
};

module.exports = function registerAudit(program) {
  program
    .command('audit [dir]')
    .description('Full audit with remediation suggestions and fix commands')
    .option('-p, --policy <file>', 'Policy file', './policy.yml')
    .option('--fix', 'Attempt to auto-remove violating packages (npm only, dry-run by default)')
    .option('--dry-run', 'Show what --fix would do without executing')
    .action(async (dir, opts) => {
      const targetDir = path.resolve(dir || process.cwd());
      const spinner = logger.spinner('Running full compliance audit...');
      spinner.start();

      try {
        const enforcer = new LicenseEnforcer({ policy: opts.policy, verbose: true });
        const report = await enforcer.scan(targetDir);
        spinner.stop();

        console.log('\n' + '═'.repeat(60));
        console.log('  ⚖️  LICENSE COMPLIANCE AUDIT REPORT');
        console.log('═'.repeat(60) + '\n');

        console.log(`  📦 Packages scanned : ${report.packages.length}`);
        console.log(`  ✅ Compliant        : ${report.packages.length - report.violations.length}`);
        console.log(`  ❌ Violations       : ${report.violations.length}`);
        console.log(`  ⚠️  Warnings         : ${report.warnings.length}`);
        console.log('\n' + '─'.repeat(60));

        if (report.violations.length === 0) {
          console.log('\n  ✅ Your project is fully compliant. No action required.\n');
          return;
        }

        console.log('\n  VIOLATIONS & REMEDIATION\n');

        for (const [i, v] of report.violations.entries()) {
          const spdx = SPDX_DATA[v.license] || {};
          const remediation = REMEDIATION_MAP[v.license] || `Review and replace or get legal approval for ${v.license}.`;

          console.log(`  [${i + 1}] ${v.name}@${v.version} (${v.ecosystem})`);
          console.log(`      License  : ${v.license}`);
          console.log(`      Risk     : ${spdx.risk || 'unknown'}`);
          console.log(`      Path     : ${v.dependencyPath || 'direct'}`);
          console.log(`      Issue    : ${v.violationReasons.join(', ')}`);
          console.log(`      Fix      : ${remediation}`);
          if (v.ecosystem === 'npm') {
            console.log(`      Command  : npm remove ${v.name}`);
          } else if (v.ecosystem === 'pip') {
            console.log(`      Command  : pip uninstall ${v.name}`);
          }
          console.log();
        }

        console.log('─'.repeat(60));
        console.log('\n  ℹ️  Add exceptions to policy.yml for packages that have been legally approved.');
        console.log('  ℹ️  Run "lce sbom" to generate a Software Bill of Materials.\n');

      } catch (err) {
        spinner.stop();
        logger.error(`Audit failed: ${err.message}`);
        process.exit(1);
      }
    });
};
