console.clear()
console.log('🚀 Starting KaworiBot v2...')

process.on('uncaughtException', err => {
    console.error('[UNCAUGHT EXCEPTION]', err)
})
process.on('unhandledRejection', err => {
    console.error('[UNHANDLED REJECTION]', err)
})

const fs = require('fs')
const path = require('path')
const pino = require('pino')
const readline = require('readline')

const {
    default: makeWASocket,
        useMultiFileAuthState,
        fetchLatestBaileysVersion,
        makeInMemoryStore,
        DisconnectReason
} = require('@shennmine/baileys')

/* ===== GLOBAL CONFIG ===== */
global.config = require('./settings/config')

const loadPlugins = require('./plugins/_loader')
const logger = pino({ level: 'trace' })

/* ===== CLI INPUT ===== */
const question = (text) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })
    return new Promise(resolve => {
        rl.question(text, ans => {
            rl.close()
            resolve(ans.trim())
        })
    })
}

async function start() {
    const sessionPath = path.join(__dirname, global.config.sessionName || 'kawori-session')
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true })
    }

    const store = makeInMemoryStore({ logger })
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        logger,
        auth: state,
        version,
        browser: ['KaworiBot', 'Chrome', '1.0.0'],
        printQRInTerminal: true
    })


    store.bind(sock.ev)
    sock.ev.on('creds.update', saveCreds)

    /* ===== LOAD PLUGINS ===== */
    const plugins = loadPlugins()
    console.log(`📦 Loaded ${plugins.length} plugins`)

    /* ===== MESSAGE HANDLER ===== */
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return
            const msg = messages[0]
            if (!msg?.message) return
            await sock.readMessages([msg.key])
            const from = msg.key.remoteJid

                /* ====================================================== */

                for (const plugin of plugins) {
                    if (typeof plugin?.onMessage !== 'function') {
                        console.error('❌ Invalid plugin:', plugin)
                        continue
                    }

                    try {
                        await plugin.onMessage(sock, msg, store)
                    } catch (err) {
                        console.error(`🔥 Plugin error [${plugin.name || 'unknown'}]`)
                        console.error(err)
                    }
                }

    })

    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode
            if (reason !== DisconnectReason.loggedOut) {
                console.log('🔄 Reconnecting...')
                start()
            }
        }

        if (connection === 'open') {
            console.log('✅ KaworiBot connected')
        }
    })
}

start()
