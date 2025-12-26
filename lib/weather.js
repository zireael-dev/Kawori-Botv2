const axios = require('axios')

const LOCATION = 'Jakarta'          // lokasi default (tidak ditampilkan)
const CACHE_TTL = 10 * 60 * 1000    // 10 menit

let cache = {
    time: 0,
    text: ''
}

module.exports = async function getWeather() {
    const apiKey = global.config?.api?.weatherapi
    if (!apiKey) return '' // fallback kosong

    // pakai cache kalau masih valid
    if (Date.now() - cache.time < CACHE_TTL) {
        return cache.text
    }

    try {
        const url = `https://api.weatherapi.com/v1/current.json`
        const { data } = await axios.get(url, {
            params: {
                key: apiKey,
                q: LOCATION,
                lang: 'id'
            },
            timeout: 5000
        })

        if (!data?.current) return ''

        const desc = data.current.condition?.text
        const temp = Math.round(data.current.temp_c)
        const feels = Math.round(data.current.feelslike_c)
        const humidity = data.current.humidity

        const text = `🌤️ Cuaca hari ini: *${desc}*, ${temp}°C (terasa ${feels}°C) • 💧${humidity}%`

        cache.time = Date.now()
        cache.text = text

        return text
    } catch {
        // ❌ error → silent fallback
        return ''
    }
}
