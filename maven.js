// src/ecosystems/maven.js
'use strict';

const fs = require('fs');
const path = require('path');
const BaseEcosystem = require('./base');

class MavenEcosystem extends BaseEcosystem {
  get name() { return 'maven'; }
  get manifestFiles() { return ['pom.xml']; }

  async parseManifest(manifestPath) {
    const content = fs.readFileSync(manifestPath, 'utf8');
    const packages = [];
    const depMatches = [...content.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)];
    for (const match of depMatches) {
      const block = match[1];
      const groupId = block.match(/<groupId>([^<]+)<\/groupId>/)?.[1]?.trim();
      const artifactId = block.match(/<artifactId>([^<]+)<\/artifactId>/)?.[1]?.trim();
      const version = block.match(/<version>([^<]+)<\/version>/)?.[1]?.trim();
      const scope = block.match(/<scope>([^<]+)<\/scope>/)?.[1]?.trim();
      if (groupId && artifactId) {
        packages.push(this.normalizePackage({
          name: `${groupId}:${artifactId}`,
          version: version || 'unknown',
          ecosystem: 'maven',
          direct: true,
          isDev: scope === 'test',
          namespace: groupId,
        }));
      }
    }
    return packages;
  }

  async fetchPackageInfo(name, version) {
    const [groupId, artifactId] = name.split(':');
    if (!groupId || !artifactId) return this.normalizePackage({ name, version, ecosystem: 'maven' });
    try {
      const groupPath = groupId.replace(/\./g, '/');
      const url = `https://search.maven.org/solrsearch/select?q=g:${groupId}+AND+a:${artifactId}&rows=1&wt=json`;
      const data = await this.fetchJson(url);
      const doc = data.response?.docs?.[0];
      return this.normalizePackage({
        name,
        version: version || doc?.latestVersion,
        ecosystem: 'maven',
        description: doc?.text?.[0],
      });
    } catch {
      return this.normalizePackage({ name, version, ecosystem: 'maven' });
    }
  }
}

module.exports = MavenEcosystem;
