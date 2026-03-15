// src/core/policy-engine.js
'use strict';

const semver = require('semver');
const { SPDX_DATA } = require('../licenses/spdx-data');

const POLICY_PRESETS = {
  startup: {
    name: 'Startup / SaaS',
    blockedLicenses: [
      'GPL-2.0-only', 'GPL-2.0-or-later', 'GPL-2.0',
      'GPL-3.0-only', 'GPL-3.0-or-later', 'GPL-3.0',
      'AGPL-3.0-only', 'AGPL-3.0-or-later', 'AGPL-3.0',
      'SSPL-1.0', 'UNLICENSED',
    ],
    allowedTypes: ['permissive', 'public-domain'],
    requireCommercial: true,
    blockUnknown: true,
  },
  enterprise: {
    name: 'Enterprise',
    blockedLicenses: [
      'GPL-2.0-only', 'GPL-2.0-or-later', 'GPL-2.0',
      'GPL-3.0-only', 'GPL-3.0-or-later', 'GPL-3.0',
      'AGPL-3.0-only', 'AGPL-3.0-or-later', 'AGPL-3.0',
      'LGPL-2.0-only', 'LGPL-2.0-or-later', 'LGPL-2.0',
      'LGPL-2.1-only', 'LGPL-2.1-or-later', 'LGPL-2.1',
      'LGPL-3.0-only', 'LGPL-3.0-or-later', 'LGPL-3.0',
      'MPL-2.0', 'EUPL-1.2', 'SSPL-1.0', 'UNLICENSED',
    ],
    allowedTypes: ['permissive', 'public-domain'],
    requireCommercial: true,
    blockUnknown: true,
    requirePatentGrant: false,
  },
  'open-source': {
    name: 'Open Source (GPL-compatible)',
    blockedLicenses: [
      'AGPL-3.0-only', 'AGPL-3.0-or-later', 'AGPL-3.0',
      'SSPL-1.0', 'UNLICENSED',
    ],
    allowedTypes: ['permissive', 'weak-copyleft', 'copyleft', 'public-domain'],
    requireCommercial: false,
    blockUnknown: false,
  },
  'permissive-only': {
    name: 'Permissive Only',
    blockedLicenses: [
      'GPL-2.0-only', 'GPL-2.0-or-later', 'GPL-2.0',
      'GPL-3.0-only', 'GPL-3.0-or-later', 'GPL-3.0',
      'AGPL-3.0-only', 'AGPL-3.0-or-later', 'AGPL-3.0',
      'LGPL-2.0-only', 'LGPL-2.0-or-later', 'LGPL-2.0',
      'LGPL-2.1-only', 'LGPL-2.1-or-later', 'LGPL-2.1',
      'LGPL-3.0-only', 'LGPL-3.0-or-later', 'LGPL-3.0',
      'MPL-2.0', 'EUPL-1.2', 'SSPL-1.0', 'UNLICENSED',
    ],
    allowedTypes: ['permissive', 'public-domain'],
    requireCommercial: true,
    blockUnknown: true,
  },
};

/**
 * PolicyEngine evaluates packages against a policy configuration
 */
class PolicyEngine {
  constructor(policy) {
    this.policy = this._resolvePolicy(policy);
  }

  _resolvePolicy(policy) {
    if (!policy) return POLICY_PRESETS.startup;

    let base = policy.preset ? { ...POLICY_PRESETS[policy.preset] } : { ...POLICY_PRESETS.startup };

    // Merge custom overrides
    if (policy.blocked_licenses) {
      base.blockedLicenses = [
        ...(base.blockedLicenses || []),
        ...policy.blocked_licenses,
      ];
    }
    if (policy.allowed_types) base.allowedTypes = policy.allowed_types;
    if (policy.require_commercial !== undefined) base.requireCommercial = policy.require_commercial;
    if (policy.block_unknown !== undefined) base.blockUnknown = policy.block_unknown;
    if (policy.require_patent_grant !== undefined) base.requirePatentGrant = policy.require_patent_grant;
    if (policy.exceptions) base.exceptions = policy.exceptions;

    // Deduplicate blocked licenses
    base.blockedLicenses = [...new Set(base.blockedLicenses)];

    return base;
  }

