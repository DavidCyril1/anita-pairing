const PastebinAPI = require('pastebin-js'),
pastebin = new PastebinAPI('EMWTMkQAVfJa9kM-MRUrxd5Oku1U7pgL')
const {makeid} = require('./id');
const QRCode = require('qrcode');
const express = require('express');
const path = require('path');
const fs = require('fs');
let router = express.Router()
const pino = require("pino");
const {
	default: Wasi_Tech,
	useMultiFileAuthState,
	jidNormalizedUser,
	Browsers,
	delay,
	makeInMemoryStore,
} = require("@whiskeysockets/baileys");

function removeFile(FilePath) {
	if (!fs.existsSync(FilePath)) return false;
	fs.rmSync(FilePath, {
		recursive: true,
		force: true
	})
};
const {
	readFile
} = require("node:fs/promises")
router.get('/', async (req, res) => {
	const id = makeid();
	async function WASI_MD_QR_CODE() {
		const {
			state,
			saveCreds
		} = await useMultiFileAuthState('./temp/' + id)
		try {
			let Qr_Code_By_Wasi_Tech = Wasi_Tech({
				auth: state,
				printQRInTerminal: false,
				logger: pino({
					level: "silent"
				}),
				browser: Browsers.macOS("Desktop"),
			});

			Qr_Code_By_Wasi_Tech.ev.on('creds.update', saveCreds)
			Qr_Code_By_Wasi_Tech.ev.on("connection.update", async (s) => {
				const {
					connection,
					lastDisconnect,
					qr
				} = s;
				if (qr) await res.end(await QRCode.toBuffer(qr));
				if (connection == "open") {
					await delay(5000);
					let data = fs.readFileSync(__dirname + `/temp/${id}/creds.json`);
					await delay(800);
				   let b64data = Buffer.from(data).toString('base64');
				   let session = await Qr_Code_By_Wasi_Tech.sendMessage(Qr_Code_By_Wasi_Tech.user.id, { text: '' + b64data });
	
				   let WASI_MD_TEXT = `
╔═══════════════════════════════════════════════╗
║ ωєℓ¢σмє тσ ωαℓℓуנαутє¢н вσт🤖🤖🤖
║✅✅✅✅✅✅✅✅✅✅                                          
║𝕎𝔸𝕃𝕃𝕐𝕁𝔸𝕐𝕋𝔼ℂℍ-𝕄𝔻 ℚℝ 𝕊ℂ𝔸ℕℕ𝔼𝔻 𝕊𝕌ℂℂ𝔼𝕊𝕊𝔽𝕌𝕃𝕃𝕐 
║████████████████████████████████████████████████
║
║         𝙍𝙚𝙖𝙙 𝙩𝙝𝙚 𝙢𝙚𝙨𝙨𝙨𝙖𝙜𝙚 𝙗𝙚𝙡𝙤𝙬  
║█▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ 
╔════════════════════════════════════════════════╗ 
║   𝕐𝕆𝕌'ℝ𝔼 𝕆ℕ𝔼 𝕊𝕋𝔼ℙ 𝕋𝕆 𝔻𝔼ℙ𝕃𝕆𝕐𝕀ℕ𝔾
║   𝕎𝔸𝕃𝕃𝕐𝕁𝔸𝕐𝕋𝔼ℂℍ-𝕄𝔻 𝔹𝕆𝕋
║▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
║❶ || ᴄʀᴇᴀᴛᴏʀ : ⋆⏤͟͞⃝🕊️ᴡᴀʟʟʏ ᴊᴀʏ ᴛᴇᴄʜ🕊️🍃࿐⃝
║▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
║ ❷ || M̳̿͟͞Y̳̿͟͞ W̳̿͟͞H̳̿͟͞A̳̿͟͞T̳̿͟͞S̳̿͟͞A̳̿͟͞P̳̿͟͞P̳̿͟͞ G̳̿͟͞R̳̿͟͞O̳̿͟͞U̳̿͟͞P̳̿͟͞👇 
║ > https://chat.whatsapp.com/HF1NuB6nFBaIwdGWgeGtni 
║▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
║❸ || 𝘾𝙤𝙣𝙩𝙖𝙘𝙩 𝙈𝙚👇 
║> https://wa.me/2348144317152
║▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
║ *2024-2099 WALLY JAY TECH*
║▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
║█▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  
║█▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  
║                                             
║      ©✌𝓣𝓗𝓐𝓝𝓚𝓢 𝓕𝓞𝓡 𝓒𝓗𝓞𝓞𝓢𝓘𝓝𝓖 𝓤𝓢✌                 
╚═══════════════════════════════════════════════════╝`
	 await Qr_Code_By_Wasi_Tech.sendMessage(Qr_Code_By_Wasi_Tech.user.id,{text:WASI_MD_TEXT},{quoted:session})



					await delay(100);
					await Qr_Code_By_Wasi_Tech.ws.close();
					return await removeFile("temp/" + id);
				} else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
					await delay(10000);
					WASI_MD_QR_CODE();
				}
			});
		} catch (err) {
			if (!res.headersSent) {
				await res.json({
					code: "Service is Currently Unavailable"
				});
			}
			console.log(err);
			await removeFile("temp/" + id);
		}
	}
	return await WASI_MD_QR_CODE()
});
module.exports = router
