// src/core/scanner.js
'use strict';

const path = require('path');
const fs = require('fs');
const Resolver = require('./resolver');
const EcosystemRegistry = require('../ecosystems/index');
const LicenseFingerprinter = require('../licenses/fingerprinter');
const { SPDX_DATA } = require('../licenses/spdx-data');

/**
 * Main scanner orchestrator.
 * Detects ecosystems, parses manifests, builds the dependency graph,
 * fetches license data, and returns normalized package objects.
 */
class Scanner {
  constructor(options = {}) {
    this.dir = options.dir || process.cwd();
    this.ecosystems = options.ecosystems || ['auto'];
    this.scanTransitive = options.scanTransitive !== false;
    this.depth = options.depth || Infinity;
    this.cache = options.cache !== false;
    this.verbose = options.verbose || false;
    this.policy = options.policy || {};
    this.maxConcurrentRequests = options.maxConcurrentRequests || 5;
    this.fingerprinter = new LicenseFingerprinter();
    this._licenseCache = new Map();
  }

  /**
   * Run the full scan pipeline
   * @returns {Promise<{packages: NormalizedPackage[], meta: ScanMeta}>}
   */
  async scan() {
    const startTime = Date.now();

    // 1. Detect which ecosystems are present
    const activeEcosystems = await this._detectEcosystems();
    if (this.verbose) {
      console.error(`[scanner] Detected ecosystems: ${activeEcosystems.join(', ')}`);
    }

    // 2. For each ecosystem, parse manifests and build dep graph
    const allPackages = [];
    const meta = {
      dir: this.dir,
      ecosystems: activeEcosystems,
      scanTransitive: this.scanTransitive,
      depth: this.depth,
      startTime: new Date().toISOString(),
    };

    for (const eco of activeEcosystems) {
      const EcosystemClass = EcosystemRegistry.get(eco);
      if (!EcosystemClass) {
        console.error(`[scanner] Unknown ecosystem: ${eco}`);
        continue;
      }

      const ecosystem = new EcosystemClass({ dir: this.dir, verbose: this.verbose });
      const manifests = await ecosystem.findManifests();

      if (manifests.length === 0) continue;

      for (const manifest of manifests) {
        if (this.verbose) {
          console.error(`[scanner] Parsing ${manifest}`);
        }

        const resolver = new Resolver(ecosystem, {
          scanTransitive: this.scanTransitive,
          depth: this.depth,
          verbose: this.verbose,
          maxConcurrentRequests: this.maxConcurrentRequests,
        });

        const packages = await resolver.resolve(manifest);
        allPackages.push(...packages);
      }
    }

    // 3. Deduplicate
    const deduplicated = this._deduplicate(allPackages);

    // 4. Enrich with license data
    const enriched = await this._enrichWithLicenses(deduplicated);

    meta.endTime = new Date().toISOString();
    meta.durationMs = Date.now() - startTime;
    meta.totalPackages = enriched.length;

    return { packages: enriched, meta };
  }

  /**
   * Auto-detect which package ecosystems are present in the directory
   */
  async _detectEcosystems() {
    if (!this.ecosystems.includes('auto')) {
      return this.ecosystems;
    }

    const detected = [];
    const ECOSYSTEM_INDICATORS = {
      npm: ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
      pip: ['requirements.txt', 'Pipfile', 'pyproject.toml', 'setup.py', 'setup.cfg'],
      cargo: ['Cargo.toml', 'Cargo.lock'],
      go: ['go.mod', 'go.sum'],
      maven: ['pom.xml'],
      rubygems: ['Gemfile', 'Gemfile.lock', '.gemspec'],
      composer: ['composer.json', 'composer.lock'],
      nuget: ['*.csproj', 'packages.config', '*.nuspec'],
      hex: ['mix.exs', 'mix.lock'],
      pub: ['pubspec.yaml', 'pubspec.lock'],
    };

    let files = [];
    try {
      files = await fs.promises.readdir(this.dir);
    } catch {
      files = [];
    }

    for (const [eco, indicators] of Object.entries(ECOSYSTEM_INDICATORS)) {
      for (const indicator of indicators) {
        if (indicator.includes('*')) {
          const ext = indicator.replace('*', '');
          if (files.some((f) => f.endsWith(ext))) {
            detected.push(eco);
            break;
          }
          continue;
        }

        const fullPath = path.join(this.dir, indicator);
        try {
          await fs.promises.access(fullPath, fs.constants.F_OK);
          detected.push(eco);
          break;
        } catch {
          // File not present.
        }
      }
    }

    return detected.length > 0 ? detected : ['npm']; // fallback
  }

