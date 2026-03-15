# Configuration Reference

Full reference for `policy.yml` — the policy-as-code file that controls all compliance rules.

---

## Top-level structure

```yaml
policy:
  name: string
  version: string
  preset: startup | enterprise | open-source | permissive-only
  # ... rule overrides
```

---

## Presets

| Preset | Description | Blocks |
|--------|-------------|--------|
| `startup` | SaaS / commercial products | GPL, AGPL, SSPL, UNLICENSED |
| `enterprise` | Large orgs / strict IP protection | GPL, AGPL, LGPL, MPL, EUPL, SSPL, UNLICENSED |
| `open-source` | GPL-compatible open source projects | AGPL, SSPL, UNLICENSED |
| `permissive-only` | Maximum safety | Everything except MIT/Apache/BSD/ISC/CC0/Unlicense |

Using a preset is a starting point — all fields below can override it.

---

## Rules

### `blocked_licenses`
List of SPDX identifiers that are **always** blocked regardless of type.

```yaml
blocked_licenses:
  - GPL-3.0-only
  - AGPL-3.0-only
  - SSPL-1.0
  - UNLICENSED
```

Use exact SPDX identifiers: `GPL-3.0-only`, not `GPL3` or `GPL-3`.
See full list at https://spdx.org/licenses/

### `allowed_types`
Only packages whose license falls into one of these categories are allowed.

```yaml
allowed_types:
  - permissive      # MIT, Apache-2.0, BSD, ISC, etc.
  - public-domain   # CC0, Unlicense
  - weak-copyleft   # LGPL, MPL (use with caution)
  - copyleft        # GPL (use only for open-source projects)
  - unknown         # (not recommended)
```

### `require_commercial`
If `true`, blocks any license that restricts commercial use.

```yaml
require_commercial: true  # blocks GPL, AGPL
```

### `block_unknown`
If `true`, blocks packages where the license cannot be determined.

```yaml
block_unknown: true  # recommended for production software
```

### `require_patent_grant`
If `true`, warns on packages without an explicit patent grant (e.g. MIT).
Apache-2.0 and GPL-3.0 include patent grants; MIT does not.

```yaml
require_patent_grant: false  # set true for maximum patent safety
```

### `scan_transitive`
Whether to scan indirect (transitive) dependencies.

```yaml
scan_transitive: true  # strongly recommended
```

### `max_depth`
Maximum depth to scan in the dependency tree. Default: unlimited.

```yaml
max_depth: 5  # only scan 5 levels deep
```

---

## SBOM

```yaml
sbom:
  enabled: true
  formats:
    - cyclonedx    # OWASP CycloneDX 1.5
    - spdx         # ISO/IEC 5962:2021 SPDX 2.3
  output_dir: ./sbom
  include_dev_deps: false  # exclude devDependencies from SBOM
```

---

## AI Resolver

For packages with ambiguous or missing license information.

```yaml
ai_resolver:
  enabled: false          # disabled by default
  provider: ollama        # ollama (free, local) | openai-compatible
  model: llama3
  base_url: http://localhost:11434/v1
  api_key: ""             # leave empty for Ollama
  confidence_threshold: 0.85
  cache_results: true     # cache per-package so you don't re-query
```

**Using Ollama (recommended — completely free and private):**
```bash
# Install Ollama: https://ollama.com
ollama pull llama3
# Then set provider: ollama in policy.yml
```

---

## Exceptions

Approved exceptions bypass policy rules for specific packages.
**Always get legal sign-off before adding an exception.**

```yaml
exceptions:
  - package: "some-gpl-package"
    ecosystem: npm           # optional: restrict to one ecosystem
    version: ">=1.0.0"       # optional: semver range
    reason: "Used as external CLI subprocess only — not linked to our code"
    approved_by: "legal@company.com"
    expires: "2025-12-31"    # forces annual review — strongly recommended
    ticket: "LEGAL-123"      # reference to your legal ticketing system
```

**Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `package` | ✅ | Exact package name |
| `ecosystem` | No | Restrict exception to one ecosystem |
| `version` | No | Semver range (e.g. `>=1.0.0 <2.0.0`) |
| `reason` | No* | Why this was approved (*strongly recommended*) |
| `approved_by` | No* | Who approved it (*strongly recommended*) |
| `expires` | No* | ISO date — exception becomes invalid after this date |
| `ticket` | No | Link to your legal/compliance tracking system |

---

## Complete example

```yaml
policy:
  name: "Acme Corp"
  version: "2.0.0"
  preset: enterprise

  blocked_licenses:
    - SSPL-1.0
    - BUSL-1.1

  allowed_types:
    - permissive
    - public-domain

  require_commercial: true
  block_unknown: true
  scan_transitive: true

  sbom:
    enabled: true
    formats: [cyclonedx, spdx]
    output_dir: ./sbom
    include_dev_deps: false

  ai_resolver:
    enabled: false

  exceptions:
    - package: "libvips"
      ecosystem: npm
      reason: "Used via sharp which dynamically links — legal confirmed this is OK"
      approved_by: "legal@acme.com"
      expires: "2025-06-01"
      ticket: "LEGAL-88"
```
