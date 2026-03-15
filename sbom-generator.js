// src/core/sbom-generator.js
'use strict';

const crypto = require('crypto');

/**
 * SBOM Generator
 * Produces Software Bills of Materials in CycloneDX 1.5 and SPDX 2.3 formats
 * Both formats are free, open standards with no licensing obligations
 */
class SbomGenerator {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Generate SBOM in the requested formats
   * @param {Object[]} packages - Normalized package list
   * @param {Object} meta - Scan metadata
   * @returns {Object} Map of format -> document
   */
  async generate(packages, meta = {}) {
    const formats = this.options.formats || ['cyclonedx', 'spdx'];
    const includeDev = this.options.includeDev || false;

    const pkgs = includeDev ? packages : packages.filter(p => !p.isDev);
    const result = {
      componentCount: pkgs.length,
      licenseCount: new Set(pkgs.map(p => p.license).filter(Boolean)).size,
    };

    if (formats.includes('cyclonedx')) {
      result.cyclonedx = this._generateCycloneDX(pkgs, meta);
    }

    if (formats.includes('spdx')) {
      result.spdx = this._generateSpdx(pkgs, meta);
    }

    return result;
  }

  /**
   * Generate CycloneDX 1.5 BOM
   * Spec: https://cyclonedx.org/docs/1.5/
   */
  _generateCycloneDX(packages, meta) {
    const serialNumber = `urn:uuid:${this._generateUUID()}`;

    const components = packages.map(pkg => {
      const component = {
        type: 'library',
        'bom-ref': `${pkg.ecosystem}:${pkg.name}@${pkg.version}`,
        name: pkg.name,
        version: pkg.version || 'unknown',
        purl: this._toPurl(pkg),
      };

      if (pkg.description) {
        component.description = pkg.description;
      }

      if (pkg.license && pkg.license !== 'UNKNOWN') {
        component.licenses = [{ license: { id: pkg.license } }];
      } else if (pkg.license === 'UNKNOWN') {
        component.licenses = [{ license: { name: 'Unknown' } }];
      }

      if (pkg.repositoryUrl) {
        component.externalReferences = [{
          type: 'vcs',
          url: pkg.repositoryUrl,
        }];
      }

      if (pkg.homepage) {
        if (!component.externalReferences) component.externalReferences = [];
        component.externalReferences.push({ type: 'website', url: pkg.homepage });
      }

      if (pkg.author) {
        component.supplier = { name: pkg.author };
      }

      // Mark development dependencies
      if (pkg.isDev) {
        component.scope = 'excluded';
      } else if (pkg.direct) {
        component.scope = 'required';
      } else {
        component.scope = 'optional'; // transitive
      }

      return component;
    });

    // Build dependency graph
    const dependencies = packages
      .filter(pkg => pkg.dependencies && pkg.dependencies.length > 0)
      .map(pkg => ({
        ref: `${pkg.ecosystem}:${pkg.name}@${pkg.version}`,
        dependsOn: pkg.dependencies.map(dep => `${pkg.ecosystem}:${dep.name}@${dep.version}`),
      }));

    return {
      bomFormat: 'CycloneDX',
      specVersion: '1.5',
      serialNumber,
      version: 1,
      metadata: {
        timestamp: new Date().toISOString(),
        tools: [
          {
            vendor: 'license-compliance-enforcer',
            name: 'license-compliance-enforcer',
            version: require('../../package.json').version,
          },
        ],
        component: {
          type: 'application',
          name: meta.projectName || 'unknown',
          version: meta.projectVersion || 'unknown',
        },
        properties: [
          { name: 'lce:dir', value: meta.dir || process.cwd() },
          { name: 'lce:ecosystems', value: (meta.ecosystems || []).join(',') },
          { name: 'lce:policy', value: meta.policyName || 'default' },
        ],
      },
      components,
      dependencies: dependencies.length > 0 ? dependencies : undefined,
    };
  }

