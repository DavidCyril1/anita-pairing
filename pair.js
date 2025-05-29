const express = require("express"); const fs = require("fs"); const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys"); const pino = require("pino"); let router = express.Router();

function removeFile(path) { if (fs.existsSync(path)) fs.rmSync(path, { recursive: true, force: true }); }

router.get('/', async (req, res) => { let number = req.query.number; if (!number) return res.status(400).send({ error: "Number is required" });

async function GENERATE_PAIR_CODE() {
    const sessionPath = './session';
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    try {
        let conn = makeWASocket({
            auth: state,
            logger: pino({ level: "fatal" }),
            printQRInTerminal: false,
            browser: ["Ubuntu", "Chrome", "20.0.04"]
        });

        if (!conn.authState.creds.registered) {
            number = number.replace(/[^0-9]/g, '');
            const code = await conn.requestPairingCode(number);
            if (!res.headersSent) {
                await res.send({ code });
            }
        }

        conn.ev.on('creds.update', saveCreds);

        conn.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
            if (connection === "open") {
                await conn.sendMessage(conn.user.id, {
                    text: `

▬▬▬▬▬▬▬▬▬▬▬▬▬▬ ❶  || ᴡʜᴀᴛsᴀᴘᴘ ᴄʜᴀɴɴᴇʟ = https://whatsapp.com/channel/0029VaeRru3ADTOEKPCPom0L ▬▬▬▬▬▬▬▬▬▬▬▬▬▬ ❷ || ᴛᴇʟᴇɢʀᴀᴍ = https://t.me/davidcyriltechs ▬▬▬▬▬▬▬▬▬▬▬▬▬▬ ➌ || ʏᴏᴜᴛᴜʙᴇ = https://www.youtube.com/@DavidCyril_TECH ▬▬▬▬▬▬▬▬▬▬▬▬ THIS IS YOUR SESSION ID👇` });

const data = fs.readFileSync(`${sessionPath}/creds.json`, 'utf-8');
                await conn.sendMessage(conn.user.id, {
                    text: "\n" + data + "\n"
                });

                await conn.ws.close();
                return removeFile(sessionPath);
            } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                setTimeout(GENERATE_PAIR_CODE, 10000);
            }
        });

    } catch (err) {
        console.error("service restarted", err);
        removeFile(sessionPath);
        if (!res.headersSent) {
            res.send({ code: "Service Unavailable" });
        }
    }
}

return await GENERATE_PAIR_CODE();

});

module.exports = router;

