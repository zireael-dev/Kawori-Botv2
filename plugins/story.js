const cohereApiKey = '9h0Ia5qSQpS9YHYJIunYc7G1ANbJqbFqnlpARpaf'
const cohereUrl = 'https://api.cohere.com/compatibility/v1/chat/completions/'

const userSessions = {}

// Fungsi bantuan untuk memastikan teks balasan AI bisa dibaca sebagai JSON
function extractJSON(text) {
    try {
        const match = text.match(/\{[\s\S]*\}/)
        if (match) return JSON.parse(match[0])
        return null
    } catch (e) { return null }
}

module.exports = {
    name: 'cohere-interactive-story',
    onMessage: async (sock, msg, store) => {
        let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ""
        let isFromButton = false
        
        // Menangkap balasan dari tombol Interactive
        if (msg.message?.interactiveResponseMessage) {
            try {
                const params = JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson)
                text = params.id 
                isFromButton = true
            } catch (e) {
                console.error("Gagal membaca respons tombol", e)
            }
        }

        const [command, ...args] = text.split(' ')
        const from = msg.key.remoteJid

        // Mengakhiri Sesi
        if (text.toLowerCase() === '.story reset') {
            if (userSessions[from]) {
                delete userSessions[from]
                return sock.sendMessage(from, { text: '🔄 _Sesi permainan diakhiri. Ketik .story untuk mulai baru._' }, { quoted: msg })
            }
            return
        }

        // TAHAP 1: MENU PILIH DUNIA (Tombol List)
        if (!userSessions[from] && command.match(/^[.!/](story|main)$/i)) {
            userSessions[from] = { state: 'PILIH_GENRE', genre: '', mcName: '', history: [], lastChoices: [] }

            return sock.sendMessage(from, {    
                interactiveMessage: {      
                    body: { text: "*✨ KAWORIBOT ROLEPLAY ✨*\n\nPilih dunia tempat ceritamu dimulai!" },
                    nativeFlowMessage: {        
                        buttons: [          
                            {            
                                name: "single_select",            
                                buttonParamsJson: JSON.stringify({              
                                    title: "Pilih Dunia (Klik Disini)",              
                                    sections: [                
                                        {                  
                                            title: "🔥 Action & Petualangan",                  
                                            rows: [                    
                                                { title: "Isekai Fantasy", id: "genre_1" },
                                                { title: "Cyberpunk City", id: "genre_2" },
                                                { title: "Zombie Apocalypse", id: "genre_3" },
                                            ]                
                                        },
                                        {                  
                                            title: "💖 Drama & Romance",                  
                                            rows: [                    
                                                { title: "Slice of Life", id: "genre_4" },
                                                { title: "Royal Romance", id: "genre_5" },
                                                { title: "Supernatural", id: "genre_6" },
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

        if (userSessions[from]) {
            const session = userSessions[from]

            // TAHAP 2: MENERIMA BALASAN GENRE
            if (session.state === 'PILIH_GENRE') {
                const daftarGenre = {
                    'genre_1': 'Fantasi Isekai dengan sistem Guild, sihir, dan monster',
                    'genre_2': 'Kota Cyberpunk futuristik yang gelap',
                    'genre_3': 'Kiamat Zombie yang menegangkan',
                    'genre_4': 'Kehidupan nyata (Real Life) kampus/kantor berfokus romansa',
                    'genre_5': 'Drama Kerajaan (Royal Romance)',
                    'genre_6': 'Dunia modern dengan mahluk gaib yang bersembunyi'
                }

                if (!daftarGenre[text]) {
                    return sock.sendMessage(from, { text: '⚠️ _Silakan klik tombol "Pilih Dunia" pada pesan di atas._' }, { quoted: msg })
                }

                session.genre = daftarGenre[text]
                session.state = 'INPUT_NAMA' 
                
                return sock.sendMessage(from, { 
                    text: `✨ *Dunia dipilih!*\n\nKetik balas pesan ini dengan *Nama Karaktermu* (Contoh: Arthur).` 
                }, { quoted: msg })
            }

            // TAHAP 3: MENERIMA NAMA & MEMULAI AI DENGAN MODE JSON
            if (session.state === 'INPUT_NAMA') {
                if (!text.trim()) return

                session.mcName = text.trim()
                session.state = 'BERMAIN'
                
                await sock.sendMessage(from, { text: `⏳ _Menyiapkan dunia untuk ${session.mcName}..._` }, { quoted: msg })

                // Instruksi ketat agar Cohere HANYA membalas dengan JSON
                const systemInstruction = `
Kamu adalah Game Master Roleplay di WhatsApp. Dunia: ${session.genre}. Pemain: ${session.mcName}.

ATURAN WAJIB (SANGAT KETAT):
1. Kamu HANYA boleh merespons dengan format JSON murni. Jangan ada teks basa-basi di luar JSON.
2. Format balasan JSON wajib persis seperti ini:
{
  "cerita": "Tulis narasi di sini. Maksimal 2 paragraf. Gaya ekspresif ala Janitor AI.",
  "pilihan": ["Tindakan 1", "Tindakan 2", "Tindakan 3"]
}
3. Array 'pilihan' WAJIB berisi tepat 3 item pilihan kelanjutan cerita.
4. Setiap item di 'pilihan' WAJIB sangat singkat (Maksimal 20 huruf agar muat di tombol WhatsApp).
5. Jangan gunakan bintang ganda (**) untuk teks tebal. Gunakan bintang tunggal (*) saja.`

                session.history = [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: `Halo, aku ${session.mcName}. Mulai cerita pembukanya dan beri aku 3 pilihan tindakan.` }
                ]

                try {
                    const response = await fetch(cohereUrl, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${cohereApiKey}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ model: "command-a-03-2025", messages: session.history, temperature: 0.8 })
                    })

                    const data = await response.json()
                    const aiReply = data.choices[0].message.content
                    const parsedData = extractJSON(aiReply)

                    if (!parsedData || !parsedData.pilihan) throw new Error("Gagal parsing JSON dari AI")

                    session.history.push({ role: "assistant", content: aiReply })
                    session.lastChoices = parsedData.pilihan // Simpan pilihan ke memori

                    // Membersihkan karakter markdown ** yang membandel menjadi *
                    const cleanStory = parsedData.cerita.replace(/\*\*/g, '*')

                    // Membuat 3 Tombol Quick Reply
                    const actionButtons = parsedData.pilihan.map((pil, idx) => ({
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: pil.substring(0, 20), // Dibatasi 20 karakter agar tombol tidak error
                            id: `action_${idx}`
                        })
                    }))

                    return sock.sendMessage(from, {
                        interactiveMessage: {
                            body: { text: cleanStory },
                            footer: { text: "✨ Pilih tindakanmu:" },
                            nativeFlowMessage: { buttons: actionButtons }
                        }
                    }, { quoted: msg })

                } catch (error) {
                    console.error('🔥 Error Cohere Start:', error)
                    delete userSessions[from]
                    return sock.sendMessage(from, { text: 'Gagal merakit dunia. Coba kirim ulang .story' }, { quoted: msg })
                }
            }

            // TAHAP 4: LOOPING GAMEPLAY (STRICT BUTTON ONLY)
            if (session.state === 'BERMAIN') {
                // Jika pesan dari ketikan manual (bukan dari tombol), tolak!
                if (!isFromButton || !text.startsWith('action_')) {
                    return sock.sendMessage(from, { text: '⚠️ _Permainan sedang berlangsung! Silakan gunakan tombol di bawah teks cerita untuk memilih tindakanmu, jangan diketik manual._' }, { quoted: msg })
                }

                await sock.sendMessage(from, { text: '⏳ _Mengetik balasan..._' }, { quoted: msg })
                
                // Mengambil tindakan dari ID tombol yang dipencet (contoh ID: action_0)
                const choiceIndex = parseInt(text.split('_')[1])
                const userRealAction = session.lastChoices[choiceIndex]
                
                session.history.push({ role: "user", content: `Aku memilih: ${userRealAction}` })

                try {
                    const response = await fetch(cohereUrl, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${cohereApiKey}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ model: "command-a-03-2025", messages: session.history, temperature: 0.8 })
                    })

                    const data = await response.json()
                    const aiReply = data.choices[0].message.content
                    const parsedData = extractJSON(aiReply)

                    if (!parsedData || !parsedData.pilihan) throw new Error("Gagal parsing JSON")

                    session.history.push({ role: "assistant", content: aiReply })
                    session.lastChoices = parsedData.pilihan

                    const cleanStory = parsedData.cerita.replace(/\*\*/g, '*')
                    const actionButtons = parsedData.pilihan.map((pil, idx) => ({
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: pil.substring(0, 20), 
                            id: `action_${idx}`
                        })
                    }))

                    return sock.sendMessage(from, {
                        interactiveMessage: {
                            body: { text: cleanStory },
                            footer: { text: "✨ Pilih tindakan selanjutnya:" },
                            nativeFlowMessage: { buttons: actionButtons }
                        }
                    }, { quoted: msg })

                } catch (error) {
                    console.error('🔥 Error Cohere Story:', error)
                    session.history.pop() 
                    return sock.sendMessage(from, { text: 'AI sedang kebingungan. Coba pencet tombolnya sekali lagi.' }, { quoted: msg })
                }
            }
        }
    }
}
