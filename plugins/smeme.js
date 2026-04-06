const sharp = require('sharp')
const fs = require('fs')
const path = require('path')
const { downloadContentFromMessage } = require('@shennmine/baileys')

/* ===== LOAD FONT BASE64 ===== */
const fontPath = path.join(__dirname, '..', 'assets', 'fonts', 'FuturaCondensedExtraBold.otf')
const fontBase64 = fs.readFileSync(fontPath).toString('base64')

/* ===== DOWNLOAD IMAGE ===== */
async function getBuffer(message) {
    const stream = await downloadContentFromMessage(message, 'image')
    let buffer = Buffer.alloc(0)
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk])
    }
    return buffer
}

/* ===== AUTO WRAP TEXT ===== */
function wrapText(text, maxChars = 15) {
    const words = text.split(' ')
    let lines = []
    let current = ''

    for (const word of words) {
        if ((current + word).length > maxChars) {
            lines.push(current.trim())
            current = word + ' '
        } else {
            current += word + ' '
        }
    }

    if (current) lines.push(current.trim())
    return lines
}

/* ===== SVG TEXT ===== */
function createTextSVG(text, position = 'top') {
    if (!text) return ''

    const lines = wrapText(text)
    const lineHeight = 60

    let yStart = position === 'top' ? 60 : 512 - (lines.length * lineHeight)

    let textElements = lines.map((line, i) => {
        return `<text x="50%" y="${yStart + i * lineHeight}" class="meme">${line}</text>`
    }).join('\n')

    return `
    <svg width="512" height="512">
        <defs>
            <style>
                @font-face {
                    font-family: 'FuturaCondensed';
                    src: url(data:font/otf;base64,${fontBase64});
                }

                .meme {
                    fill: white;
                    stroke: black;
                    stroke-width: 10;
                    paint-order: stroke fill;
                    font-size: 60px;
                    font-weight: bold;
                    text-anchor: middle;
                    font-family: 'FuturaCondensed';
                    letter-spacing: 2px;
                }
            </style>
        </defs>

        ${textElements}
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

            /* ===== PARSE ===== */
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
                    text: '❌ Kirim atau reply gambar'
                }, { quoted: msg })
            }

            const buffer = await getBuffer(imageMessage)

            /* ===== BASE IMAGE ===== */
            let img = sharp(buffer).resize(512, 512, {
                fit: 'cover'
            })

            /* ===== TEXT LAYER ===== */
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

            /* ===== SEND ===== */
            await sock.sendMessage(from, {
                sticker: final
            }, { quoted: msg })

        } catch (err) {
            console.error('[SMEME ERROR]', err)
        }
    }
}
