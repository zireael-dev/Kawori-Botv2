const sharp = require('sharp')
const { downloadContentFromMessage } = require('@shennmine/baileys')

/* ===== DOWNLOAD IMAGE ===== */
async function getBuffer(message) {
    const stream = await downloadContentFromMessage(message, 'image')
    let buffer = Buffer.alloc(0)
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk])
    }
    return buffer
}

/* ===== TEXT SVG GENERATOR ===== */
function createTextSVG(text, position = 'top') {
    if (!text) return ''

    return `
    <svg width="512" height="512">
        <style>
            .meme {
                fill: white;
                stroke: black;
                stroke-width: 6;
                font-size: 48px;
                font-weight: 900;
                text-anchor: middle;
                font-family: Impact, "Arial Black", sans-serif;
            }
        </style>

        <text x="50%" y="${position === 'top' ? '10%' : '90%'}"
              dominant-baseline="middle"
              class="meme">
            ${text}
        </text>
    </svg>
    `
}

module.exports = {
    name: 'smeme',

    async onMessage(sock, msg) {
        try {
            const from = msg.key.remoteJid

            const text =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                ''

            if (!text || !text.startsWith('/smeme')) return

            /* ===== PARSE TEXT ===== */
            const input = text.slice(7).trim()
            let [top, bottom] = input.split('|').map(v => v?.trim().toUpperCase())

            if (!top && !bottom) {
                return sock.sendMessage(from, {
                    text: '❌ Format:\n/smeme atas | bawah'
                }, { quoted: msg })
            }

            /* ===== AMBIL GAMBAR ===== */
            let imageMessage =
                msg.message?.imageMessage ||
                msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage

            if (!imageMessage) {
                return sock.sendMessage(from, {
                    text: '❌ Kirim / reply gambar'
                }, { quoted: msg })
            }

            const buffer = await getBuffer(imageMessage)

            /* ===== RESIZE BASE ===== */
            let img = sharp(buffer).resize(512, 512, {
                fit: 'cover'
            })

            /* ===== COMPOSE TEXT ===== */
            const overlays = []

            if (top) {
                overlays.push({
                    input: Buffer.from(createTextSVG(top, 'top')),
                    top: 0,
                    left: 0
                })
            }

            if (bottom) {
                overlays.push({
                    input: Buffer.from(createTextSVG(bottom, 'bottom')),
                    top: 0,
                    left: 0
                })
            }

            const final = await img
                .composite(overlays)
                .webp()
                .toBuffer()

            /* ===== KIRIM STICKER ===== */
            await sock.sendMessage(from, {
                sticker: final
            }, { quoted: msg })

        } catch (err) {
            console.error('[SMEME ERROR]', err)
        }
    }
}
