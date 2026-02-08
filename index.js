const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const express = require('express');
require('dotenv').config();

// Express server
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Tokenni shu yerga qo'ying (BotFather'dan olingan token)
const token = process.env.BOT_TOKEN || '7972728722:AAGu6_3MqTX1IO43pWj6y1SerKXa3U0qtMU';

// Botni yaratish (polling true bo'lishi kerak, shunda bot xabarlarni tekshirib turadi)
const bot = new TelegramBot(token, { polling: true });

// Ma'lumotlar bazasi fayli
const DB_FILE = path.join(__dirname, 'data.json');

// Ma'lumotlarni yuklash funksiyasi
function loadData() {
    if (fs.existsSync(DB_FILE)) {
        try {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            console.error('Error reading database:', err);
            return {};
        }
    }
    return {};
}

// Ma'lumotlarni saqlash funksiyasi
function saveData(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error writing database:', err);
    }
}

// Foydalanuvchilar ma'lumotlarini saqlash
// Tuzilishi: { chatId: { state: 'REGISTERING' | 'SELECTING' | 'DONE', name: 'Alisher' } }
let users = loadData();

// States
const STATE_REGISTERING = 'REGISTERING';
const STATE_SELECTING = 'SELECTING';
const STATE_DONE = 'DONE';

// /start komandasiga javob
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    // Agar foydalanuvchi birinchi marta kirayotgan bo'lsa
    if (!users[chatId]) {
        users[chatId] = { state: STATE_REGISTERING };
        saveData(users);
        bot.sendMessage(chatId, "Assalomu alaykum! Iltimos, ism va familiyangizni yozib yuboring:");
        return;
    }

    // Agar allaqachon tugatgan bo'lsa
    if (users[chatId].state === STATE_DONE) {
        bot.sendMessage(chatId, "Siz allaqachon tanlab bo'lgansiz. Qayta urinish mumkin emas.");
        return;
    }

    // Agar ro'yxatdan o'tish jarayonida bo'lsa
    if (users[chatId].state === STATE_REGISTERING) {
        bot.sendMessage(chatId, "Iltimos, ism va familiyangizni yozib yuboring:");
        return;
    }

    // Agar raqam tanlash jarayonida bo'lsa (lekin qayta start bosgan bo'lsa)
    if (users[chatId].state === STATE_SELECTING) {
        sendNumberKeyboard(chatId, `Siz ro'yxatdan o'tgansiz (${users[chatId].name}). Davom etish uchun raqam tanlang:`);
    }
});

// Xabarlarni tinglash
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // /start komandasi yuqorida handled qilingan, bu yerga kirmasligi kerak yoki ignored
    if (text === '/start') return;

    // Agar foydalanuvchi bazada yo'q bo'lsa (masalan bot restart bo'lganda), uni qayta start bosishga majburlashimiz mumkin
    // yoki shunchaki yangi user deb olishimiz mumkin. Keling, yangi user deb olaylik.
    if (!users[chatId]) {
        users[chatId] = { state: STATE_REGISTERING };
        saveData(users);
        // Ismni qabul qilish o'rniga, start bosishni so'raymiz yoki to'g'ridan-to'g'ri ism deb qabul qilamiz?
        // Mantiqan birinchi xabar ism bo'lishi ehtimoli katta agar start bosgandan keyin yozsa.
        // Lekin xavfsizlik uchun start bosishni so'ragan ma'qul.
        bot.sendMessage(chatId, "Botni ishga tushirish uchun /start ni bosing.");
        return;
    }

    const user = users[chatId];

    // 1. RO'YXATDAN O'TISH BOSQICHI
    if (user.state === STATE_REGISTERING) {
        user.name = text; // Ismni saqlab qo'yamiz
        user.state = STATE_SELECTING;
        saveData(users);

        sendNumberKeyboard(chatId, `Rahmat, ${user.name}! Endi 1 dan 10 gacha bo'lgan raqamlardan birini tanlang va maxsus faylni qo'lga kiriting:`);
    }

    // 2. RAQAM TANLASH BOSQICHI
    else if (user.state === STATE_SELECTING) {
        if (/^([1-9]|10)$/.test(text)) {
            const number = parseInt(text);
            const filePath = path.join(__dirname, 'files', `${number}.txt`);

            if (fs.existsSync(filePath)) {
                // Holatni o'zgartiramiz, endi qayta tanlay olmaydi
                user.state = STATE_DONE;
                saveData(users);

                bot.sendMessage(chatId, `Siz ${number}-raqamni tanladingiz.`, {
                    reply_markup: {
                        remove_keyboard: true
                    }
                }).then(() => {
                    bot.sendDocument(chatId, filePath).catch((error) => {
                        console.error(error);
                        bot.sendMessage(chatId, "Faylni yuborishda xatolik yuz berdi.");
                    });
                });
            } else {
                bot.sendMessage(chatId, `Kechirasiz, ${number}-raqam uchun fayl topilmadi.`);
            }
        } else {
            // Agar noto'g'ri narsa yozsa
            bot.sendMessage(chatId, "Iltimos, pastdagi tugmalardan foydalanib raqam tanlang.");
        }
    }

    // 3. TUGATGAN BOSQICHI
    else if (user.state === STATE_DONE) {
        // Indamaymiz yoki allaqachon tugatganini eslatamiz
        // bot.sendMessage(chatId, "Siz allaqachon ishtirok etgansiz.");
    }
});

// Yordamchi funksiya: Klaviatura chiqarish
function sendNumberKeyboard(chatId, text) {
    const opts = {
        reply_markup: {
            keyboard: [
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9'],
                ['10']
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    };
    bot.sendMessage(chatId, text, opts);
}

console.log('Bot ishga tushdi...');
