const { makeid } = require('./id');
const QRCode = require('qrcode');
const express = require('express');
const path = require('path');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    jidNormalizedUser,
    Browsers,
    delay,
    makeInMemoryStore,
} = require("baileys");

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
};

router.get('/', async (req, res) => {
    const id = makeid();

    async function SIGMA_MD_QR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);

        try {
            let Qr_Code_By_David_Cyril = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                browser: Browsers.macOS("Desktop"),
            });

            Qr_Code_By_David_Cyril.ev.on('creds.update', saveCreds);

            Qr_Code_By_David_Cyril.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect, qr } = s;

                if (qr && !res.headersSent) {
                    return res.end(await QRCode.toBuffer(qr));
                }

                if (connection === "open") {
                    await delay(5000);

                    // Read creds file
                    const data = fs.readFileSync(__dirname + `/temp/${id}/creds.json`, 'utf-8');
                    await delay(800);

                    // Send creds.json content first
                    const session = await Qr_Code_By_David_Cyril.sendMessage(
                        Qr_Code_By_David_Cyril.user.id,
                        { text: data }
                    );

                    // Promo message after creds.json
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

                    await Qr_Code_By_David_Cyril.sendMessage(
                        Qr_Code_By_David_Cyril.user.id,
                        { text: SIGMA_MD_TEXT },
                        { quoted: session }
                    );

                    await delay(100);
                    await Qr_Code_By_David_Cyril.ws.close();
                    return removeFile(`./temp/${id}`);
                }

                if (
                    connection === "close" &&
                    lastDisconnect &&
                    lastDisconnect.error &&
                    lastDisconnect.error.output.statusCode !== 401
                ) {
                    await delay(10000);
                    SIGMA_MD_QR_CODE();
                }
            });

        } catch (err) {
            if (!res.headersSent) {
                await res.json({ code: "Service Unavailable" });
            }
            console.log(err);
            removeFile(`./temp/${id}`);
        }
    }

    return await SIGMA_MD_QR_CODE();
});

module.exports = router;
