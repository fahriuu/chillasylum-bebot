const SpotifyWebApi = require("spotify-web-api-node");

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

let tokenExpiry = 0;

async function refreshToken() {
    if (Date.now() < tokenExpiry) return true;

    try {
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body.access_token);
        tokenExpiry = Date.now() + (data.body.expires_in - 60) * 1000;
        console.log("✅ Spotify token refreshed");
        return true;
    } catch (error) {
        console.error("Spotify token error:", error.message);
        return false;
    }
}

function isSpotifyUrl(url) {
    return url.includes("open.spotify.com") || url.includes("spotify.com");
}

function parseSpotifyUrl(url) {
    const trackMatch = url.match(/track\/([a-zA-Z0-9]+)/);
    const albumMatch = url.match(/album\/([a-zA-Z0-9]+)/);
    const playlistMatch = url.match(/playlist\/([a-zA-Z0-9]+)/);
    const artistMatch = url.match(/artist\/([a-zA-Z0-9]+)/);

    if (trackMatch) return { type: "track", id: trackMatch[1] };
    if (albumMatch) return { type: "album", id: albumMatch[1] };
    if (playlistMatch) return { type: "playlist", id: playlistMatch[1] };
    if (artistMatch) return { type: "artist", id: artistMatch[1] };
    return null;
}

async function getSpotifyTrack(trackId) {
    const tokenOk = await refreshToken();
    if (!tokenOk) return null;

    try {
        const data = await spotifyApi.getTrack(trackId);
        const track = data.body;

        return {
            title: track.name,
            artist: track.artists.map((a) => a.name).join(", "),
            duration: formatDuration(track.duration_ms),
            thumbnail: track.album.images[0]?.url,
            query: `${track.name} ${track.artists[0]?.name || ""}`,
        };
    } catch (error) {
        console.error("Spotify getTrack error:", error.message);
        return null;
    }
}

async function getSpotifyAlbum(albumId) {
    const tokenOk = await refreshToken();
    if (!tokenOk) return null;

    try {
        const data = await spotifyApi.getAlbumTracks(albumId, { limit: 50 });
        const albumInfo = await spotifyApi.getAlbum(albumId);
        const tracks = data.body.items;

        return tracks.map((track) => ({
            title: track.name,
            artist: track.artists.map((a) => a.name).join(", "),
            duration: formatDuration(track.duration_ms),
            thumbnail: albumInfo.body.images[0]?.url,
            query: `${track.name} ${track.artists[0]?.name || ""}`,
        }));
    } catch (error) {
        console.error("Spotify getAlbum error:", error.message);
        return null;
    }
}

async function getSpotifyPlaylist(playlistId) {
    const tokenOk = await refreshToken();
    if (!tokenOk) return null;

    try {
        const data = await spotifyApi.getPlaylistTracks(playlistId, {
            limit: 100,
        });
        const playlistInfo = await spotifyApi.getPlaylist(playlistId);
        const tracks = data.body.items.filter(
            (item) => item.track && item.track.name
        );

        return tracks.map((item) => ({
            title: item.track.name,
            artist: item.track.artists.map((a) => a.name).join(", "),
            duration: formatDuration(item.track.duration_ms),
            thumbnail:
                playlistInfo.body.images[0]?.url ||
                item.track.album?.images[0]?.url,
            query: `${item.track.name} ${item.track.artists[0]?.name || ""}`,
        }));
    } catch (error) {
        console.error("Spotify getPlaylist error:", error.message);
        return null;
    }
}

function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

async function getSpotifyArtistTopTracks(artistId) {
    const tokenOk = await refreshToken();
    if (!tokenOk) return null;

    try {
        const artistData = await spotifyApi.getArtist(artistId);
        const data = await spotifyApi.getArtistTopTracks(artistId, "ID");
        const tracks = data.body.tracks;

        return {
            tracks: tracks.map((track) => ({
                title: track.name,
                artist: track.artists.map((a) => a.name).join(", "),
                duration: formatDuration(track.duration_ms),
                thumbnail: track.album.images[0]?.url,
                query: `${track.name} ${track.artists[0]?.name || ""}`,
            })),
            artistInfo: {
                name: artistData.body.name,
                thumbnail: artistData.body.images[0]?.url,
            },
        };
    } catch (error) {
        console.error("Spotify getArtistTopTracks error:", error.message);
        return null;
    }
}

async function getPlaylistInfo(id, type) {
    const tokenOk = await refreshToken();
    if (!tokenOk) return null;

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
        } else if (type === "artist") {
            const data = await spotifyApi.getArtist(id);
            return {
                name: `${data.body.name} - Top Tracks`,
                thumbnail: data.body.images[0]?.url,
                owner: data.body.name,
            };
        }
    } catch (error) {
        console.error("Spotify getPlaylistInfo error:", error.message);
        return null;
    }
}

// Get recommendations based on genre seeds
async function getSpotifyRecommendations(genre, limit = 10) {
    const tokenOk = await refreshToken();
    if (!tokenOk) return null;

    try {
        const data = await spotifyApi.getRecommendations({
            seed_genres: [genre],
            limit: limit,
            min_popularity: 30,
        });

        return data.body.tracks.map((track) => ({
            title: track.name,
            artist: track.artists.map((a) => a.name).join(", "),
            duration: formatDuration(track.duration_ms),
            thumbnail: track.album.images[0]?.url,
            query: `${track.name} ${track.artists[0]?.name || ""}`,
        }));
    } catch (error) {
        console.error("Spotify recommendations error:", error.message);
        return null;
    }
}

// Get available genre seeds
async function getAvailableGenres() {
    const tokenOk = await refreshToken();
    if (!tokenOk) return null;

    try {
        const data = await spotifyApi.getAvailableGenreSeeds();
        return data.body.genres;
    } catch (error) {
        console.error("Spotify genres error:", error.message);
        return null;
    }
}

module.exports = {
    isSpotifyUrl,
    parseSpotifyUrl,
    getSpotifyTrack,
    getSpotifyAlbum,
    getSpotifyPlaylist,
    getSpotifyArtistTopTracks,
    getPlaylistInfo,
    getSpotifyRecommendations,
    getAvailableGenres,
};
