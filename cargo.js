// src/ecosystems/cargo.js
'use strict';

const path = require('path');
const BaseEcosystem = require('./base');

class CargoEcosystem extends BaseEcosystem {
  get name() { return 'cargo'; }
  get manifestFiles() { return ['Cargo.lock', 'Cargo.toml']; }

  async findManifests() {
    const lock = path.join(this.dir, 'Cargo.lock');
    if (await this.pathExists(lock)) return [lock];
    const toml = path.join(this.dir, 'Cargo.toml');
    if (await this.pathExists(toml)) return [toml];
    return [];
  }

  async parseManifest(manifestPath) {
    const content = await this.readTextFile(manifestPath);
    const filename = path.basename(manifestPath);

    if (filename === 'Cargo.lock') {
      return this._parseCargoLock(content);
    }

    return this._parseCargoToml(content);
  }

  _parseCargoLock(content) {
    const packages = [];
    const blockRegex = /\[\[package\]\]([\s\S]*?)(?=\n\[\[package\]\]|$)/g;

    for (const match of content.matchAll(blockRegex)) {
      const block = match[1];
      const name = block.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
      const version = block.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
      if (name && version) {
        packages.push(this.normalizePackage({ name, version, ecosystem: 'cargo', direct: false }));
      }
    }

    return packages;
  }

  _parseCargoToml(content) {
    const packages = [];
    const depsSections = [
      { name: 'dependencies', isDev: false },
      { name: 'dev-dependencies', isDev: true },
      { name: 'build-dependencies', isDev: true },
    ];

    for (const section of depsSections) {
      const block = this._extractSection(content, section.name);
      for (const line of block.split('\n')) {
        const clean = line.trim().split('#')[0].trim();
        if (!clean || !clean.includes('=')) continue;

        const eqIndex = clean.indexOf('=');
        const rawName = clean.slice(0, eqIndex).trim();
        const rawSpec = clean.slice(eqIndex + 1).trim();
        const name = rawName.replace(/["']/g, '');
        const inlineVersion = rawSpec.match(/version\s*=\s*["']([^"']+)["']/)?.[1];
        const quoteVersion = rawSpec.match(/^["']([^"']+)["']$/)?.[1];
        const version = (inlineVersion || quoteVersion || 'latest').replace(/^[^0-9]*/, '');

        if (name) {
          packages.push(this.normalizePackage({
            name,
            version,
            ecosystem: 'cargo',
            direct: true,
            isDev: section.isDev,
          }));
        }
      }
    }

    return packages;
  }

  _extractSection(content, sectionName) {
    const lines = content.split('\n');
    const start = lines.findIndex((line) => line.trim() === `[${sectionName}]`);
    if (start === -1) return '';

    const collected = [];
    for (let i = start + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('[')) break;
      collected.push(line);
    }

    return collected.join('\n');
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
      this.warn(`Could not fetch ${name}@${version}: ${err.message}`);
      return this.normalizePackage({ name, version, ecosystem: 'cargo' });
    }
  }
}

module.exports = CargoEcosystem;
