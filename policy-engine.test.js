// tests/unit/policy-engine.test.js
'use strict';

const PolicyEngine = require('../../src/core/policy-engine');

describe('PolicyEngine', () => {
  describe('preset: startup', () => {
    const engine = new PolicyEngine({ preset: 'startup' });

    test('allows MIT packages', () => {
      const result = engine.evaluate([{ name: 'lodash', version: '4.17.21', license: 'MIT', ecosystem: 'npm' }]);
      expect(result.violations).toHaveLength(0);
    });

    test('allows Apache-2.0 packages', () => {
      const result = engine.evaluate([{ name: 'some-pkg', version: '1.0.0', license: 'Apache-2.0', ecosystem: 'npm' }]);
      expect(result.violations).toHaveLength(0);
    });

    test('allows BSD-3-Clause packages', () => {
      const result = engine.evaluate([{ name: 'some-pkg', version: '1.0.0', license: 'BSD-3-Clause', ecosystem: 'npm' }]);
      expect(result.violations).toHaveLength(0);
    });

    test('blocks GPL-3.0 packages', () => {
      const result = engine.evaluate([{ name: 'gpl-pkg', version: '1.0.0', license: 'GPL-3.0-only', ecosystem: 'npm' }]);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].violationReasons.length).toBeGreaterThan(0);
    });

    test('blocks AGPL-3.0 packages', () => {
      const result = engine.evaluate([{ name: 'agpl-pkg', version: '1.0.0', license: 'AGPL-3.0-only', ecosystem: 'npm' }]);
      expect(result.violations).toHaveLength(1);
    });

    test('blocks UNLICENSED packages', () => {
      const result = engine.evaluate([{ name: 'no-license', version: '1.0.0', license: 'UNLICENSED', ecosystem: 'npm' }]);
      expect(result.violations).toHaveLength(1);
    });

    test('blocks UNKNOWN license packages', () => {
      const result = engine.evaluate([{ name: 'mystery-pkg', version: '1.0.0', license: 'UNKNOWN', ecosystem: 'npm' }]);
      expect(result.violations).toHaveLength(1);
    });

    test('handles multiple packages correctly', () => {
      const packages = [
        { name: 'good', version: '1.0.0', license: 'MIT', ecosystem: 'npm' },
        { name: 'bad', version: '1.0.0', license: 'GPL-3.0-only', ecosystem: 'npm' },
        { name: 'also-good', version: '1.0.0', license: 'Apache-2.0', ecosystem: 'npm' },
        { name: 'also-bad', version: '1.0.0', license: 'AGPL-3.0-only', ecosystem: 'npm' },
      ];
      const result = engine.evaluate(packages);
      expect(result.all).toHaveLength(4);
      expect(result.violations).toHaveLength(2);
    });
  });

  describe('preset: enterprise', () => {
    const engine = new PolicyEngine({ preset: 'enterprise' });

    test('blocks LGPL packages', () => {
      const result = engine.evaluate([{ name: 'lgpl-pkg', version: '1.0.0', license: 'LGPL-2.1-only', ecosystem: 'npm' }]);
      expect(result.violations).toHaveLength(1);
    });

    test('blocks MPL packages', () => {
      const result = engine.evaluate([{ name: 'mpl-pkg', version: '1.0.0', license: 'MPL-2.0', ecosystem: 'npm' }]);
      expect(result.violations).toHaveLength(1);
    });
  });

  describe('exceptions', () => {
    test('approved exceptions bypass violations', () => {
      const engine = new PolicyEngine({
        preset: 'startup',
        exceptions: [{
          package: 'special-gpl-pkg',
          ecosystem: 'npm',
          reason: 'Legal approved',
          approved_by: 'legal@company.com',
        }],
      });
      const result = engine.evaluate([{ name: 'special-gpl-pkg', version: '1.0.0', license: 'GPL-3.0-only', ecosystem: 'npm' }]);
      expect(result.violations).toHaveLength(0);
      expect(result.all[0].exempt).toBe(true);
    });

    test('expired exceptions are not applied', () => {
      const engine = new PolicyEngine({
        preset: 'startup',
        exceptions: [{
          package: 'expired-pkg',
          reason: 'Expired approval',
          expires: '2020-01-01', // past date
        }],
      });
      const result = engine.evaluate([{ name: 'expired-pkg', version: '1.0.0', license: 'GPL-3.0-only', ecosystem: 'npm' }]);
      expect(result.violations).toHaveLength(1);
    });
  });

  describe('custom policy', () => {
    test('custom blocked licenses override preset', () => {
      const engine = new PolicyEngine({
        preset: 'open-source',
        blocked_licenses: ['MIT'], // unusual but valid
      });
      const result = engine.evaluate([{ name: 'mit-pkg', version: '1.0.0', license: 'MIT', ecosystem: 'npm' }]);
      expect(result.violations).toHaveLength(1);
    });
  });

  describe('static methods', () => {
    test('getPresets returns all presets', () => {
      const presets = PolicyEngine.getPresets();
      expect(presets.length).toBeGreaterThanOrEqual(4);
      expect(presets.map(p => p.key)).toContain('startup');
      expect(presets.map(p => p.key)).toContain('enterprise');
    });
  });
});
