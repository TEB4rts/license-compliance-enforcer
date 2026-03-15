// src/licenses/spdx-data.js
'use strict';

/**
 * Comprehensive SPDX license data
 * Source: https://spdx.org/licenses/ (freely available, Creative Commons Zero)
 *
 * Fields:
 *   type: permissive | weak-copyleft | copyleft | public-domain | proprietary | unknown
 *   risk: none | low | medium | high | critical
 *   commercial: bool - allows commercial use
 *   patent: bool - includes explicit patent grant
 *   copyleft: bool - is copyleft (requires sharing modifications)
 *   deprecated: bool - SPDX deprecated identifier
 *   replacedBy: string - current SPDX ID if deprecated
 *   osi: bool - OSI-approved
 *   fsf: bool - FSF-approved as free
 *   url: string - canonical URL
 */
const SPDX_DATA = {
  // ──────────────────────────────────────────
  // PERMISSIVE — Low/No Risk
  // ──────────────────────────────────────────
  'MIT': {
    type: 'permissive', risk: 'low',
    commercial: true, patent: false, copyleft: false,
    osi: true, fsf: true,
    url: 'https://spdx.org/licenses/MIT.html',
    summary: 'Simple and permissive. Attribution required. No patent grant.',
  },
  'Apache-2.0': {
    type: 'permissive', risk: 'low',
    commercial: true, patent: true, copyleft: false,
    osi: true, fsf: true,
    url: 'https://spdx.org/licenses/Apache-2.0.html',
    summary: 'Permissive with explicit patent grant. Best choice for commercial software.',
  },
  'BSD-2-Clause': {
    type: 'permissive', risk: 'low',
    commercial: true, patent: false, copyleft: false,
    osi: true, fsf: true,
    url: 'https://spdx.org/licenses/BSD-2-Clause.html',
    summary: 'Simplified BSD. Attribution required.',
  },
  'BSD-3-Clause': {
    type: 'permissive', risk: 'low',
    commercial: true, patent: false, copyleft: false,
    osi: true, fsf: true,
    url: 'https://spdx.org/licenses/BSD-3-Clause.html',
    summary: 'Modified BSD. Attribution required. No endorsement clause.',
  },
  'BSD-4-Clause': {
    type: 'permissive', risk: 'low',
    commercial: true, patent: false, copyleft: false,
    osi: false, fsf: true,
    url: 'https://spdx.org/licenses/BSD-4-Clause.html',
    summary: 'Original BSD. Has advertising clause — not OSI-approved.',
  },
  'ISC': {
    type: 'permissive', risk: 'low',
    commercial: true, patent: false, copyleft: false,
    osi: true, fsf: true,
    url: 'https://spdx.org/licenses/ISC.html',
    summary: 'Functionally equivalent to MIT. Used by OpenBSD.',
  },
  'Zlib': {
    type: 'permissive', risk: 'low',
    commercial: true, patent: false, copyleft: false,
    osi: true, fsf: true,
    url: 'https://spdx.org/licenses/Zlib.html',
  },
  'PSF-2.0': {
    type: 'permissive', risk: 'low',
    commercial: true, patent: false, copyleft: false,
    osi: true, fsf: true,
    url: 'https://spdx.org/licenses/PSF-2.0.html',
    summary: 'Python Software Foundation License. Used by Python stdlib.',
  },
  'Python-2.0': {
    type: 'permissive', risk: 'low',
    commercial: true, patent: false, copyleft: false,
    osi: true, fsf: true,
  },
  'MIT-0': {
    type: 'permissive', risk: 'none',
    commercial: true, patent: false, copyleft: false,
    osi: true, fsf: true,
    summary: 'MIT without attribution requirement.',
  },
  'BlueOak-1.0.0': {
    type: 'permissive', risk: 'low',
    commercial: true, patent: true, copyleft: false,
    osi: true, fsf: true,
    summary: 'Modern permissive license with patent grant.',
  },
  'Artistic-2.0': {
    type: 'permissive', risk: 'low',
    commercial: true, patent: false, copyleft: false,
    osi: true, fsf: true,
  },
  'Boost-1.0': {
    type: 'permissive', risk: 'low',
    commercial: true, patent: false, copyleft: false,
    osi: true, fsf: true,
  },
  'WTFPL': {
    type: 'permissive', risk: 'low',
    commercial: true, patent: false, copyleft: false,
    osi: false, fsf: true,
  },
  'Unlicense': {
    type: 'public-domain', risk: 'none',
    commercial: true, patent: false, copyleft: false,
    osi: true, fsf: true,
    summary: 'Explicit public domain dedication.',
  },
  'CC0-1.0': {
    type: 'public-domain', risk: 'none',
    commercial: true, patent: false, copyleft: false,
    osi: false, fsf: true,
    summary: 'Creative Commons Zero. Maximum freedom — no restrictions.',
  },

  // ──────────────────────────────────────────
  // WEAK COPYLEFT — Medium Risk
  // ──────────────────────────────────────────
  'LGPL-2.0-only': {
    type: 'weak-copyleft', risk: 'medium',
    commercial: true, patent: false, copyleft: true,
    osi: true, fsf: true,
    summary: 'LGPL v2 only. Dynamic linking is generally OK; static linking requires source release.',
  },
  'LGPL-2.0-or-later': {
    type: 'weak-copyleft', risk: 'medium',
    commercial: true, patent: false, copyleft: true,
    osi: true, fsf: true,
  },
  'LGPL-2.1-only': {
    type: 'weak-copyleft', risk: 'medium',
    commercial: true, patent: false, copyleft: true,
    osi: true, fsf: true,
    summary: 'Most common LGPL version. Dynamic linking OK for most use cases.',
  },
  'LGPL-2.1-or-later': {
    type: 'weak-copyleft', risk: 'medium',
    commercial: true, patent: false, copyleft: true,
    osi: true, fsf: true,
  },
  'LGPL-2.1': {
    type: 'weak-copyleft', risk: 'medium',
    commercial: true, patent: false, copyleft: true,
    osi: true, fsf: true,
    deprecated: true, replacedBy: 'LGPL-2.1-only or LGPL-2.1-or-later',
  },
  'LGPL-3.0-only': {
    type: 'weak-copyleft', risk: 'medium',
    commercial: true, patent: true, copyleft: true,
    osi: true, fsf: true,
  },
  'LGPL-3.0-or-later': {
    type: 'weak-copyleft', risk: 'medium',
    commercial: true, patent: true, copyleft: true,
    osi: true, fsf: true,
  },
  'MPL-2.0': {
    type: 'weak-copyleft', risk: 'medium',
    commercial: true, patent: true, copyleft: true,
    osi: true, fsf: true,
    summary: 'Mozilla Public License. File-level copyleft — modifications to MPL files must be open-sourced.',
  },
  'CDDL-1.0': {
    type: 'weak-copyleft', risk: 'medium',
    commercial: true, patent: true, copyleft: true,
    osi: true, fsf: true,
  },
  'EPL-1.0': {
    type: 'weak-copyleft', risk: 'medium',
    commercial: true, patent: true, copyleft: true,
    osi: true, fsf: true,
  },
  'EPL-2.0': {
    type: 'weak-copyleft', risk: 'medium',
    commercial: true, patent: true, copyleft: true,
    osi: true, fsf: true,
  },
  'EUPL-1.2': {
    type: 'weak-copyleft', risk: 'medium',
    commercial: true, patent: false, copyleft: true,
    osi: true, fsf: true,
  },

  // ──────────────────────────────────────────
  // STRONG COPYLEFT — High Risk for Commercial
  // ──────────────────────────────────────────
  'GPL-2.0-only': {
    type: 'copyleft', risk: 'high',
    commercial: false, patent: false, copyleft: true,
    osi: true, fsf: true,
    summary: 'GNU GPL v2. Any software linking to GPL v2 must also be GPL v2.',
  },
  'GPL-2.0-or-later': {
    type: 'copyleft', risk: 'high',
    commercial: false, patent: false, copyleft: true,
    osi: true, fsf: true,
  },
  'GPL-2.0': {
    type: 'copyleft', risk: 'high',
    commercial: false, patent: false, copyleft: true,
    osi: true, fsf: true,
    deprecated: true, replacedBy: 'GPL-2.0-only or GPL-2.0-or-later',
  },
  'GPL-3.0-only': {
    type: 'copyleft', risk: 'high',
    commercial: false, patent: true, copyleft: true,
    osi: true, fsf: true,
    summary: 'GNU GPL v3. Strict copyleft with patent protections.',
  },
  'GPL-3.0-or-later': {
    type: 'copyleft', risk: 'high',
    commercial: false, patent: true, copyleft: true,
    osi: true, fsf: true,
  },
  'GPL-3.0': {
    type: 'copyleft', risk: 'high',
    commercial: false, patent: true, copyleft: true,
    osi: true, fsf: true,
    deprecated: true, replacedBy: 'GPL-3.0-only or GPL-3.0-or-later',
  },

  // ──────────────────────────────────────────
  // CRITICAL COPYLEFT — Critical Risk
  // ──────────────────────────────────────────
  'AGPL-3.0-only': {
    type: 'copyleft', risk: 'critical',
    commercial: false, patent: true, copyleft: true,
    osi: true, fsf: true,
    summary: 'CRITICAL: Network use triggers copyleft. Any SaaS using AGPL must publish ALL source code.',
  },
  'AGPL-3.0-or-later': {
    type: 'copyleft', risk: 'critical',
    commercial: false, patent: true, copyleft: true,
    osi: true, fsf: true,
  },
  'AGPL-3.0': {
    type: 'copyleft', risk: 'critical',
    commercial: false, patent: true, copyleft: true,
    deprecated: true, replacedBy: 'AGPL-3.0-only or AGPL-3.0-or-later',
  },
  'SSPL-1.0': {
    type: 'copyleft', risk: 'critical',
    commercial: false, patent: false, copyleft: true,
    osi: false, fsf: false,
    summary: 'CRITICAL: Server Side Public License (MongoDB). Requires open-sourcing your ENTIRE infrastructure stack.',
  },
  'BUSL-1.1': {
    type: 'proprietary', risk: 'high',
    commercial: false, patent: false, copyleft: false,
    osi: false, fsf: false,
    summary: 'Business Source License. Commercial use prohibited for a time-limited period.',
  },

  // ──────────────────────────────────────────
  // PROPRIETARY / SPECIAL
  // ──────────────────────────────────────────
  'UNLICENSED': {
    type: 'proprietary', risk: 'critical',
    commercial: false, patent: false, copyleft: false,
    osi: false, fsf: false,
    summary: 'CRITICAL: No license = all rights reserved. You have no legal right to use this package.',
  },
  'UNKNOWN': {
    type: 'unknown', risk: 'high',
    commercial: false, patent: false, copyleft: false,
    osi: false, fsf: false,
    summary: 'License could not be determined. Treat as unknown risk.',
  },
  'SEE-LICENSE-IN-LICENSE': {
    type: 'unknown', risk: 'high',
    commercial: false, patent: false, copyleft: false,
  },
  'SEE-LICENSE-IN-README': {
    type: 'unknown', risk: 'high',
    commercial: false, patent: false, copyleft: false,
  },
};

// Create aliases for common non-standard identifiers
const ALIASES = {
  'Apache 2': 'Apache-2.0',
  'Apache License 2.0': 'Apache-2.0',
  'MIT License': 'MIT',
  'BSD': 'BSD-2-Clause',
  'GPL': 'GPL-3.0-only',
  'AGPL': 'AGPL-3.0-only',
  'LGPL': 'LGPL-2.1-only',
};

/**
 * Look up SPDX info, with alias support
 */
function getSpdxInfo(licenseId) {
  if (!licenseId) return SPDX_DATA.UNKNOWN;
  const direct = SPDX_DATA[licenseId];
  if (direct) return direct;
  const aliased = ALIASES[licenseId];
  if (aliased) return SPDX_DATA[aliased];
  return null;
}

module.exports = { SPDX_DATA, ALIASES, getSpdxInfo };
