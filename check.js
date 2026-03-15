// src/cli/commands/check.js
'use strict';

const logger = require('../../utils/logger');

module.exports = function registerCheck(program) {
  program
    .command('check <package>')
    .description('Check license info for a single package (e.g. lodash@4.17.21, pip:requests@2.31)')
    .option('-e, --ecosystem <eco>', 'Ecosystem: npm|pip|cargo|go|maven|rubygems', 'npm')
    .option('--json', 'Output as JSON')
    .action(async (pkg, opts) => {
      try {
        let name, version, ecosystem;
        // Support pkg:name@version format
        if (pkg.includes(':')) {
          [ecosystem, pkg] = pkg.split(':');
        } else {
          ecosystem = opts.ecosystem;
        }
        if (pkg.includes('@') && !pkg.startsWith('@')) {
          [name, version] = pkg.split('@');
        } else if (pkg.includes('@') && pkg.startsWith('@')) {
          const parts = pkg.slice(1).split('@');
          name = '@' + parts[0];
          version = parts[1];
        } else {
          name = pkg;
          version = 'latest';
        }

        const EcosystemResolver = require(`../../ecosystems/${ecosystem}`);
        const resolver = new EcosystemResolver();
        const info = await resolver.fetchPackageInfo(name, version);

        if (opts.json) {
          console.log(JSON.stringify(info, null, 2));
        } else {
          logger.packageInfo(info);
        }
      } catch (err) {
        logger.error(`Failed to check package: ${err.message}`);
        process.exit(1);
      }
    });
};
