// src/ecosystems/cargo.js
'use strict';

const fs = require('fs');
const path = require('path');
const BaseEcosystem = require('./base');

class CargoEcosystem extends BaseEcosystem {
  get name() { return 'cargo'; }
  get manifestFiles() { return ['Cargo.lock', 'Cargo.toml']; }

  async findManifests() {
    const lock = path.join(this.dir, 'Cargo.lock');
    if (fs.existsSync(lock)) return [lock];
    const toml = path.join(this.dir, 'Cargo.toml');
    if (fs.existsSync(toml)) return [toml];
    return [];
  }

  async parseManifest(manifestPath) {
    const content = fs.readFileSync(manifestPath, 'utf8');
    const packages = [];
    const filename = path.basename(manifestPath);

    if (filename === 'Cargo.lock') {
      // Parse TOML-like Cargo.lock format
      const blocks = content.split('\n[[package]]').slice(1);
      for (const block of blocks) {
        const name = block.match(/\nname\s*=\s*"([^"]+)"/)?.[1];
        const version = block.match(/\nversion\s*=\s*"([^"]+)"/)?.[1];
        if (name && version) {
          packages.push(this.normalizePackage({ name, version, ecosystem: 'cargo', direct: false }));
        }
      }
    } else {
      // Parse Cargo.toml for direct dependencies
      const depsSection = content.match(/\[dependencies\]([\s\S]*?)(?=\[|$)/)?.[1] || '';
      for (const line of depsSection.split('\n')) {
        const match = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/);
        if (match) {
          packages.push(this.normalizePackage({ name: match[1], version: match[2], ecosystem: 'cargo', direct: true }));
        }
      }
    }
    return packages;
  }

  async fetchPackageInfo(name, version) {
    try {
      const url = `https://crates.io/api/v1/crates/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
      const data = await this.fetchJson(url, { headers: { 'Accept': 'application/json' } });
      const v = data.version || {};
      const krate = data.crate || {};
      return this.normalizePackage({
        name,
        version: v.num || version,
        license: v.license,
        description: krate.description,
        repositoryUrl: krate.repository,
        homepage: krate.homepage,
        ecosystem: 'cargo',
      });
    } catch (err) {
      if (this.verbose) console.error(`[cargo] Could not fetch ${name}: ${err.message}`);
      return this.normalizePackage({ name, version, ecosystem: 'cargo' });
    }
  }
}

module.exports = CargoEcosystem;
