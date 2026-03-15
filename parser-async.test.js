'use strict';

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const PipEcosystem = require('./pip');
const CargoEcosystem = require('./cargo');

describe('parser improvements', () => {
  test('pip parser handles extras and markers', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'lce-pip-'));
    const req = path.join(tmp, 'requirements.txt');
    await fs.writeFile(req, "requests[socks]>=2.0 ; python_version > '3.8'\npytest==8.2.0\n", 'utf8');

    const eco = new PipEcosystem({ dir: tmp });
    const manifests = await eco.findManifests();
    expect(manifests).toEqual([req]);

    const pkgs = await eco.parseManifest(req);
    expect(pkgs.find((p) => p.name === 'requests')).toBeTruthy();
    expect(pkgs.find((p) => p.name === 'pytest')?.version).toBe('8.2.0');
  });

  test('cargo parser handles inline table dependency version', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'lce-cargo-'));
    const manifest = path.join(tmp, 'Cargo.toml');
    await fs.writeFile(manifest, '[dependencies]\nserde = { version = "1.0", features = ["derive"] }\n', 'utf8');

    const eco = new CargoEcosystem({ dir: tmp });
    const pkgs = await eco.parseManifest(manifest);
    const serde = pkgs.find((p) => p.name === 'serde');
    expect(serde).toBeTruthy();
    expect(serde.version).toBe('1.0');
  });
});
