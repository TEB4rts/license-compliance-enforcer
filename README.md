# ⚖️ license-compliance-enforcer

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![GitHub Action](https://img.shields.io/badge/GitHub-Action-blue?logo=github)](https://github.com/marketplace/actions/license-compliance-enforcer)
[![npm version](https://img.shields.io/npm/v/license-compliance-enforcer.svg)](https://www.npmjs.com/package/license-compliance-enforcer)
[![Free Forever](https://img.shields.io/badge/Free-Forever-brightgreen)](https://github.com/your-org/license-compliance-enforcer)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> **100% free, open-source, zero telemetry** license compliance enforcement for every ecosystem. Blocks non-compliant dependencies before they hit production. Replaces $20K/year enterprise tools at no cost.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🌍 **10 Ecosystems** | npm, pip, cargo, go, maven, rubygems, composer, nuget, hex, pub |
| 🔗 **Deep Transitive Scan** | Walks the full dependency graph — not just your direct deps |
| ⚖️ **Policy-as-Code** | Declarative `policy.yml` that lives in your repo |
| 📋 **SBOM Generation** | CycloneDX 1.5 + SPDX 2.3 formats, EO-14028 compliant |
| 🤖 **AI Ambiguity Resolver** | LLM-powered fallback for dual-licensed/unlabeled packages |
| 🔬 **License Fingerprinting** | Cosine-similarity text matching for modified/mislabeled licenses |
| 💬 **PR Comments** | Rich violation reports posted directly on pull requests |
| ⛔ **PR Blocking** | Fails CI on violations — nothing merges without approval |
| 📝 **Exception Management** | Team-level exceptions with expiry dates and audit trail |
| 🛡️ **Patent Grant Analysis** | Flags packages missing patent grants (critical for enterprise) |
| 📊 **Copyleft Tracing** | Traces exact contamination paths through your dep tree |
| 🚫 **Zero Telemetry** | No data ever leaves your environment |

---

## 🚀 Quick Start

### GitHub Action (Recommended)

Add to `.github/workflows/license-check.yml`:

```yaml
name: License Compliance

on: [push, pull_request]

jobs:
  license-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: License Compliance Check
        uses: your-org/license-compliance-enforcer@v2
        with:
          policy: startup
          ecosystems: auto
          fail-on-violation: true
          generate-sbom: true
          post-pr-comment: true
```

### CLI

```bash
# Install globally
npm install -g license-compliance-enforcer

# Initialize policy for your project
lce init

# Run a scan
lce scan

# Scan with specific policy
lce scan --policy enterprise

# Export SBOM
lce sbom --format cyclonedx --output sbom.cdx.json

# Check a single package
lce check lodash@4.17.21
```

### Programmatic API

```javascript
const { LicenseEnforcer } = require('license-compliance-enforcer');

const enforcer = new LicenseEnforcer({
  policy: './policy.yml',
  ecosystems: ['npm', 'pip'],
  scanTransitive: true,
});

const report = await enforcer.scan('./');
if (report.hasViolations) {
  console.error(report.summary());
  process.exit(1);
}
```

---

## 📋 Policy Configuration

Create a `policy.yml` in your project root:

```yaml
# policy.yml
policy:
  name: "My Project"
  version: "1.0.0"

  # Choose a preset: startup | enterprise | open-source | permissive-only
  # Or define custom rules below
  preset: startup

  # Explicitly blocked licenses (SPDX identifiers)
  blocked_licenses:
    - GPL-2.0
    - GPL-3.0
    - AGPL-3.0
    - SSPL-1.0

  # Allowed license types
  allowed_types:
    - permissive
    - public-domain

  # Require commercial use rights
  require_commercial: true

  # Block packages with unknown/missing licenses
  block_unknown: true

  # Scan transitive (indirect) dependencies
  scan_transitive: true

  # SBOM generation
  sbom:
    enabled: true
    formats: [cyclonedx, spdx]
    output: ./sbom/

  # Approved exceptions (always get legal sign-off first!)
  exceptions:
    - package: "some-gpl-package"
      version: ">=1.0.0"
      ecosystem: npm
      reason: "Isolated in separate process, legal approved 2024-01-15"
      approved_by: "legal@company.com"
      expires: "2025-01-15"  # Forces re-review annually
```

### Policy Presets

| Preset | Use Case | Blocks |
|---|---|---|
| `startup` | SaaS / commercial product | GPL, AGPL, SSPL, unlicensed |
| `enterprise` | Large org / strict IP | GPL, AGPL, LGPL, MPL, SSPL, unlicensed |
| `open-source` | GPL-compatible OSS | AGPL, proprietary, unlicensed |
| `permissive-only` | Maximum safety | Everything except MIT/Apache/BSD/ISC/CC0 |

---

## 🔧 CLI Reference

```
Usage: lce <command> [options]

Commands:
  scan      Scan dependencies for license violations
  report    Generate a full compliance report
  sbom      Generate a Software Bill of Materials
  check     Check a single package's license
  init      Initialize policy.yml for this project
  diff      Compare two scan results (for CI delta reports)
  audit     Full audit with remediation suggestions

Options for scan:
  --policy <file>        Path to policy.yml (default: ./policy.yml)
  --ecosystems <list>    Comma-separated list or 'auto' (default: auto)
  --format <fmt>         Output format: text|json|junit|sarif (default: text)
  --output <file>        Write report to file
  --fail-on-violation    Exit 1 if violations found (default: true)
  --scan-transitive      Include indirect dependencies (default: true)
  --depth <n>            Max transitive depth (default: unlimited)
  --no-cache             Skip the dependency cache
  --verbose              Verbose output
  --quiet                Suppress all output except errors
```

---

## 🌍 Supported Ecosystems

| Ecosystem | Manifest Files | Registry |
|---|---|---|
| **npm** | `package.json`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` | registry.npmjs.org |
| **pip** | `requirements.txt`, `Pipfile`, `pyproject.toml`, `setup.py` | pypi.org |
| **cargo** | `Cargo.toml`, `Cargo.lock` | crates.io |
| **go** | `go.mod`, `go.sum` | pkg.go.dev |
| **maven** | `pom.xml` | search.maven.org |
| **rubygems** | `Gemfile`, `Gemfile.lock`, `*.gemspec` | rubygems.org |
| **composer** | `composer.json`, `composer.lock` | packagist.org |
| **nuget** | `*.csproj`, `packages.config`, `*.nuspec` | nuget.org |
| **hex** | `mix.exs`, `mix.lock` | hex.pm |
| **pub** | `pubspec.yaml`, `pubspec.lock` | pub.dev |

---

## 📊 SBOM Formats

Both formats are generated automatically and comply with:
- **CycloneDX 1.5** — OWASP standard, supported by most tools
- **SPDX 2.3** — ISO/IEC 5962:2021, required by US EO-14028

```bash
# Generate both formats
lce sbom --format all

# Validate an existing SBOM
lce sbom --validate ./sbom.cdx.json
```

---

## 🤖 AI Ambiguity Resolver

For packages with unclear, dual, or non-standard licenses, the AI resolver:

1. Downloads the raw `LICENSE` file from the package repository
2. Runs cosine-similarity fingerprinting against 500+ known license templates
3. Falls back to an LLM (local Ollama or OpenAI-compatible API) for edge cases
4. Caches results locally — no repeat API calls

```yaml
# policy.yml
ai_resolver:
  enabled: true
  # Use local Ollama (free, private, recommended)
  provider: ollama
  model: llama3
  # OR use any OpenAI-compatible endpoint
  # provider: openai-compatible
  # base_url: http://localhost:11434/v1
  # api_key: "" # empty for Ollama
  confidence_threshold: 0.85
  cache_results: true
```

---

## 🏗️ Architecture

```
license-compliance-enforcer/
├── src/
│   ├── cli/              # CLI entry point & commands
│   ├── core/
│   │   ├── scanner.js        # Main orchestrator
│   │   ├── resolver.js       # Dependency graph builder
│   │   ├── policy-engine.js  # Rule evaluation engine
│   │   ├── sbom-generator.js # CycloneDX + SPDX output
│   │   ├── ai-resolver.js    # LLM ambiguity resolution
│   │   └── reporter.js       # Report formatting
│   ├── ecosystems/       # Per-ecosystem parsers
│   ├── licenses/
│   │   ├── spdx-data.js      # Full SPDX license database
│   │   ├── fingerprinter.js  # Text similarity matching
│   │   └── compatibility.js  # License compatibility matrix
│   └── utils/
├── action/               # GitHub Action wrapper
├── dashboard/            # Optional local web dashboard
├── tests/
├── docs/
└── examples/
```

---

## 🤝 Contributing

All contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

- 🐛 **Bug reports** → [GitHub Issues](https://github.com/your-org/license-compliance-enforcer/issues)
- 💡 **Feature requests** → [GitHub Discussions](https://github.com/your-org/license-compliance-enforcer/discussions)
- 🌍 **New ecosystem support** → See `src/ecosystems/` for the interface

---

## 📄 License

MIT © 2024 license-compliance-enforcer contributors

**This tool is free forever.** No paid tiers, no usage limits, no telemetry, no SaaS upsell. Just open-source software.

---

## 🙏 Acknowledgments

- [SPDX Project](https://spdx.org/) — License identifiers & data
- [CycloneDX](https://cyclonedx.org/) — SBOM specification
- [TLDR Legal](https://tldrlegal.com/) — License summaries
- [ChooseALicense](https://choosealicense.com/) — License guidance
