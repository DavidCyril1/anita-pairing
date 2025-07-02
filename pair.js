const { makeid } = require('./id');
const express = require('express');
const pino = require("pino");
const {
    makeWASocket,
    initAuthCreds,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@fizzxydev/baileys-pro");
const { MongoClient } = require('mongodb');
const { Boom } = require('@hapi/boom');

const router = express.Router();

const MONGO_URL = 'mongodb+srv://davidcyril209:85200555dcx@david.sfonwmo.mongodb.net/?retryWrites=true&w=majority&appName=David';

// === MongoDB Auth State ===
async function useMongoAuthState(sessionId) {
    const client = new MongoClient(MONGO_URL);
    await client.connect();
    const db = client.db('whatsappSessions');
    const col = db.collection('sessions');

    // Ensure TTL index (expires after 5 minutes)
    await col.createIndex({ createdAt: 1 }, { expireAfterSeconds: 300 });

    let doc = await col.findOne({ sessionId });
    let creds = doc?.creds || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    let result = await col.findOne({ sessionId });
                    return ids.map(id => result?.keys?.[type]?.[id]).filter(Boolean);
                },
                set: async (data) => {
                    doc = await col.findOne({ sessionId }) || {};
                    doc.keys = doc.keys || {};
                    for (const category in data) {
                        doc.keys[category] = { ...doc.keys[category], ...data[category] };
                    }
                    await col.updateOne(
                        { sessionId },
                        { $set: { keys: doc.keys, createdAt: new Date() } },
                        { upsert: true }
                    );
                },
            },
        },
        saveCreds: async () => {
            await col.updateOne(
                { sessionId },
                { $set: { creds, createdAt: new Date() } },
                { upsert: true }
            );
        },
        getSession: async () => {
            let data = await col.findOne({ sessionId });
            return data ? JSON.stringify(data) : null;
        },
        close: async () => {
            await client.close();
        }
    };
}

// === Pairing Route ===
router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;

    if (!num) return res.status(400).json({ error: 'Phone number is required' });

    num = num.replace(/[^0-9]/g, '');
    if (num.length < 10) {
        return res.status(400).json({ error: 'Invalid phone number format' });
    }

    async function SIGMA_MD_PAIR_CODE() {
        try {
            const { state, saveCreds, getSession, close } = await useMongoAuthState(id);
            const { version } = await fetchLatestBaileysVersion();
            const logger = pino({ level: 'silent' });

            let sock = makeWASocket({
                version,
                logger,
                printQRInTerminal: false,
                auth: state,
                generateHighQualityLinkPreview: true,
                getMessage: async () => ({ conversation: 'Hello' }),
            });

            // Pairing code
            if (!sock.authState.creds.registered) {
                setTimeout(async () => {
                    try {
                        const code = await sock.requestPairingCode(num, 'CYRILDEV');
                        console.log('Pairing code:', code, 'for:', num);
                        if (!res.headersSent) res.json({ code });
                    } catch (error) {
                        console.error('Error requesting pairing code:', error);
                        if (!res.headersSent) res.status(500).json({ error: 'Failed to generate pairing code' });
                    }
                }, 500);
            }

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect } = update;
                console.log('Connection update:', { connection, phoneNumber: num });

                if (connection === 'close') {
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    console.log('Connection closed:', lastDisconnect?.error);

                    if (shouldReconnect) {
                        setTimeout(() => SIGMA_MD_PAIR_CODE(), 5000);
                    } else {
                        await close();
                    }
                } else if (connection === 'open') {
                    console.log('WhatsApp connected for:', num);

                    sock.newsletterFollow('120363315231436175@newsletter');

                    await new Promise(r => setTimeout(r, 3000));

                    const SIGMA_MD_TEXT = `
╔══╦═╗╔══╦═╦═╦╗╔╗
╚╗╗║╔╝╚╗╔╣╦╣╔╣╚╝║
╔╩╝║╚╗─║║║╩╣╚╣╔╗║
╚══╩═╝─╚╝╚═╩═╩╝╚╝

▬▬▬▬▬▬▬▬▬▬▬▬▬▬
❶ || *WhatsApp Channel* = https://whatsapp.com/channel/0029VaeRru3ADTOEKPCPom0L
▬▬▬▬▬▬▬▬▬▬▬▬▬▬
❷ || *Telegram* = https://t.me/davidcyriltechs
▬▬▬▬▬▬▬▬▬▬▬▬▬▬
➌ || *YouTube* = https://www.youtube.com/@DavidCyril_TECH
▬▬▬▬▬▬▬▬▬▬▬▬
THIS IS YOUR SESSION ID 👇`;

                    const jid = sock.user.id;
                    await sock.sendMessage(jid, { text: SIGMA_MD_TEXT });
                    console.log('Promo message sent');

                    await new Promise(r => setTimeout(r, 2000));

                    const sessionData = await getSession();
                    if (sessionData) {
                        await sock.sendMessage(jid, { text: sessionData });
                        console.log('Session data sent');
                    } else {
                        console.error('No session data found');
                    }

                    await new Promise(r => setTimeout(r, 1000));
                    await sock.ws.close();
                    await close();
                } else if (connection === 'connecting') {
                    console.log('Connecting to WhatsApp...');
                }
            });

        } catch (err) {
            console.error('SIGMA_MD_PAIR_CODE error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Service Unavailable', details: err.message });
            }
        }
    }

    return await SIGMA_MD_PAIR_CODE();
});

module.exports = router;
