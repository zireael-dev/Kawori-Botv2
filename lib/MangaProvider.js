const puppeteer = require('puppeteer');
const PDFDocument = require('pdfkit');
const fs = require('fs');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';

const MangaProvider = {
    
    // --- 1. SEARCH DENGAN DEBUGGING ---
    search: async (keyword) => {
        console.log(`🔍 [DEBUG] Searching keyword: ${keyword}`);
        
        // Tambahkan argumen extra agar lancar di VPS (--disable-dev-shm-usage penting buat VPS)
        const browser = await puppeteer.launch({ 
            headless: "new", 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
        });
        
        try {
            const page = await browser.newPage();
            await page.setUserAgent(USER_AGENT);
            
            // Format URL Mangabats
            const query = keyword.trim().replace(/\s+/g, '_');
            const url = `https://www.mangabats.com/search/story/${query}`;
            
            console.log(`⏳ [DEBUG] Mengakses URL: ${url}`);
            
            // Tunggu sampai network idle (tidak ada loading lagi)
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

            // --- CEK APA YANG DILIHAT BOT ---
            const pageTitle = await page.title();
            const currentUrl = page.url();
            console.log(`📄 [DEBUG] Judul Halaman: "${pageTitle}"`);
            console.log(`🔗 [DEBUG] URL Sekarang: "${currentUrl}"`);

            if (pageTitle.includes("Just a moment") || pageTitle.includes("Attention Required")) {
                console.log("⛔ [DEBUG] Terdeteksi Cloudflare! Bot tertahan di ruang tunggu.");
                await browser.close();
                return [];
            }

            // --- MENCOBA BEBERAPA KEMUNGKINAN SELECTOR ---
            const results = await page.evaluate(() => {
                // Selector 1: Mangabats Lama
                let items = document.querySelectorAll('.list-story-item');
                
                // Selector 2: Manganato / Style Baru
                if (items.length === 0) {
                    items = document.querySelectorAll('.panel-search-story .search-story-item');
                }
                
                // Selector 3: Generic Fallback
                if (items.length === 0) {
                    items = document.querySelectorAll('.daily-update .item');
                }

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

            console.log(`✅ [DEBUG] Ditemukan ${results.length} hasil.`);
            
            await browser.close();
            return results;

        } catch (error) {
            console.error("❌ [DEBUG] Search Error:", error.message);
            await browser.close();
            return [];
        }
    },

    // --- 2. GET CHAPTERS (Standard) ---
    getChapters: async (mangaUrl) => {
        const browser = await puppeteer.launch({ 
            headless: "new", 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
        });

        try {
            const page = await browser.newPage();
            await page.setUserAgent(USER_AGENT);
            await page.goto(mangaUrl, { waitUntil: 'domcontentloaded' });

            const chapters = await page.evaluate(() => {
                // Selector Mangabats / Manganato
                const list = document.querySelectorAll('.row-content-chapter li a');
                return Array.from(list).map(link => ({
                    title: link.innerText,
                    url: link.href
                }));
            });

            await browser.close();
            return chapters;

        } catch (error) {
            console.error("❌ Get Chapters Error:", error);
            await browser.close();
            return [];
        }
    },

    // --- 3. DOWNLOAD PDF (Browser Rendering) ---
    downloadChapter: async (chapterUrl, outputFilename) => {
        console.log(`🚀 Download PDF: ${chapterUrl}`);
        const browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-web-security', 
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-dev-shm-usage'
            ]
        });

        try {
            const page = await browser.newPage();
            await page.setUserAgent(USER_AGENT);
            await page.goto(chapterUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

            // Auto Scroll untuk memicu gambar loading
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 100;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if(totalHeight >= scrollHeight){
                            clearInterval(timer);
                            resolve();
                        }
                    }, 50);
                });
            });

            const imageUrls = await page.evaluate(() => {
                const container = document.querySelector('.container-chapter-reader') || document.querySelector('.reading-content');
                if (!container) return [];
                return Array.from(container.querySelectorAll('img')).map(img => img.dataset.src || img.src);
            });

            if (!imageUrls.length) throw new Error("Gambar tidak ditemukan.");

            const doc = new PDFDocument({ autoFirstPage: false });
            const writeStream = fs.createWriteStream(outputFilename);
            doc.pipe(writeStream);

            for (let i = 0; i < imageUrls.length; i++) {
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
                        return canvas.toDataURL('image/jpeg', 0.80);
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
            await browser.close();
            return null;
        }
    }
};

module.exports = MangaProvider;
