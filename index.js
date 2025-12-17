require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, IntentsBitField, Collection } = require("discord.js");
const { initLavalink } = require("./utils/lavalink");

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
        console.log(`✅ Slash Command loaded: /${command.data.name}`);
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
        console.log(`✅ Event loaded (once): ${event.name}`);
    } else {
        client.on(event.name, (...args) => event.execute(...args));
        console.log(`✅ Event loaded: ${event.name}`);
    }
}

// Handle messages
client.on("messageCreate", (message) => {
    if (message.author.bot) return;

    // Respon halo
    const haloKeywords = ["halo", "hai", "hello", "hi", "hey"];
    const content = message.content.toLowerCase();
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
    console.error("Client error:", error);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection:", reason);
});

// Init Lavalink
initLavalink(client);

// Login bot
client.login(process.env.DISCORD_TOKEN);
