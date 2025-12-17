const SpotifyWebApi = require("spotify-web-api-node");

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

let tokenExpiry = 0;

async function refreshToken() {
    if (Date.now() < tokenExpiry) return;

    try {
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body.access_token);
        tokenExpiry = Date.now() + (data.body.expires_in - 60) * 1000;
    } catch (error) {
        console.error("Spotify token error:", error);
    }
}

function isSpotifyUrl(url) {
    return url.includes("open.spotify.com") || url.includes("spotify.com");
}

function parseSpotifyUrl(url) {
    const trackMatch = url.match(/track\/([a-zA-Z0-9]+)/);
    const albumMatch = url.match(/album\/([a-zA-Z0-9]+)/);
    const playlistMatch = url.match(/playlist\/([a-zA-Z0-9]+)/);

    if (trackMatch) return { type: "track", id: trackMatch[1] };
    if (albumMatch) return { type: "album", id: albumMatch[1] };
    if (playlistMatch) return { type: "playlist", id: playlistMatch[1] };
    return null;
}

async function getSpotifyTrack(trackId) {
    await refreshToken();

    try {
        const data = await spotifyApi.getTrack(trackId);
        const track = data.body;

        return {
            title: track.name,
            artist: track.artists.map((a) => a.name).join(", "),
            duration: formatDuration(track.duration_ms),
            thumbnail: track.album.images[0]?.url,
            query: `${track.name} ${track.artists[0].name}`,
        };
    } catch (error) {
        console.error("Spotify getTrack error:", error);
        return null;
    }
}

async function getSpotifyAlbum(albumId) {
    await refreshToken();

    try {
        const data = await spotifyApi.getAlbumTracks(albumId, { limit: 50 });
        const albumInfo = await spotifyApi.getAlbum(albumId);
        const tracks = data.body.items;

        return tracks.map((track) => ({
            title: track.name,
            artist: track.artists.map((a) => a.name).join(", "),
            duration: formatDuration(track.duration_ms),
            thumbnail: albumInfo.body.images[0]?.url,
            query: `${track.name} ${track.artists[0].name}`,
        }));
    } catch (error) {
        console.error("Spotify getAlbum error:", error);
        return null;
    }
}

async function getSpotifyPlaylist(playlistId) {
    await refreshToken();

    try {
        const data = await spotifyApi.getPlaylistTracks(playlistId, {
            limit: 50,
        });
        const playlistInfo = await spotifyApi.getPlaylist(playlistId);
        const tracks = data.body.items.filter((item) => item.track);

        return tracks.map((item) => ({
            title: item.track.name,
            artist: item.track.artists.map((a) => a.name).join(", "),
            duration: formatDuration(item.track.duration_ms),
            thumbnail: playlistInfo.body.images[0]?.url,
            query: `${item.track.name} ${item.track.artists[0].name}`,
        }));
    } catch (error) {
        console.error("Spotify getPlaylist error:", error);
        return null;
    }
}

function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

async function getPlaylistInfo(id, type) {
    await refreshToken();

    try {
        if (type === "playlist") {
            const data = await spotifyApi.getPlaylist(id);
            return {
                name: data.body.name,
                thumbnail: data.body.images[0]?.url,
                owner: data.body.owner.display_name,
            };
        } else if (type === "album") {
            const data = await spotifyApi.getAlbum(id);
            return {
                name: data.body.name,
                thumbnail: data.body.images[0]?.url,
                owner: data.body.artists[0]?.name,
            };
        }
    } catch (error) {
        console.error("Spotify getPlaylistInfo error:", error.message);
        return null;
    }
}

module.exports = {
    isSpotifyUrl,
    parseSpotifyUrl,
    getSpotifyTrack,
    getSpotifyAlbum,
    getSpotifyPlaylist,
    getPlaylistInfo,
};
