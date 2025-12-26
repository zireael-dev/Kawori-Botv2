module.exports = () => ({
    name: 'message-router',

    async onMessage(client, msg) {
        const jid = msg.key.remoteJid
        const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text

        if (!text) return

            if (text === 'ping') {
                await client.sendMessage(jid, { text: 'pong' })
            }
    }
})
