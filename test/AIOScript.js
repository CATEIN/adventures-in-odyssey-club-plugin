// AIOScript.js
const PLATFORM_NAME = "Adventures In Odyssey Club"
const PLATFORM_LINK = "app.adventuresinodyssey.com"
const BANNER_URL = "https://www.adventuresinodyssey.com/wp-content/uploads/whits-end-adventures-in-odyssey.jpg"
const PLATFORM_CHANNEL_LOGO = "https://app.adventuresinodyssey.com/icons/Icon-167.png"

const PLATFORM_AUTHOR = new PlatformAuthorLink(
  new PlatformID(PLATFORM_NAME, PLATFORM_LINK),
  PLATFORM_NAME,
  PLATFORM_LINK,
  PLATFORM_CHANNEL_LOGO
);

const aioheaders = {
  "Content-Type": "application/json",
  "Accept": "application/json",
  "x-experience-name": "Adventures In Odyssey"
};

const commentIdCache = {};
let cachedEpisodeIds = null;
let local_settings;
var config = {}

source.enable = function (conf, settings) {
  config = conf ?? {}
  local_settings = settings
  
}

function cacheEpisodeIds(fasterRandom = false) {
  if (cachedEpisodeIds !== null) {
    return cachedEpisodeIds; // Already cached
  }

  try {
    log("Caching episode IDs...");
    
    const payload = {
      community: "Adventures in Odyssey",
      pageNumber: 1,
      pageSize: 100, // Get all albums in one request
      type: "Album"
    };

    const albumsData = fetchWithErrorHandling(
      "https://fotf.my.site.com/aio/services/apexrest/v1/contentgrouping/search",
      aioheaders,
      "POST",
      payload
    );

    // Extract episode IDs from all albums
    const episodeIds = [];
    const restrictedAlbums = ["Family Portraits", "The Officer Harley Collection", "#00: The Lost Episodes", "The Truth Chronicles"];
    
    if (albumsData && albumsData.contentGroupings) {
      albumsData.contentGroupings.forEach(album => {
        // For faster random mode, don't skip any albums
        if (!fasterRandom) {
          // Skip albums with ½ symbol in name
          if (album.name && album.name.includes('½')) {
            return;
          }
          
          // Skip hard-coded restricted albums
          if (album.name && restrictedAlbums.includes(album.name)) {
            return;
          }
        }
        
        if (album.contentList && Array.isArray(album.contentList)) {
          album.contentList.forEach(episode => {
            if (episode.id && episode.type === "Audio" && episode.subtype === "Episode") {
              // Skip episodes with "BONUS!" in name (for both modes)
              const episodeName = episode.name || episode.short_name || "";
              if (episodeName.includes("BONUS!")) {
                return;
              }
              
              episodeIds.push(episode.id);
            }
          });
        }
      });
    }
    
    cachedEpisodeIds = episodeIds;
    log(`Cached ${cachedEpisodeIds.length} episode IDs`);
    return cachedEpisodeIds;
    
  } catch (error) {
    log("Failed to cache episode IDs:", error);
    cachedEpisodeIds = []; // Set to empty array to avoid retry
    return cachedEpisodeIds;
  }
}

function fetchWithErrorHandling(url, headers = {}, method = "GET", body = null) {
  let response;
  
  if (method.toUpperCase() === "POST") {
      // Convert body to JSON string if it's an object
      const postBody = typeof body === 'object' && body !== null ? JSON.stringify(body) : body;
      response = http.POST(url, postBody, headers, true);
  } else {
      response = http.GET(url, headers, true);
  }

  // Check if response is not ok
  if (!response.isOk) {
      if (response.code === 401) {
          throw new ScriptLoginRequiredException("Auth token expired. Login to fetch a new token.");
      }
      throw new Error(`HTTP Error ${response.code}: ${response.statusMessage || 'Request failed'}`);
  }

  // Always parse as JSON
  try {
      const data = JSON.parse(response.body);
      
      
      return data;
  } catch (e) {
      throw new Error(`Failed to parse JSON response: ${e.message}`);
  }
}

function formatDescription(data) {
  let out = data.description || "";

  if (data.content_body) {
    // Extract image URLs and replace with clickable [Image] links
    const cleanedContent = data.content_body
      .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, (match, src) => {
        return `<a href="${src}" target="_blank" rel="noopener noreferrer">[Image]</a>`;
      });
    
    out += `\n\n${cleanedContent}`;
  }
  if (data.air_date) {
    const dateOnly = data.air_date.split("T")[0].replace(/-/g, "/");
    out += `\n\nAir Date: ${dateOnly}`;
  }
  if (Array.isArray(data.authors) && data.authors.length) {
  const authors = data.authors
    .map(a => {
      if (a.id) {
        return `${a.role}: <a href="https://app.adventuresinodyssey.com/cast/${a.id}" target="_blank">${a.name}</a>`;
      }
      return `${a.role}: ${a.name}`;
    })
    .join("\n");
  out += "\n\n" + authors;
  }
  if (Array.isArray(data.characters) && data.characters.length) {
  const characters = data.characters
    .map(c => `<a href="https://app.adventuresinodyssey.com/characters/${c.id}" target="_blank">${c.nickname || c.name}</a>`)
    .join(", ");
  out += `\n\nCharacters: ${characters}`;
  }
  if (Array.isArray(data.tags) && data.tags.length) {
  const themes = data.tags
    .map(t => `<a href="https://app.adventuresinodyssey.com/themes/${t.topic_id}" target="_blank">${t.name}</a>`)
    .join(", ");
  out += `\n\nThemes: ${themes}`;
  }
  if (data.bible_verse) {
    out += `\n\nBible Verse: ${data.bible_verse}`;
  }
  if (data.devotional) {
    out += `\n\nDevotional: ${data.devotional}`;
  }
  if (local_settings && local_settings.debug) {
    if (data.id) {
      out += `\n\nID: ${data.id}`;
    }
    if (data.relative_air_day) {
      out += `\n\nRelative Air Day: ${data.relative_air_day}`;
    }
    if (data.recent_air_date) {
      out += `\n\nRecent Air Date: ${data.recent_air_date}`;
    }
    if (data.album_name) {
      out += `\n\nAlbum Name: ${data.album_name}`;
    }
    if (data.bookmarks) {
      out += `\n\nBookmarks: ${data.bookmarks}`;
    }
    if (data.rating_count) {
      out += `\n\nRating Count: ${data.rating_count}`;
    }
    if (data.rating_average) {
      out += `\n\nRating Average: ${data.rating_average}`;
    }
    if (data.media_format) {
      out += `\n\nMedia Format: ${data.media_format}`;
    }
    if (data.download_url) {
      out += `\n\nDownload URL: ${data.download_url}`;
    }
    if (data.signed_cookie) {
      out += `\n\nSigned Cookie: ${data.signed_cookie}`;
    }
  }
  return out;
}

