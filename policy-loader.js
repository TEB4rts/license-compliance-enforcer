// src/core/policy-loader.js
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { POLICY_PRESETS } = require('./policy-engine');

/**
 * Load and validate a policy configuration
 * @param {string} policyPath - Path to policy.yml OR a preset name
 * @returns {Promise<Object>} Resolved policy object
 */
async function loadPolicy(policyPath) {
  // Is it a preset name?
  if (POLICY_PRESETS[policyPath]) {
    return { preset: policyPath, ...POLICY_PRESETS[policyPath] };
  }

  const resolvedPath = path.resolve(policyPath);

  // Does the file exist?
  if (!fs.existsSync(resolvedPath)) {
    // If the default policy.yml doesn't exist, fall back to startup preset
    if (policyPath === './policy.yml' || policyPath === 'policy.yml') {
      console.warn('[policy] No policy.yml found, using default "startup" preset.');
      return { preset: 'startup', ...POLICY_PRESETS.startup };
    }
    throw new Error(`Policy file not found: ${resolvedPath}`);
  }

  const raw = fs.readFileSync(resolvedPath, 'utf8');
  const parsed = yaml.load(raw);

  if (!parsed || !parsed.policy) {
    throw new Error(`Invalid policy.yml: must have a top-level "policy" key`);
  }

  const policy = parsed.policy;

  // Validate exceptions
  if (policy.exceptions) {
    for (const ex of policy.exceptions) {
      if (!ex.package) {
        throw new Error(`Invalid exception in policy.yml: missing "package" field`);
      }
      if (!ex.reason) {
        console.warn(`[policy] Exception for "${ex.package}" has no reason — please document why it was approved.`);
      }
      if (!ex.approved_by) {
        console.warn(`[policy] Exception for "${ex.package}" has no approved_by — consider adding a legal contact.`);
      }
    }
  }

  return policy;
}

module.exports = { loadPolicy };
