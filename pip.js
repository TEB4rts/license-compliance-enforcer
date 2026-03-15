// src/ecosystems/pip.js
'use strict';

const fs = require('fs');
const path = require('path');
const BaseEcosystem = require('./base');

class PipEcosystem extends BaseEcosystem {
  get name() { return 'pip'; }
  get manifestFiles() { return ['requirements.txt', 'Pipfile', 'pyproject.toml', 'setup.py']; }

  async findManifests() {
    const found = [];
    for (const file of this.manifestFiles) {
      const full = path.join(this.dir, file);
      if (fs.existsSync(full)) found.push(full);
    }
    return found.slice(0, 1); // use first found
  }

  async parseManifest(manifestPath) {
    const filename = path.basename(manifestPath);
    const content = fs.readFileSync(manifestPath, 'utf8');
    const packages = [];

    if (filename === 'requirements.txt') {
      for (const line of content.split('\n')) {
        const clean = line.trim().split('#')[0].trim();
        if (!clean || clean.startsWith('-')) continue;
        const match = clean.match(/^([A-Za-z0-9_.-]+)\s*([=<>!~].+)?/);
        if (match) {
          const name = match[1];
          const version = (match[2] || '').replace(/^==/, '').trim() || 'latest';
          packages.push(this.normalizePackage({ name, version, ecosystem: 'pip', direct: true }));
        }
      }
    } else if (filename === 'pyproject.toml') {
      const depMatches = content.matchAll(/^\s*"([A-Za-z0-9_.-]+)\s*([^"]*)"[,\s]/gm);
      for (const m of depMatches) {
        const name = m[1];
        const version = (m[2] || '').replace(/^[^0-9]*/, '').trim() || 'latest';
        packages.push(this.normalizePackage({ name, version, ecosystem: 'pip', direct: true }));
      }
    }

    return packages;
  }

  async fetchPackageInfo(name, version) {
    const url = `https://pypi.org/pypi/${encodeURIComponent(name)}/${version === 'latest' ? '' : encodeURIComponent(version) + '/'}json`;
    try {
      const data = await this.fetchJson(url);
      const info = data.info;
      return this.normalizePackage({
        name: info.name,
        version: info.version,
        license: info.license || this._extractLicenseFromClassifiers(info.classifiers),
        description: info.summary,
        homepage: info.home_page || info.project_url,
        author: info.author,
        ecosystem: 'pip',
        downloadUrl: `https://pypi.org/pypi/${info.name}/${info.version}/json`,
      });
    } catch (err) {
      if (this.verbose) console.error(`[pip] Could not fetch ${name}: ${err.message}`);
      return this.normalizePackage({ name, version, ecosystem: 'pip' });
    }
  }

  _extractLicenseFromClassifiers(classifiers = []) {
    for (const c of classifiers) {
      if (c.startsWith('License ::')) {
        const parts = c.split(' :: ');
        return parts[parts.length - 1];
      }
    }
    return null;
  }
}

module.exports = PipEcosystem;