function isEpisodeFree(recentAirDate) {
  const airDate = new Date(recentAirDate);
  if (isNaN(airDate.getTime())) return false; // Invalid date

  const today = new Date();
  const ageInDays = (today - airDate) / (1000 * 60 * 60 * 24);
  return ageInDays >= 0 && ageInDays <= 7; // Must be 0–7 days old, not negative (future)
}

function rankResults(items, query) {
  const lowerQuery = query.toLowerCase();

  return items.sort((a, b) => {
    const aTitle = (a.name || "").toLowerCase();
    const bTitle = (b.name || "").toLowerCase();

    // Exact match → highest priority
    const aExact = aTitle === lowerQuery;
    const bExact = bTitle === lowerQuery;
    if (aExact && !bExact) return -1;
    if (bExact && !aExact) return 1;

    // Title contains query (at start is better than in middle)
    const aIndex = aTitle.indexOf(lowerQuery);
    const bIndex = bTitle.indexOf(lowerQuery);

    if (aIndex !== -1 && bIndex === -1) return -1;
    if (bIndex !== -1 && aIndex === -1) return 1;

    if (aIndex !== -1 && bIndex !== -1) {
      // Earlier occurrence is better
      if (aIndex < bIndex) return -1;
      if (bIndex < aIndex) return 1;
    }

    // Fallback: keep original order
    return 0;
  });
}

function toPlatformPlaylist(rec) {
  // Calculate videoCount from total runtime
  const totalRuntimeMs = rec.column3?.value || 0;
  const averageEpisodeDurationMs = 23 * 60 * 1000; // 23 minutes in milliseconds
  const videoCount = Math.round(totalRuntimeMs / averageEpisodeDurationMs);

  const baseUrl = (rec.column3?.value === "Badge" || rec.column3?.value === "Adventure")
  ? "https://app.adventuresinodyssey.com/badges/"
  : "https://app.adventuresinodyssey.com/contentGroup/";


  return new PlatformPlaylist({
    id: new PlatformID(
      PLATFORM_NAME,
      PLATFORM_LINK,
      rec.id
    ),
    name: rec.column1?.value || "Untitled",
    thumbnail: rec.column2?.value || "",
    author: PLATFORM_AUTHOR,
    url: `${baseUrl}${rec.id}`,
    videoCount: videoCount
  });
}

function toPlatformVideo(rec) {
  const baseUrl = rec.column3?.value === "Adventure" 
    ? "https://app.adventuresinodyssey.com/badges/" 
    : "https://app.adventuresinodyssey.com/content/";
  
  // Format name with episode number
  const episodeName = rec.column1?.value || "Untitled";
  const episodeNumber = rec.column4?.value;
  const displayName = episodeNumber 
    ? `#${episodeNumber}: ${episodeName}`
    : episodeName;
    
  return new PlatformVideo({
    id: new PlatformID(
      PLATFORM_NAME,
      PLATFORM_LINK,
      rec.id
    ),
    name: displayName,
    url: `${baseUrl}${rec.id}`,
    thumbnails: new Thumbnails([
      new Thumbnail(rec.column2?.value || "", 128)
    ]),
    author: PLATFORM_AUTHOR,
    duration: 0,
    viewCount: 0
  });
}

// Check if a URL is a content details URL
source.isContentDetailsUrl = function(url) {
    // Check if the URL matches the pattern for AiO content URLs
    return url.startsWith('https://app.adventuresinodyssey.com/content/') ||
           url.startsWith('https://app.adventuresinodyssey.com/video?') ||
           (url.startsWith('https://app.adventuresinodyssey.com/') && 
            url.includes('/contentGroup/') && 
            url.includes('/content/')) ||
            url.startsWith('https://media.adventuresinodyssey.com/private/audio/episode');
  };

source.isPlaylistUrl = function(url) {
  return (url.startsWith('https://app.adventuresinodyssey.com/contentGroup/') && !url.includes('/content/')) ||
           url.startsWith('https://app.adventuresinodyssey.com/playlists/') ||
           url.startsWith('https://app.adventuresinodyssey.com/badges/') ||
           url.startsWith('https://app.adventuresinodyssey.com/themes/');
};
  
