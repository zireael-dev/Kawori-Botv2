const { downloadContentFromMessage } = require('@shennmine/baileys')

module.exports = {
    name: 'bukti',

    async onMessage(sock, msg) {
        try {
            const from = msg.key.remoteJid
            const sender = msg.key.participant || msg.key.remoteJid
            const number = sender.split('@')[0]

            const text =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                ''

            if (!text || !text.toLowerCase().startsWith('/bukti')) return

            const paket = text.match(/paket=(\d+)/)?.[1]
            if (!paket) return

            let imageMessage =
                msg.message?.imageMessage ||
                msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage

            if (!imageMessage) return

            // download
            const stream = await downloadContentFromMessage(imageMessage, 'image')
            let buffer = Buffer.alloc(0)

            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk])
            }

            // kirim ke owner
            for (const owner of global.config.owner) {
                await sock.sendMessage(owner + '@s.whatsapp.net', {
                    image: buffer,
                    caption: `Bukti dari ${number}, paket ${paket}`
                })
            }

            await sock.sendMessage(from, {
                text: '✅ Bukti terkirim'
            })

        } catch (err) {
            console.error('[BUKTI ERROR]', err)
        }
    }
}
