/**
 * plugins/youtube.js
 * Features:
 * - /yt <query> (search + interactive)
 * - /ytmp3 <url>
 * - /ytmp4 <url>
 * Uses Neoxr API
 */

const axios = require('axios')
const { checkLimit } = require('../lib/limit')

/* ===== SESSION MEMORY ===== */
global.db = global.db || {}
global.db.ytSession = global.db.ytSession || {}

module.exports = {
    name: 'youtube',

    // ===== MENU REGISTRY =====
    menu: {
        id: 'menu_youtube',
        title: 'YouTube Downloader',
        desc: 'Cari & download video YouTube (MP3 / MP4)',
        category: 'Downloader'
    },

    async onMessage(sock, msg) {
        const from = msg.key.remoteJid
        const name = msg.pushName || 'User'

        const text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            ''

        /* =========================
           HANDLE INTERACTIVE CLICK
        ========================== */
        const params =
            msg.message?.interactiveResponseMessage
                ?.nativeFlowResponseMessage
                ?.paramsJson

        if (params) {
            let parsed
            try {
                parsed = JSON.parse(params)
            } catch {
                return
            }

            const id = parsed.id
            const session = global.db.ytSession[from]
            if (!session) return

            /* ===== VIDEO SELECTED ===== */
            if (id.startsWith('yt_select_')) {
                const index = parseInt(id.split('_')[2])
                const video = session.results[index]
                if (!video) return

                session.selected = video

                return sock.sendMessage(from, {
                    interactiveMessage: {
                        title: '🎬 Pilih Format',
                        footer: video.title,
                        nativeFlowMessage: {
                            buttons: [
                                {
                                    name: 'single_select',
                                    buttonParamsJson: JSON.stringify({
                                        title: 'Pilih Format',
                                        sections: [
                                            {
                                                title: 'Audio',
                                                rows: [
                                                    {
                                                        title: '🎵 MP3 128kbps',
                                                        description: 'Download audio',
                                                        id: `yt_audio`
                                                    }
                                                ]
                                            },
                                            {
                                                title: 'Video',
                                                rows: [
                                                    {
                                                        title: '🎬 MP4 360p',
                                                        description: 'Resolusi rendah',
                                                        id: `yt_video_360`
                                                    },
                                                    {
                                                        title: '🎬 MP4 720p',
                                                        description: 'HD',
                                                        id: `yt_video_720`
                                                    }
                                                ]
                                            }
                                        ]
                                    })
                                }
                            ]
                        }
                    }
                }, { quoted: msg })
            }

            /* ===== FORMAT SELECTED ===== */
            if (id.startsWith('yt_audio') || id.startsWith('yt_video')) {
                const session = global.db.ytSession[from]
                if (!session?.selected) return

                /* ===== CHECK LIMIT ===== */
                const limitCheck = checkLimit(from, name)
                if (!limitCheck.ok) {
                    return sock.sendMessage(from, {
                        text: `❌ Limit harian habis

📊 ${limitCheck.user.used}/${limitCheck.user.limit}
💎 Premium = Unlimited`
                    }, { quoted: msg })
                }

                const apiKey = global.config?.api?.neoxr
                const video = session.selected

                let apiUrl
                let caption
                let sendType = 'video'

                if (id === 'yt_audio') {
                    apiUrl =
                        `https://api.neoxr.eu/api/youtube?url=${encodeURIComponent(video.url)}&type=audio&quality=128kbps&apikey=${apiKey}`
                    sendType = 'audio'
                    caption = `🎵 ${video.title}`
                } else {
                    const quality = id.endsWith('720') ? '720p' : '360p'
                    apiUrl =
                        `https://api.neoxr.eu/api/youtube?url=${encodeURIComponent(video.url)}&type=video&quality=${quality}&apikey=${apiKey}`
                    caption = `🎬 ${video.title} (${quality})`
                }

                await sock.sendMessage(from, {
                    react: { text: '⏳', key: msg.key }
                })

                try {
                    const { data } = await axios.get(apiUrl)
                    if (!data?.status || !data?.data?.url) {
                        throw 'Invalid response'
                    }

                    const media = await axios.get(data.data.url, {
                        responseType: 'arraybuffer'
                    })

                    if (sendType === 'audio') {
                        await sock.sendMessage(from, {
                            audio: Buffer.from(media.data),
                            mimetype: 'audio/mpeg',
                            fileName: `${video.title}.mp3`
                        }, { quoted: msg })
                    } else {
                        await sock.sendMessage(from, {
                            video: Buffer.from(media.data),
                            mimetype: 'video/mp4',
                            caption
                        }, { quoted: msg })
                    }

                    await sock.sendMessage(from, {
                        react: { text: '✅', key: msg.key }
                    })

                    delete global.db.ytSession[from]
                } catch (e) {
                    console.error('[YOUTUBE DOWNLOAD ERROR]', e)
                    await sock.sendMessage(from, {
                        text: `❌ Gagal upload\n\nLink:\n${video.url}`
                    }, { quoted: msg })
                }
            }

            return
        }

        /* =========================
           TEXT COMMAND HANDLER
        ========================== */

        if (!text) return
        const args = text.trim().split(/\s+/)
        const command = args[0].toLowerCase()

        /* ===== DIRECT MP3 / MP4 ===== */
        if (command === '/ytmp3' || command === '/ytmp4') {
            const url = args[1]
            if (!url || !/youtube\.com|youtu\.be/i.test(url)) {
                return sock.sendMessage(from, {
                    text: '❌ Contoh:\n/ytmp3 https://youtube.com/watch?v=xxxx'
                }, { quoted: msg })
            }

            const limitCheck = checkLimit(from, name)
            if (!limitCheck.ok) {
                return sock.sendMessage(from, {
                    text: `❌ Limit harian habis`
                }, { quoted: msg })
            }

            const apiKey = global.config?.api?.neoxr
            const type = command === '/ytmp3' ? 'audio' : 'video'
            const quality = type === 'audio' ? '128kbps' : '720p'

            await sock.sendMessage(from, {
                react: { text: '⏳', key: msg.key }
            })

            try {
                const apiUrl =
                    `https://api.neoxr.eu/api/youtube?url=${encodeURIComponent(url)}&type=${type}&quality=${quality}&apikey=${apiKey}`
                const { data } = await axios.get(apiUrl)

                const media = await axios.get(data.data.url, {
                    responseType: 'arraybuffer'
                })

                if (type === 'audio') {
                    await sock.sendMessage(from, {
                        audio: Buffer.from(media.data),
                        mimetype: 'audio/mpeg'
                    }, { quoted: msg })
                } else {
                    await sock.sendMessage(from, {
                        video: Buffer.from(media.data),
                        mimetype: 'video/mp4'
                    }, { quoted: msg })
                }

                await sock.sendMessage(from, {
                    react: { text: '✅', key: msg.key }
                })
            } catch (e) {
                console.error('[YTMP DIRECT ERROR]', e)
                await sock.sendMessage(from, {
                    text: '❌ Gagal download YouTube'
                }, { quoted: msg })
            }

            return
        }

        /* ===== SEARCH ===== */
        if (command === '/yt') {
            const query = args.slice(1).join(' ')
            if (!query) {
                return sock.sendMessage(from, {
                    text: '❌ Contoh:\n/yt parachute'
                }, { quoted: msg })
            }

            const apiKey = global.config?.api?.neoxr

            await sock.sendMessage(from, {
                react: { text: '🔎', key: msg.key }
            })

            try {
                const apiUrl =
                    `https://api.neoxr.eu/api/yts?q=${encodeURIComponent(query)}&apikey=${apiKey}`
                const { data } = await axios.get(apiUrl)

                if (!data?.status || !data?.data?.length) {
                    return sock.sendMessage(from, {
                        text: '❌ Video tidak ditemukan'
                    }, { quoted: msg })
                }

                const results = data.data.slice(0, 5)
                global.db.ytSession[from] = { results }

                return sock.sendMessage(from, {
                    interactiveMessage: {
                        title: '🔎 Hasil Pencarian YouTube',
                        footer: `Query: ${query}`,
                        nativeFlowMessage: {
                            buttons: [
                                {
                                    name: 'single_select',
                                    buttonParamsJson: JSON.stringify({
                                        title: 'Pilih Video',
                                        sections: [
                                            {
                                                title: 'Hasil',
                                                rows: results.map((v, i) => ({
                                                    title: v.title,
                                                    description: `${v.channel} • ${v.duration}`,
                                                    id: `yt_select_${i}`
                                                }))
                                            }
                                        ]
                                    })
                                }
                            ]
                        }
                    }
                }, { quoted: msg })
            } catch (e) {
                console.error('[YT SEARCH ERROR]', e)
                await sock.sendMessage(from, {
                    text: '❌ Gagal mencari YouTube'
                }, { quoted: msg })
            }
        }
    }
}