// Get content details from a URL
source.getContentDetails = function(url) {
  let data;
  let contentId;
  let contentGroupingId = null;

   // Check if this is a direct media URL
  if (url.startsWith('https://media.adventuresinodyssey.com/private/audio/')) {
    log("Direct media URL detected");
    
    // Direct media URLs require login
    if (!bridge.isLoggedIn()) {
      throw new ScriptLoginRequiredException("Login required to access direct media URLs");
    }
    
    // Use the fixed API URL to get the signed cookie
    const apiUrl = 'https://fotf.my.site.com/aio/services/apexrest/v1/content/a354W0000046V5fQAE?tag=true&series=true&recommendations=true&player=true&parent=true';
    data = fetchWithErrorHandling(apiUrl, aioheaders);
    
    if (!data.signed_cookie) {
      throw new UnavailableException('No signed cookie found for direct media URL');
    }
    
    // Extract cookie parameters from signed_cookie
    // Format: https://media.adventuresinodyssey.com/private/audio/episode/*?Policy=...&Signature=...&Key-Pair-Id=...
    const cookieParams = data.signed_cookie.split('*?')[1];
    
    if (!cookieParams) {
      throw new UnavailableException('Invalid signed cookie format');
    }
    
    // Normalize the URL to full format if it's a relative path
    let fullUrl = url;
    
    // Extract filename from URL
    const filename = fullUrl.split('/').pop().split('?')[0]; // Get filename without query params
    
    // Append the cookie parameters to the original URL
    const authenticatedUrl = fullUrl + '?' + cookieParams;
    
    // Create audio source descriptor with authenticated URL
    const sourceDescriptor = new UnMuxVideoSourceDescriptor(
      [],
      [
        new AudioUrlSource({
          name: filename,
          duration: 0,
          url: authenticatedUrl,
          requestModifier: {
            headers: {
              "Sec-Fetch-Dest": "audio",
              "range": "-",
            }
          }
        })
      ]
    );
    
    const details = new PlatformVideoDetails({
      id: new PlatformID(PLATFORM_NAME, PLATFORM_NAME, "direct_media"),
      thumbnails: new Thumbnails([
      new Thumbnail(PLATFORM_CHANNEL_LOGO || "", 128)
    ]),
      author: PLATFORM_AUTHOR,
      name: filename,
      uploadDate: 0,
      duration: 0,
      viewCount: 0,
      url: fullUrl,
      description: `\n\nURL: ${authenticatedUrl}`,
      video: sourceDescriptor
    });
    
    details.getContentRecommendations = function() {
      return buildRecommendations(null, null);
    };
    
    return details;
  }

  // Extract the content ID and content grouping ID from the URL
  if (url.startsWith('https://app.adventuresinodyssey.com/video?')) {
    contentId = new URLSearchParams(url.split('?')[1]).get('id');
  } else if (url.includes('/contentGroup/') && url.includes('/content/')) {
    // Handle contentGroup URLs like: /contentGroup/a31Uh000001ReNNIA0/content/a35Uh000000CupdIAC
    const parts = url.split('/');
    const contentGroupIndex = parts.indexOf('contentGroup');
    const contentIndex = parts.indexOf('content');
    
    if (contentGroupIndex !== -1 && contentIndex !== -1 && contentIndex > contentGroupIndex) {
      contentGroupingId = parts[contentGroupIndex + 1];
      contentId = parts[contentIndex + 1];
    } else {
      contentId = url.split('/').pop();
    }
  } else {
    contentId = url.split('/').pop();
  }

  log("Fetching content ID: " + contentId);
  if (contentGroupingId) {
    log("Content grouping ID: " + contentGroupingId);
  }
  log("Randomizer? " + local_settings.fetchRandomEpisode);

  // Regular content handling
  let apiUrl;
  const baseParams = "tag=true&series=true&recommendations=true&player=true&parent=true";
  
  if (bridge.isLoggedIn()) {
    // User is logged in - use the original URL
    apiUrl = `https://fotf.my.site.com/aio/services/apexrest/v1/content/${contentId}?${baseParams}`;
  } else {
    // User is not logged in - use the alternative URL with radio_page_type
    apiUrl = `https://fotf.my.site.com/aio/services/apexrest/v1/content/${contentId}?${baseParams}&radio_page_type=aired`;
  }

  // Add content_grouping_id if available
  if (contentGroupingId) {
    apiUrl += `&content_grouping_id=${contentGroupingId}`;
  }

  data = fetchWithErrorHandling(apiUrl, aioheaders);

  if (data.type !== "Audio" && data.type !== "Video") {
    log("Unsupported content type: " + data.type);
    throw new UnavailableException("No support for " + data.type + " content");
  }

  
  // Check if user is not logged in and episode requires login
  if (!bridge.isLoggedIn()) {
    const recentAirDate = data.recent_air_date;
    log("Recent air date: " + recentAirDate);
    
    // Check if it's a podcast (always free)
    if (data.subtype === "Podcast") {
      log("Podcast detected - making additional request");
      data = fetchWithErrorHandling(`https://fotf.my.site.com/aio/services/apexrest/v1/content/${contentId}?tag=true&series=true&recommendations=true&player=true&parent=true`, aioheaders);
    } else {
      const isFreeEpisode = recentAirDate ? isEpisodeFree(recentAirDate) : false;
      const hasSecretAccess = local_settings.secretVariable === true;
      
      if (!isFreeEpisode && !hasSecretAccess) {
          throw new ScriptLoginRequiredException("Login to listen to this episode");
      }
    }
  }

  if (!data.download_url) {
    throw new UnavailableException('No media URL found.');
  }

  // Create the appropriate source descriptor based on content type
  let sourceDescriptor;
  if (data.type === "Audio") {
    sourceDescriptor = new UnMuxVideoSourceDescriptor(
      [], // No video sources for audio content
      [
        new AudioUrlSource({
          name: data.short_name,
          duration: data.media_length / 1000,
          url: data.download_url,
          requestModifier: {
            headers: {
              "Sec-Fetch-Dest": "audio",
              "range": "-",
            }
          }
        })
      ]
    );
  } else {
    // For video content
    sourceDescriptor = new VideoSourceDescriptor([
      new VideoUrlSource({
        name: data.short_name,
        url: (data.stream_url && data.download_url && data.stream_url.length > data.download_url.length)
          ? data.stream_url 
          : data.download_url,
        requestModifier: {
          headers: {
            "Sec-Fetch-Dest": "video",
            "range": "-"
          }
        }
      })
    ]);
  }

  const details = new PlatformVideoDetails({
    id: new PlatformID(PLATFORM_NAME, PLATFORM_NAME, contentId),
    thumbnails: new Thumbnails([
      new Thumbnail(data.thumbnail_small || "", 128)
    ]),
    author: PLATFORM_AUTHOR,
    name: data.short_name,
    uploadDate: Math.floor(new Date(data.air_date).getTime() / 1000) || Math.floor(new Date(data.last_published_date).getTime() / 1000),
    duration: data.media_length / 1000,
    viewCount: data.views,
    url: url,
    description: formatDescription(data),
    video: sourceDescriptor
  });

  details.getContentRecommendations = function() {
    return buildRecommendations(data, contentId);
  };

  return details;
};

