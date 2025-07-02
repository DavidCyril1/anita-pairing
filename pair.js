const { makeid } = require('./id');
const express = require('express');
const pino = require("pino");
const {
  makeWASocket,
  delay,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require("@fizzxydev/baileys-pro");
const { Boom } = require('@hapi/boom');
const { useMongoAuthState } = require('./auth/useMongoAuthState');

let router = express.Router();

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

  async function SIGMA_MD_PAIR_CODE() {
    try {
      const { state, saveCreds, close } = await useMongoAuthState(id);
      const { version } = await fetchLatestBaileysVersion();

      const logger = pino({ level: 'silent' });

      const sock = makeWASocket({
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

          const davidchannelJid = '120363315231436175@newsletter';
          sock.newsletterFollow(davidchannelJid);

          await delay(3000);

          const SIGMA_MD_TEXT = `
╔══╦═╗╔══╦═╦═╦╗╔╗
╚╗╗║╔╝╚╗╔╣╦╣╔╣╚╝║
╔╩╝║╚╗─║║║╩╣╚╣╔╗║
╚══╩═╝─╚╝╚═╩═╩╝╚╝

▬▬▬▬▬▬▬▬▬▬▬▬▬▬
❶  || *WhatsApp Channel* = https://whatsapp.com/channel/0029VaeRru3ADTOEKPCPom0L
▬▬▬▬▬▬▬▬▬▬▬▬▬▬
❷ || *Telegram* = https://t.me/davidcyriltechs 
▬▬▬▬▬▬▬▬▬▬▬▬▬▬
➌ || *YouTube* = https://www.youtube.com/@DavidCyril_TECH 
▬▬▬▬▬▬▬▬▬▬▬▬
THIS IS YOUR SESSION ID👇`;

          const jid = sock.user.id;
          await sock.sendMessage(jid, { text: SIGMA_MD_TEXT });

          console.log('Promotional message sent');

          await delay(2000);

          // Retrieve session doc and send
          const client = new MongoClient(process.env.MONGO_URL);
          await client.connect();
          const sessionDoc = await client.db('whatsappSessions').collection('sessions').findOne({ sessionId: id });
          await client.close();

          if (sessionDoc) {
            await sock.sendMessage(jid, { text: JSON.stringify(sessionDoc) });
            console.log('Session data sent successfully');
          } else {
            console.error('No session data found in MongoDB');
          }

          await delay(1000);
          await sock.ws.close();
          await close();
        }
      });

    } catch (err) {
      console.error("Error in SIGMA_MD_PAIR_CODE:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Service Unavailable", details: err.message });
      }
    }
  }

  return await SIGMA_MD_PAIR_CODE();
});

module.exports = router;
