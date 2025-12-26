const MENUS = require('../lib/menu')
const sendWithCover = require('../lib/sendWithCover')
const getGreeting = require('../lib/greeting')
const getWeather = require('../lib/weather')

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
        const sender = msg.key.participant || msg.key.remoteJid

        const text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            ''

        /* ================= OPEN MENU ================= */
        if (text === '/menu') {
            const name =
                msg.pushName ||
                sender.split('@')[0] ||
                'Kak'

            const greeting = getGreeting(name)

            const date = new Date().toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            })

            let weather = ''
            try {
                weather = await getWeather()
            } catch {}

            /* ===== GROUP MENU BY CATEGORY (WITH OWNER FILTER) ===== */
            const grouped = {}
            const isOwner = global.config.owner?.includes(
                sender.replace(/@.+/, '')
            )

            for (const m of MENUS) {
                if (m.category === 'OwnerZone' && !isOwner) continue

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

            const openingText = `
${greeting}

📅 *${date}*
${weather ? '\n' + weather : ''}

🤖 *${global.config.botName}* adalah bot WhatsApp multifungsi yang dapat membantu kamu mengunduh media, membuat sticker, membaca manga, dan kebutuhan lainnya langsung dari WhatsApp.

Silakan tekan tombol *Menu Utama* di bawah untuk mulai menggunakan bot.
            `.trim()

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

        /* ================= HANDLE MENU CLICK ================= */
        const params =
            msg.message?.interactiveResponseMessage
                ?.nativeFlowResponseMessage
                ?.paramsJson

        if (!params) return

        let parsed
        try {
            parsed = JSON.parse(params)
        } catch (e) {
            console.error('[MENU PARSE ERROR]', e)
            return
        }

        const selectedId = parsed.id || parsed.selectedRowId
        if (!selectedId) {
            console.error('[MENU] selectedId not found:', parsed)
            return
        }

        const menu = MENUS.find(m => m.id === selectedId)
        if (!menu) {
            console.error('[MENU] menu not found:', selectedId)
            return
        }

        await sock.sendMessage(from, {
            text: menu.reply
        }, { quoted: msg })
    }
}