// Build recommendations for content
function buildRecommendations(data, contentId) {
  const videos = [];
  
  // Random episode logic
  if (local_settings.fetchRandomEpisode) {
    if (bridge.isLoggedIn() && local_settings.fasterRandom) {
      // Use cached episodes instead of API when fasterRandom is enabled
      const episodeIds = cacheEpisodeIds(true); // Pass true to skip album restrictions
      
      // Filter out the current episode ID
      const availableEpisodes = episodeIds.filter(id => id !== contentId);
      
      if (availableEpisodes.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableEpisodes.length);
        const randomEpisodeId = availableEpisodes[randomIndex];
        videos.push(new PlatformVideo({
          id: new PlatformID(PLATFORM_NAME, PLATFORM_LINK, randomEpisodeId),
          name: "🎲 Random Episode",
          url: `https://app.adventuresinodyssey.com/content/${randomEpisodeId}`,
          thumbnails: new Thumbnails([
            new Thumbnail("https://d23sy43gbewnpt.cloudfront.net/public%2Fimages%2Fcontent_body%2Fmobile-random.jpeg", 128)
          ]),
          author: PLATFORM_AUTHOR,
          duration: 0,
          viewCount: 0
        }));
      }
    } else if (bridge.isLoggedIn()) {
      // Use API if logged in and fasterRandom is false
      const randomData = fetchWithErrorHandling(
        "https://fotf.my.site.com/aio/services/apexrest/v1/content/random",
        aioheaders
      );
      videos.push(new PlatformVideo({
        id: new PlatformID(PLATFORM_NAME, PLATFORM_LINK, randomData.id),
        name: "🎲 Random Episode",
        url: `https://app.adventuresinodyssey.com/content/${randomData.id}`,
        thumbnails: new Thumbnails([
          new Thumbnail("https://d23sy43gbewnpt.cloudfront.net/public%2Fimages%2Fcontent_body%2Fmobile-random.jpeg", 128)
        ]),
        author: PLATFORM_AUTHOR,
        duration: 0,
        viewCount: 0
      }));
    } else {
      // Cache episodes and pick random one if not logged in
      const episodeIds = cacheEpisodeIds(false); // Use regular caching mode
      
      // Filter out the current episode ID
      const availableEpisodes = episodeIds.filter(id => id !== contentId);
      
      if (availableEpisodes.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableEpisodes.length);
        const randomEpisodeId = availableEpisodes[randomIndex];
        videos.push(new PlatformVideo({
          id: new PlatformID(PLATFORM_NAME, PLATFORM_LINK, randomEpisodeId),
          name: "🎲 Random Episode",
          url: `https://app.adventuresinodyssey.com/content/${randomEpisodeId}`,
          thumbnails: new Thumbnails([
            new Thumbnail("https://d23sy43gbewnpt.cloudfront.net/public%2Fimages%2Fcontent_body%2Fmobile-random.jpeg", 128)
          ]),
          author: PLATFORM_AUTHOR,
          duration: 0,
          viewCount: 0
        }));
      }
    }
  }
  
  // If data is null (direct media URL), return only random episode
  if (!data) {
    return new VideoPager(videos, false, null);
  }

  const album = data.in_album?.content_list || data.in_album || [];
  const recs = data.recommendations || [];
  
  // Handle extras - try both possible structures
  let extrasArray = [];
  if (data.extras?.content_list && Array.isArray(data.extras.content_list)) {
    extrasArray = data.extras.content_list;
  } else if (Array.isArray(data.extras)) {
    extrasArray = data.extras;
  }
  
  // Filter extras to only include Audio or Video types
  const extras = extrasArray.filter(item => {
    return item.type === "Audio" || item.type === "Video";
  });
  
  // Handle next episode (goes first)
  const nextEpisode = [];
  if (data.next_episode && (data.next_episode.type === "Audio" || data.next_episode.type === "Video")) {
    nextEpisode.push(data.next_episode);
  }
  
  // Handle previous episode (goes after album)
  const previousEpisode = [];
  if (data.previous_episode && (data.previous_episode.type === "Audio" || data.previous_episode.type === "Video")) {
    previousEpisode.push(data.previous_episode);
  }
  
  // Combine all content in the new order: next_episode, extras, album, previous_episode, recommendations
  const combined = nextEpisode.concat(extras).concat(album).concat(previousEpisode).concat(recs);

  // Remove duplicates by tracking seen IDs, and filter out current content ID
  const seenIds = new Set();
  
  const uniqueCombined = combined.filter(item => {
    // Skip if it's the current content
    if (item.id === contentId) {
      return false;
    }
    if (seenIds.has(item.id)) {
      return false;
    }
    
    seenIds.add(item.id);
    return true;
  });

  // Add this episode's navigation/album/recommendations/extras
  for (const item of uniqueCombined) {
    videos.push(new PlatformVideo({
      id: new PlatformID(PLATFORM_NAME, PLATFORM_LINK, item.id),
      name: item.short_name || item.name || "Untitled",
      url: `https://app.adventuresinodyssey.com/content/${item.id}`,
      uploadDate: Math.floor(new Date(item.air_date).getTime() / 1000) || Math.floor(new Date(item.last_published_date).getTime() / 1000) || 0,
      thumbnails: new Thumbnails([
        new Thumbnail(item.thumbnail_small || "", 128)
      ]),
      author: PLATFORM_AUTHOR,
      duration: (item.media_length || 0) / 1000,
      viewCount: item.views || 0
    }));
  }

  return new VideoPager(videos, false, null);
}

source.getPlaylist = function(url) {
  const contentGroupId = url.split('/').pop();
  log("Fetching playlist ID: " + contentGroupId);

  // Check what type of URL this is
  const isTheme = url.includes('/themes/');
  const isBadge = url.includes('/badges/');
  
  let apiEndpoint;
  if (isBadge) {
    apiEndpoint = `https://fotf.my.site.com/aio/services/apexrest/v1/badge/${contentGroupId}`;
  } else if (isTheme) {
    apiEndpoint = `https://fotf.my.site.com/aio/services/apexrest/v1/topic/${contentGroupId}`;
  } else {
    apiEndpoint = `https://fotf.my.site.com/aio/services/apexrest/v1/contentgrouping/${contentGroupId}`;
  }

  const data = fetchWithErrorHandling(apiEndpoint, aioheaders);

  let grouping = {};
  let rawList = [];
  let playlistTitle = `contentGroup ${contentGroupId}`;

  if (isBadge) {
    // Handle badge data structure
    const badge = data.badges && data.badges.length > 0 ? data.badges[0] : data;
    grouping = badge;
    
    // Extract content from badge requirements
    rawList = [];
    if (Array.isArray(badge.requirements)) {
      badge.requirements.forEach(req => {
        if (req.contentToComplete && req.contentToComplete.type) {
          rawList.push(req.contentToComplete);
        }
      });
    }
    
    playlistTitle = badge.name || `Badge ${contentGroupId}`;
    
  } else if (isTheme) {
    // Handle theme data structure
    const topic = Array.isArray(data.topics) && data.topics[0] ? data.topics[0] : {};
    grouping = topic;
    rawList = Array.isArray(topic.recommendations) ? topic.recommendations : [];
    playlistTitle = topic.name || `Theme ${contentGroupId}`;
    
  } else {
    // Handle regular content group data structure
    grouping = Array.isArray(data.contentGroupings) && data.contentGroupings[0]
      ? data.contentGroupings[0]
      : {};
    rawList = Array.isArray(grouping.contentList) ? grouping.contentList : [];
    playlistTitle = grouping.name || `Playlist ${contentGroupId}`;
  }

  // Parse the copyright year, defaulting to current year if missing/invalid
  const yearNum = parseInt(grouping.album_copyright_year, 10);
  const baseDate = new Date(
    isNaN(yearNum) ? new Date().getFullYear() : yearNum,
    0,  // January
    1   // 1st
  );
  const uploadTimestamp = Math.floor(baseDate.getTime() / 1000);

  const contents = rawList
    .filter(item => item.type === "Audio" || item.type === "Video")
    .map(item => new PlatformVideo({
      id:         new PlatformID(PLATFORM_NAME, PLATFORM_LINK, item.link_to_id),
      name:       item.short_name || item.name,
      thumbnails: new Thumbnails([ new Thumbnail(item.thumbnail_small || "", 128) ]),
      author:     PLATFORM_AUTHOR,
      uploadDate: uploadTimestamp,
      duration:   (item.media_length || 0) / 1000,
      viewCount:  item.views || 0,
      url:        `https://app.adventuresinodyssey.com/content/${item.link_to_id}`
    }));

  return new PlatformPlaylistDetails({
    id:         new PlatformID(PLATFORM_NAME, PLATFORM_NAME, contentGroupId),
    author:     PLATFORM_AUTHOR,
    url:        url,
    name:       playlistTitle,
    videoCount: contents.length,
    thumbnail:  grouping.imageURL || grouping.thumbnail_medium || "",
    contents:   new ContentPager(contents, false)
  });
};

