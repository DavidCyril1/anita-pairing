const { makeid } = require('./id');
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const pino = require("pino");
const FormData = require("form-data");
const {
    makeWASocket,
    useMultiFileAuthState,
    delay,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@fizzxydev/baileys-pro");
const { Boom } = require('@hapi/boom');

const router = express.Router();

// Catbox uploader
async function catbox(filePath) {
    const data = new FormData();
    data.append('reqtype', 'fileupload');
    data.append('fileToUpload', fs.createReadStream(filePath));

    const res = await axios.post("https://catbox.moe/user/api.php", data, {
        headers: data.getHeaders()
    });
    return res.data.trim();
}

// Catbox downloader
async function downloadFromCatbox(url, outPath) {
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync(outPath, res.data);
}

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();
    const num = (req.query.number || "").replace(/[^0-9]/g, '');

    if (num.length < 10) {
        return res.status(400).json({ error: "Invalid phone number" });
    }

    const sessionId = `session_${id}`;
    const sessionFolder = path.join('./temp', sessionId);

    async function SIGMA_MD_PAIR_CODE(catboxUrl = null) {
        try {
            // download from Catbox if resuming
            if (catboxUrl) {
                console.log("Restoring session from Catbox:", catboxUrl);
                if (!fs.existsSync(sessionFolder)) {
                    fs.mkdirSync(sessionFolder, { recursive: true });
                }
                await downloadFromCatbox(catboxUrl, path.join(sessionFolder, 'creds.json'));
            }

            const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
            const { version } = await fetchLatestBaileysVersion();
            const logger = pino({ level: "silent" });

            let sock = makeWASocket({
                version,
                logger,
                auth: state,
                printQRInTerminal: false,
                getMessage: async () => ({ conversation: "Hello" }),
            });

            // pairing code
            if (!sock.authState.creds.registered) {
                setTimeout(async () => {
                    try {
                        const code = await sock.requestPairingCode(num, "CYRILDEV");
                        console.log("Pairing code:", code);
                        if (!res.headersSent) res.json({ code });
                    } catch (err) {
                        console.error("Pairing error", err);
                        if (!res.headersSent) res.status(500).json({ error: "Failed to pair" });
                    }
                }, 500);
            }

            sock.ev.on("creds.update", async () => {
                console.log("Creds updated — uploading to Catbox...");
                try {
                    const uploadedUrl = await catbox(path.join(sessionFolder, "creds.json"));
                    console.log("Session stored on Catbox at:", uploadedUrl);
                } catch (e) {
                    console.error("Failed to upload session:", e);
                }
            });

            sock.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect } = update;

                console.log("Connection update:", connection);

                if (connection === 'close') {
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    if (shouldReconnect) {
                        console.log("Reconnecting...");
                        SIGMA_MD_PAIR_CODE(catboxUrl);
                    } else {
                        console.log("Logged out, cleaning up");
                        removeFile(sessionFolder);
                    }
                } else if (connection === 'open') {
                    console.log("Connected, sending session link...");

                    await delay(3000);

                    try {
                        // upload the current creds
                        const catboxSessionUrl = await catbox(path.join(sessionFolder, "creds.json"));
                        console.log("Session uploaded to Catbox:", catboxSessionUrl);

                        const jid = sock.user.id;
                        const message = `
╔══╦═╗╔══╦═╦═╦╗╔╗
╚╗╗║╔╝╚╗╔╣╦╣╔╣╚╝║
╔╩╝║╚╗─║║║╩╣╚╣╔╗║
╚══╩═╝─╚╝╚═╩═╩╝╚╝

▬▬▬▬▬▬▬▬▬▬▬▬▬▬
❶ *WhatsApp Channel*: https://whatsapp.com/channel/0029VaeRru3ADTOEKPCPom0L
❷ *Telegram*: https://t.me/davidcyriltechs
➌ *YouTube*: https://www.youtube.com/@DavidCyril_TECH
▬▬▬▬▬▬▬▬▬▬▬▬▬▬
✅ *Session JSON stored here:* ${catboxSessionUrl}`;

                        await sock.sendMessage(jid, { text: message });

                        await delay(1000);
                        await sock.ws.close();
                        removeFile(sessionFolder);
                    } catch (e) {
                        console.error("error sending session:", e);
                        removeFile(sessionFolder);
                    }
                }
            });

        } catch (err) {
            console.error("Fatal error:", err);
            removeFile(sessionFolder);
            if (!res.headersSent) res.status(500).json({ error: "Internal error", details: err.message });
        }
    }

    await SIGMA_MD_PAIR_CODE();
});

module.exports = router;
