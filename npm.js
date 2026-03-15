// src/ecosystems/npm.js
'use strict';

const fs = require('fs');
const path = require('path');
const BaseEcosystem = require('./base');

class NpmEcosystem extends BaseEcosystem {
  get name() { return 'npm'; }
  get manifestFiles() {
    return ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'package.json'];
  }

  async findManifests() {
    const dir = this.dir;
    // Prefer lockfiles for accurate version resolution
    for (const file of ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']) {
      const full = path.join(dir, file);
      if (fs.existsSync(full)) return [full];
    }
    // Fallback to package.json
    const pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pkg)) return [pkg];
    return [];
  }

  async parseManifest(manifestPath) {
    const ext = path.basename(manifestPath);

    if (ext === 'package-lock.json') {
      return this._parsePackageLock(manifestPath);
    } else if (ext === 'yarn.lock') {
      return this._parseYarnLock(manifestPath);
    } else if (ext === 'package.json') {
      return this._parsePackageJson(manifestPath);
    }
    return [];
  }

  async _parsePackageLock(lockPath) {
    const raw = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const packages = [];
    const pkgJson = this._readSiblingPackageJson(lockPath);
    const directDeps = new Set([
      ...Object.keys(pkgJson.dependencies || {}),
      ...Object.keys(pkgJson.devDependencies || {}),
    ]);
    const devDeps = new Set(Object.keys(pkgJson.devDependencies || {}));

    // package-lock v2/v3 use "packages" field
    const deps = raw.packages || {};
    for (const [pkgPath, info] of Object.entries(deps)) {
      if (pkgPath === '') continue; // skip root
      const name = pkgPath.replace(/^node_modules\//, '').replace(/node_modules\//g, '');
      if (!name || !info.version) continue;

      packages.push(this.normalizePackage({
        name,
        version: info.version,
        license: this._normalizeLicenseField(info.license),
        ecosystem: 'npm',
        direct: directDeps.has(name),
        isDev: devDeps.has(name),
        downloadUrl: info.resolved,
        repositoryUrl: info.repository?.url || null,
      }));
    }

    // v1 lockfiles use "dependencies" field
    if (packages.length === 0 && raw.dependencies) {
      return this._parseV1Deps(raw.dependencies, directDeps, devDeps);
    }

    return packages;
  }

  _parseV1Deps(deps, directDeps, devDeps, prefix = '') {
    const packages = [];
    for (const [name, info] of Object.entries(deps)) {
      packages.push(this.normalizePackage({
        name,
        version: info.version,
        license: this._normalizeLicenseField(info.license),
        ecosystem: 'npm',
        direct: directDeps.has(name),
        isDev: devDeps.has(name),
        downloadUrl: info.resolved,
      }));
      if (info.dependencies) {
        packages.push(...this._parseV1Deps(info.dependencies, directDeps, devDeps, name));
      }
    }
    return packages;
  }

  async _parseYarnLock(lockPath) {
    const content = fs.readFileSync(lockPath, 'utf8');
    const packages = [];
    const pkgJson = this._readSiblingPackageJson(lockPath);
    const directDeps = new Set([
      ...Object.keys(pkgJson.dependencies || {}),
      ...Object.keys(pkgJson.devDependencies || {}),
    ]);

    // Simple yarn.lock parser — handles v1 and berry formats
    const blocks = content.split('\n\n').filter(Boolean);
    for (const block of blocks) {
      const lines = block.split('\n').filter(Boolean);
      const headerLine = lines[0];
      if (!headerLine || headerLine.startsWith('#')) continue;

      const nameMatch = headerLine.match(/^"?(@?[^@"]+)@/);
      const versionMatch = block.match(/^\s+version[:\s]+"?([^"\n]+)"?/m);
      const resolvedMatch = block.match(/^\s+resolved\s+"([^"]+)"/m);

      if (nameMatch && versionMatch) {
        const name = nameMatch[1].trim();
        const version = versionMatch[1].trim();
        packages.push(this.normalizePackage({
          name,
          version,
          ecosystem: 'npm',
          direct: directDeps.has(name),
          downloadUrl: resolvedMatch ? resolvedMatch[1] : null,
        }));
      }
    }
    return packages;
  }

  async _parsePackageJson(pkgPath) {
    const raw = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const packages = [];
    const allDeps = {
      ...Object.fromEntries(Object.entries(raw.dependencies || {}).map(([k, v]) => [k, { version: v, isDev: false }])),
      ...Object.fromEntries(Object.entries(raw.devDependencies || {}).map(([k, v]) => [k, { version: v, isDev: true }])),
    };

    for (const [name, { version, isDev }] of Object.entries(allDeps)) {
      packages.push(this.normalizePackage({
        name,
        version: version.replace(/^[^~]/, '').replace(/[\^~>=<]/g, '') || version,
        ecosystem: 'npm',
        direct: true,
        isDev,
      }));
    }
    return packages;
  }

  async fetchPackageInfo(name, version) {
    const encodedName = name.startsWith('@') ? name.replace('/', '%2F') : name;
    const url = `https://registry.npmjs.org/${encodedName}/${version === 'latest' ? 'latest' : encodeURIComponent(version)}`;

    try {
      const data = await this.fetchJson(url);
      return this.normalizePackage({
        name: data.name,
        version: data.version,
        license: this._normalizeLicenseField(data.license),
        description: data.description,
        repositoryUrl: typeof data.repository === 'string' ? data.repository : data.repository?.url,
        homepage: data.homepage,
        author: typeof data.author === 'string' ? data.author : data.author?.name,
        dependencies: Object.entries(data.dependencies || {}).map(([n, v]) => ({ name: n, version: v, ecosystem: 'npm' })),
      });
    } catch (err) {
      if (this.verbose) console.error(`[npm] Could not fetch ${name}@${version}: ${err.message}`);
      return this.normalizePackage({ name, version, ecosystem: 'npm' });
    }
  }

  _normalizeLicenseField(license) {
    if (!license) return null;
    if (typeof license === 'string') return license;
    if (typeof license === 'object') {
      if (license.type) return license.type;
      if (license.name) return license.name;
    }
    if (Array.isArray(license)) {
      return license.map(l => typeof l === 'string' ? l : l.type || l.name).join(' OR ');
    }
    return String(license);
  }

  _readSiblingPackageJson(lockPath) {
    const pkgPath = path.join(path.dirname(lockPath), 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      } catch { /* ignore */ }
    }
    return {};
  }
}

module.exports = NpmEcosystem;