source.search = (query, type) => {
  try {
    // Build payload with larger page size
    const payload = {
      searchTerm: query,
      searchObjects: [
        {
          objectName: "Content__c",
          pageNumber: 1,
          pageSize: 30,
          fields: ["Name", "Thumbnail_Small__c", "Subtype__c", "Episode_Number__c"]
        },
        {
          objectName: "Content_Grouping__c",
          pageNumber: 1,
          pageSize: 30,
          fields: ["Name", "Image_URL__c", "total_runtime__c"]
        },
        {
          objectName: "Badge__c",
          pageNumber: 1,
          pageSize: 30,
          fields: ["Name", "Icon__c", "Type__c"]
        }
      ]
    };

    const data = fetchWithErrorHandling(
      "https://fotf.my.site.com/aio/services/apexrest/v1/search",
      aioheaders,
      "POST",
      payload
    );

    log("Search response received successfully");

    const convertToPlatform = function (rec, section) {
      switch (section.objectName) {
        case "Badge__c":
        case "Content_Grouping__c":
          return toPlatformPlaylist(rec);
        case "Content__c":
        default:
          return toPlatformVideo(rec);
      }
    };

    // Separate results
    const playlists = [];
    const videos = [];
    const badges = [];

    for (const section of data.resultObjects || []) {
      log(`Processing section: ${section.objectName} with ${section.results?.length || 0} results`);

      for (const rec of section.results || []) {
        const platformItem = convertToPlatform(rec, section);

        if (section.objectName === "Content_Grouping__c") {
          playlists.push(platformItem);
        } else if (section.objectName === "Badge__c") {
          badges.push(platformItem);
        } else {
          videos.push(platformItem);
        }

        log(`Added ${section.objectName}: ${platformItem.name}`);
      }
    }

    // Decide what to return based on type
    let results = [];
    if (type === "playlists") {
      results = rankResults(playlists, query);
    } else if (type === "videos") {
      results = rankResults(videos, query);
    } else if (type === "badges") {
      results = rankResults(badges, query);
    } else {
      // Include badges in general search results
      results = rankResults([...videos, ...playlists, ...badges], query);
    }

    log(
      `Final results: ${results.length} items returned (requested type=${type}, total ${playlists.length} playlists, ${videos.length} videos, ${badges.length} badges)`
    );

    return new VideoPager(results, false, null, []);
  } catch (e) {
    log("Search failed: " + e.message + " (Stack: " + e.stack + ")");
    return new VideoPager([], false, null, []);
  }
};

source.isChannelUrl = function(input) {
  return input === "app.adventuresinodyssey.com";
};

source.getChannel = function(url) {

  return new PlatformChannel({
    id: new PlatformID(
      PLATFORM_NAME,
      PLATFORM_LINK,
      PLATFORM_LINK),
    name: "Adventures In Odyssey Club",
    description: "Adventures in Odyssey is an award-winning, original audio drama series created for ages 8-12 and enjoyed by the whole family. They teach lasting truths and bring biblical principles to life, with just the right balance of fun, faith and imagination.",
    url:  url,
    banner: BANNER_URL,
    thumbnail: "https://app.adventuresinodyssey.com/icons/Icon-167.png"
  });
};

source.getHome = function() {
  let result;
  let isLoggedIn;

  try {
    isLoggedIn = bridge.isLoggedIn(1);
    log("bridge.isLoggedIn(): " + isLoggedIn);

    if (isLoggedIn) {
      log("Fetching Club episodes");
      result = fetchEpisodeHomePage(1);
    } else {
      log("Fetching Free episodes");
      result = fetchFreeEpisodes(1);
    }
  } catch (e) {
    log("Error during isLoggedIn check or fetch: " + e);
    result = fetchFreeEpisodes(1);
  }

  const { videos } = result;
  return new AIOChannelVideoPager(videos, false);
};

source.getChannelContents = function(url, type, order, filters, continuationToken) {
  const page = continuationToken?.pageNumber || 1;

  let result;
  let isLoggedIn;

  try {
    isLoggedIn = bridge.isLoggedIn();
    log("bridge.isLoggedIn(): " + isLoggedIn);

    if (isLoggedIn) {
      log("Fetching Club episodes");
      result = fetchEpisodeHomePage(page);
    } else {
      log("Fetching Free episodes");
      result = fetchFreeEpisodes(page);
    }
  } catch (e) {
    log("Error during isLoggedIn check or fetch: " + e);
    result = fetchFreeEpisodes(page);
  }

  const { videos, totalPages } = result;
  const hasMore = page < totalPages;
  const context = { url, type, order, filters, pageNumber: page };
  return new AIOChannelVideoPager(videos, hasMore, context);
};

source.getChannelPlaylists = function(
  url, type, filters, continuationToken
) {
  const page = continuationToken?.pageNumber || 1;
  // Fetch and build playlists + totalPages
  const { playlists, totalPages } = fetchAlbumsPage(page);
  // Determine if more pages exist
  const hasMore = page < totalPages;
  // Context for continuation
  const context = { url, type, filters, pageNumber: page };
  return new AIOChannelPlaylistPager(playlists, hasMore, context);
};

class AIOChannelPager extends ChannelPager {
	constructor(results, hasMore, context) {
		super(results, hasMore, context);
	}
	
	nextPage() {
		return source.searchChannelContents(this.context.query, this.context.continuationToken);
	}
}

class AIOChannelVideoPager extends VideoPager {
  constructor(results, hasMore, context) {
    super(results, hasMore, context);
  }
  nextPage() {
    // call back into our source with the saved context
    return source.getChannelContents(
      this.context.url,
      this.context.type,
      this.context.order,
      this.context.filters,
      { pageNumber: this.context.pageNumber + 1 }
    );
  }
}

class AIOChannelPlaylistPager extends PlaylistPager {
  constructor(results, hasMore, context) {
    super(results, hasMore, context);
  }
  nextPage() {
    // Create continuation token with incremented page number
    const continuationToken = { pageNumber: this.context.pageNumber + 1 };
    
    return source.getChannelPlaylists(
      this.context.url,
      this.context.type,
      this.context.filters,
      continuationToken  // Pass as 4th parameter, not 5th
    );
  }
}