  /**
   * Evaluate all packages against the policy
   * @param {Object[]} packages
   * @returns {{ all: Object[], violations: Object[], warnings: Object[] }}
   */
  evaluate(packages) {
    const violations = [];
    const warnings = [];
    const all = [];

    for (const pkg of packages) {
      const result = this._evaluatePackage(pkg);
      const enriched = { ...pkg, ...result };

      all.push(enriched);
      if (result.violationReasons.length > 0) {
        violations.push(enriched);
      } else if (result.warningReasons.length > 0) {
        warnings.push(enriched);
      }
    }

    return { all, violations, warnings };
  }

  /**
   * Evaluate a single package
   */
  _evaluatePackage(pkg) {
    const violationReasons = [];
    const warningReasons = [];
    const policy = this.policy;

    // Check if this package has an approved exception
    if (this._hasException(pkg)) {
      return {
        violationReasons: [],
        warningReasons: [],
        exempt: true,
        exemptionDetails: this._getException(pkg),
      };
    }

    const license = pkg.license || 'UNKNOWN';
    const spdxInfo = SPDX_DATA[license] || {};
    const licenseType = spdxInfo.type || 'unknown';

    // Rule 1: Explicitly blocked licenses
    if (policy.blockedLicenses && policy.blockedLicenses.includes(license)) {
      violationReasons.push(`License '${license}' is explicitly blocked by policy`);
    }

    // Rule 2: Unknown / missing license
    if ((license === 'UNKNOWN' || !license) && policy.blockUnknown) {
      violationReasons.push('Package has no detectable license (blocked_unknown: true)');
    }

    // Rule 3: License type not in allowed types
    if (policy.allowedTypes && licenseType && !policy.allowedTypes.includes(licenseType)) {
      // Only add if not already caught by explicit block (avoid duplicate messages)
      if (!violationReasons.length) {
        violationReasons.push(`License type '${licenseType}' is not in allowed_types: [${policy.allowedTypes.join(', ')}]`);
      }
    }

    // Rule 4: Commercial use restriction
    if (policy.requireCommercial && spdxInfo.commercial === false) {
      violationReasons.push(`License '${license}' restricts commercial use`);
    }

    // Rule 5: Patent grant requirement
    if (policy.requirePatentGrant && !spdxInfo.patent) {
      warningReasons.push(`License '${license}' does not include an explicit patent grant`);
    }

    // Rule 6: Copyleft warning (even if not blocked)
    if (spdxInfo.copyleft && !violationReasons.length) {
      warningReasons.push(`License '${license}' is copyleft — ensure it does not contaminate your codebase`);
    }

    // Rule 7: Deprecated SPDX identifiers
    if (spdxInfo.deprecated) {
      warningReasons.push(`License identifier '${license}' is deprecated — use '${spdxInfo.replacedBy || 'the current SPDX identifier'}' instead`);
    }

    return {
      violationReasons,
      warningReasons,
      exempt: false,
      compliant: violationReasons.length === 0,
    };
  }

  _hasException(pkg) {
    const exceptions = this.policy.exceptions || [];
    return exceptions.some(ex => this._matchesException(pkg, ex));
  }

  _getException(pkg) {
    const exceptions = this.policy.exceptions || [];
    return exceptions.find(ex => this._matchesException(pkg, ex));
  }

  _matchesException(pkg, exception) {
    if (exception.package && exception.package !== pkg.name) return false;
    if (exception.ecosystem && exception.ecosystem !== pkg.ecosystem) return false;
    if (exception.version && pkg.version) {
      try {
        if (!semver.satisfies(pkg.version, exception.version)) return false;
      } catch { /* ignore invalid semver */ }
    }
    // Check expiry
    if (exception.expires) {
      if (new Date(exception.expires) < new Date()) {
        console.warn(`[policy] Exception for ${pkg.name} expired on ${exception.expires} — treating as violation`);
        return false;
      }
    }
    return true;
  }

  /**
   * Get policy info for display
   */
  getSummary() {
    return {
      name: this.policy.name || 'Custom Policy',
      blockedCount: this.policy.blockedLicenses?.length || 0,
      allowedTypes: this.policy.allowedTypes || [],
      requireCommercial: this.policy.requireCommercial || false,
      blockUnknown: this.policy.blockUnknown || false,
    };
  }

  /**
   * Static: get all available presets
   */
  static getPresets() {
    return Object.entries(POLICY_PRESETS).map(([key, preset]) => ({
      key,
      name: preset.name,
      blockedCount: preset.blockedLicenses.length,
      allowedTypes: preset.allowedTypes,
    }));
  }
}

module.exports = PolicyEngine;
module.exports.POLICY_PRESETS = POLICY_PRESETS;
