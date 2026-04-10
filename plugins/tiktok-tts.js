const { config, createAudioFromText } = require('tiktok-tts')
const translate = require('google-translate-api-x')
const fs = require('fs')
const path = require('path')

// Masukkan sessionid TikTok kamu di sini
config('a7208223c705b88d269d6cdca5745b7d')

// Mapping canggih: Menyimpan ID Speaker TikTok sekaligus Target Bahasa Translator
const voiceMap = {
    'id':  { speaker: 'id_001', lang: 'id' },                 // Indonesia
    'en':  { speaker: 'en_us_001', lang: 'en' },              // Inggris (Cewek)
    'enc': { speaker: 'en_male_narration', lang: 'en' },      // Inggris (Cowok)
    'jp':  { speaker: 'jp_001', lang: 'ja' },                 // Jepang (Cewek) -> Google Translate pakai 'ja'
    'jpc': { speaker: 'jp_male_keiichinakano', lang: 'ja' },  // Jepang (Cowok)
    'kr':  { speaker: 'kr_003', lang: 'ko' },                 // Korea (Cewek) -> Google Translate pakai 'ko'
    'br':  { speaker: 'br_001', lang: 'pt' },                 // Brazil/Portugis
    'es':  { speaker: 'es_002', lang: 'es' }                  // Spanyol
}

module.exports = {
    name: 'tiktok-tts-auto-translate',
    onMessage: async (sock, msg, store) => {
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ""
        const [command, ...args] = text.split(' ')

        if (!command.match(/^[.!/](tts|suara)$/i)) return

        const from = msg.key.remoteJid

        if (args.length === 0) {
            return sock.sendMessage(from, { 
                text: `*Cara Penggunaan:*\n.tts [kode_suara] [teks]\n\n*Contoh Auto-Translate:*\n.tts jp Halo, apa kabar? \n_(Bot akan mentranslate ke Jepang lalu membaca teksnya)_\n\n*Daftar Kode:*\n- id, en, enc, jp, jpc, kr, br, es` 
            }, { quoted: msg })
        }

        let targetSpeaker = 'id_001' // Default suara
        let targetLang = 'id'        // Default bahasa
        let textToSpeak = args.join(' ')

        // Mengecek apakah ada kode di awal kata
        const firstWord = args[0].toLowerCase()
        if (voiceMap[firstWord]) {
            targetSpeaker = voiceMap[firstWord].speaker
            targetLang = voiceMap[firstWord].lang
            textToSpeak = args.slice(1).join(' ') // Teks sisa yang akan di-translate
        }

        if (!textToSpeak.trim()) {
            return sock.sendMessage(from, { 
                text: 'Teksnya mana yang mau dibacakan?' 
            }, { quoted: msg })
        }

        try {
            // PROSES 1: Auto-Translate (Jika target bahasanya BUKAN Indonesia)
            let finalTTSString = textToSpeak
            
            // Google Translate otomatis mendeteksi bahasa asal, jadi kita cuma perlu set 'to' (bahasa tujuan)
            if (targetLang !== 'id') {
                const res = await translate(textToSpeak, { to: targetLang })
                finalTTSString = res.text
                console.log(`[TTS] Translated: "${textToSpeak}" -> "${finalTTSString}"`)
            }

            // PROSES 2: Generate Audio TikTok
            const fileName = `tts_${Date.now()}`
            const filePathNoExt = path.join(__dirname, fileName) 
            const filePathFull = `${filePathNoExt}.mp3`

            // Generate suara menggunakan teks yang SUDAH DITRANSLATE
            await createAudioFromText(finalTTSString, filePathNoExt, targetSpeaker)

            // Kirim Audio ke WhatsApp
            await sock.sendMessage(from, { 
                audio: { url: filePathFull }, 
                mimetype: 'audio/mp4', 
                ptt: true 
            }, { quoted: msg })

            // Bersihkan file lokal setelah terkirim
            if (fs.existsSync(filePathFull)) {
                fs.unlinkSync(filePathFull)
            }

        } catch (error) {
            console.error('🔥 Error TTS / Translate:', error)
            await sock.sendMessage(from, { 
                text: 'Gagal memproses suara. Pastikan teks tidak terlalu panjang, atau Session ID TikTok kamu masih aktif.' 
            }, { quoted: msg })
        }
    }
}