function fetchEpisodeHomePage(pageNumber) {

  const data = fetchWithErrorHandling(
    `https://fotf.my.site.com/aio/services/apexrest/v1/content/search?community=Adventures+In+Odyssey&orderby=Last_Published_Date__c+DESC+NULLS+LAST&pagenum=${pageNumber}&pagecount=25`,
    aioheaders, 
    "GET"
  );
  
  // grab metadata for total pages - new structure uses total_pages
  const totalPages = Number(data.total_pages || 1);
  
  // get the results array and filter out articles and conditionally podcasts
  const list = (data.results || [])
    .filter(item => item.type !== "Article")  // Filter out articles
    .filter(item => {
      if (item.subtype === "Podcast" && !local_settings.podcasts) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.last_published_date || 0);
      const dateB = new Date(b.last_published_date || 0);
      return dateB - dateA; // descending order (newest first)
    });
  
  const nowSec = Math.floor(Date.now() / 1000);

  const videos = list.map(item => new PlatformVideo({
    id:         new PlatformID("Adventures In Odyssey Club", item.id, item.id),
    name:       item.short_name || item.name || "Untitled",
    url:        `https://app.adventuresinodyssey.com/content/${item.id}`,
    thumbnails: new Thumbnails([ new Thumbnail(item.thumbnail_small||"",128) ]),
    author:     PLATFORM_AUTHOR,
    uploadDate: Math.floor(new Date(item.air_date).getTime() / 1000) || Math.floor(new Date(item.last_published_date).getTime() / 1000),
    duration:   (item.media_length||0)/1000,
    viewCount:  item.views||0
  }));

  return { videos, totalPages };
}

function fetchFreeEpisodes(pageNumber) {
  if (local_settings.podcasts) {
    // Make both requests sequentially using fetchWithErrorHandling
    
    // Fetch free episodes
    const freeEpisodesData = fetchWithErrorHandling(
      `https://fotf.my.site.com/aio/services/apexrest/v1/content/search?content_type=Audio&content_subtype=Episode&community=Adventures+In+Odyssey&orderby=Recent_Air_Date__c+DESC&pagenum=${pageNumber}&pagecount=25&radio_page_type=aired`,
      aioheaders,
      "GET"
    );
    
    // Fetch podcast episodes
    const podcastData = fetchWithErrorHandling(
      "https://fotf.my.site.com/aio/services/apexrest/v1/content/search?content_subtype=Podcast&community=Adventures+In+Odyssey&orderby=Last_Published_Date__c+DESC+NULLS+LAST&pagenum=1&pagecount=25&player=true",
      aioheaders,
      "GET"
    );
    
    // Parse free episodes (limit to 5)
    const freeEpisodesList = (freeEpisodesData.results || []).slice(0, 5);
    
    // Parse podcast episodes - fix the data access path
    let podcastEpisodesList = [];
    if (podcastData) {
      if (podcastData.data && podcastData.data.results) {
        // If fetchWithErrorHandling returns the full response object
        podcastEpisodesList = podcastData.data.results;
      } else if (podcastData.results) {
        // If fetchWithErrorHandling returns just the parsed body
        podcastEpisodesList = podcastData.results;
      }
    }
    
    // Convert free episodes to PlatformVideo objects
    const freeVideos = freeEpisodesList.map(item => new PlatformVideo({
      id:         new PlatformID("Adventures In Odyssey Club", item.id, item.id),
      name:       "FREE: " + (item.name || item.short_name || "Untitled"),
      url:        `https://app.adventuresinodyssey.com/content/${item.id}`,
      thumbnails: new Thumbnails([ new Thumbnail(item.thumbnail_small || "", 128) ]),
      author:     PLATFORM_AUTHOR,
      uploadDate: Math.floor(new Date(item.recent_air_date || item.air_date || 0).getTime() / 1000),
      duration:   (item.media_length || 0) / 1000,
      viewCount:  item.views || 0
    }));
    
    // Convert podcast episodes to PlatformVideo objects
    const podcastVideos = podcastEpisodesList.map(item => new PlatformVideo({
      id:         new PlatformID("Adventures In Odyssey Club", item.id, item.id),
      name:       (item.name || item.short_name || "Untitled"),
      url:        `https://app.adventuresinodyssey.com/content/${item.id}`,
      thumbnails: new Thumbnails([ new Thumbnail(item.thumbnail_small || "", 128) ]),
      author:     PLATFORM_AUTHOR,
      uploadDate: Math.floor(new Date(item.last_published_date || item.air_date || 0).getTime() / 1000),
      duration:   (item.media_length || 0) / 1000,
      viewCount:  item.views || 0
    }));
    
    // Combine both arrays and sort by newest first (using last_published_date or air_date)
    const combinedVideos = [...freeVideos, ...podcastVideos].sort((a, b) => {
      // Extract timestamps for comparison (uploadDate is already in seconds)
      return b.uploadDate - a.uploadDate;
    });
    
    return { videos: combinedVideos, totalPages: 1 };
    
  } else {
    // Original logic when podcasts is false
    const data = fetchWithErrorHandling(
      `https://fotf.my.site.com/aio/services/apexrest/v1/content/search?content_type=Audio&content_subtype=Episode&community=Adventures+In+Odyssey&orderby=Recent_Air_Date__c+DESC&pagenum=${pageNumber}&pagecount=25&radio_page_type=aired`,
      aioheaders,
      "GET"
    );

    const totalPages = 1;

    // No sorting — assume server sends in correct order, just slice top 5
    const list = (data.results || []).slice(0, 5);

    const videos = list.map(item => new PlatformVideo({
      id:         new PlatformID("Adventures In Odyssey Club", item.id, item.id),
      name:       "FREE: " + (item.name || item.short_name || "Untitled"),
      url:        `https://app.adventuresinodyssey.com/content/${item.id}`,
      thumbnails: new Thumbnails([ new Thumbnail(item.thumbnail_small || "", 128) ]),
      author:     PLATFORM_AUTHOR,
      uploadDate: Math.floor(new Date(item.recent_air_date || item.air_date || 0).getTime() / 1000),
      duration:   (item.media_length || 0) / 1000,
      viewCount:  item.views || 0
    }));

    return { videos, totalPages };
  }
}

