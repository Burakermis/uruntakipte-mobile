// Expo SDK 58 needs Node >= 22.13. If the current Node is older (e.g. a stray
// system-wide Node 21), re-run the Expo CLI with an nvm-installed Node 22+.
// Works on any Node version, so `npm start` just works.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MIN = [22, 13, 0];
const parse = (v) => v.replace(/^v/, '').split('.').map(Number);
const gte = (a, b) => {
  for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  return true;
};

function findNode() {
  if (gte(parse(process.version), MIN)) return process.execPath;
  // Project-local Node 22 (devDependency 'node'): independent of the machine's setup.
  const local = path.join(__dirname, '..', 'node_modules', 'node', 'bin', process.platform === 'win32' ? 'node.exe' : 'node');
  if (fs.existsSync(local)) return local;
  const env = process.env;
  const roots = [
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Author Software', 'nvm', 'installs'),
    env.APPDATA && path.join(env.APPDATA, 'nvm'),
    env.NVM_HOME,
    env.NVM_DIR && path.join(env.NVM_DIR, 'versions', 'node'),
    path.join(require('os').homedir(), 'AppData', 'Local', 'Author Software', 'nvm', 'installs'),
  ].filter((r) => r && fs.existsSync(r));
  const exe = process.platform === 'win32' ? 'node.exe' : path.join('bin', 'node');
  const found = [];
  for (const root of roots) {
    for (const name of fs.readdirSync(root)) {
      if (!/^v\d+\.\d+\.\d+$/.test(name)) continue;
      const bin = path.join(root, name, exe);
      if (gte(parse(name), MIN) && fs.existsSync(bin)) found.push({ v: parse(name), bin });
    }
  }
  found.sort((a, b) => (gte(a.v, b.v) ? -1 : 1));
  return found.length ? found[0].bin : null;
}

const node = findNode();
if (!node) {
  console.error(`Node >= 22.13 gerekli (şu an ${process.version}). https://nodejs.org adresinden Node 22 LTS kurun.`);
  process.exit(1);
}
if (node !== process.execPath) console.log(`Node ${process.version} eski; Node 22 kullanılıyor: ${node}`);

const cli = require.resolve('expo/bin/cli', { paths: [process.cwd()] });
const args = process.argv.slice(2);
const r = spawnSync(node, [cli, 'start', ...args], { stdio: 'inherit', env: process.env });
process.exit(r.status === null ? 1 : r.status);
