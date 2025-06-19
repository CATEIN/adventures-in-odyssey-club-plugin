// AIOScript.js
const PLATFORM_NAME = "Adventures In Odyssey Club"
const PLATFORM_LINK = "app.adventuresinodyssey.com"
const BANNER_URL = "https://www.adventuresinodyssey.com/wp-content/uploads/whits-end-adventures-in-odyssey.jpg"

const badgeIdCache = {};

const aioheaders = {
  "Content-Type": "application/json",
  "Accept": "application/json",
  "x-experience-name": "Adventures In Odyssey"
};

let local_settings;
var config = {}

source.enable = function (conf, settings) {
  config = conf ?? {}
  local_settings = settings
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

function formatDescription(desc, authors, characters, airDateRaw, bibleVerse, devotional) {
  let out = desc || "";

  // 1 Air Date
  if (airDateRaw) {
    // take "YYYY-MM-DD" before the "T", then swap dashes for slashes
    const dateOnly = airDateRaw.split("T")[0].replace(/-/g, "/");
    out += `\n\nAir Date: ${dateOnly}`;
  }

  // 2 Authors
  if (Array.isArray(authors) && authors.length) {
    out += "\n\n" + authors
      .map(a => `${a.role}: ${a.name}`)
      .join("\n");
  }

  // 3 Characters
  if (Array.isArray(characters) && characters.length) {
    out += "\n\nCharacters:\n" +
      characters
        .map(c => c.name)
        .join("\n");
  }

  // 4 Bible Verse
  if (bibleVerse) {
    out += `\n\nBible Verse: ${bibleVerse}`;
  }

  // 5 Devotional
  if (devotional) {
    out += `\n\nDevotional: ${devotional}`
  }

  return out;
}


function getAirDateFromRelativeLabel(label) {
  const today = new Date();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  if (label === "Aired Today") {
    return new Date(today);
  }

  const match = label.match(/^Aired (Last )?(\w+)$/);
  if (!match) return null;

  const hasLast = !!match[1]; // true if "Last" is present
  const dayName = match[2];
  const targetWeekday = dayNames.indexOf(dayName);
  if (targetWeekday === -1) return null;

  const currentWeekday = today.getDay();
  let daysAgo = (7 + currentWeekday - targetWeekday) % 7;

  if (hasLast) {
    // "Last [Day]" means the most recent occurrence of that day in the past
    if (daysAgo === 0) {
      daysAgo = 7; // if today is the target day, go back one week
    }
    // Otherwise, daysAgo already gives us the most recent past occurrence
  } else {
    // "Aired [Day]" means the most recent occurrence of that day
    if (daysAgo === 0) {
      daysAgo = 7; // if today is the target day, assume it means last week (not today)
    }
  }

  const airDate = new Date(today);
  airDate.setDate(today.getDate() - daysAgo);
  return airDate;
}

function isEpisodeFree(relativeAirDay) {
  const airDate = getAirDateFromRelativeLabel(relativeAirDay);
  if (!airDate) return false;

  const today = new Date();
  const ageInDays = (today - airDate) / (1000 * 60 * 60 * 24);
  return ageInDays <= 6;
}

// Check if a URL is a content details URL
source.isContentDetailsUrl = function(url) {
    // Check if the URL matches the pattern for AiO content URLs
    return url.startsWith('https://app.adventuresinodyssey.com/content/');
  };

source.isPlaylistUrl = function(url) {
  return url.startsWith('https://app.adventuresinodyssey.com/contentGroup/');
};
  
// Get content details from a URL
source.getContentDetails = function(url) {
  // Extract the content ID from the URL
  const contentId = url.split('/').pop();
  log("Fetching content ID: " + contentId);
  log("Randomizer? " + local_settings.fetchRandomEpisode);

  // Check if user is logged in and construct appropriate URL
  let apiUrl;
  if (bridge.isLoggedIn()) {
    // User is logged in - use the original URL
    apiUrl = `https://fotf.my.site.com/aio/services/apexrest/v1/content/${contentId}?tag=true&series=true&recommendations=true&player=true&parent=true`;
  } else {
    // User is not logged in - use the alternative URL with radio_page_type
    apiUrl = `https://fotf.my.site.com/aio/services/apexrest/v1/content/${contentId}?tag=true&series=true&recommendations=true&player=true&parent=true&radio_page_type=aired`;
  }

  let data = fetchWithErrorHandling(apiUrl, aioheaders);

  if (data.type !== "Audio" && data.type !== "Video") {
    log("Unsupported content type: " + data.type);
  }

  // Check if user is not logged in and episode requires login
  if (!bridge.isLoggedIn()) {
    const relativeAirDay = data.relative_air_day;
    log("Relative air day: " + relativeAirDay);
    
    // Check if it's a podcast (always free)
    if (data.subtype === "Podcast") {
      log("Podcast detected - making additional request");
      data = fetchWithErrorHandling(`https://fotf.my.site.com/aio/services/apexrest/v1/content/${contentId}?tag=true&series=true&recommendations=true&player=true&parent=true`, aioheaders);
    } else {
      const isFreeEpisode = relativeAirDay ? isEpisodeFree(relativeAirDay) : false;
      const hasSecretAccess = local_settings.secretVariable === true;
      
      if (!isFreeEpisode && !hasSecretAccess) {
          throw new ScriptLoginRequiredException("Login to listen to this episode");
      }
    }
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
              "range": "-"
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
        url: data.download_url,
        requestModifier: {
          headers: {
            "Sec-Fetch-Dest": "audio",
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
    author: new PlatformAuthorLink(
      new PlatformID(PLATFORM_NAME, PLATFORM_LINK, contentId),
      PLATFORM_NAME,
      PLATFORM_LINK,
      "https://app.adventuresinodyssey.com/icons/Icon-167.png"
    ),
    name: data.short_name,
    uploadDate: Math.floor(new Date(data.air_date).getTime() / 1000) || Math.floor(new Date(data.last_published_date).getTime() / 1000),
    duration: data.media_length / 1000,
    viewCount: data.views,
    url: url,
    description: formatDescription(data.description, data.authors, data.characters, data.air_date, data.bible_verse, data.devotional),
    video: sourceDescriptor
  });

  details.getContentRecommendations = function() {
    const album = data.in_album?.content_list || data.in_album || [];
    const recs = data.recommendations || [];
    const combined = album.concat(recs);
  
    const videos = [];
  
    if (local_settings.fetchRandomEpisode && bridge.isLoggedIn()) {
      const randomData = fetchWithErrorHandling(
        "https://fotf.my.site.com/aio/services/apexrest/v1/content/random",
        aioheaders
      );
  
      // Add only the random episode (no in_album or recommendations)
      videos.push(new PlatformVideo({
        id: new PlatformID(PLATFORM_NAME, PLATFORM_LINK, randomData.id),
        name: "🎲 Random Episode",
        url: `https://app.adventuresinodyssey.com/content/${randomData.id}`,
        thumbnails: new Thumbnails([
          new Thumbnail("https://d23sy43gbewnpt.cloudfront.net/public%2Fimages%2Fcontent_body%2Fmobile-random.jpeg", 128)
        ]),
        author: new PlatformAuthorLink(
          new PlatformID(PLATFORM_NAME, PLATFORM_LINK, randomData.id),
          PLATFORM_NAME,
          PLATFORM_LINK,
          "https://app.adventuresinodyssey.com/icons/Icon-167.png"
        ),
        duration: 0,
        viewCount: 0
        // No uploadDate to keep it mysterious
      }));
    }
  
    // Add this episode's album/recommendations
    for (const item of combined) {
      videos.push(new PlatformVideo({
        id: new PlatformID(PLATFORM_NAME, PLATFORM_LINK, item.id),
        name: item.short_name || "Untitled",
        url: `https://app.adventuresinodyssey.com/content/${item.id}`,
        uploadDate: Math.floor(new Date(item.air_date).getTime() / 1000) || Math.floor(new Date(item.last_published_date).getTime() / 1000),
        thumbnails: new Thumbnails([
          new Thumbnail(item.thumbnail_small || "", 128)
        ]),
        author: new PlatformAuthorLink(
          new PlatformID(PLATFORM_NAME, PLATFORM_LINK, item.id),
          PLATFORM_NAME,
          PLATFORM_LINK,
          "https://app.adventuresinodyssey.com/icons/Icon-167.png"
        ),
        duration: (item.media_length || 0) / 1000,
        viewCount: item.views || 0
      }));
    }
  
    return new VideoPager(videos, false, null);
  };

  return details;
};

source.getPlaylist = function(url) {
  const contentGroupId = url.split('/').pop();
  log("Fetching playlist ID: " + contentGroupId);

  const data = fetchWithErrorHandling(
    `https://fotf.my.site.com/aio/services/apexrest/v1/contentgrouping/${contentGroupId}`,
    aioheaders
  );

  const grouping = Array.isArray(data.contentGroupings) && data.contentGroupings[0]
    ? data.contentGroupings[0]
    : {};

  const playlistTitle = grouping.name || `Playlist ${contentGroupId}`;
  const rawList = Array.isArray(grouping.contentList) ? grouping.contentList : [];

  // 1) Parse the copyright year, defaulting to current year if missing/invalid
  const yearNum = parseInt(grouping.album_copyright_year, 10);
  const baseDate = new Date(
    isNaN(yearNum) ? new Date().getFullYear() : yearNum,
    0,  // January
    1   // 1st
  );
  const uploadTimestamp = Math.floor(baseDate.getTime() / 1000);

  const author = new PlatformAuthorLink(
    new PlatformID(PLATFORM_NAME, PLATFORM_LINK, contentGroupId),
    PLATFORM_NAME,
    PLATFORM_LINK,
    "https://app.adventuresinodyssey.com/icons/Icon-167.png"
  );

  const contents = rawList
    .filter(item => item.type === "Audio" || item.type === "Video")
    .map(item => new PlatformVideo({
      id:         new PlatformID(PLATFORM_NAME, PLATFORM_LINK, item.link_to_id),
      name:       item.short_name || item.name,
      thumbnails: new Thumbnails([ new Thumbnail(item.thumbnail_small || "", 128) ]),
      author:     author,
      // 2) Use the January 1st timestamp of the album's copyright year:
      uploadDate: uploadTimestamp,
      duration:   (item.media_length || 0) / 1000,
      viewCount:  item.views || 0,
      url:        `https://app.adventuresinodyssey.com/content/${item.link_to_id}`
    }));

  return new PlatformPlaylistDetails({
    id:         new PlatformID(PLATFORM_NAME, PLATFORM_NAME, contentGroupId),
    author:     author,
    url:        url,
    name:       playlistTitle,
    videoCount: contents.length,
    thumbnail:  grouping.imageURL || "",
    contents:   new ContentPager(contents, false)
  });
};

source.getSearchCapabilities = () => ({
  types:  [ Type.Feed.Mixed ],
  sorts:  [],
  filters:[ ]
});

source.search = (query) => {
  try {
    // Build payload with larger page size
    const payload = {
      searchTerm: query,
      searchObjects: [
        {
          objectName: "Content__c",
          pageNumber: 1,
          pageSize: 30,
          fields: ["Name", "Thumbnail_Small__c", "Subtype__c", "media_length__c"]
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
        case "Content_Grouping__c": {
          return toPlatformPlaylist(rec);
        }
        case "Content__c": {
          return toPlatformVideo(rec);
        }
        default: {
          return toPlatformVideo(rec); // Default to video for other types
        }
      }
    };

    // Process all results into mixed array
    const playlists = [];
    const videos = [];
    
    for (const section of data.resultObjects || []) {
      log(`Processing section: ${section.objectName} with ${section.results?.length || 0} results`);
      
      for (const rec of section.results || []) {
        const platformItem = convertToPlatform(rec, section);
        
        if (section.objectName === "Content_Grouping__c") {
          playlists.push(platformItem);
        } else {
          videos.push(platformItem);
        }
        
        log(`Added ${section.objectName}: ${platformItem.name}`);
      }
    }

    // Combine with playlists first
    const results = [...videos, ...playlists];

    log(`Final results: ${results.length} total items (${playlists.length} playlists, ${videos.length} videos) from search`);
    
    // Return ContentPager with mixed results in the videos array
    return new ContentPager(results, false, null, []);
    
  } catch (e) {
    log("Search failed: " + e.message + " (Stack: " + e.stack + ")");
    return new ContentPager([], false, null, []);
  }
};

function toPlatformPlaylist(rec) {
  // Calculate videoCount from total runtime
  const totalRuntimeMs = rec.column3?.value || 0;
  const averageEpisodeDurationMs = 23 * 60 * 1000; // 23 minutes in milliseconds
  const videoCount = Math.round(totalRuntimeMs / averageEpisodeDurationMs);
  
  return new PlatformPlaylist({
    id: new PlatformID(
      PLATFORM_NAME,
      PLATFORM_LINK,
      rec.id
    ),
    name: rec.column1?.value || "Untitled",
    thumbnail: rec.column2?.value || "",
    author: new PlatformAuthorLink(
      new PlatformID(PLATFORM_NAME, PLATFORM_NAME, "aio"), 
      PLATFORM_NAME, 
      PLATFORM_LINK, 
      "https://app.adventuresinodyssey.com/icons/Icon-167.png"
    ),
    url: `https://app.adventuresinodyssey.com/contentGroup/${rec.id}`,
    videoCount: videoCount
  });
}

function toPlatformVideo(rec) {
  return new PlatformVideo({
    id: new PlatformID(
      PLATFORM_NAME,
      PLATFORM_LINK,
      rec.id
    ),
    name: rec.column1?.value || "Untitled",
    url: `https://app.adventuresinodyssey.com/content/${rec.id}`,
    thumbnails: new Thumbnails([
      new Thumbnail(rec.column2?.value || "", 128)
    ]),
    author: new PlatformAuthorLink(
      new PlatformID(PLATFORM_NAME, PLATFORM_NAME, rec.id), 
      PLATFORM_NAME, 
      PLATFORM_LINK, 
      "https://app.adventuresinodyssey.com/icons/Icon-167.png"
    ),
    duration: rec.column4?.value ? Math.floor(rec.column4.value / 1000) : 0,
    viewCount: 0
  });
}

source.isChannelUrl = function(input) {
  return input === "app.adventuresinodyssey.com"
      || input === "app.adventuresinodyssey.com/";
};

source.getChannel = function(url) {

  return new PlatformChannel({
    id: new PlatformID(
      PLATFORM_NAME,
      PLATFORM_LINK,
      PLATFORM_LINK),
    name: "Adventures In Odyssey Club",
    description: "Cool audio drama",
    url:  url,
    banner: BANNER_URL,
    thumbnail: "https://app.adventuresinodyssey.com/icons/Icon-167.png"
  });
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
    `https://fotf.my.site.com/aio/services/apexrest/v1/content/search?type=Audio&has_devotional=true&community=Adventures+In+Odyssey&orderby=Order__c+DESC&pagenum=${pageNumber}&pagecount=25&player=true`,
    aioheaders, 
    "GET"
  );
  
  // grab metadata for total pages - new structure uses total_pages
  const totalPages = Number(data.total_pages || 1);
  // get the results array and sort by last_published_date (newest first)
  const list = (data.results || []).sort((a, b) => {
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
    author:     new PlatformAuthorLink(
                  new PlatformID("Adventures In Odyssey Club", item.id, item.id),
                  "Adventures In Odyssey Club",
                  "app.adventuresinodyssey.com",
                  "https://app.adventuresinodyssey.com/icons/Icon-167.png"
                ),
    uploadDate: Math.floor(new Date(item.air_date).getTime() / 1000) || Math.floor(new Date(item.last_published_date).getTime() / 1000),
    duration:   (item.media_length||0)/1000,
    viewCount:  item.views||0
  }));

  return { videos, totalPages };
}

function fetchFreeEpisodes(pageNumber) {
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
    author:     new PlatformAuthorLink(
                  new PlatformID("Adventures In Odyssey Club", item.id, item.id),
                  "Adventures In Odyssey Club",
                  "app.adventuresinodyssey.com",
                  "https://app.adventuresinodyssey.com/icons/Icon-167.png"
                ),
    uploadDate: Math.floor(new Date(item.recent_air_date || item.air_date || 0).getTime() / 1000),
    duration:   (item.media_length || 0) / 1000,
    viewCount:  item.views || 0
  }));

  return { videos, totalPages };
}

