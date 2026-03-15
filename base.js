// src/ecosystems/base.js
'use strict';

const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

/**
 * BaseEcosystem - shared logic for all ecosystem parsers
 * All ecosystem classes extend this.
 */
class BaseEcosystem {
  constructor(options = {}) {
    this.dir = options.dir || process.cwd();
    this.verbose = options.verbose || false;
    this._httpCache = new Map();
  }

  get name() { throw new Error('Ecosystem must define a name'); }
  get manifestFiles() { throw new Error('Ecosystem must define manifestFiles'); }

  /**
   * Find all relevant manifest files in the project directory
   */
  async findManifests() {
    const checks = await Promise.all(this.manifestFiles.map(async (filename) => {
      const fullPath = path.join(this.dir, filename);
      try {
        await fs.promises.access(fullPath, fs.constants.F_OK);
        return fullPath;
      } catch {
        return null;
      }
    }));

    // Preserve manifestFiles ordering while still checking in parallel.
    return checks.filter(Boolean);
  }

  /**
   * Parse a manifest and return NormalizedPackage[]
   * Must be implemented by each ecosystem subclass
   */
  async parseManifest(manifestPath) {
    throw new Error(`${this.name}.parseManifest() not implemented`);
  }

  /**
   * Fetch detailed package info from the registry
   * Must be implemented by each ecosystem subclass
   */
  async fetchPackageInfo(name, version) {
    throw new Error(`${this.name}.fetchPackageInfo() not implemented`);
  }

  /**
   * Shared HTTP GET with caching
   */
  async httpGet(url, options = {}) {
    if (this._httpCache.has(url)) {
      return this._httpCache.get(url);
    }

    const text = await new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.get(url, {
        headers: {
          'User-Agent': 'license-compliance-enforcer/2.0.0 (https://github.com/your-org/license-compliance-enforcer)',
          'Accept': 'application/json',
          ...options.headers,
        },
        timeout: 15000,
      }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return this.httpGet(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout: ${url}`));
      });
    });

    this._httpCache.set(url, text);
    return text;
  }

  /**
   * Fetch JSON from URL
   */
  async fetchJson(url, options = {}) {
    const text = await this.httpGet(url, options);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON from ${url}`);
    }
  }

  /**
   * Create a normalized package object
   */
  normalizePackage(data) {
    return {
      name: data.name,
      version: data.version || 'unknown',
      license: data.license || null,
      licenseText: data.licenseText || null,
      description: data.description || null,
      ecosystem: this.name,
      direct: data.direct !== false,
      isDev: data.isDev || false,
      dependencyPath: data.dependencyPath || null,
      repositoryUrl: data.repositoryUrl || null,
      homepage: data.homepage || null,
      author: data.author || null,
      downloadUrl: data.downloadUrl || null,
      dependencies: data.dependencies || [],
    };
  }
}

module.exports = BaseEcosystem;