function fetchAlbumsPage(pageNumber) {
  let payload, url;
  
  // Get the grouping type based on the dropdown selection
  const groupingTypes = ["Album", "Playlist", "Series", "Collection", "Bonus Video Home", "Life Lesson"];
  const selectedType = groupingTypes[local_settings.groupings] || "Album";
  
  if (selectedType === "Playlist" && bridge.isLoggedIn()) {
    // Fetch playlists (only if logged in)
    payload = {
      type: "Playlist",
      pageNumber: 1,
      pageSize: 200
    };
    url = "https://fotf.my.site.com/aio/services/apexrest/v1/contentgrouping/search";
  } else if (selectedType === "Playlist" && !bridge.isLoggedIn()) {
    // Fall back to albums if playlists selected but not logged in
    payload = {
      community: "Adventures in Odyssey",
      pageNumber: pageNumber,
      pageSize: 25,
      type: "Album"
    };
    url = "https://fotf.my.site.com/aio/services/apexrest/v1/contentgrouping/search";
  } else {
    // Handle Albums, Series, Collections, or Bonus Videos
    payload = {
      community: "Adventures in Odyssey",
      pageNumber: pageNumber,
      pageSize: 25,
      type: selectedType
    };
    url = "https://fotf.my.site.com/aio/services/apexrest/v1/contentgrouping/search";
  }

  const data = fetchWithErrorHandling(
    url,
    aioheaders,
    "POST",
    payload
  );

  const totalPages = Number(data.metadata?.totalPageCount || 1);
  let list = data.contentGroupings || [];
  
  // Sort playlists with viewer_id to the top when fetching playlists
  if (selectedType === "Playlist") {
    list = list.sort((a, b) => {
      const aHasViewer = !!a.viewer_id;
      const bHasViewer = !!b.viewer_id;
      
      if (aHasViewer && !bHasViewer) return -1; // a goes first
      if (!aHasViewer && bHasViewer) return 1;  // b goes first
      return 0; // maintain original order for items with same viewer_id status
    });
  }

  const playlists = list.map(album => new PlatformPlaylist({
    id: new PlatformID(PLATFORM_NAME, album.id, album.id),
    author: PLATFORM_AUTHOR,
    name: album.name || album.album_name || "Untitled Album",
    description: album.description || "",
    thumbnail: album.imageURL || "",
    url: `https://app.adventuresinodyssey.com/contentGroup/${album.id}`,
    videoCount: album.contentList ? album.contentList.length : 0
  }));

  return { playlists, totalPages };
}


/**
 * Comment class specific to AIO with reply handling (based off how BitChute does it https://gitlab.futo.org/videostreaming/plugins/bitchute/-/blob/master/BitchuteScript.js?ref_type=heads)
 */
class AIOComment extends Comment {
  constructor(obj) {
    super(obj);
    this.replies = obj.replies || [];
  }

  getReplies() {
    if (this.replies.length > 0) {
      return new AIOReplyPager(this.replies);
    } else {
      return new AIOReplyPager([]);
    }
  }
}

/**
 * Pager for AIO comment replies (when replies are pre-loaded)
 */
class AIOReplyPager extends CommentPager {
  constructor(allResults, pageSize = 60) {
    const end = Math.min(pageSize, allResults.length);
    const results = allResults.slice(0, end);
    const hasMore = pageSize < allResults.length;
    super(results, hasMore, {});

    this.offset = end;
    this.allResults = allResults;
    this.pageSize = pageSize;
  }

  nextPage() {
    const end = Math.min(this.offset + this.pageSize, this.allResults.length);
    this.results = this.allResults.slice(this.offset, end);
    this.offset = end;
    this.hasMore = end < this.allResults.length;
    return this;
  }
}

class AIOCommentPager extends CommentPager {
  constructor(results, hasMore, context) {
    super(results, hasMore, context);
  }
  nextPage() {
    // ask for the next pageNumber
    return source.getComments(
      this.context.url,
      { pageNumber: this.context.pageNumber + 1 }
    );
  }
}