function fetchAlbumsPage(pageNumber) {
  const payload = {
    community:  "Adventures in Odyssey",
    pageNumber: pageNumber,
    pageSize:   25,
    type:       "Album"
  };

  const data = fetchWithErrorHandling(
    "https://fotf.my.site.com/aio/services/apexrest/v1/contentgrouping/search",
    aioheaders,
    "POST",
    payload
  );

  const totalPages = Number(data.metadata?.totalPageCount || 1);
  const list = data.contentGroupings || [];

  const playlists = list.map(album => new PlatformPlaylist({
    id: new PlatformID(PLATFORM_NAME, album.id, album.id),
    author: new PlatformAuthorLink(
      new PlatformID(PLATFORM_NAME, PLATFORM_NAME, album.id), 
      PLATFORM_NAME, 
      PLATFORM_LINK, 
      "https://app.adventuresinodyssey.com/icons/Icon-167.png"
    ),
    name: album.name || album.album_name || "Untitled Album",
    description: album.description || "",
    thumbnail: album.imageURL || "",
    url: `https://app.adventuresinodyssey.com/contentGroup/${album.id}`,
    videoCount: album.contentList ? album.contentList.length : 0
  }));

  return { playlists, totalPages };
}

/**
 * Comment class specific to AIO with reply handling (BitChute style)
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
  constructor(allResults, pageSize = 20) {
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

source.getComments = function(url, continuationToken) {
  try {
    const contentId = url.split("/").pop();
    const pageNumber = continuationToken?.pageNumber || 1;

    let targetId = contentId;
    let hasDirectComments = true;

    const cacheKey = `${contentId}`;
    if (badgeIdCache[cacheKey]) {
      targetId = badgeIdCache[cacheKey].targetId;
      hasDirectComments = badgeIdCache[cacheKey].hasDirectComments;
      log(`Using cached data for ${contentId}: targetId=${targetId}, hasDirectComments=${hasDirectComments}`);
    } else {
      const contentData = fetchWithErrorHandling(
        `https://fotf.my.site.com/aio/services/apexrest/v1/content/${contentId}?tag=true&series=true&recommendations=true&player=true&parent=true`,
        aioheaders
      );

      hasDirectComments = contentData.enable_commenting || contentData.disable_comment_posting;
      
      if (!hasDirectComments) {
        const shortName = contentData.short_name;
        if (!shortName) {
          log("No short_name found for badge search");
          return new AIOCommentPager([], false, { url, pageNumber: 1 });
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
        
        const badgeSearchData = fetchWithErrorHandling(
          "https://fotf.my.site.com/aio/services/apexrest/v1/search",
          aioheaders,
          "POST",
          badgeSearchPayload
        );
        
        const badgeResults = badgeSearchData.resultObjects?.[0]?.results;
        if (!badgeResults || badgeResults.length === 0) {
          log(`No badge found for search term: ${cleanedName}`);
          return new AIOCommentPager([], false, { url, pageNumber: 1 });
        }
        
        const badgeId = badgeResults[0].id;
        targetId = badgeId;
        log(`Found badge ID: ${badgeId}`);
      }
      
      badgeIdCache[cacheKey] = {
        targetId: targetId,
        hasDirectComments: hasDirectComments
      };
      log(`Cached data for ${contentId}: targetId=${targetId}, hasDirectComments=${hasDirectComments}`);
    }

    // Fetch comments
    const payload = {
      orderBy: "CreatedDate DESC",
      pageSize: 20,
      pageNumber: pageNumber,
      relatedToId: targetId
    };

    const data = fetchWithErrorHandling(
      "https://fotf.my.site.com/aio/services/apexrest/v1/comment/search",
      aioheaders,
      "POST",
      payload
    );

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
    
      log(`Comment "${c.message?.substring(0, 30)}..." has replyCount: ${c.numberOfComments}`);
    
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