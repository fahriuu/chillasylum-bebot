require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, IntentsBitField, Collection } = require("discord.js");
const { initLavalink } = require("./utils/lavalink");
const { Api: TopggApi } = require("@top-gg/sdk");

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildVoiceStates,
    ],
});

// Collections untuk commands
client.commands = new Collection();
client.prefixCommands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    // Slash commands
    if ("data" in command && "execute" in command && !command.prefix) {
        client.commands.set(command.data.name, command);
    }
    // Prefix commands
    else if (command.prefix && "name" in command && "execute" in command) {
        client.prefixCommands.set(command.name, command);
        console.log(`✅ Prefix Command loaded: !${command.name}`);
    }
}

// Load events
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Bad words filter (kata kasar Indonesia + English)
const badWords = [
    "anjing",
    "anjg",
    "anjir",
    "ajg",
    "anj",
    "bangsat",
    "bgst",
    "bngst",
    "kontol",
    "kntl",
    "memek",
    "mmk",
    "goblok",
    "goblog",
    "gblk",
    "tolol",
    "tll",
    "bego",
    "bodoh",
    "idiot",
    "tai",
    "taik",
    "tahi",
    "kampret",
    "kmprt",
    "bajingan",
    "bjngn",
    "setan",
    "iblis",
    "babi",
    "monyet",
    "pepek",
    "ngentot",
    "ngewe",
    "asu",
    "jancok",
    "jancuk",
    "cok",
    "bacot",
    "bcot",
    "bacod",
    "fuck",
    "fak",
    "fck",
    "fuk",
    "shit",
    "bitch",
    "ass",
    "bangke",
    "bgke",
];

// Handle messages
client.on("messageCreate", (message) => {
    if (message.author.bot) return;

    const content = message.content.toLowerCase();

    // Check for bad words (any message)
    const hasBadWord = badWords.some((word) => content.includes(word));
    if (hasBadWord) {
        const warnings = [
            `Hei <@${message.author.id}>, tolong jaga omonganmu ya memek`,
            `<@${message.author.id}> Ehh, mulutnya kaya ga di sekolahin`,
            `<@${message.author.id}> pepek so a6 lo kontol`,
            `Sabar <@${message.author.id}>, dek `,
            `<@${message.author.id}> so cakep lu kodok`,
        ];
        const randomWarning =
            warnings[Math.floor(Math.random() * warnings.length)];
        message.reply(randomWarning);
        return;
    }

    // Respon halo
    const haloKeywords = ["halo", "hai", "hello", "hi", "hey"];
    if (haloKeywords.some((word) => content.includes(word))) {
        message.reply(`👋 Halo <@${message.author.id}>!`);
        return;
    }

    // Handle prefix commands
    const prefix = "!";
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.prefixCommands.get(commandName);
    if (!command) return;

    try {
        command.execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply({
            content: "❌ Ada error saat menjalankan command!",
        });
    }
});

// Handle error
client.on("error", (error) => {
    console.error("Client error:", error.message);
});

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error.message);
});

// Graceful shutdown
process.on("SIGINT", () => {
    client.destroy();
    process.exit(0);
});

process.on("SIGTERM", () => {
    client.destroy();
    process.exit(0);
});

// Init Lavalink
initLavalink(client);

// Init Top.gg stat posting (if token provided)
if (process.env.TOPGG_TOKEN) {
    const topgg = new TopggApi(process.env.TOPGG_TOKEN);

    const postTopggStats = async () => {
        try {
            await topgg.postStats({
                serverCount: client.guilds.cache.size,
            });
            console.log(`✅ Top.gg stats posted: ${client.guilds.cache.size} servers`);
        } catch (error) {
            console.error("❌ Top.gg post stats error:", error.message);
        }
    };

    // Post stats once bot is ready, then every 30 minutes
    client.once("clientReady", () => {
        postTopggStats();
        setInterval(postTopggStats, 30 * 60 * 1000);
        console.log("🔝 Top.gg stat poster initialized");
    });
} else {
    console.log("⚠️ Top.gg token not found - stats posting disabled");
}

// Login bot
client.login(process.env.DISCORD_TOKEN);
