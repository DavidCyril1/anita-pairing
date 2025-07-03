const { makeid } = require('./id');
const express = require('express');
const fs = require('fs');
const path = require('path');
let router = express.Router();
const pino = require("pino");
const {
    makeWASocket,
    useMultiFileAuthState,
    delay,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@fizzxydev/baileys-pro");
const { Boom } = require('@hapi/boom');
const { catbox } = require('./catbox');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

// Create single creds.json from session data
const createCredsJson = (sessionPath) => {
    try {
        const credsPath = path.join(sessionPath, 'creds.json');
        const files = fs.readdirSync(sessionPath);
        
        let credsData = {};
        let preKeysData = {};
        let senderKeysData = {};
        
        // Read creds.json
        if (fs.existsSync(credsPath)) {
            credsData = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
        }
        
        // Read pre-keys
        const preKeyFile = files.find(file => file.startsWith('pre-key-'));
        if (preKeyFile) {
            const preKeyPath = path.join(sessionPath, preKeyFile);
            preKeysData = JSON.parse(fs.readFileSync(preKeyPath, 'utf8'));
        }
        
        // Read sender keys
        const senderKeyFile = files.find(file => file.startsWith('sender-key-'));
        if (senderKeyFile) {
            const senderKeyPath = path.join(sessionPath, senderKeyFile);
            senderKeysData = JSON.parse(fs.readFileSync(senderKeyPath, 'utf8'));
        }
        
        // Combine all
        const combinedCreds = {
            ...credsData,
            preKeys: preKeysData,
            senderKeys: senderKeysData,
            timestamp: new Date().toISOString()
        };
        
        return JSON.stringify(combinedCreds, null, 2);
    } catch (error) {
        console.error('Error creating creds.json:', error);
        return null;
    }
};

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;

    if (!num) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    num = num.replace(/[^0-9]/g, '');
    if (num.length < 10) {
        return res.status(400).json({ error: 'Invalid phone number format' });
    }

    const sessionPath = './temp/' + id;

    async function SIGMA_MD_PAIR_CODE() {
        try {
            if (!fs.existsSync(sessionPath)) {
                fs.mkdirSync(sessionPath, { recursive: true });
            }

            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
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

            if (!sock.authState.creds.registered) {
                setTimeout(async () => {
                    try {
                        const customPairCode = "CYRILDEV";
                        const code = await sock.requestPairingCode(num, customPairCode);
                        console.log('Pairing code generated:', code, 'for:', num);
                        if (!res.headersSent) {
                            res.json({ code });
                        }
                    } catch (error) {
                        console.error('Error requesting pairing code:', error);
                        if (!res.headersSent) {
                            res.status(500).json({ error: 'Failed to generate pairing code' });
                        }
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
                        console.log('Reconnecting...');
                        setTimeout(() => SIGMA_MD_PAIR_CODE(), 5000);
                    } else {
                        console.log('Logged out, cleaning up...');
                        await removeFile(sessionPath);
                    }
                } else if (connection === 'open') {
                    console.log('WhatsApp connected successfully for:', num);

                    const davidchannelJid = '120363315231436175@newsletter';
                    sock.newsletterFollow(davidchannelJid);

                    await delay(3000);

                    try {
                        let SIGMA_MD_TEXT = `
╔══╦═╗╔══╦═╦═╦╗╔╗
╚╗╗║╔╝╚╗╔╣╦╣╔╣╚╝║
╔╩╝║╚╗─║║║╩╣╚╣╔╗║
╚══╩═╝─╚╝╚═╩═╩╝╚╝

▬▬▬▬▬▬▬▬▬▬▬▬▬▬
❶  || *ᴡʜᴀᴛsᴀᴘᴘ ᴄʜᴀɴɴᴇʟ* = https://whatsapp.com/channel/0029VaeRru3ADTOEKPCPom0L
▬▬▬▬▬▬▬▬▬▬▬▬▬▬
❷ || *ᴛᴇʟᴇɢʀᴀᴍ* = https://t.me/davidcyriltechs 
▬▬▬▬▬▬▬▬▬▬▬▬▬▬
➌ || *ʏᴏᴜᴛᴜʙᴇ* = https://www.youtube.com/@DavidCyril_TECH 
▬▬▬▬▬▬▬▬▬▬▬▬
THIS IS YOUR SESSION JSON👇`;

                        const jid = sock.user.id;
                        await sock.sendMessage(jid, { text: SIGMA_MD_TEXT });
                        console.log('Promotional message sent');

                        await delay(2000);

                        // create creds
                        const sessionData = createCredsJson(sessionPath);

                        if (sessionData) {
                            const combinedPath = sessionPath + '/combined_creds.json';
                            fs.writeFileSync(combinedPath, sessionData);

                            try {
                                const result = await catbox(combinedPath);
                                await sock.sendMessage(jid, {
                                    text: `✅ *Your Session JSON is stored here:*\n${result.url}`
                                });
                                console.log('Session data uploaded to Catbox:', result.url);
                            } catch (uploadErr) {
                                console.error('Error uploading to Catbox:', uploadErr);
                                await sock.sendMessage(jid, {
                                    text: '⚠️ Failed to upload session data to Catbox'
                                });
                            }
                        } else {
                            const credsPath = sessionPath + '/creds.json';
                            if (fs.existsSync(credsPath)) {
                                try {
                                    const result = await catbox(credsPath);
                                    await sock.sendMessage(jid, {
                                        text: `✅ *Your Session JSON is stored here:*\n${result.url}`
                                    });
                                    console.log('Session data uploaded to Catbox (fallback):', result.url);
                                } catch (uploadErr) {
                                    console.error('Error uploading fallback to Catbox:', uploadErr);
                                    await sock.sendMessage(jid, {
                                        text: '⚠️ Failed to upload session data to Catbox (fallback)'
                                    });
                                }
                            }
                        }

                        await delay(1000);
                        await sock.ws.close();
                        setTimeout(() => removeFile(sessionPath), 5000);

                    } catch (error) {
                        console.error('Error sending session data:', error);
                        await removeFile(sessionPath);
                    }
                } else if (connection === 'connecting') {
                    console.log('Connecting to WhatsApp...');
                }
            });

        } catch (err) {
            console.error("Error in SIGMA_MD_PAIR_CODE:", err);
            await removeFile(sessionPath);
            if (!res.headersSent) {
                res.status(500).json({ error: "Service Unavailable", details: err.message });
            }
        }
    }

    return await SIGMA_MD_PAIR_CODE();
});

module.exports = router;
