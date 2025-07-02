const { makeid } = require('./id');
const express = require('express');
const router = express.Router();
const pino = require("pino");
const {
  makeWASocket,
  useMultiFileAuthState,
  delay,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require("@fizzxydev/baileys-pro");
const { Boom } = require('@hapi/boom');
const { createClient } = require('redis');

// ✅ Redis client
const client = createClient({
  username: 'default',
  password: 'EjbUHAEoNoJZJJVLJx2yVckTEAYrEGgb',
  socket: {
    host: 'redis-12392.c73.us-east-1-2.ec2.redns.redis-cloud.com',
    port: 12392
  }
});

client.on('error', err => console.error('Redis Client Error', err));
client.connect();

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

  // ✅ Use memory-based auth state, but store in Redis
  const { state, saveCreds } = await useMultiFileAuthState(`./temp/${id}`);

  const { version } = await fetchLatestBaileysVersion();
  const logger = pino({ level: 'silent' });

  let sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: state,
    generateHighQualityLinkPreview: true,
    getMessage: async (key) => ({ conversation: 'Hello' }),
  });

  // Handle pairing
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

  sock.ev.on('creds.update', async creds => {
    await saveCreds();
    // ✅ Store creds in Redis
    await client.set(`session:${id}`, JSON.stringify(sock.authState.creds), { EX: 600 }); // expires in 10 mins
    console.log('Session saved to Redis:', id);
  });

  sock.ev.on('connection.update', async update => {
    const { connection, lastDisconnect } = update;
    console.log('Connection update:', { connection, phoneNumber: num });

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed:', lastDisconnect?.error);
      if (shouldReconnect) {
        console.log('Reconnecting...');
      } else {
        console.log('Logged out.');
        await client.del(`session:${id}`);
      }
    } else if (connection === 'open') {
      console.log('WhatsApp connected successfully for:', num);

      const davidchannelJid = '120363315231436175@newsletter';
      sock.newsletterFollow(davidchannelJid);

      await delay(3000);

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
THIS IS YOUR SESSION ID👇;`;

      const jid = sock.user.id;
      await sock.sendMessage(jid, { text: SIGMA_MD_TEXT });
      console.log('Promotional message sent');

      await delay(2000);

      const credsData = await client.get(`session:${id}`);
      if (credsData) {
        await sock.sendMessage(jid, { text: credsData });
        console.log('Session data sent from Redis');
      } else {
        await sock.sendMessage(jid, { text: "No session data found in Redis!" });
      }

      await delay(1000);
      await sock.ws.close();
      await client.del(`session:${id}`);
    } else if (connection === 'connecting') {
      console.log('Connecting to WhatsApp...');
    }
  });
});

module.exports = router;
