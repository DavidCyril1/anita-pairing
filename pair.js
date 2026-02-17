const { makeid } = require('./id');
const express = require('express');
const path = require("path");
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const {
    makeWASocket,
    useMultiFileAuthState,
    delay,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("wileys"); // ✅ switched from baileys-mod to original baileys
const { Boom } = require('@hapi/boom');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

// Create single creds.json from session data (same as server.js)
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
        
        // Read pre-keys (find the first pre-key file)
        const preKeyFile = files.find(file => file.startsWith('pre-key-'));
        if (preKeyFile) {
            const preKeyPath = path.join(sessionPath, preKeyFile);
            preKeysData = JSON.parse(fs.readFileSync(preKeyPath, 'utf8'));
        }
        
        // Read sender keys (find the first sender-key file)
        const senderKeyFile = files.find(file => file.startsWith('sender-key-'));
        if (senderKeyFile) {
            const senderKeyPath = path.join(sessionPath, senderKeyFile);
            senderKeysData = JSON.parse(fs.readFileSync(senderKeyPath, 'utf8'));
        }
        
        // Combine all data into single creds.json
        const combinedCreds = {
            ...credsData,
            preKeys: preKeysData,
            senderKeys: senderKeysData,
            timestamp: new Date().toISOString()
        };
        
        return JSON.stringify(combinedCreds);
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

    // Clean phone number
    num = num.replace(/[^0-9]/g, '');
    if (num.length < 10) {
        return res.status(400).json({ error: 'Invalid phone number format' });
    }

    const sessionPath = './temp/' + id;

    async function SIGMA_MD_PAIR_CODE() {
        try {
            // Ensure session directory exists
            if (!fs.existsSync(sessionPath)) {
                fs.mkdirSync(sessionPath, { recursive: true });
            }

            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
            const { version, isLatest } = await fetchLatestBaileysVersion();

            // Create logger (same as server.js)
            const logger = pino({ level: 'silent' });

            let sock = makeWASocket({
                version,
                logger,
                printQRInTerminal: false,
                auth: state,
                generateHighQualityLinkPreview: true,
                getMessage: async (key) => {
                    return { conversation: 'Hello' };
                },
            });

          // Handle pairing code request
if (!sock.authState.creds.registered) {
    setTimeout(async () => {
        try {
            // ❌ Removed custom pair code
            // const customPairCode = "CYRILDEV";

            // ✅ Request normal Baileys pairing code
            const code = await sock.requestPairingCode(num);

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


            // Handle credentials update
            sock.ev.on('creds.update', saveCreds);

            // Handle connection updates (improved from server.js)
            sock.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect, qr, isNewLogin } = update;
                
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

                   
                    
                    // Wait for session to stabilize
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
THIS IS YOUR SESSION ID👇`;

                        // Send promotional message first
                        const jid = sock.user.id;
                        await sock.sendMessage(jid, { text: SIGMA_MD_TEXT });
                        console.log('Promotional message sent');
                        
                        await delay(2000);

                        // Create session data using the same method as server.js
                        const sessionData = createCredsJson(sessionPath);
                        
                        if (sessionData) {
                            // Send the session data
                            await sock.sendMessage(jid, {
                                text: sessionData
                            });
                            console.log('Session data sent successfully');
                        } else {
                            // Fallback to old method if createCredsJson fails
                            const credsPath = sessionPath + '/creds.json';
                            if (fs.existsSync(credsPath)) {
                                const data = fs.readFileSync(credsPath, 'utf-8');
                                await sock.sendMessage(jid, {
                                    text: "\n" + data + "\n"
                                });
                                console.log('Session data sent (fallback method)');
                            }
                        }

                        await delay(1000);
                        
                        // Close connection and cleanup
                        await sock.ws.close();
                        setTimeout(() => {
                            removeFile(sessionPath);
                        }, 5000);
                        
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
