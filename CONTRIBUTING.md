# Contributing to license-compliance-enforcer

First off, thank you for considering contributing! This project is 100% community-driven and free forever.

## Ways to Contribute

- 🐛 **Report bugs** — Open a GitHub Issue with reproduction steps
- 🌍 **Add ecosystem support** — See "Adding a New Ecosystem" below
- 📜 **Add license data** — Expand `src/licenses/spdx-data.js`
- 🧪 **Write tests** — More coverage is always welcome
- 📖 **Improve docs** — Fix typos, add examples, clarify confusing parts
- 💡 **Suggest features** — Open a Discussion

## Development Setup

```bash
# Clone the repo
git clone https://github.com/your-org/license-compliance-enforcer.git
cd license-compliance-enforcer

# Install dependencies
npm install

# Run tests
npm test

# Run with test coverage
npm run test:coverage

# Lint
npm run lint

# Try the CLI locally
node src/cli/index.js scan --help
node src/cli/index.js scan --policy startup
```

## Adding a New Ecosystem

1. Create `src/ecosystems/<name>.js` by extending `BaseEcosystem`:

```javascript
// src/ecosystems/myeco.js
'use strict';
const BaseEcosystem = require('./base');

class MyEcoEcosystem extends BaseEcosystem {
  get name() { return 'myeco'; }
  get manifestFiles() { return ['manifest.lock', 'manifest.toml']; }

  async parseManifest(manifestPath) {
    // Parse the manifest file and return normalized packages
    const packages = [];
    // ... parsing logic ...
    return packages.map(p => this.normalizePackage(p));
  }

  async fetchPackageInfo(name, version) {
    // Fetch package info from the registry API
    try {
      const data = await this.fetchJson(`https://registry.myeco.org/packages/${name}/${version}`);
      return this.normalizePackage({
        name: data.name,
        version: data.version,
        license: data.license,
        description: data.description,
        ecosystem: 'myeco',
      });
    } catch {
      return this.normalizePackage({ name, version, ecosystem: 'myeco' });
    }
  }
}

module.exports = MyEcoEcosystem;
```

2. Register it in `src/ecosystems/index.js`:
```javascript
myeco: () => require('./myeco'),
```

3. Add detection indicators in `src/core/scanner.js` under `ECOSYSTEM_INDICATORS`.

4. Add a fixture in `tests/fixtures/myeco/`.

5. Add a test in `tests/integration/scan.test.js`.

6. Update the README ecosystem table.

## Code Style

- Use `'use strict'` at the top of every file
- Use `async/await` not callbacks
- Write JSDoc for public methods
- Keep functions small and focused
- All network calls go through `BaseEcosystem.fetchJson()` — never raw `fetch`/`axios`

## Pull Request Process

1. Fork the repo and create a feature branch: `git checkout -b feature/my-feature`
2. Write tests for your changes
3. Make sure all tests pass: `npm test`
4. Make sure lint passes: `npm run lint`
5. Submit a PR with a clear description of what and why

## Reporting Security Issues

**Do not open a public issue for security vulnerabilities.**
Email `security@your-org.com` with the details. We'll respond within 48 hours.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
