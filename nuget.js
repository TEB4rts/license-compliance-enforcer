// src/ecosystems/nuget.js
'use strict';

const fs = require('fs');
const path = require('path');
const BaseEcosystem = require('./base');

class NuGetEcosystem extends BaseEcosystem {
  get name() { return 'nuget'; }
  get manifestFiles() { return ['packages.config']; }

  async findManifests() {
    // Find all .csproj files and packages.config
    const found = [];
    try {
      const files = fs.readdirSync(this.dir);
      for (const file of files) {
        if (file.endsWith('.csproj') || file === 'packages.config') {
          found.push(path.join(this.dir, file));
        }
      }
    } catch { /* ignore */ }
    return found.slice(0, 1);
  }

  async parseManifest(manifestPath) {
    const content = fs.readFileSync(manifestPath, 'utf8');
    const packages = [];
    const filename = path.basename(manifestPath);

    if (filename === 'packages.config') {
      const matches = [...content.matchAll(/<package\s+id="([^"]+)"\s+version="([^"]+)"/g)];
      for (const m of matches) {
        packages.push(this.normalizePackage({ name: m[1], version: m[2], ecosystem: 'nuget', direct: true }));
      }
    } else if (filename.endsWith('.csproj')) {
      // Parse PackageReference elements
      const refs = [...content.matchAll(/<PackageReference\s+Include="([^"]+)"\s+Version="([^"]+)"/gi)];
      for (const r of refs) {
        packages.push(this.normalizePackage({ name: r[1], version: r[2], ecosystem: 'nuget', direct: true }));
      }
    }
    return packages;
  }

  async fetchPackageInfo(name, version) {
    try {
      const url = `https://api.nuget.org/v3/registration5-semver1/${name.toLowerCase()}/index.json`;
      const data = await this.fetchJson(url);
      const entry = data.items?.[0]?.items?.[0]?.catalogEntry || {};
      return this.normalizePackage({
        name,
        version: entry.version || version,
        license: entry.licenseExpression || null,
        description: entry.description,
        homepage: entry.projectUrl,
        ecosystem: 'nuget',
      });
    } catch {
      return this.normalizePackage({ name, version, ecosystem: 'nuget' });
    }
  }
}

module.exports = NuGetEcosystem;