function findCommentPage(contentId) {
  const cacheKey = `${contentId}`;
  
  // Check cache first
  if (commentIdCache[cacheKey]) {
    log(`Using cached comment page data for ${contentId}: targetId=${commentIdCache[cacheKey].targetId}`);
    return commentIdCache[cacheKey].targetId;
  }

  log(`Searching for album containing content ID: ${contentId}`);
  
  // Search for albums that contain this content ID
  const albumSearchPayload = {
    community: "Adventures in Odyssey",
    pageNumber: 1,
    pageSize: 50,
    type: "Album"
  };
  
  try {
    const albumSearchData = fetchWithErrorHandling(
      "https://fotf.my.site.com/aio/services/apexrest/v1/contentgrouping/search",
      aioheaders,
      "POST",
      albumSearchPayload
    );
    
    const albumResults = albumSearchData.contentGroupings;
    if (!albumResults || albumResults.length === 0) {
      log(`No albums found in search results`);
      return null;
    }
    
    // Find the album that contains this content ID
    let matchingAlbum = null;
    for (const album of albumResults) {
      // Check if this album's contentList contains the content ID (using startsWith for partial match)
      if (album.contentList && album.contentList.some(content => content.id && content.id.startsWith(contentId))) {
        matchingAlbum = album;
        break;
      }
    }
    
    if (!matchingAlbum) {
      log(`No album found containing content ID: ${contentId}, trying direct content fetch for badge search`);
      
      // Fetch content data for badge search
      try {
        const contentData = fetchWithErrorHandling(
          `https://fotf.my.site.com/aio/services/apexrest/v1/content/${contentId}?tag=true&series=true&recommendations=true&player=true&parent=true`,
          aioheaders
        );
        
        const shortName = contentData.short_name;
        if (!shortName) {
          log("No short_name found in content data for badge search");
          return null;
        }
        
        const cleanedName = shortName.replace(/^#\d+:\s*/, '');
        log(`Searching for badge with cleaned name from content data: ${cleanedName}`);
        
        const badgeSearchPayload = {
          searchTerm: cleanedName,
          searchObjects: [{
            objectName: "Badge__c",
            pageNumber: 1,
            pageSize: 50,
            fields: ["Name", "Icon__c", "Type__c"]
          }]
        };
        
        const badgeSearchData = fetchWithErrorHandling(
          "https://fotf.my.site.com/aio/services/apexrest/v1/search",
          aioheaders,
          "POST",
          badgeSearchPayload
        );
        
        const badgeResults = badgeSearchData.resultObjects?.[0]?.results;
        if (!badgeResults || badgeResults.length === 0) {
          log(`No badge found for search term: ${cleanedName}`);
          return null;
        }
        
        const commentPageId = badgeResults[0].id;
        log(`Found badge comment page ID from content data: ${commentPageId}`);
        
        // Cache the result
        commentIdCache[cacheKey] = {
          targetId: commentPageId,
          hasDirectComments: false
        };
        log(`Cached badge comment page data for ${contentId}: targetId=${commentPageId}`);
        
        return commentPageId;
      } catch (e) {
        log(`Content fetch and badge search failed: ${e.message}`);
        return null;
      }
    }
    
    const albumName = matchingAlbum.name;
    log(`Found album: ${albumName} containing content ID: ${contentId}`);
    
    // Check if this album contains the ½ symbol (indicating it's a badge)
    if (albumName && albumName.includes('½')) {
      log(`Album contains ½ symbol, treating as badge: ${albumName}`);
      
      // Find the specific content item to get its short_name (using startsWith for partial match)
      const contentItem = matchingAlbum.contentList.find(content => content.id && content.id.startsWith(contentId));
      let shortName = contentItem ? contentItem.short_name : null;
      
      // If short_name is not available, try to derive it from the album name
      if (!shortName) {
        shortName = albumName.replace(/^#\d+:\s*/, '');
      }
      
      if (!shortName) {
        log("No short_name available for badge search");
        return null;
      }
      
      const cleanedName = shortName.replace(/^#\d+:\s*/, '');
      log(`Searching for badge with cleaned name: ${cleanedName}`);
      
      const badgeSearchPayload = {
        searchTerm: cleanedName,
        searchObjects: [{
          objectName: "Badge__c",
          pageNumber: 1,
          pageSize: 50,
          fields: ["Name", "Icon__c", "Type__c"]
        }]
      };
      
      try {
        const badgeSearchData = fetchWithErrorHandling(
          "https://fotf.my.site.com/aio/services/apexrest/v1/search",
          aioheaders,
          "POST",
          badgeSearchPayload
        );
        
        const badgeResults = badgeSearchData.resultObjects?.[0]?.results;
        if (!badgeResults || badgeResults.length === 0) {
          log(`No badge found for search term: ${cleanedName}`);
          return null;
        }
        
        const commentPageId = badgeResults[0].id;
        log(`Found badge comment page ID: ${commentPageId}`);
        
        // Cache the result
        commentIdCache[cacheKey] = {
          targetId: commentPageId,
          hasDirectComments: false
        };
        log(`Cached badge comment page data for ${contentId}: targetId=${commentPageId}`);
        
        return commentPageId;
      } catch (e) {
        log(`Badge search failed: ${e.message}`);
        return null;
      }
    } else {
      // This is a regular album
      const commentPageId = matchingAlbum.id;
      log(`Found album comment page ID: ${commentPageId}`);
      
      // Cache the result
      commentIdCache[cacheKey] = {
        targetId: commentPageId,
        hasDirectComments: false
      };
      log(`Cached album comment page data for ${contentId}: targetId=${commentPageId}`);
      
      return commentPageId;
    }
  } catch (e) {
    log(`Album search failed: ${e.message}`);
    return null;
  }
}

source.getComments = function(url, continuationToken) {
  if (!bridge.isLoggedIn()) {
    return
  }

  try {
    const contentId = url.split("/").pop();
    const pageNumber = continuationToken?.pageNumber || 1;
    let targetId = contentId;
    let hasDirectComments = true;
    const commentsSize = [10, 20, 30, 40, 50][local_settings.commentPageSize] || 20;

    // Check cache first to see if we already know the comment page ID
    const cacheKey = `${contentId}`;
    if (commentIdCache[cacheKey]) {
      targetId = commentIdCache[cacheKey].targetId;
      hasDirectComments = commentIdCache[cacheKey].hasDirectComments;
      log(`Using cached data for ${contentId}: targetId=${targetId}, hasDirectComments=${hasDirectComments}, pageSize=${commentsSize}`);
    }

    // Fetch comments with the target ID (either original contentId or cached comment page ID)
    let payload = {
      orderBy: "CreatedDate DESC",
      pageSize: commentsSize,
      pageNumber: pageNumber,
      relatedToId: targetId
    };

    let data = fetchWithErrorHandling(
      "https://fotf.my.site.com/aio/services/apexrest/v1/comment/search",
      aioheaders,
      "POST",
      payload
    );

    // If no comments found and we haven't tried finding a comment page yet, try to find one
    if ((!data.comments || data.comments.length === 0) && !commentIdCache[cacheKey]) {
      log(`No direct comments found for ${contentId}, searching for comment page`);
      bridge.log(`No direct comments found for ${contentId}, searching for comment page`);
      
      // Use the modified findCommentPage function with just the contentId
      const commentPageId = findCommentPage(contentId);
      if (!commentPageId) {
        bridge.log("No comment page found.");
        return new AIOCommentPager([], false, { url, pageNumber: 1 });
      }

      targetId = commentPageId;
      hasDirectComments = false;

      // Fetch comments again with the comment page ID
      payload.relatedToId = targetId;
      data = fetchWithErrorHandling(
        "https://fotf.my.site.com/aio/services/apexrest/v1/comment/search",
        aioheaders,
        "POST",
        payload
      );
    }

    const totalPages = Number(data.metadata?.totalPageCount || 1);
    const allComments = data.comments || [];

    const comments = allComments.map(c => {
      const author = new PlatformAuthorLink(
        new PlatformID(PLATFORM_NAME, c.viewerProfileId || "", c.viewerProfileId || ""),
        c.userName || "",
        url,
        c.userProfilePicture || ""
      );
      const dateSec = Math.floor(new Date(c.createdDateTimestamp).getTime() / 1000);
    
      // Map embedded replies (if any)
      const replies = (c.comments || []).map(reply => {
        const replyAuthor = new PlatformAuthorLink(
          new PlatformID(PLATFORM_NAME, reply.viewerProfileId || "", reply.viewerProfileId || ""),
          reply.userName || "",
          url,
          reply.userProfilePicture || ""
        );
        const replyDateSec = Math.floor(new Date(reply.createdDateTimestamp).getTime() / 1000);
    
        return new AIOComment({
          contextUrl: url,
          author: replyAuthor,
          message: reply.message || "",
          rating: new RatingLikes(reply.numberOfLikes || 0),
          date: replyDateSec,
          replyCount: 0,
          context: {
            claimId: contentId,
            commentId: reply.id,
            parentId: c.id,
            searchType: hasDirectComments ? 'direct' : 'badge',
            searchId: targetId
          },
          replies: []
        });
      });
    
      return new AIOComment({
        contextUrl: url,
        author: author,
        message: c.message || "",
        rating: new RatingLikes(c.numberOfLikes || 0),
        date: dateSec,
        replyCount: c.numberOfComments || 0,
        context: {
          claimId: contentId,
          commentId: c.id,
          searchType: hasDirectComments ? 'direct' : 'badge',
          searchId: targetId
        },
        replies: replies
      });
    });

    const hasMore = pageNumber < totalPages;
    return new AIOCommentPager(comments, hasMore, { url, pageNumber: pageNumber + 1 });
  }
  catch (e) {
    log("getComments failed: " + e.message);
    return new AIOCommentPager([], false, { url, pageNumber: 1 });
  }
};