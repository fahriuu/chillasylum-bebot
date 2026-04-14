const https = require("https");

function isDeezerUrl(url) {
    return url.includes("deezer.com") || url.includes("deezer.page.link");
}

function parseDeezerUrl(url) {
    const trackMatch = url.match(/track\/([0-9]+)/);
    const albumMatch = url.match(/album\/([0-9]+)/);
    const playlistMatch = url.match(/playlist\/([0-9]+)/);

    if (trackMatch) return { type: "track", id: trackMatch[1] };
    if (albumMatch) return { type: "album", id: albumMatch[1] };
    if (playlistMatch) return { type: "playlist", id: playlistMatch[1] };
    return null;
}

function fetchDeezerAPI(endpoint) {
    return new Promise((resolve, reject) => {
        const url = `https://api.deezer.com${endpoint}`;
        https.get(url, (res) => {
            let data = "";
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                try {
                    const json = JSON.parse(data);
                    if (json.error) {
                        reject(new Error(json.error.message));
                    } else {
                        resolve(json);
                    }
                } catch (error) {
                    reject(error);
                }
            });
        }).on("error", (error) => {
            reject(error);
        });
    });
}

function formatDuration(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
}

async function getDeezerTrack(trackId) {
    try {
        const track = await fetchDeezerAPI(`/track/${trackId}`);
        return {
            title: track.title,
            artist: track.artist.name,
            duration: formatDuration(track.duration),
            thumbnail: track.album.cover_xl || track.album.cover_big,
            uri: track.link,
            query: `${track.title} ${track.artist.name}`
        };
    } catch (error) {
        console.error(`❌ Deezer getTrack error for ID ${trackId}:`, error.message);
        return null;
    }
}

async function getDeezerAlbum(albumId) {
    try {
        const album = await fetchDeezerAPI(`/album/${albumId}`);
        return album.tracks.data.map(track => ({
            title: track.title,
            artist: track.artist.name,
            duration: formatDuration(track.duration),
            thumbnail: album.cover_xl || album.cover_big,
            uri: track.link,
            query: `${track.title} ${track.artist.name}`
        }));
    } catch (error) {
        console.error(`❌ Deezer getAlbum error for ID ${albumId}:`, error.message);
        return null;
    }
}

async function getDeezerPlaylist(playlistId) {
    try {
        const playlist = await fetchDeezerAPI(`/playlist/${playlistId}`);
        return playlist.tracks.data.map(track => ({
            title: track.title,
            artist: track.artist.name,
            duration: formatDuration(track.duration),
            thumbnail: playlist.picture_xl || playlist.picture_big,
            uri: track.link,
            query: `${track.title} ${track.artist.name}`
        }));
    } catch (error) {
        console.error(`❌ Deezer getPlaylist error for ID ${playlistId}:`, error.message);
        return null;
    }
}

async function getPlaylistInfo(id, type) {
    try {
        let endpoint = type === 'playlist' ? `/playlist/${id}` : `/album/${id}`;
        const data = await fetchDeezerAPI(endpoint);
        return {
            name: data.title,
            thumbnail: data.picture_xl || data.cover_xl || data.picture_big || data.cover_big,
            owner: type === 'playlist' ? data.creator.name : data.artist.name,
            uri: data.link
        };
    } catch (error) {
        return null;
    }
}

module.exports = {
    isDeezerUrl,
    parseDeezerUrl,
    getDeezerTrack,
    getDeezerAlbum,
    getDeezerPlaylist,
    getPlaylistInfo
};
