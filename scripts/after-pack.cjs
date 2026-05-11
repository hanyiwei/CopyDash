// electron-builder afterPack hook — runs rcedit to embed the icon into the exe.
// This works around electron-builder's internal rcedit failing when winCodeSign
// can't be downloaded (e.g. behind a firewall / no proxy).
const { execSync } = require('child_process');
const path = require('path');

module.exports = async function (context) {
  if (context.electronPlatformName !== 'win32') return;

  const rcedit = path.join(__dirname, '..', 'node_modules', 'rcedit', 'bin', 'rcedit.exe');
  const ico = path.join(__dirname, '..', 'resources', 'icon.ico');
  const exe = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.exe');

  try {
    execSync(`"${rcedit}" "${exe}" --set-icon "${ico}"`, { stdio: 'inherit' });
    console.log('[afterPack] Icon applied to', exe);
  } catch (err) {
    console.error('[afterPack] rcedit failed:', err.message);
    // Don't fail the build — let electron-builder continue with whatever icon is there
  }
};
