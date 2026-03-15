// src/ecosystems/pip.js
'use strict';

const fs = require('fs');
const path = require('path');
const BaseEcosystem = require('./base');
const logger = require('./logger');

class PipEcosystem extends BaseEcosystem {
  get name() { return 'pip'; }
  get manifestFiles() { return ['requirements.txt', 'Pipfile', 'pyproject.toml', 'setup.py']; }

  async findManifests() {
    const checks = await Promise.all(this.manifestFiles.map(async (file) => {
      const full = path.join(this.dir, file);
      try {
        await fs.promises.access(full, fs.constants.F_OK);
        return full;
      } catch {
        return null;
      }
    }));

    return checks.filter(Boolean).slice(0, 1); // use first found
  }

  async parseManifest(manifestPath) {
    const filename = path.basename(manifestPath);
    const content = await fs.promises.readFile(manifestPath, 'utf8');

    if (filename === 'requirements.txt') {
      return content
        .split('\n')
        .map((line) => this._parseRequirementLine(line))
        .filter(Boolean);
    }

    if (filename === 'pyproject.toml') {
      return this._parsePyprojectToml(content);
    }

    if (filename === 'Pipfile') {
      return this._parsePipfile(content);
    }

    return [];
  }

  _parseRequirementLine(line) {
    const clean = line.trim().split('#')[0].trim();
    if (!clean || clean.startsWith('-')) return null;

    // Ignore environment markers: requests>=2; python_version>="3.9"
    const withoutMarkers = clean.split(';')[0].trim();
    // Ignore extras in dependency key: requests[socks]>=2 -> requests>=2
    const withoutExtras = withoutMarkers.replace(/\[[^\]]+\]/g, '');

    const match = withoutExtras.match(/^([A-Za-z0-9_.-]+)\s*(.*)$/);
    if (!match) return null;

    const name = match[1];
    const specifier = (match[2] || '').trim();
    const exactMatch = specifier.match(/^==\s*([^,\s]+)$/)?.[1];
    const version = exactMatch || specifier || 'latest';

    return this.normalizePackage({ name, version, ecosystem: 'pip', direct: true });
  }

  _parsePyprojectToml(content) {
    const packages = [];

    const projectBlock = content.match(/\[project\]([\s\S]*?)(?=\n\[[^\]]+\]|$)/)?.[1] || '';
    const dependenciesArray = projectBlock.match(/dependencies\s*=\s*\[([\s\S]*?)\]/)?.[1] || '';
    for (const line of dependenciesArray.split('\n')) {
      const quoted = line.match(/"([^"]+)"/);
      if (!quoted) continue;
      const pkg = this._parseRequirementLine(quoted[1]);
      if (pkg) packages.push(pkg);
    }

    const poetryBlock = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?=\n\[[^\]]+\]|$)/)?.[1] || '';
    for (const rawLine of poetryBlock.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('python')) continue;

      const simple = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*"([^"]+)"$/);
      if (simple) {
        packages.push(this.normalizePackage({
          name: simple[1],
          version: simple[2],
          ecosystem: 'pip',
          direct: true,
        }));
        continue;
      }

      const inlineTable = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*\{(.+)\}$/);
      if (inlineTable) {
        const version = inlineTable[2].match(/version\s*=\s*"([^"]+)"/)?.[1] || 'latest';
        packages.push(this.normalizePackage({
          name: inlineTable[1],
          version,
          ecosystem: 'pip',
          direct: true,
        }));
      }
    }

    return packages;
  }

  _parsePipfile(content) {
    const packagesBlock = content.match(/\[packages\]([\s\S]*?)(?=\n\[[^\]]+\]|$)/)?.[1] || '';

    return packagesBlock
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const simple = line.match(/^"?([A-Za-z0-9_.-]+)"?\s*=\s*"([^"]+)"$/);
        if (simple) {
          return this.normalizePackage({
            name: simple[1],
            version: simple[2] === '*' ? 'latest' : simple[2],
            ecosystem: 'pip',
            direct: true,
          });
        }

        const inlineTable = line.match(/^"?([A-Za-z0-9_.-]+)"?\s*=\s*\{(.+)\}$/);
        if (!inlineTable) return null;

        const version = inlineTable[2].match(/version\s*=\s*"([^"]+)"/)?.[1] || 'latest';
        return this.normalizePackage({
          name: inlineTable[1],
          version,
          ecosystem: 'pip',
          direct: true,
        });
      })
      .filter(Boolean);
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
      logger.warn(`[pip] Could not fetch ${name}: ${err.message}`);
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
