// src/core/resolver.js
'use strict';

/**
 * Resolver builds the full dependency graph for a manifest file.
 * It calls the ecosystem-specific parser to get direct deps,
 * then recursively fetches transitive deps up to the configured depth.
 */
class Resolver {
  constructor(ecosystemParser, options = {}) {
    this.parser = ecosystemParser;
    this.scanTransitive = options.scanTransitive !== false;
    this.depth = options.depth || Infinity;
    this.verbose = options.verbose || false;
    this._visited = new Set();
    this.maxConcurrentRequests = Math.max(1, Number(options.maxConcurrentRequests) || 5);
  }

  /**
   * Resolve all dependencies from a manifest file
   * @param {string} manifestPath - Path to the manifest file
   * @returns {Promise<NormalizedPackage[]>}
   */
  async resolve(manifestPath) {
    this._visited.clear();

    // Parse direct dependencies from the manifest
    const direct = await this.parser.parseManifest(manifestPath);

    // Mark them as direct
    for (const pkg of direct) {
      pkg.direct = true;
      pkg.dependencyDepth = 0;
    }

    if (!this.scanTransitive) {
      return direct;
    }

    // BFS through the transitive dependency graph
    const all = [...direct];
    let currentDepth = 1;
    let currentLayer = direct;

    while (currentLayer.length > 0 && currentDepth <= this.depth) {
      const nextLayer = [];

      for (let i = 0; i < currentLayer.length; i += this.maxConcurrentRequests) {
        const chunk = currentLayer.slice(i, i + this.maxConcurrentRequests);
        const results = await Promise.all(chunk.map(async (pkg) => {
          const key = `${pkg.ecosystem}:${pkg.name}@${pkg.version}`;
          if (this._visited.has(key)) return { pkg, deps: [] };
          this._visited.add(key);

          let deps = [];
          try {
            const info = await this.parser.fetchPackageInfo(pkg.name, pkg.version);
            deps = info.dependencies || [];
            if (info.license && (!pkg.license || pkg.license === 'UNKNOWN')) {
              pkg.license = info.license;
            }
            if (info.description && !pkg.description) pkg.description = info.description;
            if (info.repositoryUrl && !pkg.repositoryUrl) pkg.repositoryUrl = info.repositoryUrl;
            if (info.homepage && !pkg.homepage) pkg.homepage = info.homepage;
            if (info.author && !pkg.author) pkg.author = info.author;
            if (info.licenseText && !pkg.licenseText) pkg.licenseText = info.licenseText;
          } catch (err) {
            if (this.verbose) {
              console.error(`[resolver] Could not fetch info for ${pkg.name}@${pkg.version}: ${err.message}`);
            }
          }

          return { pkg, deps };
        }));

        for (const { pkg, deps } of results) {
          for (const dep of deps) {
            const depKey = `${dep.ecosystem || pkg.ecosystem}:${dep.name}@${dep.version}`;
            if (!this._visited.has(depKey)) {
              const transitivePkg = {
                ...dep,
                ecosystem: dep.ecosystem || pkg.ecosystem,
                direct: false,
                dependencyDepth: currentDepth,
                dependencyPath: `${pkg.name} > ${dep.name}`,
              };
              nextLayer.push(transitivePkg);
              all.push(transitivePkg);
            }
          }
        }
      }

      currentLayer = nextLayer;
      currentDepth++;
    }

    return all;
  }
}

module.exports = Resolver;
