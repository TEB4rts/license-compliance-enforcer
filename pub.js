// src/ecosystems/pub.js
'use strict';

const fs = require('fs');
const path = require('path');
const BaseEcosystem = require('./base');

class PubEcosystem extends BaseEcosystem {
  get name() { return 'pub'; }
  get manifestFiles() { return ['pubspec.lock', 'pubspec.yaml']; }

  async findManifests() {
    const lock = path.join(this.dir, 'pubspec.lock');
    if (fs.existsSync(lock)) return [lock];
    const yaml = path.join(this.dir, 'pubspec.yaml');
    if (fs.existsSync(yaml)) return [yaml];
    return [];
  }

  async parseManifest(manifestPath) {
    const content = fs.readFileSync(manifestPath, 'utf8');
    const packages = [];
    const filename = path.basename(manifestPath);

    if (filename === 'pubspec.lock') {
      // Parse YAML-like pubspec.lock
      const pkgBlocks = content.split('\n  ').slice(1);
      let currentName = null;
      let currentVersion = null;

      for (const line of content.split('\n')) {
        const nameMatch = line.match(/^  ([a-zA-Z0-9_]+):$/);
        const versionMatch = line.match(/^\s+version:\s+"?([^"\n]+)"?/);

        if (nameMatch) {
          if (currentName && currentVersion) {
            packages.push(this.normalizePackage({ name: currentName, version: currentVersion, ecosystem: 'pub' }));
          }
          currentName = nameMatch[1];
          currentVersion = null;
        } else if (versionMatch && currentName) {
          currentVersion = versionMatch[1].trim();
        }
      }
      if (currentName && currentVersion) {
        packages.push(this.normalizePackage({ name: currentName, version: currentVersion, ecosystem: 'pub' }));
      }
    } else {
      // Parse pubspec.yaml
      const depsSection = content.match(/^dependencies:\s*\n([\s\S]*?)(?=^\w|$)/m)?.[1] || '';
      for (const line of depsSection.split('\n')) {
        const match = line.match(/^\s+([a-zA-Z0-9_]+):\s*[^#\n]*\^?([0-9][^\s#]*)?/);
        if (match && match[1] !== 'flutter' && match[1] !== 'sdk') {
          packages.push(this.normalizePackage({ name: match[1], version: match[2] || 'latest', ecosystem: 'pub', direct: true }));
        }
      }
    }

    return packages;
  }

  async fetchPackageInfo(name, version) {
    try {
      const url = `https://pub.dev/api/packages/${encodeURIComponent(name)}`;
      const data = await this.fetchJson(url);
      const latest = data.latest?.pubspec || {};
      return this.normalizePackage({
        name,
        version: data.latest?.version || version,
        license: latest.license || null,
        description: latest.description,
        homepage: latest.homepage,
        ecosystem: 'pub',
      });
    } catch {
      return this.normalizePackage({ name, version, ecosystem: 'pub' });
    }
  }
}

module.exports = PubEcosystem;
