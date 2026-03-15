// src/ecosystems/rubygems.js
'use strict';

const fs = require('fs');
const path = require('path');
const BaseEcosystem = require('./base');

class RubyGemsEcosystem extends BaseEcosystem {
  get name() { return 'rubygems'; }
  get manifestFiles() { return ['Gemfile.lock', 'Gemfile']; }

  async findManifests() {
    const lock = path.join(this.dir, 'Gemfile.lock');
    if (fs.existsSync(lock)) return [lock];
    const gem = path.join(this.dir, 'Gemfile');
    if (fs.existsSync(gem)) return [gem];
    return [];
  }

  async parseManifest(manifestPath) {
    const content = fs.readFileSync(manifestPath, 'utf8');
    const packages = [];
    const filename = path.basename(manifestPath);

    if (filename === 'Gemfile.lock') {
      // Parse the GEM section of Gemfile.lock
      const gemSection = content.match(/GEM\s+remote:[^\n]+\s+specs:([\s\S]*?)(?=\n\n|\nBUNDLED|$)/)?.[1] || '';
      for (const line of gemSection.split('\n')) {
        const match = line.match(/^\s{4}([a-zA-Z0-9_-]+)\s+\(([^)]+)\)/);
        if (match) {
          packages.push(this.normalizePackage({ name: match[1], version: match[2], ecosystem: 'rubygems' }));
        }
      }
    } else {
      // Parse Gemfile
      for (const line of content.split('\n')) {
        const match = line.match(/^\s*gem\s+['"]([^'"]+)['"]/);
        if (match) {
          packages.push(this.normalizePackage({ name: match[1], version: 'latest', ecosystem: 'rubygems', direct: true }));
        }
      }
    }
    return packages;
  }

  async fetchPackageInfo(name, version) {
    try {
      const url = version && version !== 'latest'
        ? `https://rubygems.org/api/v2/rubygems/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}.json`
        : `https://rubygems.org/api/v1/gems/${encodeURIComponent(name)}.json`;
      const data = await this.fetchJson(url);
      return this.normalizePackage({
        name: data.name,
        version: data.version,
        license: (data.licenses || [])[0] || null,
        description: data.info,
        homepage: data.homepage_uri || data.project_uri,
        ecosystem: 'rubygems',
      });
    } catch {
      return this.normalizePackage({ name, version, ecosystem: 'rubygems' });
    }
  }
}

module.exports = RubyGemsEcosystem;
