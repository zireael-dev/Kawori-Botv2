const cohereApiKey = '9h0Ia5qSQpS9YHYJIunYc7G1ANbJqbFqnlpARpaf'
const cohereUrl = 'https://api.cohere.com/compatibility/v1/chat/completions/'

const userSessions = {}

// Fungsi pembersih JSON yang lebih kuat
function extractJSON(text) {
    try {
        const start = text.indexOf('{')
        const end = text.lastIndexOf('}')
        if (start !== -1 && end !== -1) {
            return JSON.parse(text.substring(start, end + 1))
        }
        return null
    } catch (e) { return null }
}

module.exports = {
    name: 'cohere-interactive-story',
    onMessage: async (sock, msg, store) => {
        let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ""
        let isFromButton = false
        
        // Cek apakah pesan berasal dari interaksi tombol
        if (msg.message?.interactiveResponseMessage) {
            try {
                const params = JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson)
                text = params.id 
                isFromButton = true
            } catch (e) { console.error("Gagal membaca ID tombol") }
        } else if (msg.message?.templateButtonReplyMessage) {
            text = msg.message.templateButtonReplyMessage.selectedId
            isFromButton = true
        }

        const [command, ...args] = text.split(' ')
        const from = msg.key.remoteJid

        if (text.toLowerCase() === '.story reset') {
            if (userSessions[from]) {
                delete userSessions[from]
                return sock.sendMessage(from, { text: '🔄 _Sesi permainan diakhiri._' }, { quoted: msg })
            }
            return
        }

        // TAHAP 1: MENU PILIH DUNIA
        if (!userSessions[from] && command.match(/^[.!/](story|main)$/i)) {
            userSessions[from] = { state: 'PILIH_GENRE', genre: '', mcName: '', history: [], lastChoices: [] }

            return sock.sendMessage(from, {    
                interactiveMessage: {      
                    title: "✨ KAWORIBOT ROLEPLAY ✨",
                    footer: "Pilih dunia tempat ceritamu dimulai!",
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
                                        },
                                        {                  
                                            title: "🕵️‍♂️ Misteri & Sci-Fi",                  
                                            rows: [                    
                                                { title: "Detektif Noir", id: "genre_7" },
                                                { title: "Sci-Fi Space", id: "genre_8" }
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
                    'genre_6': 'Dunia modern dengan mahluk gaib yang bersembunyi',
                    'genre_7': 'Misteri Detektif bergaya Noir',
                    'genre_8': 'Sci-Fi Penjelajahan Luar Angkasa'
                }

                if (!daftarGenre[text]) {
                    return sock.sendMessage(from, { text: '⚠️ _Silakan klik tombol "Pilih Dunia" pada pesan di atas._' }, { quoted: msg })
                }

                session.genre = daftarGenre[text]
                session.state = 'INPUT_NAMA' 
                
                return sock.sendMessage(from, { 
                    text: `✨ *Dunia dipilih!*\n\nKetik balas pesan ini dengan *Nama Karaktermu* (Contoh: Yusril).` 
                }, { quoted: msg })
            }

            // FUNGSI BANTUAN UNTUK MEMANGGIL AI DAN MENGIRIM 2 BUBBLE (STORY + BUTTON)
            const requestStory = async (promptMsg) => {
                session.history.push({ role: "user", content: promptMsg })

                const response = await fetch(cohereUrl, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${cohereApiKey}`, 'Content-Type': 'application/json' },
                    // 👇 DI SINI NAMA MODELNYA SUDAH DIUBAH 👇
                    body: JSON.stringify({ model: "command-a-03-2025", messages: session.history, temperature: 0.8 })
                })

                const data = await response.json()
                const aiReply = data.choices[0].message.content
                const parsedData = extractJSON(aiReply)

                if (!parsedData || !parsedData.pilihan || !parsedData.cerita) throw new Error("Gagal parsing JSON AI")

                session.history.push({ role: "assistant", content: aiReply })
                session.lastChoices = parsedData.pilihan

                // Pastikan teks bersih dari markdown tebal ganda
                const cleanStory = String(parsedData.cerita).replace(/\*\*/g, '*')

                const actionButtons = parsedData.pilihan.map((pil, idx) => ({
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                        display_text: String(pil).substring(0, 20), 
                        id: `action_${idx}`
                    })
                }))

                // 1. Kirim Bubble Cerita
                await sock.sendMessage(from, { text: cleanStory })

                // 2. Kirim Bubble Tombol
                await sock.sendMessage(from, {
                    interactiveMessage: {
                        title: "Apa yang akan kamu lakukan?",
                        nativeFlowMessage: { buttons: actionButtons }
                    }
                })
            }

            // TAHAP 3: MENERIMA NAMA & MEMULAI AI
            if (session.state === 'INPUT_NAMA') {
                if (!text.trim()) return

                session.mcName = text.trim()
                session.state = 'BERMAIN'
                
                await sock.sendMessage(from, { text: `⏳ _Menyiapkan dunia untuk ${session.mcName}..._` }, { quoted: msg })

                const systemInstruction = `
Kamu adalah Game Master Roleplay. Dunia: ${session.genre}. Pemain: ${session.mcName}.
ATURAN WAJIB (SANGAT KETAT):
1. HANYA respons dengan JSON murni.
2. Format balasan:
{
  "cerita": "Tulis narasi maksimal 2 paragraf di sini.",
  "pilihan": ["Tindakan 1", "Tindakan 2", "Tindakan 3"]
}
3. Array 'pilihan' WAJIB persis 3 item singkat (Maks 20 huruf).
4. Jangan gunakan bintang ganda (**) di dalam teks.`

                session.history = [{ role: "system", content: systemInstruction }]

                try {
                    await requestStory(`Halo, aku ${session.mcName}. Mulai cerita pembukanya dan beri aku 3 pilihan tindakan.`)
                } catch (error) {
                    console.error('🔥 Error Cohere Start:', error)
                    delete userSessions[from]
                    return sock.sendMessage(from, { text: 'Gagal merakit dunia. Coba kirim ulang .story' }, { quoted: msg })
                }
                return
            }

            // TAHAP 4: LOOPING GAMEPLAY
            if (session.state === 'BERMAIN') {
                if (command.match(/^[.!/]/i)) return

                let actionStr = ""

                // Validasi Cerdas
                if (isFromButton && text.startsWith('action_')) {
                    const idx = parseInt(text.split('_')[1])
                    actionStr = session.lastChoices[idx]
                } else {
                    const matchedIdx = session.lastChoices.findIndex(c => String(c).substring(0, 20).toLowerCase() === text.trim().toLowerCase())
                    if (matchedIdx !== -1) {
                        actionStr = session.lastChoices[matchedIdx]
                    }
                }

                if (!actionStr) {
                    return sock.sendMessage(from, { text: '⚠️ _Permainan sedang berlangsung! Silakan gunakan tombol untuk memilih tindakanmu._' }, { quoted: msg })
                }

                await sock.sendMessage(from, { text: '⏳ _Mengetik balasan..._' }, { quoted: msg })

                try {
                    await requestStory(`Aku memilih: ${actionStr}`)
                } catch (error) {
                    console.error('🔥 Error Cohere Story:', error)
                    session.history.pop() 
                    return sock.sendMessage(from, { text: 'AI sedang kebingungan. Coba pencet tombolnya sekali lagi.' }, { quoted: msg })
                }
            }
        }
    }
}
