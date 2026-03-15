// src/ecosystems/composer.js
'use strict';

const fs = require('fs');
const path = require('path');
const BaseEcosystem = require('./base');

class ComposerEcosystem extends BaseEcosystem {
  get name() { return 'composer'; }
  get manifestFiles() { return ['composer.lock', 'composer.json']; }

  async findManifests() {
    const lock = path.join(this.dir, 'composer.lock');
    if (fs.existsSync(lock)) return [lock];
    const json = path.join(this.dir, 'composer.json');
    if (fs.existsSync(json)) return [json];
    return [];
  }

  async parseManifest(manifestPath) {
    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const packages = [];
    const filename = path.basename(manifestPath);

    if (filename === 'composer.lock') {
      for (const pkg of [...(content.packages || []), ...(content['packages-dev'] || [])]) {
        const isDev = (content['packages-dev'] || []).includes(pkg);
        packages.push(this.normalizePackage({
          name: pkg.name,
          version: pkg.version?.replace(/^v/, '') || 'unknown',
          license: (pkg.license || [])[0] || null,
          description: pkg.description,
          homepage: pkg.homepage,
          ecosystem: 'composer',
          isDev,
        }));
      }
    } else {
      const allDeps = { ...(content.require || {}), ...(content['require-dev'] || {}) };
      const devDeps = new Set(Object.keys(content['require-dev'] || {}));
      for (const [name, version] of Object.entries(allDeps)) {
        if (name === 'php' || name.startsWith('ext-')) continue;
        packages.push(this.normalizePackage({
          name, version: version.replace(/[^0-9.]/g, '') || version,
          ecosystem: 'composer', direct: true, isDev: devDeps.has(name),
        }));
      }
    }
    return packages;
  }

  async fetchPackageInfo(name, version) {
    try {
      const url = `https://packagist.org/packages/${name}.json`;
      const data = await this.fetchJson(url);
      const versions = data.package?.versions || {};
      const versionKey = Object.keys(versions).find(v => v.includes(version)) || Object.keys(versions)[0];
      const info = versions[versionKey] || {};
      return this.normalizePackage({
        name,
        version: info.version || version,
        license: (info.license || [])[0] || null,
        description: info.description,
        homepage: info.homepage,
        ecosystem: 'composer',
      });
    } catch {
      return this.normalizePackage({ name, version, ecosystem: 'composer' });
    }
  }
}

module.exports = ComposerEcosystem;
