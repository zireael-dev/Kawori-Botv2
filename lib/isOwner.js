module.exports = function isOwner(msg) {
    const owners = global.config.owner || []

    const jid =
        msg.key.participant || // kalau di grup
        msg.key.remoteJid      // kalau private

    if (!jid) return false

    const number = jid.split('@')[0]
    return owners.includes(number)
}
