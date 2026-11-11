const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// permite fazer require() de modelos .tflite
config.resolver.assetExts.push('tflite')

module.exports = config
