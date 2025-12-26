/**
 * plugins/sticker.js
 * Command: /s /sticker /stiker /stick
 * Support: reply image/video atau caption
 */

const { Sticker, StickerTypes } = require('wa-sticker-formatter')
const { downloadContentFromMessage } = require('@shennmine/baileys')

module.exports = {
    name: 'sticker',

    async onMessage(sock, m) {
        const from = m.key.remoteJid

        const text =
        m.message?.conversation ||
        m.message?.extendedTextMessage?.text ||
        m.message?.imageMessage?.caption ||
        m.message?.videoMessage?.caption ||
        ''

        if (!text) return

            const command = text.split(' ')[0].toLowerCase()
            const triggers = ['/s', '/sticker', '/stiker', '/stick']
            if (!triggers.includes(command)) return

                // ambil media (reply / direct)
                const ctx = m.message?.extendedTextMessage?.contextInfo
                const quoted = ctx?.quotedMessage

                let media, type

                if (quoted?.imageMessage) {
                    media = quoted.imageMessage
                    type = 'image'
                } else if (quoted?.videoMessage) {
                    media = quoted.videoMessage
                    type = 'video'
                } else if (m.message?.imageMessage) {
                    media = m.message.imageMessage
                    type = 'image'
                } else if (m.message?.videoMessage) {
                    media = m.message.videoMessage
                    type = 'video'
                } else {
                    return sock.sendMessage(
                        from,
                        { text: '❌ Kirim atau reply gambar/video dengan /sticker' },
                        { quoted: m }
                    )
                }

                // download media
                let buffer = Buffer.alloc(0)
                try {
                    const stream = await downloadContentFromMessage(media, type)
                    for await (const chunk of stream) {
                        buffer = Buffer.concat([buffer, chunk])
                    }
                } catch (err) {
                    console.error('[STICKER] download error', err)
                    return sock.sendMessage(from, { text: '❌ Gagal download media' }, { quoted: m })
                }

                const pack = global.config?.sticker?.packname || 'KaworiBot'
                const author = global.config?.sticker?.author || 'Yusril'

                try {
                    const sticker = new Sticker(buffer, {
                        pack,
                        author,
                        type: type === 'image' ? StickerTypes.FULL : StickerTypes.CROPPED,
                        quality: 80
                    })

                    const result = await sticker.toBuffer()
                    await sock.sendMessage(from, { sticker: result }, { quoted: m })
                } catch (err) {
                    console.error('[STICKER] build error', err)
                    await sock.sendMessage(from, { text: '❌ Gagal membuat stiker' }, { quoted: m })
                }
    }
}
