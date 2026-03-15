// src/ecosystems/cargo.js
'use strict';

const fs = require('fs');
const path = require('path');
const BaseEcosystem = require('./base');
const logger = require('./logger');

class CargoEcosystem extends BaseEcosystem {
  get name() { return 'cargo'; }
  get manifestFiles() { return ['Cargo.lock', 'Cargo.toml']; }

  async findManifests() {
    const lock = path.join(this.dir, 'Cargo.lock');
    try {
      await fs.promises.access(lock, fs.constants.F_OK);
      return [lock];
    } catch {
      // continue
    }

    const toml = path.join(this.dir, 'Cargo.toml');
    try {
      await fs.promises.access(toml, fs.constants.F_OK);
      return [toml];
    } catch {
      return [];
    }
  }

  async parseManifest(manifestPath) {
    const content = await fs.promises.readFile(manifestPath, 'utf8');
    const packages = [];
    const filename = path.basename(manifestPath);

    if (filename === 'Cargo.lock') {
      packages.push(...this._parseCargoLock(content));
    } else {
      packages.push(...this._parseCargoToml(content));
    }

    return packages;
  }

  _parseCargoLock(content) {
    const packages = [];
    const lines = content.split('\n');
    let inPackage = false;
    let name = null;
    let version = null;

    const flushPackage = () => {
      if (name && version) {
        packages.push(this.normalizePackage({ name, version, ecosystem: 'cargo', direct: false }));
      }
      name = null;
      version = null;
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line === '[[package]]') {
        if (inPackage) flushPackage();
        inPackage = true;
        continue;
      }
      if (!inPackage || !line || line.startsWith('#')) continue;

      const keyValue = line.match(/^([A-Za-z0-9_\-.]+)\s*=\s*"([^"]+)"$/);
      if (!keyValue) continue;

      if (keyValue[1] === 'name') name = keyValue[2];
      if (keyValue[1] === 'version') version = keyValue[2];
    }

    if (inPackage) flushPackage();
    return packages;
  }

  _parseCargoToml(content) {
    const packages = [];
    const lines = content.split('\n');
    let inDependencies = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      if (line.startsWith('[')) {
        inDependencies = /^\[(dependencies|workspace\.dependencies|target\..+\.dependencies)\]$/.test(line);
        continue;
      }

      if (!inDependencies) continue;

      const simpleMatch = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"$/);
      if (simpleMatch) {
        packages.push(this.normalizePackage({
          name: simpleMatch[1],
          version: simpleMatch[2],
          ecosystem: 'cargo',
          direct: true,
        }));
        continue;
      }

      const inlineTableMatch = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*\{(.+)\}$/);
      if (inlineTableMatch) {
        const depAlias = inlineTableMatch[1];
        const depName = inlineTableMatch[2].match(/package\s*=\s*"([^"]+)"/)?.[1] || depAlias;
        const version = inlineTableMatch[2].match(/version\s*=\s*"([^"]+)"/)?.[1] || 'latest';
        packages.push(this.normalizePackage({
          name: depName,
          version,
          ecosystem: 'cargo',
          direct: true,
        }));
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
      logger.warn(`[cargo] Could not fetch ${name}: ${err.message}`);
      return this.normalizePackage({ name, version, ecosystem: 'cargo' });
    }
  }
}

module.exports = CargoEcosystem;
