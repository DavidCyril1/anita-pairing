const express = require("express");
const fs = require("fs");
const { makeid } = require("./id");
const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const pino = require("pino");

let router = express.Router();

function removeFile(path) {
    if (fs.existsSync(path)) fs.rmSync(path, { recursive: true, force: true });
}

router.get("/", async (req, res) => {
    const id = makeid();
    let number = req.query.number;
    if (!number) return res.status(400).send({ error: "Number is required" });

    const tempPath = `./temp/${id}`;
    const { state, saveCreds } = await useMultiFileAuthState(tempPath);

    const sock = makeWASocket({
        logger: pino({ level: "fatal" }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (!sock.authState.creds.registered) {
        try {
            number = number.replace(/[^0-9]/g, "");
            const code = await sock.requestPairingCode(number);
            if (!res.headersSent) res.send({ code });
        } catch (err) {
            console.error("Error generating pairing code:", err);
            if (!res.headersSent) res.send({ code: "Error generating code" });
            return removeFile(tempPath);
        }
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
        if (connection === "open") {
            await sock.sendMessage(sock.user.id, {
                text: `*CONNECTED SUCCESSFULLY ✅*\n\nFollow our channels below:\n• WhatsApp: https://whatsapp.com/channel/0029VaeRru3ADTOEKPCPom0L\n• Telegram: https://t.me/davidcyriltechs\n• YouTube: https://www.youtube.com/@DavidCyril_TECH\n\n*YOUR SESSION ID:*`
            });

            const creds = fs.readFileSync(`${tempPath}/creds.json`, "utf-8");
            await sock.sendMessage(sock.user.id, {
                text: "```\n" + creds + "\n```"
            });

            await sock.ws.close();
            removeFile(tempPath);
        } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
            setTimeout(() => {
                sock.ev.removeAllListeners();
                router.handle(req, res);
            }, 10000);
        }
    });
});

module.exports = router;