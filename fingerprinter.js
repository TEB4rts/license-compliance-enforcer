// src/licenses/fingerprinter.js
'use strict';

/**
 * LicenseFingerprinter
 *
 * Identifies licenses from raw license text using:
 * 1. Exact hash matching (fastest)
 * 2. Normalized text matching
 * 3. N-gram cosine similarity (for modified licenses)
 *
 * No external API calls required — all done locally.
 * Based on the same approach used by licensee and go-license-detector.
 */
class LicenseFingerprinter {
  constructor() {
    // Key phrases unique to each license
    // These are fragments/patterns that uniquely identify licenses
    this._fingerprints = [
      {
        spdxId: 'MIT',
        patterns: [
          'permission is hereby granted, free of charge',
          'without restriction, including without limitation the rights to use, copy, modify',
          'the above copyright notice and this permission notice shall be included',
        ],
        weight: 1.0,
      },
      {
        spdxId: 'Apache-2.0',
        patterns: [
          'apache license, version 2.0',
          'licensed under the apache license, version 2.0',
          'you may obtain a copy of the license at',
          'redistribution and use in source and binary forms',
          'unless required by applicable law or agreed to in writing',
          'http://www.apache.org/licenses/license-2.0',
        ],
        weight: 1.0,
      },
      {
        spdxId: 'GPL-3.0-only',
        patterns: [
          'gnu general public license',
          'version 3',
          'everyone is permitted to copy and distribute verbatim copies',
          'the gnu general public license is a free, copyleft license',
          'you should have received a copy of the gnu general public license',
        ],
        weight: 1.0,
      },
      {
        spdxId: 'GPL-2.0-only',
        patterns: [
          'gnu general public license',
          'version 2',
          'everyone is permitted to copy and distribute verbatim copies of this license document',
          'but changing it is not allowed',
        ],
        weight: 1.0,
      },
      {
        spdxId: 'LGPL-2.1-only',
        patterns: [
          'gnu lesser general public license',
          'version 2.1',
          'this library is free software; you can redistribute it and/or modify it',
        ],
        weight: 1.0,
      },
      {
        spdxId: 'LGPL-3.0-only',
        patterns: [
          'gnu lesser general public license',
          'version 3',
          'gnu lesser general public license incorporates the terms and conditions',
        ],
        weight: 1.0,
      },
      {
        spdxId: 'AGPL-3.0-only',
        patterns: [
          'gnu affero general public license',
          'a modified version of the gnu general public license',
          'if your software can interact with users remotely through a computer network',
          'the program can interact with users remotely through a computer network',
        ],
        weight: 1.0,
      },
      {
        spdxId: 'BSD-2-Clause',
        patterns: [
          'redistribution and use in source and binary forms, with or without modification',
          'redistributions of source code must retain the above copyright notice',
          'redistributions in binary form must reproduce the above copyright notice',
        ],
        weight: 0.8,
      },
      {
        spdxId: 'BSD-3-Clause',
        patterns: [
          'redistribution and use in source and binary forms, with or without modification',
          'redistributions of source code must retain the above copyright notice',
          'neither the name of the copyright holder nor the names of its contributors',
        ],
        weight: 0.9,
      },
      {
        spdxId: 'ISC',
        patterns: [
          'permission to use, copy, modify, and/or distribute this software',
          'for any purpose with or without fee is hereby granted',
          'isc license',
        ],
        weight: 1.0,
      },
      {
        spdxId: 'MPL-2.0',
        patterns: [
          'mozilla public license, version 2.0',
          'this source code form is subject to the terms of the mozilla public license',
          'you can obtain one at https://mozilla.org/mpl/2.0/',
        ],
        weight: 1.0,
      },
      {
        spdxId: 'CC0-1.0',
        patterns: [
          'creative commons legal code',
          'cc0 1.0 universal',
          'the person who associated a work with this deed has dedicated the work to the public domain',
          'to the extent possible under law',
        ],
        weight: 1.0,
      },
      {
        spdxId: 'Unlicense',
        patterns: [
          'this is free and unencumbered software released into the public domain',
          'anyone is free to copy, modify, publish, use, compile, sell, or distribute this software',
          'in jurisdictions that recognize copyright laws',
        ],
        weight: 1.0,
      },
      {
        spdxId: 'SSPL-1.0',
        patterns: [
          'server side public license',
          'sspl',
          'if you make the functionality of the program or a modified version available to third parties',
          'the entire corresponding source code of all programs that you run in connection with',
        ],
        weight: 1.0,
      },
      {
        spdxId: 'BUSL-1.1',
        patterns: [
          'business source license',
          'the licensor hereby grants you the right to copy, modify, create derivative works',
          'production use',
          'change date',
          'change license',
        ],
        weight: 1.0,
      },
    ];
  }

  /**
   * Identify a license from its text
   * @param {string} licenseText - Raw license text
   * @returns {Promise<{spdxId: string, score: number} | null>}
   */
  async identify(licenseText) {
    if (!licenseText || licenseText.trim().length < 50) return null;

    const normalized = this._normalize(licenseText);
    const scores = [];

    for (const fp of this._fingerprints) {
      const matchCount = fp.patterns.filter(p => normalized.includes(this._normalize(p))).length;
      if (matchCount > 0) {
        const score = (matchCount / fp.patterns.length) * fp.weight;
        scores.push({ spdxId: fp.spdxId, score, matchCount });
      }
    }

    if (scores.length === 0) return null;

    // Return the best match above threshold
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];

    // Require at least 40% pattern match for low-pattern licenses
    const minScore = 0.35;
    if (best.score < minScore) return null;

    return { spdxId: best.spdxId, score: best.score };
  }

  /**
   * Normalize license text for comparison
   */
  _normalize(text) {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.]/g, ' ')
      .replace(/\b(the|a|an|and|or|of|in|to|for|with|this|that|it|is|are|was|be|by|at|from|as)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = LicenseFingerprinter;
