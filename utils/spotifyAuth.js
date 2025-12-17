const SpotifyWebApi = require("spotify-web-api-node");
const express = require("express");
const { Collection } = require("discord.js");

// Storage untuk user tokens (in production, gunakan database)
const userTokens = new Collection();
const pendingAuths = new Collection();

const REDIRECT_URI =
    process.env.SPOTIFY_REDIRECT_URI || "http://localhost:3000/callback";
const PORT = process.env.SPOTIFY_AUTH_PORT || 3000;

let authServer = null;

// Buat Spotify API instance untuk user
function createUserSpotifyApi() {
    return new SpotifyWebApi({
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        redirectUri: REDIRECT_URI,
    });
}

// Generate auth URL untuk user
function getAuthUrl(userId) {
    const spotifyApi = createUserSpotifyApi();
    const state = `${userId}_${Date.now()}`;
    pendingAuths.set(state, { userId, timestamp: Date.now() });

    const scopes = [
        "user-library-read",
        "user-read-private",
        "playlist-read-private",
        "user-top-read",
    ];

    return spotifyApi.createAuthorizeURL(scopes, state);
}

// Handle callback dan simpan token
async function handleCallback(code, state) {
    const pending = pendingAuths.get(state);
    if (!pending) return null;

    pendingAuths.delete(state);

    const spotifyApi = createUserSpotifyApi();

    try {
        const data = await spotifyApi.authorizationCodeGrant(code);
        const { access_token, refresh_token, expires_in } = data.body;

        userTokens.set(pending.userId, {
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: Date.now() + expires_in * 1000,
        });

        return pending.userId;
    } catch (error) {
        console.error("Spotify auth error:", error);
        return null;
    }
}

// Refresh token jika expired
async function refreshUserToken(userId) {
    const tokens = userTokens.get(userId);
    if (!tokens) return false;

    if (Date.now() < tokens.expiresAt - 60000) return true;

    const spotifyApi = createUserSpotifyApi();
    spotifyApi.setRefreshToken(tokens.refreshToken);

    try {
        const data = await spotifyApi.refreshAccessToken();
        tokens.accessToken = data.body.access_token;
        tokens.expiresAt = Date.now() + data.body.expires_in * 1000;
        userTokens.set(userId, tokens);
        return true;
    } catch (error) {
        console.error("Token refresh error:", error);
        userTokens.delete(userId);
        return false;
    }
}

// Get user's Spotify API instance
async function getUserSpotifyApi(userId) {
    const tokens = userTokens.get(userId);
    if (!tokens) return null;

    const refreshed = await refreshUserToken(userId);
    if (!refreshed) return null;

    const spotifyApi = createUserSpotifyApi();
    spotifyApi.setAccessToken(tokens.accessToken);
    return spotifyApi;
}

// Check if user is connected
function isUserConnected(userId) {
    return userTokens.has(userId);
}

// Disconnect user
function disconnectUser(userId) {
    return userTokens.delete(userId);
}

// Get user's liked songs
async function getUserLikedSongs(userId, limit = 50) {
    const spotifyApi = await getUserSpotifyApi(userId);
    if (!spotifyApi) return null;

    try {
        const data = await spotifyApi.getMySavedTracks({ limit });
        return data.body.items.map((item) => ({
            title: item.track.name,
            artist: item.track.artists.map((a) => a.name).join(", "),
            duration: formatDuration(item.track.duration_ms),
            thumbnail: item.track.album.images[0]?.url,
            query: `${item.track.name} ${item.track.artists[0].name}`,
        }));
    } catch (error) {
        console.error("Get liked songs error:", error);
        return null;
    }
}

// Get user's top tracks
async function getUserTopTracks(userId, limit = 50) {
    const spotifyApi = await getUserSpotifyApi(userId);
    if (!spotifyApi) return null;

    try {
        const data = await spotifyApi.getMyTopTracks({ limit });
        return data.body.items.map((track) => ({
            title: track.name,
            artist: track.artists.map((a) => a.name).join(", "),
            duration: formatDuration(track.duration_ms),
            thumbnail: track.album.images[0]?.url,
            query: `${track.name} ${track.artists[0].name}`,
        }));
    } catch (error) {
        console.error("Get top tracks error:", error);
        return null;
    }
}

function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Start auth server
function startAuthServer() {
    if (authServer) return;

    const app = express();

    app.get("/callback", async (req, res) => {
        const { code, state } = req.query;

        if (!code || !state) {
            return res.send("❌ Invalid request");
        }

        const userId = await handleCallback(code, state);

        if (userId) {
            res.send(`
                <html>
                <body style="background:#1DB954;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
                    <div style="text-align:center;">
                        <h1>✅ Spotify Connected!</h1>
                        <p>Kamu bisa tutup halaman ini dan kembali ke Discord.</p>
                    </div>
                </body>
                </html>
            `);
        } else {
            res.send("❌ Authentication failed. Please try again.");
        }
    });

    authServer = app.listen(PORT, () => {
        console.log(`✅ Spotify Auth Server running on port ${PORT}`);
    });
}

module.exports = {
    getAuthUrl,
    isUserConnected,
    disconnectUser,
    getUserLikedSongs,
    getUserTopTracks,
    getUserSpotifyApi,
    startAuthServer,
};
