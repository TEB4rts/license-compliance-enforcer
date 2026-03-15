// tests/integration/scan.test.js
'use strict';

const path = require('path');
const PolicyEngine = require('../../src/core/policy-engine');
const NpmEcosystem = require('../../src/ecosystems/npm');
const PipEcosystem = require('../../src/ecosystems/pip');
const CargoEcosystem = require('../../src/ecosystems/cargo');
const GoEcosystem = require('../../src/ecosystems/go');
const SbomGenerator = require('../../src/core/sbom-generator');
const Reporter = require('../../src/core/reporter');

const FIXTURES = {
  npm: path.join(__dirname, '../fixtures/npm'),
  pip: path.join(__dirname, '../fixtures/pip'),
  cargo: path.join(__dirname, '../fixtures/cargo'),
  go: path.join(__dirname, '../fixtures/go'),
};

describe('Integration: npm manifest parsing', () => {
  test('parses package.json and returns packages', async () => {
    const eco = new NpmEcosystem({ dir: FIXTURES.npm });
    const manifests = await eco.findManifests();
    expect(manifests.length).toBeGreaterThan(0);

    const packages = await eco.parseManifest(manifests[0]);
    expect(packages.length).toBeGreaterThan(0);
    expect(packages[0]).toHaveProperty('name');
    expect(packages[0]).toHaveProperty('version');
    expect(packages[0]).toHaveProperty('ecosystem', 'npm');
  });
});

describe('Integration: pip manifest parsing', () => {
  test('parses requirements.txt and returns packages', async () => {
    const eco = new PipEcosystem({ dir: FIXTURES.pip });
    const manifests = await eco.findManifests();
    expect(manifests.length).toBeGreaterThan(0);

    const packages = await eco.parseManifest(manifests[0]);
    expect(packages.length).toBeGreaterThan(0);
    expect(packages.some(p => p.name === 'requests')).toBe(true);
  });
});

describe('Integration: cargo manifest parsing', () => {
  test('parses Cargo.toml and returns packages', async () => {
    const eco = new CargoEcosystem({ dir: FIXTURES.cargo });
    const manifests = await eco.findManifests();
    expect(manifests.length).toBeGreaterThan(0);

    const packages = await eco.parseManifest(manifests[0]);
    expect(packages.length).toBeGreaterThan(0);
    expect(packages.some(p => p.name === 'serde')).toBe(true);
  });
});

describe('Integration: go manifest parsing', () => {
  test('parses go.mod and returns packages', async () => {
    const eco = new GoEcosystem({ dir: FIXTURES.go });
    const manifests = await eco.findManifests();
    expect(manifests.length).toBeGreaterThan(0);

    const packages = await eco.parseManifest(manifests[0]);
    expect(packages.length).toBeGreaterThan(0);
    expect(packages.some(p => p.name.includes('gin-gonic'))).toBe(true);
  });
});

describe('Integration: full policy evaluation pipeline', () => {
  const mockPackages = [
    { name: 'react', version: '18.2.0', license: 'MIT', ecosystem: 'npm', direct: true },
    { name: 'lodash', version: '4.17.21', license: 'MIT', ecosystem: 'npm', direct: true },
    { name: 'violating-pkg', version: '1.0.0', license: 'GPL-3.0-only', ecosystem: 'npm', direct: false, dependencyPath: 'some-lib > violating-pkg' },
    { name: 'no-license', version: '2.0.0', license: 'UNLICENSED', ecosystem: 'npm', direct: true },
  ];

  test('startup preset correctly identifies violations', () => {
    const engine = new PolicyEngine({ preset: 'startup' });
    const { violations, all } = engine.evaluate(mockPackages);
    expect(all).toHaveLength(4);
    expect(violations).toHaveLength(2);
    expect(violations.map(v => v.name)).toContain('violating-pkg');
    expect(violations.map(v => v.name)).toContain('no-license');
  });

  test('generates markdown report without crashing', () => {
    const engine = new PolicyEngine({ preset: 'startup' });
    const evaluated = engine.evaluate(mockPackages);
    const report = {
      packages: evaluated.all,
      violations: evaluated.violations,
      warnings: evaluated.warnings,
      timestamp: new Date().toISOString(),
      hasViolations: evaluated.violations.length > 0,
      meta: { ecosystems: ['npm'], totalPackages: 4 },
    };
    const reporter = new Reporter();
    const md = reporter.markdown(report);
    expect(md).toContain('License Compliance');
    expect(md).toContain('violating-pkg');
  });

  test('generates CycloneDX SBOM without crashing', async () => {
    const gen = new SbomGenerator({ formats: ['cyclonedx'] });
    const result = await gen.generate(mockPackages, { projectName: 'test' });
    expect(result.cyclonedx.components).toHaveLength(4);
    const comp = result.cyclonedx.components.find(c => c.name === 'react');
    expect(comp.purl).toBe('pkg:npm/react@18.2.0');
    expect(comp.licenses[0].license.id).toBe('MIT');
  });
});
