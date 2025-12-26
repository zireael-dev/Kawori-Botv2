const MENUS = require('../lib/menu')
const sendWithCover = require('../lib/sendWithCover')
const getGreeting = require('../lib/greeting')
const getWeather = require('../lib/weather') // ⬅️ TAMBAHAN

const CATEGORY_EMOJI = {
    Downloader: '📥',
    Converter: '🔄',
    Utilities: '⚙️',
    Animanga: '⛩️',
    OwnerZone: '🔐',
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
        if (text !== '/menu') return

        // ===== USER NAME =====
        const name =
            msg.pushName ||
            msg.key.participant?.split('@')[0] ||
            'Kak'

        // ===== GREETING =====
        const greeting = getGreeting(name)

        // ===== DATE =====
        const date = new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })

        // ===== WEATHER (SAFE) =====
        let weather = ''
        try {
            weather = await getWeather()
        } catch {
            weather = ''
        }

        // ===== GROUP MENU BY CATEGORY =====
        const grouped = {}
        for (const m of MENUS) {
            const cat = m.category || 'Lainnya'
            if (!grouped[cat]) grouped[cat] = []
            grouped[cat].push(m)
        }

        const sections = Object.keys(grouped).map(cat => ({
            title: `${CATEGORY_EMOJI[cat] || '📦'} ${cat}`,
            rows: grouped[cat].map(m => ({
                title: m.title,
                description: m.desc,
                id: m.id
            }))
        }))

        // ===== OPENING TEXT =====
        const openingText = `
${greeting}

📅 *${date}*
${weather ? '\n' + weather : ''}

🤖 *${global.config.botName}* adalah bot WhatsApp multifungsi yang dapat membantu kamu mengunduh media, mengelola fitur, dan kebutuhan lainnya langsung dari WhatsApp.

Silakan tekan tombol *Menu Utama* di bawah untuk mulai menggunakan bot.
`.trim()

        // ===== SEND MENU WITH COVER =====
        await sendWithCover(
            sock,
            from,
            openingText,
            {
                title: global.config.botName,
                body: 'WhatsApp Automation Bot',
                quoted: msg
            }
        )

        // ===== SEND INTERACTIVE MENU =====
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
}
