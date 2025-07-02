const { makeid } = require('./id');
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require("pino");
const {
  makeWASocket,
  delay,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require("@fizzxydev/baileys-pro");
const { MongoClient } = require('mongodb');

const router = express.Router();

const mongoUrl = 'mongodb+srv://davidcyril209:85200555dcx@david.sfonwmo.mongodb.net/?retryWrites=true&w=majority&appName=David';

// Custom MongoDB-based auth state
async function useMongoAuthState(sessionId) {
  const client = new MongoClient(mongoUrl);
  await client.connect();
  const db = client.db('whatsappSessions');
  const collection = db.collection('sessions');

  // Ensure TTL index exists: delete after 5 minutes (300 seconds)
  await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 300 });

  // Load creds
  let credsDoc = await collection.findOne({ sessionId });
  let creds = credsDoc?.creds || {};

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          let doc = await collection.findOne({ sessionId });
          return ids.map(id => doc?.keys?.[type]?.[id]).filter(Boolean);
        },
        set: async (data) => {
          credsDoc = await collection.findOne({ sessionId }) || {};
          credsDoc.keys = credsDoc.keys || {};
          for (const category in data) {
            credsDoc.keys[category] = {
              ...credsDoc.keys[category],
              ...data[category],
            };
          }
          await collection.updateOne(
            { sessionId },
            {
              $set: {
                keys: credsDoc.keys,
                createdAt: new Date(),
              }
            },
            { upsert: true }
          );
        },
      },
    },
    saveCreds: async () => {
      await collection.updateOne(
        { sessionId },
        {
          $set: {
            creds: creds,
            createdAt: new Date(),
          }
        },
        { upsert: true }
      );
    },
    close: () => client.close(),
  };
}

router.get('/', async (req, res) => {
  const id = makeid();
  let num = req.query.number;

  if (!num) return res.status(400).json({ error: 'Phone number is required' });

  num = num.replace(/[^0-9]/g, '');
  if (num.length < 10) {
    return res.status(400).json({ error: 'Invalid phone number format' });
  }

  async function SIGMA_MD_PAIR_CODE() {
    const { state, saveCreds, close } = await useMongoAuthState(id);

    try {
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
        console.log('Connection update:', { connection });

        if (connection === 'close') {
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
          console.log('Connection closed:', lastDisconnect?.error);
          if (shouldReconnect) {
            setTimeout(SIGMA_MD_PAIR_CODE, 5000);
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

          // Send session ID to user so they can retrieve later
          await sock.sendMessage(jid, { text: `Session ID: ${id}` });
          console.log('Session ID sent');

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
