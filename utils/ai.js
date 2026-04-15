const { OpenAI } = require("openai");

const openai = new OpenAI({
    apiKey: process.env.QWEN_API_KEY,
    baseURL: "https://api.mulerouter.ai/vendors/openai/v1",
});

async function askQwen(question) {
    if (!process.env.QWEN_API_KEY) {
        return " QWEN_API_KEY belum di-setup di file .env!";
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "Qwen3.5-Plus",
            messages: [
                {
                    role: "system",
                    content:
                        "Kamu adalah asisten Discord bot yang ramah bernama Bebot. Jawablah dengan sangat singkat, jelas, dan santai tanpa penjelasan bertele-tele.",
                },
                {
                    role: "user",
                    content: question,
                },
            ],
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error("Error asking Qwen API:", error.message);
        return "Maaf, aku lagi pusing atau ada masalah sama koneksi API-nya nih. Coba lagi nanti ya!";
    }
}

module.exports = { askQwen };
