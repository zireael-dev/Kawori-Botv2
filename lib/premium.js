function isPremium(user) {
    if (!user.premium?.status) return false
    if (!user.premium.expired) return true

    const now = Date.now()
    return now < new Date(user.premium.expired).getTime()
}

module.exports = { isPremium }
