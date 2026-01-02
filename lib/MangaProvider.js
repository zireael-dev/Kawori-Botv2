const puppeteer = require('puppeteer');
const PDFDocument = require('pdfkit');
const fs = require('fs');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';

const MangaProvider = {
    
    /**
     * 1. SEARCH MANGA
     * Mengubah spasi jadi underscore (chainsaw man -> chainsaw_man)
     */
    search: async (keyword) => {
        console.log(`🔍 Searching: ${keyword}...`);
        const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
        
        try {
            const page = await browser.newPage();
            await page.setUserAgent(USER_AGENT);
            
            // Format URL Mangabats: spasi diganti underscore
            const query = keyword.trim().replace(/\s+/g, '_');
            const url = `https://www.mangabats.com/search/story/${query}`;
            
            await page.goto(url, { waitUntil: 'domcontentloaded' });

            const results = await page.evaluate(() => {
                // Selector Search Result Mangabats
                const items = document.querySelectorAll('.list-story-item');
                return Array.from(items).map(item => {
                    const titleEl = item.querySelector('.item-title');
                    const imgEl = item.querySelector('.item-img');
                    const chapterEl = item.querySelector('.item-chapter'); // Chapter terbaru

                    return {
                        title: titleEl ? titleEl.innerText : 'No Title',
                        url: titleEl ? titleEl.href : null,
                        thumb: imgEl ? imgEl.src : null,
                        latest: chapterEl ? chapterEl.innerText : '-'
                    };
                });
            });

            await browser.close();
            return results;

        } catch (error) {
            console.error("❌ Search Error:", error.message);
            await browser.close();
            return [];
        }
    },

    /**
     * 2. GET CHAPTER LIST
     * Mengambil daftar semua chapter dari halaman depan manga
     */
    getChapters: async (mangaUrl) => {
        console.log(`📖 Mengambil list chapter...`);
        const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });

        try {
            const page = await browser.newPage();
            await page.setUserAgent(USER_AGENT);
            await page.goto(mangaUrl, { waitUntil: 'domcontentloaded' });

            const chapters = await page.evaluate(() => {
                // Selector List Chapter Mangabats
                const list = document.querySelectorAll('.row-content-chapter li a');
                return Array.from(list).map(link => ({
                    title: link.innerText, // Misal: "Chapter 224"
                    url: link.href
                }));
            });

            await browser.close();
            return chapters; // Biasanya urutan paling atas = chapter terbaru

        } catch (error) {
            console.error("❌ Get Chapters Error:", error.message);
            await browser.close();
            return [];
        }
    },

    /**
     * 3. DOWNLOAD & CONVERT TO PDF (Teknik Browser Rendering)
     * Anti-Blank & Anti-403
     */
    downloadChapter: async (chapterUrl, outputFilename) => {
        console.log(`🚀 Download PDF: ${chapterUrl}`);
        
        // Mode security dimatikan agar bisa manipulasi gambar Canvas
        const browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-web-security', '--disable-features=IsolateOrigins,site-per-process']
        });

        try {
            const page = await browser.newPage();
            await page.setUserAgent(USER_AGENT);
            
            // Timeout diperpanjang (2 menit) jaga-jaga internet lambat
            await page.goto(chapterUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

            // A. Ambil List URL Gambar
            const imageUrls = await page.evaluate(() => {
                const container = document.querySelector('.container-chapter-reader') || document.querySelector('.reading-content');
                if (!container) return [];
                // Prioritaskan data-src (lazy load) baru src
                return Array.from(container.querySelectorAll('img')).map(img => img.dataset.src || img.src);
            });

            if (!imageUrls.length) throw new Error("Gambar tidak ditemukan di halaman ini.");

            console.log(`⬇️  Memproses ${imageUrls.length} halaman...`);

            // B. Siapkan PDF
            const doc = new PDFDocument({ autoFirstPage: false });
            const writeStream = fs.createWriteStream(outputFilename);
            doc.pipe(writeStream);

            // C. Loop Download via Browser Context
            for (let i = 0; i < imageUrls.length; i++) {
                const imgUrl = imageUrls[i];
                
                // Inject script untuk fetch & convert ke JPEG base64
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
                        
                        // Convert ke JPEG 85% quality
                        return canvas.toDataURL('image/jpeg', 0.85); 
                    } catch (e) { return null; }
                }, imgUrl);

                if (base64Data) {
                    const imgBuffer = Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ""), 'base64');
                    doc.addPage({ size: 'A4' });
                    doc.image(imgBuffer, 0, 0, { width: 595.28 }); // Fit A4
                    process.stdout.write("."); // Progress bar
                } else {
                    process.stdout.write("x"); // Gagal
                }
            }

            doc.end();
            await browser.close();

            // Tunggu file selesai ditulis
            return new Promise((resolve) => {
                writeStream.on('finish', () => {
                    console.log(`\n✅ PDF Selesai: ${outputFilename}`);
                    resolve(outputFilename);
                });
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
