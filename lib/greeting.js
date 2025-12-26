module.exports = function getGreeting(name = '') {
    const hour = new Date().getHours()
    let greet = 'Halo'

    if (hour >= 4 && hour < 11) greet = 'Selamat pagi'
    else if (hour >= 11 && hour < 15) greet = 'Selamat siang'
    else if (hour >= 15 && hour < 18) greet = 'Selamat sore'
    else greet = 'Selamat malam'

    return `${greet}${name ? ', ' + name : ''} 👋`
}