  /**
   * Deduplicate packages by ecosystem:name@version key
   */
  _deduplicate(packages) {
    const seen = new Map();
    for (const pkg of packages) {
      const key = `${pkg.ecosystem}:${pkg.name}@${pkg.version}`;
      if (!seen.has(key)) {
        seen.set(key, pkg);
      } else {
        // Merge dependency paths if same package found via multiple routes
        const existing = seen.get(key);
        if (pkg.dependencyPath && !existing.dependencyPaths) {
          existing.dependencyPaths = [existing.dependencyPath, pkg.dependencyPath];
        } else if (pkg.dependencyPath && existing.dependencyPaths) {
          existing.dependencyPaths.push(pkg.dependencyPath);
        }
      }
    }
    return Array.from(seen.values());
  }

  /**
   * Enrich packages with full license data, SPDX info, and fingerprint results
   */
  async _enrichWithLicenses(packages) {
    const enriched = [];

    for (const pkg of packages) {
      const normalized = await this._normalizeLicense(pkg);
      enriched.push(normalized);
    }

    return enriched;
  }

  async _normalizeLicense(pkg) {
    let license = pkg.license;

    // Already cached from a previous run?
    const cacheKey = `${pkg.ecosystem}:${pkg.name}`;
    if (this._licenseCache.has(cacheKey)) {
      license = this._licenseCache.get(cacheKey);
    }

    // Normalize common non-standard identifiers
    license = this._normalizeLicenseId(license);

    // Try to match unknown licenses by fingerprinting
    if (!license || license === 'UNKNOWN') {
      if (pkg.licenseText) {
        const matched = await this.fingerprinter.identify(pkg.licenseText);
        if (matched) {
          license = matched.spdxId;
          pkg.licenseMatchScore = matched.score;
          pkg.licenseMatchMethod = 'fingerprint';
        }
      }
    }

    // Add SPDX metadata
    const spdxInfo = SPDX_DATA[license] || null;

    const result = {
      ...pkg,
      license: license || 'UNKNOWN',
      spdxInfo,
      riskLevel: spdxInfo?.risk || 'unknown',
      commercial: spdxInfo?.commercial || false,
      patentGrant: spdxInfo?.patent || false,
      copyleft: spdxInfo?.copyleft || false,
      licenseType: spdxInfo?.type || 'unknown',
    };

    this._licenseCache.set(cacheKey, license);
    return result;
  }

  _normalizeLicenseId(license) {
    if (!license) return 'UNKNOWN';

    const ALIAS_MAP = {
      'Apache 2.0': 'Apache-2.0',
      'Apache-2': 'Apache-2.0',
      'Apache License 2.0': 'Apache-2.0',
      'Apache License, Version 2.0': 'Apache-2.0',
      'GPL-2': 'GPL-2.0-only',
      'GPL-3': 'GPL-3.0-only',
      'GNU GPL v3': 'GPL-3.0-only',
      'GNU GPLv3': 'GPL-3.0-only',
      'GNU GPLv2': 'GPL-2.0-only',
      'AGPLv3': 'AGPL-3.0-only',
      'LGPL-2': 'LGPL-2.0-only',
      'LGPL-3': 'LGPL-3.0-only',
      'BSD': 'BSD-2-Clause',
      '2-clause BSD': 'BSD-2-Clause',
      '3-clause BSD': 'BSD-3-Clause',
      'BSD-new': 'BSD-3-Clause',
      'New BSD': 'BSD-3-Clause',
      'PSF': 'PSF-2.0',
      'Python Software Foundation License': 'PSF-2.0',
      'CC0': 'CC0-1.0',
      'Public Domain': 'CC0-1.0',
      'Unlicense': 'Unlicense',
      'WTFPL': 'WTFPL',
      'UNLICENSED': 'UNLICENSED',
      '(MIT)': 'MIT',
      'MIT License': 'MIT',
      'MIT/X11': 'MIT',
    };

    // Direct alias match
    if (ALIAS_MAP[license]) return ALIAS_MAP[license];

    // Handle compound: "(MIT OR Apache-2.0)" → pick the permissive one
    if (license.startsWith('(') && license.includes(' OR ')) {
      const parts = license.replace(/[()]/g, '').split(' OR ').map(s => s.trim());
      // Prefer permissive licenses in OR expressions
      const permissive = parts.find(p => ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'].includes(p));
      if (permissive) return permissive;
      return parts[0];
    }

    // Handle "AND" expressions — use the most restrictive
    if (license.startsWith('(') && license.includes(' AND ')) {
      const parts = license.replace(/[()]/g, '').split(' AND ').map(s => s.trim());
      // Sort by risk level and pick the most restrictive
      return parts[0]; // simplified: just return first
    }

    return license;
  }
}

module.exports = Scanner;
