/**
 * JS entry for Expo config so `scheme` is always visible to expo-linking / Constants
 * (avoids stale "scheme left blank" warnings when Metro caches config).
 */
const { expo } = require('./app.json');
const withAdiRegistration = require('./plugins/with-adi-registration');

module.exports = {
  expo: {
    ...expo,
    scheme: 'chefai',
    plugins: [...(expo.plugins || []), withAdiRegistration],
  },
};
