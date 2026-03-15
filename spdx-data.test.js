// tests/unit/spdx-data.test.js
'use strict';

const { SPDX_DATA, getSpdxInfo } = require('../../src/licenses/spdx-data');

describe('SPDX Data', () => {
  test('contains MIT', () => {
    expect(SPDX_DATA.MIT).toBeDefined();
    expect(SPDX_DATA.MIT.type).toBe('permissive');
    expect(SPDX_DATA.MIT.commercial).toBe(true);
    expect(SPDX_DATA.MIT.copyleft).toBe(false);
  });

  test('MIT has no patent grant', () => {
    expect(SPDX_DATA.MIT.patent).toBe(false);
  });

  test('Apache-2.0 has patent grant', () => {
    expect(SPDX_DATA['Apache-2.0'].patent).toBe(true);
  });

  test('GPL-3.0-only is copyleft', () => {
    expect(SPDX_DATA['GPL-3.0-only'].copyleft).toBe(true);
    expect(SPDX_DATA['GPL-3.0-only'].commercial).toBe(false);
    expect(SPDX_DATA['GPL-3.0-only'].risk).toBe('high');
  });

  test('AGPL-3.0-only is critical risk', () => {
    expect(SPDX_DATA['AGPL-3.0-only'].risk).toBe('critical');
  });

  test('CC0-1.0 is public domain', () => {
    expect(SPDX_DATA['CC0-1.0'].type).toBe('public-domain');
    expect(SPDX_DATA['CC0-1.0'].commercial).toBe(true);
  });

  test('UNLICENSED is critical', () => {
    expect(SPDX_DATA.UNLICENSED.risk).toBe('critical');
    expect(SPDX_DATA.UNLICENSED.commercial).toBe(false);
  });

  test('getSpdxInfo returns correct data', () => {
    expect(getSpdxInfo('MIT')).toBe(SPDX_DATA.MIT);
  });

  test('getSpdxInfo handles unknown licenses', () => {
    expect(getSpdxInfo('COMPLETELY-MADE-UP-LICENSE')).toBeNull();
  });

  test('getSpdxInfo handles null/undefined', () => {
    expect(getSpdxInfo(null)).toBe(SPDX_DATA.UNKNOWN);
    expect(getSpdxInfo(undefined)).toBe(SPDX_DATA.UNKNOWN);
  });
});


// tests/unit/fingerprinter.test.js
const LicenseFingerprinter = require('../../src/licenses/fingerprinter');

describe('LicenseFingerprinter', () => {
  let fp;
  beforeEach(() => { fp = new LicenseFingerprinter(); });

  test('identifies MIT license', async () => {
    const text = `MIT License

Copyright (c) 2024 Test Author

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.`;
    const result = await fp.identify(text);
    expect(result).not.toBeNull();
    expect(result.spdxId).toBe('MIT');
    expect(result.score).toBeGreaterThan(0.3);
  });

  test('identifies Apache-2.0 license', async () => {
    const text = `Apache License, Version 2.0

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS`;
    const result = await fp.identify(text);
    expect(result).not.toBeNull();
    expect(result.spdxId).toBe('Apache-2.0');
  });

  test('returns null for very short text', async () => {
    const result = await fp.identify('MIT');
    expect(result).toBeNull();
  });

  test('returns null for empty text', async () => {
    const result = await fp.identify('');
    expect(result).toBeNull();
  });

  test('handles Unlicense', async () => {
    const text = `This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or distribute this software,
either in source code form or as a compiled binary, for any purpose, commercial or non-commercial,
and by any means.

In jurisdictions that recognize copyright laws, the author or authors of this software
dedicate any and all copyright interest in the software to the public domain.`;
    const result = await fp.identify(text);
    expect(result).not.toBeNull();
    expect(result.spdxId).toBe('Unlicense');
  });
});


// tests/unit/sbom-generator.test.js
const SbomGenerator = require('../../src/core/sbom-generator');

describe('SbomGenerator', () => {
  const mockPackages = [
    { name: 'lodash', version: '4.17.21', license: 'MIT', ecosystem: 'npm', direct: true, isDev: false },
    { name: 'axios', version: '1.4.0', license: 'MIT', ecosystem: 'npm', direct: true, isDev: false },
    { name: 'webpack', version: '5.88.0', license: 'MIT', ecosystem: 'npm', direct: false, isDev: true },
  ];

  test('generates CycloneDX SBOM', async () => {
    const gen = new SbomGenerator({ formats: ['cyclonedx'] });
    const result = await gen.generate(mockPackages, { projectName: 'test' });
    expect(result.cyclonedx).toBeDefined();
    expect(result.cyclonedx.bomFormat).toBe('CycloneDX');
    expect(result.cyclonedx.specVersion).toBe('1.5');
    expect(result.cyclonedx.components).toHaveLength(3);
  });

  test('generates SPDX SBOM', async () => {
    const gen = new SbomGenerator({ formats: ['spdx'] });
    const result = await gen.generate(mockPackages, { projectName: 'test' });
    expect(result.spdx).toBeDefined();
    expect(result.spdx.spdxVersion).toBe('SPDX-2.3');
    expect(result.spdx.dataLicense).toBe('CC0-1.0');
  });

  test('generates both formats when formats=all', async () => {
    const gen = new SbomGenerator({ formats: ['cyclonedx', 'spdx'] });
    const result = await gen.generate(mockPackages, {});
    expect(result.cyclonedx).toBeDefined();
    expect(result.spdx).toBeDefined();
  });

  test('generates correct purls for npm', async () => {
    const gen = new SbomGenerator({ formats: ['cyclonedx'] });
    const result = await gen.generate(mockPackages, {});
    const component = result.cyclonedx.components.find(c => c.name === 'lodash');
    expect(component.purl).toBe('pkg:npm/lodash@4.17.21');
  });

  test('excludes dev deps when includeDev=false', async () => {
    const gen = new SbomGenerator({ formats: ['cyclonedx'], includeDev: false });
    const result = await gen.generate(mockPackages, {});
    const devPkg = result.cyclonedx.components.find(c => c.name === 'webpack');
    expect(devPkg).toBeUndefined();
  });

  test('reports correct component count', async () => {
    const gen = new SbomGenerator({ formats: ['cyclonedx'] });
    const result = await gen.generate(mockPackages, {});
    expect(result.componentCount).toBe(3);
  });
});
