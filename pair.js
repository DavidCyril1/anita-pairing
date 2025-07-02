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
const path = require('path');

// ⚡️ Setup Redis client
const redisClient = createClient({
  username: 'default',
  password: 'EjbUHAEoNoJZJJVLJx2yVckTEAYrEGgb',
  socket: {
    host: 'redis-12392.c73.us-east-1-2.ec2.redns.redis-cloud.com',
    port: 12392
  }
});
redisClient.connect().then(() => console.log('✅ Redis connected')).catch(console.error);

function removeSessionFromRedis(sessionId) {
  return redisClient.del(`session:${sessionId}`);
}

// Replace file-based creds handling with Redis
const useRedisAuthState = async (id) => {
  const credsKey = `session:${id}:creds`;
  const keysKey = `session:${id}:keys`;

  let creds = {};
  let keys = {};

  // Load creds if exist
  const credsStr = await redisClient.get(credsKey);
  if (credsStr) creds = JSON.parse(credsStr);

  const keysStr = await redisClient.get(keysKey);
  if (keysStr) keys = JSON.parse(keysStr);

  return {
    state: {
      creds,
      keys
    },
    saveCreds: async (newCreds) => {
      await redisClient.set(credsKey, JSON.stringify(newCreds.creds));
      await redisClient.set(keysKey, JSON.stringify(newCreds.keys));
    }
  };
};

// Create combined creds JSON from Redis
const createCredsJson = async (sessionId) => {
  const credsStr = await redisClient.get(`session:${sessionId}:creds`);
  const keysStr = await redisClient.get(`session:${sessionId}:keys`);

  let combined = {};
  if (credsStr) combined = { ...JSON.parse(credsStr) };
  if (keysStr) combined.keys = JSON.parse(keysStr);
  combined.timestamp = new Date().toISOString();

  return JSON.stringify(combined);
};

router.get('/', async (req, res) => {
  const id = makeid();
  let num = req.query.number;

  if (!num) return res.status(400).json({ error: 'Phone number is required' });

  num = num.replace(/[^0-9]/g, '');
  if (num.length < 10) return res.status(400).json({ error: 'Invalid phone number format' });

  async function SIGMA_MD_PAIR_CODE() {
    try {
      const { state, saveCreds } = await useRedisAuthState(id);
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
            console.log('Reconnecting...');
            setTimeout(() => SIGMA_MD_PAIR_CODE(), 5000);
          } else {
            console.log('Logged out, cleaning up...');
            await removeSessionFromRedis(id);
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
THIS IS YOUR SESSION ID👇;`;

            const jid = sock.user.id;
            await sock.sendMessage(jid, { text: SIGMA_MD_TEXT });
            console.log('Promotional message sent');

            await delay(2000);

            const sessionData = await createCredsJson(id);
            if (sessionData) {
              await sock.sendMessage(jid, { text: sessionData });
              console.log('Session data sent successfully');
            }

            await delay(1000);
            await sock.ws.close();
            setTimeout(() => removeSessionFromRedis(id), 5000);

          } catch (error) {
            console.error('Error sending session data:', error);
            await removeSessionFromRedis(id);
          }
        } else if (connection === 'connecting') {
          console.log('Connecting to WhatsApp...');
        }
      });

    } catch (err) {
      console.error("Error in SIGMA_MD_PAIR_CODE:", err);
      await removeSessionFromRedis(id);
      if (!res.headersSent) {
        res.status(500).json({ error: "Service Unavailable", details: err.message });
      }
    }
  }

  return await SIGMA_MD_PAIR_CODE();
});

module.exports = router;
