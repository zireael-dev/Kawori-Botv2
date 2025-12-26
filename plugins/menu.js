const MENUS = require('../lib/menu')

const CATEGORY_EMOJI = {
    Downloader: '📥',
    Converter: '🔄',
    Utilities: '⚙️',
    Lainnya: '📦'
}

module.exports = {
    name: 'menu',

    async onMessage(sock, msg) {
        const from = msg.key.remoteJid
        const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        ''

        /* === OPEN MENU === */
        if (text === '/menu') {
            const grouped = {}

            // group by category
            for (const m of MENUS) {
                const cat = m.category || 'Lainnya'
                if (!grouped[cat]) grouped[cat] = []
                    grouped[cat].push(m)
            }

            // build sections
            const sections = Object.keys(grouped).map(cat => ({
                title: `${CATEGORY_EMOJI[cat] || '📦'} ${cat}`,
                rows: grouped[cat].map(m => ({
                    title: m.title,
                    description: m.desc,
                    id: m.id
                }))
            }))

            return sock.sendMessage(from, {
                interactiveMessage: {
                    title: '📜 Kawori-Bot v2 Menu',
                    footer: '⫷ ᴋᴀᴡᴏʀɪ-ʙᴏᴛ ʙʏ ᴢɪʀᴇᴀᴇʟ ⫸',
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({
                                    title: '📜 Menu Utama 📜',
                                    sections
                                })
                            }
                        ]
                    }
                }
            }, { quoted: msg })
        }

        /* === HANDLE CLICK === */
        const params =
        msg.message?.interactiveResponseMessage
        ?.nativeFlowResponseMessage
        ?.paramsJson

        if (!params) return

            let parsed
            try {
                parsed = JSON.parse(params)
            } catch {
                return
            }

            const menu = MENUS.find(m => m.id === parsed.id)
            if (!menu) return

                await sock.sendMessage(from, {
                    text: menu.reply
                }, { quoted: msg })
    }
}
