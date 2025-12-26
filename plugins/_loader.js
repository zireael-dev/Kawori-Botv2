const fs = require('fs')
const path = require('path')

module.exports = function loadPlugins() {
    const pluginsDir = path.join(__dirname)
    const files = fs.readdirSync(pluginsDir)

    const plugins = []

    for (const file of files) {
        if (file === '_loader.js') continue
            if (!file.endsWith('.js')) continue

                const fullPath = path.join(pluginsDir, file)

                try {
                    delete require.cache[require.resolve(fullPath)]
                    const plugin = require(fullPath)

                    // VALIDASI OBJECT PLUGIN
                    if (
                        typeof plugin !== 'object' ||
                        typeof plugin.onMessage !== 'function' ||
                        !plugin.name
                    ) {
                        console.log(`❌ Invalid plugin structure: ${file}`)
                        continue
                    }

                    plugins.push(plugin)
                } catch (err) {
                    console.log(`❌ Failed loading plugin: ${file}`)
                    console.error(err)
                }
    }

    return plugins
}
