// action/index.js
// GitHub Action entrypoint
'use strict';

const path = require('path');
const fs = require('fs');
const { LicenseEnforcer } = require('../src/index');
const Reporter = require('../src/core/reporter');

// GitHub Actions core functions (using env vars directly to avoid @actions/core dependency)
const core = {
  getInput: (name) => process.env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`] || '',
  setOutput: (name, value) => {
    const outputFile = process.env.GITHUB_OUTPUT;
    if (outputFile) {
      fs.appendFileSync(outputFile, `${name}=${value}\n`);
    } else {
      console.log(`::set-output name=${name}::${value}`);
    }
  },
  setFailed: (message) => {
    console.error(`::error::${message}`);
    process.exit(1);
  },
  warning: (message) => console.warn(`::warning::${message}`),
  info: (message) => console.log(message),
  startGroup: (name) => console.log(`::group::${name}`),
  endGroup: () => console.log('::endgroup::'),
};

async function run() {
  try {
    const policy = core.getInput('policy') || 'startup';
    const ecosystems = core.getInput('ecosystems') || 'auto';
    const failOnViolation = core.getInput('fail-on-violation') !== 'false';
    const generateSbom = core.getInput('generate-sbom') !== 'false';
    const sbomFormat = core.getInput('sbom-format') || 'all';
    const postPrComment = core.getInput('post-pr-comment') !== 'false';
    const scanTransitive = core.getInput('scan-transitive') !== 'false';
    const workingDir = path.resolve(core.getInput('working-directory') || '.');

    core.info(`⚖️  License Compliance Enforcer`);
    core.info(`   Policy     : ${policy}`);
    core.info(`   Ecosystems : ${ecosystems}`);
    core.info(`   Directory  : ${workingDir}`);
    core.info('');

    const enforcer = new LicenseEnforcer({
      policy,
      ecosystems: ecosystems === 'auto' ? ['auto'] : ecosystems.split(',').map(e => e.trim()),
      scanTransitive,
    });

    core.startGroup('🔍 Scanning dependencies...');
    const report = await enforcer.scan(workingDir);
    core.endGroup();

    // Set outputs
    core.setOutput('violations-count', report.violations.length);
    core.setOutput('warnings-count', report.warnings.length);
    core.setOutput('packages-scanned', report.packages.length);
    core.setOutput('compliant', report.hasViolations ? 'false' : 'true');

    // Generate report
    const reporter = new Reporter();
    const markdownReport = reporter.markdown(report);
    const reportPath = '/tmp/lce-report.md';
    fs.writeFileSync(reportPath, markdownReport);
    core.setOutput('report-path', reportPath);
    core.startGroup('📋 Compliance Report');
    core.info(markdownReport);
    core.endGroup();

    // Generate SBOM
    if (generateSbom) {
      core.startGroup('📦 Generating SBOM...');
      const sbomDir = path.join(workingDir, 'sbom');
      fs.mkdirSync(sbomDir, { recursive: true });
      const sbom = await enforcer.generateSbom(workingDir, {
        formats: sbomFormat === 'all' ? ['cyclonedx', 'spdx'] : [sbomFormat],
      });
      if (sbom.cyclonedx) {
        const sbomPath = path.join(sbomDir, 'sbom.cdx.json');
        fs.writeFileSync(sbomPath, JSON.stringify(sbom.cyclonedx, null, 2));
        core.setOutput('sbom-path', sbomPath);
        core.info(`✅ CycloneDX SBOM: ${sbomPath}`);
      }
      if (sbom.spdx) {
        const spdxPath = path.join(sbomDir, 'sbom.spdx.json');
        fs.writeFileSync(spdxPath, JSON.stringify(sbom.spdx, null, 2));
        core.info(`✅ SPDX SBOM: ${spdxPath}`);
      }
      core.endGroup();
    }

    // Post PR comment
    if (postPrComment && process.env.GITHUB_EVENT_NAME === 'pull_request') {
      await postComment(markdownReport);
    }

    // Summary
    core.info('');
    core.info(`📊 Results:`);
    core.info(`   Packages scanned : ${report.packages.length}`);
    core.info(`   Violations       : ${report.violations.length}`);
    core.info(`   Warnings         : ${report.warnings.length}`);

    if (report.hasViolations && failOnViolation) {
      core.setFailed(`❌ ${report.violations.length} license violation(s) found. See report above.`);
    } else if (!report.hasViolations) {
      core.info('');
      core.info('✅ All dependencies comply with the license policy.');
    }

  } catch (err) {
    core.setFailed(`License scan failed: ${err.message}\n${err.stack}`);
  }
}

async function postComment(body) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('GITHUB_TOKEN not set — skipping PR comment');
    return;
  }

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) return;

  try {
    const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    const prNumber = event.pull_request?.number;
    const repo = process.env.GITHUB_REPOSITORY;
    if (!prNumber || !repo) return;

    const url = `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`;
    const https = require('https');
    const payload = JSON.stringify({ body: `<!-- lce-report -->\n${body}` });

    await new Promise((resolve, reject) => {
      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'User-Agent': 'license-compliance-enforcer',
        },
      }, (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    console.log('✅ PR comment posted');
  } catch (err) {
    console.warn(`Could not post PR comment: ${err.message}`);
  }
}

run();