  /**
   * Generate SPDX 2.3 document
   * Spec: https://spdx.github.io/spdx-spec/v2.3/
   * ISO/IEC 5962:2021
   */
  _generateSpdx(packages, meta) {
    const docNamespace = `https://spdx.org/spdxdocs/${meta.projectName || 'unknown'}-${this._generateUUID()}`;
    const createdAt = new Date().toISOString();

    const packages_spdx = packages.map((pkg, i) => {
      const spdxId = `SPDXRef-Package-${i + 1}-${pkg.name.replace(/[^a-zA-Z0-9.-]/g, '-')}`;
      return {
        SPDXID: spdxId,
        name: pkg.name,
        versionInfo: pkg.version || 'NOASSERTION',
        downloadLocation: pkg.downloadUrl || 'NOASSERTION',
        filesAnalyzed: false,
        licenseConcluded: pkg.license || 'NOASSERTION',
        licenseDeclared: pkg.license || 'NOASSERTION',
        copyrightText: pkg.author ? `Copyright ${pkg.author}` : 'NOASSERTION',
        externalRefs: [
          {
            referenceCategory: 'PACKAGE-MANAGER',
            referenceType: 'purl',
            referenceLocator: this._toPurl(pkg),
          },
        ],
        ...(pkg.description && { comment: pkg.description }),
        ...(pkg.homepage && { homepage: pkg.homepage }),
      };
    });

    const relationships = [
      {
        spdxElementId: 'SPDXRef-DOCUMENT',
        relationshipType: 'DESCRIBES',
        relatedSpdxElement: 'SPDXRef-RootPackage',
      },
      ...packages.map((pkg, i) => ({
        spdxElementId: 'SPDXRef-RootPackage',
        relationshipType: pkg.direct ? 'DEPENDS_ON' : 'DYNAMIC_LINK',
        relatedSpdxElement: `SPDXRef-Package-${i + 1}-${pkg.name.replace(/[^a-zA-Z0-9.-]/g, '-')}`,
      })),
    ];

    return {
      SPDXID: 'SPDXRef-DOCUMENT',
      spdxVersion: 'SPDX-2.3',
      creationInfo: {
        created: createdAt,
        creators: [
          `Tool: license-compliance-enforcer-${require('../../package.json').version}`,
          'Organization: NOASSERTION',
        ],
        licenseListVersion: '3.21',
      },
      name: meta.projectName || 'unknown',
      dataLicense: 'CC0-1.0',
      documentNamespace: docNamespace,
      documentDescribes: ['SPDXRef-RootPackage'],
      packages: [
        {
          SPDXID: 'SPDXRef-RootPackage',
          name: meta.projectName || 'unknown',
          versionInfo: meta.projectVersion || 'NOASSERTION',
          downloadLocation: 'NOASSERTION',
          filesAnalyzed: false,
          licenseConcluded: 'NOASSERTION',
          licenseDeclared: 'NOASSERTION',
          copyrightText: 'NOASSERTION',
        },
        ...packages_spdx,
      ],
      relationships,
    };
  }

  /**
   * Convert a package to a Package URL (purl)
   * Spec: https://github.com/package-url/purl-spec
   */
  _toPurl(pkg) {
    const ECOSYSTEM_PURL_MAP = {
      npm: 'npm',
      pip: 'pypi',
      cargo: 'cargo',
      go: 'golang',
      maven: 'maven',
      rubygems: 'gem',
      composer: 'composer',
      nuget: 'nuget',
      hex: 'hex',
      pub: 'pub',
    };

    const type = ECOSYSTEM_PURL_MAP[pkg.ecosystem] || pkg.ecosystem;
    const name = pkg.namespace ? `${pkg.namespace}/${pkg.name}` : pkg.name;
    const version = pkg.version ? `@${pkg.version}` : '';

    return `pkg:${type}/${encodeURIComponent(name)}${version}`;
  }

  _generateUUID() {
    return crypto.randomUUID ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
  }
}

module.exports = SbomGenerator;
