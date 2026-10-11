// Сборка демо-приложения «Smart Central Demo»: дом-выставка без входа, для показа.
// Берёт настройки обычной сборки и меняет имя, идентификатор и папку результата.
const base = require('./package.json').build;

module.exports = {
  ...base,
  appId: 'com.derklabautermann.smartcentral.demo',
  productName: 'Smart Central Demo',
  extraMetadata: { name: 'smart-central-demo', productName: 'Smart Central Demo' },
  directories: { output: 'release-demo' },
  mac: {
    ...base.mac,
    artifactName: 'Smart.Central.Demo.v${version}-${arch}.${ext}',
    // Без локализованных названий: иначе Finder показывал бы «Smart Central» без «Demo»
    extraResources: [],
    extendInfo: { ...base.mac.extendInfo, CFBundleDisplayName: 'Smart Central Demo', LSHasLocalizedDisplayName: false },
  },
  dmg: { ...base.dmg, title: 'Smart Central Demo' },
  win: { ...base.win, artifactName: 'Smart.Central.Demo.Setup.v${version}.${ext}' },
};
