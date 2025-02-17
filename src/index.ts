import express from 'express';
import axios from 'axios';
import { Request,Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3000;
const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0/YOUR_PHONE_NUMBER_ID/messages';
const GOOGLE_GEMINI_API = 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateText?key=YOUR_API_KEY';

app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = "hashim";

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log("Webhook verified successfully.");
        res.status(200).send(challenge);
    } else {
        res.status(403).send('Verification failed.');
    }
});


// Handle incoming WhatsApp messages
app.post('/webhook', express.json(), async (req, res): Promise<void> => {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    console.log('Message:', message);
    if (!message) {
        res.sendStatus(200);
        return;
    }

    const userPhone = message.from;
    // if (message.type === 'text') {
    //     const userText = message.text.body;
    //     const calories = await estimateCalories(userText);
    //     await sendWhatsAppMessage(userPhone, `Estimated Calories: ${calories} kcal`);
    // } else if (message.type === 'image') {
    //     await sendWhatsAppMessage(userPhone, 'Processing image...');
    //     // YOLO/MobileNet image processing logic here
    // }

    res.sendStatus(200);
});



app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
