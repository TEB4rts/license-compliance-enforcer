// src/core/policy-loader.js
'use strict';

const fs = require('fs/promises');
const path = require('path');
const yaml = require('js-yaml');
const Ajv = require('ajv');
const schema = require('./policy-schema.json');
const { POLICY_PRESETS } = require('./policy-engine');

const ajv = new Ajv({ allErrors: true, strict: false });
const validatePolicySchema = ajv.compile(schema);

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

  try {
    await fs.access(resolvedPath);
  } catch {
    if (policyPath === './policy.yml' || policyPath === 'policy.yml') {
      console.warn('[policy] No policy.yml found, using default "startup" preset.');
      return { preset: 'startup', ...POLICY_PRESETS.startup };
    }
    throw new Error(`Policy file not found: ${resolvedPath}`);
  }

  const raw = await fs.readFile(resolvedPath, 'utf8');
  const parsed = yaml.load(raw);

  if (!validatePolicySchema(parsed)) {
    const details = validatePolicySchema.errors.map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');
    throw new Error(`Invalid policy.yml schema: ${details}`);
  }

  const policy = parsed.policy;

  if (policy.exceptions) {
    for (const ex of policy.exceptions) {
      if (!ex.approved_by) {
        console.warn(`[policy] Exception for "${ex.package}" has no approved_by — consider adding a legal contact.`);
      }
    }
  }

  return policy;
}

module.exports = { loadPolicy };
