const { Api, Webhook } = require("@top-gg/sdk");

let topggApi = null;
let topggWebhook = null;

// Initialize Top.gg API
function initTopggApi() {
    if (!process.env.TOPGG_TOKEN) {
        console.log(" Top.gg token not configured");
        return null;
    }

    try {
        topggApi = new Api(process.env.TOPGG_TOKEN);
        console.log("Top.gg API initialized");
        return topggApi;
    } catch (error) {
        console.error(" Failed to initialize Top.gg API:", error.message);
        return null;
    }
}

// Initialize Top.gg Webhook (for vote notifications)
function initTopggWebhook(port = 3000) {
    if (!process.env.TOPGG_WEBHOOK_SECRET) {
        console.log(" Top.gg webhook secret not configured");
        return null;
    }

    try {
        topggWebhook = new Webhook(process.env.TOPGG_WEBHOOK_SECRET);
        console.log(` Top.gg Webhook initialized on port ${port}`);
        return topggWebhook;
    } catch (error) {
        console.error(" Failed to initialize Top.gg Webhook:", error.message);
        return null;
    }
}

// Check if user has voted
async function hasVoted(userId) {
    if (!topggApi) {
        topggApi = initTopggApi();
        if (!topggApi) return false;
    }

    try {
        const hasVoted = await topggApi.hasVoted(userId);
        return hasVoted;
    } catch (error) {
        console.error("Error checking vote status:", error.message);
        return false;
    }
}

// Get bot stats from Top.gg
async function getBotStats(botId) {
    if (!topggApi) {
        topggApi = initTopggApi();
        if (!topggApi) return null;
    }

    try {
        const stats = await topggApi.getBot(botId);
        return stats;
    } catch (error) {
        console.error("Error getting bot stats:", error.message);
        return null;
    }
}

// Get bot votes
async function getBotVotes() {
    if (!topggApi) {
        topggApi = initTopggApi();
        if (!topggApi) return [];
    }

    try {
        const votes = await topggApi.getVotes();
        return votes;
    } catch (error) {
        console.error("Error getting bot votes:", error.message);
        return [];
    }
}

// Post bot stats manually (AutoPoster does this automatically)
async function postStats(client) {
    if (!topggApi) {
        topggApi = initTopggApi();
        if (!topggApi) return false;
    }

    try {
        await topggApi.postStats({
            serverCount: client.guilds.cache.size,
            shardCount: client.shard?.count || 0,
        });
        console.log(
            `Posted stats to Top.gg: ${client.guilds.cache.size} servers`,
        );
        return true;
    } catch (error) {
        console.error("Error posting stats:", error.message);
        return false;
    }
}

// Get user info from Top.gg
async function getUser(userId) {
    if (!topggApi) {
        topggApi = initTopggApi();
        if (!topggApi) return null;
    }

    try {
        const user = await topggApi.getUser(userId);
        return user;
    } catch (error) {
        console.error("Error getting user info:", error.message);
        return null;
    }
}

module.exports = {
    initTopggApi,
    initTopggWebhook,
    hasVoted,
    getBotStats,
    getBotVotes,
    postStats,
    getUser,
};
