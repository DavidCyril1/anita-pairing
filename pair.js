const express = require('express');
const fs = require('fs');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const { makeid } = require('./id');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    delay
} = require('@fizzxydev/baileys-pro');

const router = express.Router();

function removeFolder(folder) {
    if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();
    const number = req.query.number?.replace(/[^0-9]/g, '');

    if (!number) return res.status(400).send({ error: 'Missing ?number=' });

    const sessionPath = `./temp/${id}`;

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        const sock = makeWASocket({
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
            syncFullHistory: false,
        });

        sock.ev.on('creds.update', saveCreds);

        if (!sock.authState.creds.registered) {
            const code = await sock.requestPairingCode(number);
            console.log(`PAIRING CODE for ${number} =>`, code);
            if (!res.headersSent) res.send({ code });

            sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
                if (connection === 'open') {
                    await delay(3000);

                    const welcomeText = `
▬▬▬▬▬▬▬▬▬▬▬▬▬▬
❶  || *ᴡʜᴀᴛsᴀᴘᴘ ᴄʜᴀɴɴᴇʟ* = https://whatsapp.com/channel/0029VaeRru3ADTOEKPCPom0L
▬▬▬▬▬▬▬▬▬▬▬▬▬▬
❷ || *ᴛᴇʟᴇɢʀᴀᴍ* = https://t.me/davidcyriltechs 
▬▬▬▬▬▬▬▬▬▬▬▬▬▬
➌ || *ʏᴏᴜᴛᴜʙᴇ* = https://www.youtube.com/@DavidCyril_TECH 
▬▬▬▬▬▬▬▬▬▬▬▬
THIS IS YOUR SESSION ID👇`.trim();

                    await sock.sendMessage(sock.user.id, { text: welcomeText });

                    const data = fs.readFileSync(`${sessionPath}/creds.json`, 'utf-8');
                    await delay(1000);

                    await sock.sendMessage(sock.user.id, {
                        text: "\n" + data + "\n"
                    });

                    await delay(1000);
                    await sock.ws.close();
                    removeFolder(sessionPath);
                }

                if (connection === 'close') {
                    const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                    if (reason !== DisconnectReason.loggedOut) {
                        console.log('Reconnecting...');
                    }
                }
            });
        } else {
            res.send({ error: 'Already registered session.' });
        }

    } catch (err) {
        console.error('Pairing failed:', err.message);
        removeFolder(sessionPath);
        if (!res.headersSent) res.send({ error: 'Pairing failed. Try again.' });
    }
});

module.exports = router;