// src/cli/commands/sbom.js
'use strict';

const path = require('path');
const fs = require('fs');
const { LicenseEnforcer } = require('../../index');
const logger = require('../../utils/logger');

module.exports = function registerSbom(program) {
  program
    .command('sbom [dir]')
    .description('Generate a Software Bill of Materials (SBOM)')
    .option('-f, --format <fmt>', 'Format: cyclonedx|spdx|all', 'all')
    .option('-o, --output <dir>', 'Output directory', './sbom')
    .option('-p, --policy <file>', 'Policy file', './policy.yml')
    .option('--validate', 'Validate an existing SBOM file instead of generating')
    .option('--include-dev', 'Include dev dependencies')
    .action(async (dir, opts) => {
      const targetDir = path.resolve(dir || process.cwd());

      if (opts.validate) {
        logger.info('SBOM validation not yet implemented — coming in v2.1');
        return;
      }

      try {
        const enforcer = new LicenseEnforcer({ policy: opts.policy });
        const formats = opts.format === 'all' ? ['cyclonedx', 'spdx'] : [opts.format];
        const spinner = logger.spinner('Generating SBOM...');
        spinner.start();

        const sbom = await enforcer.generateSbom(targetDir, { formats, includeDev: opts.includeDev });

        spinner.stop();
        fs.mkdirSync(opts.output, { recursive: true });

        for (const fmt of formats) {
          const ext = fmt === 'cyclonedx' ? 'cdx.json' : 'spdx.json';
          const outFile = path.join(opts.output, `sbom.${ext}`);
          fs.writeFileSync(outFile, JSON.stringify(sbom[fmt], null, 2), 'utf8');
          logger.success(`✅ ${fmt.toUpperCase()} SBOM written to ${outFile}`);
        }

        logger.info(`📦 ${sbom.componentCount} components · ${sbom.licenseCount} unique licenses`);
      } catch (err) {
        logger.error(`SBOM generation failed: ${err.message}`);
        process.exit(1);
      }
    });
};
