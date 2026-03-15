// src/cli/commands/init.js
'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

const POLICY_TEMPLATE = `# policy.yml — License Compliance Enforcer
# Documentation: https://github.com/your-org/license-compliance-enforcer/docs/configuration.md

policy:
  name: "My Project"
  version: "1.0.0"

  # Preset: startup | enterprise | open-source | permissive-only
  # You can use a preset OR define custom rules below (custom rules override preset)
  preset: startup

  # ----- Custom Rules (override preset) -----

  # Explicitly blocked SPDX license identifiers
  blocked_licenses:
    - GPL-2.0-only
    - GPL-2.0-or-later
    - GPL-3.0-only
    - GPL-3.0-or-later
    - AGPL-3.0-only
    - AGPL-3.0-or-later
    - SSPL-1.0

  # Allowed license categories
  # Options: permissive | weak-copyleft | copyleft | public-domain | proprietary | unknown
  allowed_types:
    - permissive
    - public-domain

  # Fail if a dependency has no license or the license cannot be determined
  block_unknown: true

  # Require that all licenses allow commercial use
  require_commercial: true

  # Require patent grant clauses (blocks MIT, prefers Apache-2.0)
  # require_patent_grant: false

  # Scan indirect/transitive dependencies
  scan_transitive: true

  # Maximum transitive depth (comment out for unlimited)
  # max_depth: 5

  # SBOM Configuration
  sbom:
    enabled: true
    formats:
      - cyclonedx   # OWASP CycloneDX 1.5
      - spdx        # SPDX 2.3 (ISO/IEC 5962:2021)
    output_dir: ./sbom
    include_dev_deps: false

  # AI Ambiguity Resolver (for dual-licensed / unlabeled packages)
  # Uses local Ollama by default (free, private, no API key needed)
  ai_resolver:
    enabled: false
    provider: ollama           # ollama | openai-compatible
    model: llama3
    base_url: http://localhost:11434/v1
    api_key: ""                # Leave empty for Ollama
    confidence_threshold: 0.85
    cache_results: true

  # Approved exceptions — always get legal sign-off first!
  exceptions: []
  # - package: "some-gpl-package"
  #   ecosystem: npm
  #   version: ">=1.0.0 <2.0.0"
  #   reason: "Used only in CLI tooling, not shipped to users"
  #   approved_by: "legal@company.com"
  #   expires: "2026-01-01"
  #   ticket: "LEGAL-123"
`;

module.exports = function registerInit(program) {
  program
    .command('init')
    .description('Initialize a policy.yml for this project')
    .option('--preset <name>', 'Policy preset to use', 'startup')
    .option('--force', 'Overwrite existing policy.yml')
    .action(async (opts) => {
      const policyPath = path.resolve('./policy.yml');
      if (fs.existsSync(policyPath) && !opts.force) {
        logger.warn('policy.yml already exists. Use --force to overwrite.');
        process.exit(1);
      }
      fs.writeFileSync(policyPath, POLICY_TEMPLATE.replace('preset: startup', `preset: ${opts.preset}`), 'utf8');
      logger.success(`✅ Created policy.yml with preset: ${opts.preset}`);
      logger.info('Edit policy.yml to customize your compliance rules.');
      logger.info('Run "lce scan" to check your current dependencies.');
    });
};
