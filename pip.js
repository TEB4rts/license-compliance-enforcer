// src/ecosystems/pip.js
'use strict';

const path = require('path');
const BaseEcosystem = require('./base');

class PipEcosystem extends BaseEcosystem {
  get name() { return 'pip'; }
  get manifestFiles() { return ['requirements.txt', 'Pipfile', 'pyproject.toml', 'setup.py']; }

  async findManifests() {
    const found = [];
    for (const file of this.manifestFiles) {
      const full = path.join(this.dir, file);
      if (await this.pathExists(full)) found.push(full);
    }
    return found.slice(0, 1); // use first found
  }

  async parseManifest(manifestPath) {
    const filename = path.basename(manifestPath);
    const content = await this.readTextFile(manifestPath);

    if (filename === 'requirements.txt') {
      return this._parseRequirements(content);
    }

    if (filename === 'Pipfile') {
      return this._parsePipfile(content);
    }

    if (filename === 'pyproject.toml') {
      return this._parsePyProject(content);
    }

    return [];
  }

  _parseRequirements(content) {
    const packages = [];

    for (const line of content.split('\n')) {
      const clean = line.trim().split('#')[0].trim();
      if (!clean || clean.startsWith('-')) continue;

      // Support extras + markers: requests[socks]>=2.0 ; python_version > '3.8'
      const markerSplit = clean.split(';')[0].trim();
      const reqMatch = markerSplit.match(/^([A-Za-z0-9_.-]+(?:\[[^\]]+\])?)\s*(?:===|==|~=|!=|>=|<=|>|<)?\s*(.*)$/);
      if (!reqMatch) continue;

      const name = reqMatch[1].replace(/\[.*\]$/, '').trim();
      const version = (reqMatch[2] || '').trim() || 'latest';
      if (!name) continue;

      packages.push(this.normalizePackage({ name, version, ecosystem: 'pip', direct: true }));
    }

    return packages;
  }

  _parsePipfile(content) {
    const packages = [];
    const sections = ['packages', 'dev-packages'];

    for (const section of sections) {
      const block = content.match(new RegExp(`\\[${section}\\]([\\s\\S]*?)(?=\\n\\[|$)`, 'm'))?.[1] || '';
      for (const line of block.split('\n')) {
        const clean = line.trim().split('#')[0].trim();
        if (!clean || !clean.includes('=')) continue;
        const [rawName, rawVersion] = clean.split('=', 2).map((s) => s.trim());
        const name = rawName.replace(/["']/g, '');
        const version = rawVersion.replace(/["']/g, '').replace(/^==/, '') || 'latest';
        if (!name) continue;

        packages.push(this.normalizePackage({
          name,
          version,
          ecosystem: 'pip',
          direct: true,
          isDev: section === 'dev-packages',
        }));
      }
    }

    return packages;
  }

  _parsePyProject(content) {
    const packages = [];

    const depBlock = content.match(/\[project\][\s\S]*?dependencies\s*=\s*\[([\s\S]*?)\]/m)?.[1] || '';
    const poetryBlock = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?=\n\[|$)/m)?.[1] || '';

    for (const entry of depBlock.split('\n')) {
      const parsed = entry.replace(/["',]/g, '').trim();
      if (!parsed) continue;
      const reqMatch = parsed.match(/^([A-Za-z0-9_.-]+(?:\[[^\]]+\])?)\s*(?:===|==|~=|!=|>=|<=|>|<)?\s*(.*)$/);
      if (!reqMatch) continue;
      const name = reqMatch[1].replace(/\[.*\]$/, '').trim();
      const version = (reqMatch[2] || '').trim() || 'latest';
      if (!name || name === 'python') continue;
      packages.push(this.normalizePackage({ name, version, ecosystem: 'pip', direct: true }));
    }

    for (const line of poetryBlock.split('\n')) {
      const clean = line.trim().split('#')[0].trim();
      if (!clean || !clean.includes('=')) continue;
      const [rawName, rawValue] = clean.split('=', 2).map((v) => v.trim());
      const name = rawName.replace(/["']/g, '');
      if (!name || name === 'python') continue;
      const versionMatch = rawValue.match(/["']([^"']+)["']/);
      const version = versionMatch ? versionMatch[1].replace(/^\^/, '') : 'latest';
      packages.push(this.normalizePackage({ name, version, ecosystem: 'pip', direct: true }));
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
      this.warn(`Could not fetch ${name}@${version}: ${err.message}`);
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
