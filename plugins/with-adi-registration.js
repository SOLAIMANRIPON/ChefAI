const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Google Play "Sign and upload an APK" (package name verification) requires
 * android/app/src/main/assets/adi-registration.properties inside the signed APK.
 * Copy the Snippet from Play Console into ./adi-registration.properties (see .example).
 */
function withAdiRegistration(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const srcFile = path.join(projectRoot, 'adi-registration.properties');
      let snippet = (process.env.GOOGLE_PLAY_ADI_REGISTRATION_SNIPPET || '').trim();
      if (!snippet && fs.existsSync(srcFile)) {
        snippet = fs.readFileSync(srcFile, 'utf8').trim();
      }
      if (!snippet || snippet.includes('PASTE_')) {
        throw new Error(
          'Play package verification: create adi-registration.properties at the project root ' +
            'with the Snippet from Play Console (Android developer verification → Copy), ' +
            'or set GOOGLE_PLAY_ADI_REGISTRATION_SNIPPET for EAS Build.'
        );
      }
      const assetsDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'assets');
      fs.mkdirSync(assetsDir, { recursive: true });
      fs.writeFileSync(path.join(assetsDir, 'adi-registration.properties'), `${snippet}\n`, 'utf8');
      return cfg;
    },
  ]);
}

module.exports = withAdiRegistration;
