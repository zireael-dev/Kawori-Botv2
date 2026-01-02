const antibotbrowser = require("antibotbrowser");
const puppeteer = require("puppeteer");
const PDFDocument = require("pdfkit");
const fs = require("fs");

const BASE_URL = 'https://www.mangabats.com'; 
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Helper untuk menyalakan AntibotBrowser di port acak
async function startBrowser() {
    // Random port antara 9000 - 9999 agar tidak bentrok jika banyak request
    const port = Math.floor(Math.random() * (9999 - 9000 + 1) + 9000);
    
    console.log(`🔌 Starting AntibotBrowser on port ${port}...`);
    
    // Start browser sesuai snippet kamu
    const antibrowser = await antibotbrowser.startbrowser(port);
    
    // Ambil websocket url (handle typo 'websokcet' sesuai snippet kamu, atau 'websocket' jaga-jaga)
    const wsUrl = antibrowser.websokcet || antibrowser.websocket || antibrowser.ws;
    
    if (!wsUrl) throw new Error("Gagal mendapatkan WebSocket URL dari AntibotBrowser");

    // Connect Puppeteer ke browser tersebut
    const browser = await puppeteer.connect({
        browserWSEndpoint: wsUrl
    });
    
    return browser;
}

const MangaProvider = {
    
    // --- 1. SEARCH ---
    search: async (keyword) => {
        console.log(`🔍 [Antibot] Searching: ${keyword}`);
        let browser;
        
        try {
            browser = await startBrowser();
            const page = await browser.newPage();
            
            // Set Viewport 0x0 sesuai rekomendasi snippet kamu (atau set normal HD)
            // Tapi untuk scraping elemen, HD lebih aman biar layout desktop keluar
            await page.setViewport({ width: 1920, height: 1080 }); 
            await page.setUserAgent(USER_AGENT);

            const query = keyword.trim().replace(/\s+/g, '_');
            const url = `${BASE_URL}/search/story/${query}`;
            
            console.log(`➡️  Mengakses: ${url}`);
            
            // Timeout panjang
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

            // Cek Title
            const title = await page.title();
            console.log(`📄 Page Title: "${title}"`);

            if (title.includes("Just a moment") || title.includes("Cloudflare")) {
                console.log("⏳ Kena Cloudflare. Menunggu 10 detik...");
                await new Promise(r => setTimeout(r, 10000));
            }

            // Scrape Data
            const results = await page.evaluate(() => {
                let items = document.querySelectorAll('.list-story-item');
                if (!items.length) items = document.querySelectorAll('.panel-search-story .search-story-item');

                return Array.from(items).map(item => {
                    const titleEl = item.querySelector('.item-title') || item.querySelector('a.item-title');
                    const imgEl = item.querySelector('.item-img') || item.querySelector('img');
                    const chapterEl = item.querySelector('.item-chapter') || item.querySelector('.item-chapter a');

                    return {
                        title: titleEl ? titleEl.innerText : 'No Title',
                        url: titleEl ? titleEl.href : null,
                        thumb: imgEl ? imgEl.src : null,
                        latest: chapterEl ? chapterEl.innerText : '-'
                    };
                });
            });

            console.log(`✅ Ditemukan ${results.length} hasil.`);
            await browser.close();
            return results;

        } catch (error) {
            console.error("❌ Search Error:", error.message);
            if (browser) await browser.close();
            return [];
        }
    },

    // --- 2. GET CHAPTER LIST ---
    getChapters: async (mangaUrl) => {
        let browser;
        try {
            browser = await startBrowser();
            const page = await browser.newPage();
            await page.setUserAgent(USER_AGENT);
            
            await page.goto(mangaUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

            const chapters = await page.evaluate(() => {
                const list = document.querySelectorAll('.row-content-chapter li a');
                return Array.from(list).map(link => ({
                    title: link.innerText,
                    url: link.href
                }));
            });

            await browser.close();
            return chapters;

        } catch (error) {
            console.error("❌ Get Chapters Error:", error.message);
            if (browser) await browser.close();
            return [];
        }
    },

    // --- 3. DOWNLOAD PDF ---
    downloadChapter: async (chapterUrl, outputFilename) => {
        console.log(`🚀 Download PDF: ${chapterUrl}`);
        let browser;
        
        try {
            browser = await startBrowser();
            const page = await browser.newPage();
            await page.setUserAgent(USER_AGENT);
            await page.setExtraHTTPHeaders({ 'Referer': 'https://mangabats.com/' });

            await page.goto(chapterUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

            // Auto Scroll
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 150;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if(totalHeight >= scrollHeight){
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100);
                });
            });
            
            await new Promise(r => setTimeout(r, 4000));

            const imageUrls = await page.evaluate(() => {
                const container = document.querySelector('.container-chapter-reader') || document.querySelector('.reading-content');
                if (!container) return [];
                return Array.from(container.querySelectorAll('img')).map(img => img.dataset.src || img.src);
            });

            if (!imageUrls.length) throw new Error("Gambar tidak ditemukan.");

            const doc = new PDFDocument({ autoFirstPage: false });
            const writeStream = fs.createWriteStream(outputFilename);
            doc.pipe(writeStream);

            console.log(`⬇️  Mengambil ${imageUrls.length} gambar...`);

            for (let i = 0; i < imageUrls.length; i++) {
                // Fetch & Convert (Canvas Trick)
                const base64Data = await page.evaluate(async (url) => {
                    try {
                        const response = await fetch(url);
                        const blob = await response.blob();
                        const bitmap = await createImageBitmap(blob);
                        
                        const canvas = document.createElement('canvas');
                        canvas.width = bitmap.width;
                        canvas.height = bitmap.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(bitmap, 0, 0);
                        
                        return canvas.toDataURL('image/jpeg', 0.85);
                    } catch (e) { return null; }
                }, imageUrls[i]);

                if (base64Data) {
                    const imgBuffer = Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ""), 'base64');
                    doc.addPage({ size: 'A4' });
                    doc.image(imgBuffer, 0, 0, { width: 595.28 });
                }
            }

            doc.end();
            await browser.close();

            return new Promise((resolve) => {
                writeStream.on('finish', () => resolve(outputFilename));
                writeStream.on('error', () => resolve(null));
            });

        } catch (error) {
            console.error("\n❌ Download Error:", error.message);
            if (browser) await browser.close();
            return null;
        }
    }
};

module.exports = MangaProvider;
