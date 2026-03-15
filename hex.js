// src/ecosystems/hex.js
'use strict';

const fs = require('fs');
const path = require('path');
const BaseEcosystem = require('./base');

class HexEcosystem extends BaseEcosystem {
  get name() { return 'hex'; }
  get manifestFiles() { return ['mix.lock', 'mix.exs']; }

  async findManifests() {
    const lock = path.join(this.dir, 'mix.lock');
    if (fs.existsSync(lock)) return [lock];
    const exs = path.join(this.dir, 'mix.exs');
    if (fs.existsSync(exs)) return [exs];
    return [];
  }

  async parseManifest(manifestPath) {
    const content = fs.readFileSync(manifestPath, 'utf8');
    const packages = [];

    // Parse mix.lock: {:package_name, "registry", "hash", version, ...}
    const matches = [...content.matchAll(/^\s*"([^"]+)":\s*\{:hex,\s*:([^,]+),\s*"([^"]+)"/gm)];
    for (const m of matches) {
      packages.push(this.normalizePackage({ name: m[2] || m[1], version: m[3], ecosystem: 'hex' }));
    }

    if (packages.length === 0) {
      // Parse mix.exs deps
      const depMatches = [...content.matchAll(/\{:([a-z_]+),\s*"~>\s*([^"]+)"/g)];
      for (const m of depMatches) {
        packages.push(this.normalizePackage({ name: m[1], version: m[2], ecosystem: 'hex', direct: true }));
      }
    }

    return packages;
  }

  async fetchPackageInfo(name, version) {
    try {
      const url = `https://hex.pm/api/packages/${encodeURIComponent(name)}`;
      const data = await this.fetchJson(url);
      const release = data.releases?.find(r => r.version === version) || data.releases?.[0] || {};
      return this.normalizePackage({
        name,
        version: release.version || version,
        license: (data.meta?.licenses || [])[0] || null,
        description: data.meta?.description,
        homepage: data.html_url,
        ecosystem: 'hex',
      });
    } catch {
      return this.normalizePackage({ name, version, ecosystem: 'hex' });
    }
  }
}

module.exports = HexEcosystem;
