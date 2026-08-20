require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// 1. Webhook Verification (Meta/WhatsApp ke liye zaroori hai)
app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
    
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

// 2. Incoming WhatsApp Messages Handler
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;

        if (body.object === 'whatsapp_business_account') {
            const entry = body.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;
            const messageData = value?.messages?.[0];

            if (messageData) {
                const senderPhone = messageData.from; // User ka WhatsApp Number
                const messageText = messageData.text?.body; // User ka message
                const messageId = messageData.id;

                console.log(Received message from ${senderPhone}: ${messageText});

                // Data ko n8n webhook par forward karna
                const n8nPayload = {
                    senderPhone,
                    messageText,
                    messageId,
                    timestamp: messageData.timestamp
                };

                // n8n ko trigger karein aur response ka wait karein (ya asynchronous rakhein)
                const n8nResponse = await axios.post(N8N_WEBHOOK_URL, n8nPayload);
                
                // Agar n8n se direct reply milta hai toh WhatsApp par bhej dein
                if (n8nResponse.data && n8nResponse.data.reply) {
                    await sendWhatsAppMessage(senderPhone, n8nResponse.data.reply);
                }
            }

            res.status(200).send('EVENT_RECEIVED');
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('Error processing webhook:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

// WhatsApp par message bhejne ka function
async function sendWhatsAppMessage(recipientPhone, messageBody) {
    try {
        await axios.post(
            https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages,
            {
                messaging_product: 'whatsapp',
                to: recipientPhone,
                text: { body: messageBody }
            },
            {
                headers: {
                    'Authorization': Bearer ${WHATSAPP_TOKEN},
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log(Reply sent successfully to ${recipientPhone});
    } catch (error) {
        console.error('Error sending WhatsApp message:', error.response?.data || error.message);
    }
}

app.listen(PORT, () => {
    console.log(WhatsApp Agent Server is running on port ${PORT});
});