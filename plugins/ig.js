/**
 * plugins/ig.js
 * Instagram Downloader (photo, video, carousel)
 * Command: /ig [link]
 * npm install axios
 */

const axios = require('axios');

module.exports = {
    name: 'instagram',

    onMessage: async (sock, msg) => {
        try {
            const m = msg;
            const from = m.key.remoteJid;
            const body =
            m.message?.conversation ||
            m.message?.extendedTextMessage?.text ||
            m.message?.imageMessage?.caption ||
            m.message?.videoMessage?.caption ||
            '';

    if (!body) return;

    const args = body.trim().split(/\s+/);
            const command = args[0].toLowerCase();
            const link = args[1];

            if (command !== '/ig') return;

            if (!link || !/^https:\/\/(www\.)?instagram\.com/i.test(link)) {
                return sock.sendMessage(from, {
                    text: '❌ Kirim: /ig [link Instagram]\nContoh:\n/ig https://www.instagram.com/p/xxxx'
                }, { quoted: m });
            }

            // React proses
            await sock.sendMessage(from, {
                react: { text: '⏳', key: m.key }
            });

            // API KEY (ambil dari config kalau ada)
            const apiKey = global.config?.apiKey || 'UCIELL';

            let json;
            try {
                const apiUrl = `https://api.neoxr.eu/api/ig?url=${encodeURIComponent(link)}&apikey=${apiKey}`;
                const res = await axios.get(apiUrl);
                json = res.data;
            } catch (err) {
                console.error('[IG API ERROR]', err);
                return sock.sendMessage(from, {
                    text: '❌ Gagal memanggil API Instagram.'
                }, { quoted: m });
            }

            if (!json?.status || !Array.isArray(json.data) || !json.data.length) {
                return sock.sendMessage(from, {
                    text: '❌ Media tidak ditemukan (private / invalid / dihapus).'
                }, { quoted: m });
            }

            // Kirim media satu-satu (carousel friendly)
            for (const media of json.data) {
                try {
                    const file = await axios.get(media.url, {
                        responseType: 'arraybuffer'
                    });

                    if (media.type === 'mp4') {
                        await sock.sendMessage(from, {
                            video: Buffer.from(file.data),
                                               mimetype: 'video/mp4'
                        }, { quoted: m });
                    } else {
                        await sock.sendMessage(from, {
                            image: Buffer.from(file.data),
                                               mimetype: 'image/jpeg'
                        }, { quoted: m });
                    }

                    // delay biar WA aman
                    await new Promise(r => setTimeout(r, 1200));
                } catch (err) {
                    console.error('[IG SEND ERROR]', err);
                    await sock.sendMessage(from, {
                        text: `❌ Gagal upload ke WhatsApp.\nDownload manual:\n${media.url}`
                    }, { quoted: m });
                }
            }

            // React selesai
            await sock.sendMessage(from, {
                react: { text: '✅', key: m.key }
            });

        } catch (err) {
            console.error('[IG PLUGIN ERROR]', err);
        }
    }
};
