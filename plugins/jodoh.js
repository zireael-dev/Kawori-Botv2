module.exports = {
    name: 'jodoh',

    async onMessage(sock, msg, store) {
        try {
            const from = msg.key.remoteJid

            const text =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                ''

            if (!text) return

            const command = text.toLowerCase().split(' ')[0]
            const triggers = ['/jodoh', '/couple', '/partner']

            if (!triggers.includes(command)) return

            // HARUS DI GROUP
            if (!from.endsWith('@g.us')) {
                return sock.sendMessage(from, {
                    text: '❌ Fitur ini hanya bisa digunakan di grup!'
                }, { quoted: msg })
            }

            // AMBIL MEMBER GROUP
            const metadata = await sock.groupMetadata(from)
            const members = metadata.participants
                .map(v => v.id)
                .filter(v => !v.includes('status')) // filter aneh

            if (members.length < 2) {
                return sock.sendMessage(from, {
                    text: '❌ Member tidak cukup untuk dijodohkan 😔'
                }, { quoted: msg })
            }

            // RANDOM 2 USER
            const pickRandom = () => members[Math.floor(Math.random() * members.length)]

            let user1 = pickRandom()
            let user2 = pickRandom()

            // biar ga sama
            while (user1 === user2) {
                user2 = pickRandom()
            }

            const percent = Math.floor(Math.random() * 101)

            /* ===== VARIATION DATA ===== */

            const insights = [
                'Hubungan ini penuh chemistry yang tidak terduga.',
                'Kalian punya potensi besar tapi butuh usaha.',
                'Vibes kalian nyambung tapi sering beda timing.',
                'Hubungan ini unik dan sulit ditebak.',
                'Koneksi kalian terasa natural dan kuat.'
            ]

            const pros = [
                ['Saling pengertian', 'Komunikasi lancar', 'Chemistry kuat'],
                ['Humor nyambung', 'Saling support', 'Nyaman satu sama lain'],
                ['Bisa jadi partner solid', 'Setia', 'Saling melengkapi'],
                ['Energi positif', 'Jarang konflik', 'Vibes cocok']
            ]

            const cons = [
                ['Ego tinggi', 'Mood swing', 'Overthinking'],
                ['Cemburuan', 'Kurang komunikasi', 'Salah paham'],
                ['Baperan', 'Gengsi tinggi', 'Susah jujur'],
                ['Terlalu santai', 'Kurang effort', 'Ambigu']
            ]

            const predictions = [
                'Hubungan ini bisa berkembang jadi serius 👀',
                'Berpotensi jadi cerita cinta yang panjang.',
                'Akan banyak drama tapi tetap bertahan.',
                'Bisa jadi best couple di grup ini 😎',
                'Butuh banyak kesabaran untuk bertahan.'
            ]

            const openings = [
                '💘 *KAWORI MATCHMAKING*',
                '💞 *LOVE DETECTOR AKTIF*',
                '💖 *COUPLE SCANNER RESULT*',
                '💓 *HASIL JODOH TERPILIH*',
                '💕 *LOVE ANALYZER*'
            ]

            const tiers = (p) => {
                if (p <= 30) return '💀 Toxic banget, mending temenan aja'
                if (p <= 50) return '😬 Hubungan agak maksa'
                if (p <= 70) return '🙂 Lumayan cocok'
                if (p <= 90) return '😍 Cocok banget ini!'
                return '💍 FIX JODOH INI MAH'
            }

            const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)]

            const selectedInsight = randomPick(insights)
            const selectedPros = randomPick(pros)
            const selectedCons = randomPick(cons)
            const selectedPrediction = randomPick(predictions)
            const title = randomPick(openings)

            /* ===== BUILD MESSAGE ===== */

            const result = `
${title}

@${user1.split('@')[0]} ❤️ @${user2.split('@')[0]}

💞 *Kecocokan:* ${percent}%
${tiers(percent)}

🧠 *Insight:*
${selectedInsight}

👍 *Kelebihan:*
• ${selectedPros.join('\n• ')}

👎 *Kekurangan:*
• ${selectedCons.join('\n• ')}

🔮 *Prediksi:*
${selectedPrediction}

🙏 Doakan mereka ya guys 😆
            `.trim()

            await sock.sendMessage(from, {
                text: result,
                mentions: [user1, user2]
            }, { quoted: msg })

        } catch (err) {
            console.error('[JODOH ERROR]', err)
        }
    }
}
