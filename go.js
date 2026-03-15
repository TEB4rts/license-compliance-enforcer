// src/ecosystems/go.js
'use strict';

const fs = require('fs');
const path = require('path');
const BaseEcosystem = require('./base');

class GoEcosystem extends BaseEcosystem {
  get name() { return 'go'; }
  get manifestFiles() { return ['go.mod', 'go.sum']; }

  async findManifests() {
    const mod = path.join(this.dir, 'go.mod');
    if (fs.existsSync(mod)) return [mod];
    return [];
  }

  async parseManifest(manifestPath) {
    const content = fs.readFileSync(manifestPath, 'utf8');
    const packages = [];

    // Parse require block(s)
    const requireBlocks = [...content.matchAll(/require\s*\(([\s\S]*?)\)/g)];
    for (const block of requireBlocks) {
      for (const line of block[1].split('\n')) {
        const clean = line.trim().split('//')[0].trim();
        if (!clean) continue;
        const parts = clean.split(/\s+/);
        if (parts.length >= 2) {
          packages.push(this.normalizePackage({
            name: parts[0],
            version: parts[1].replace(/^v/, ''),
            ecosystem: 'go',
            direct: true,
          }));
        }
      }
    }

    // Single-line requires
    for (const line of content.split('\n')) {
      const match = line.match(/^require\s+(\S+)\s+(v[\S]+)/);
      if (match) {
        packages.push(this.normalizePackage({
          name: match[1],
          version: match[2].replace(/^v/, ''),
          ecosystem: 'go',
          direct: true,
        }));
      }
    }

    return packages;
  }

  async fetchPackageInfo(name, version) {
    try {
      const url = `https://proxy.golang.org/${encodeURIComponent(name)}/@v/v${version}.info`;
      const data = await this.fetchJson(url);
      return this.normalizePackage({
        name,
        version: (data.Version || version).replace(/^v/, ''),
        ecosystem: 'go',
      });
    } catch {
      return this.normalizePackage({ name, version, ecosystem: 'go' });
    }
  }
}

module.exports = GoEcosystem;
