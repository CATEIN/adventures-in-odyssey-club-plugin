// this file is for testing casting/downloading
const PLATFORM_NAME = "Adventures In Odyssey Club"
const PLATFORM_LINK = "app.adventuresinodyssey.com"
const BANNER_URL = "https://www.adventuresinodyssey.com/wp-content/uploads/whits-end-adventures-in-odyssey.jpg"

const aioheaders = {
  "Content-Type": "application/json",
  "Accept": "application/json",
  "x-experience-name": "Adventures In Odyssey"
};

let local_settings;
let local_state;


let config = {};

source.enable = function (conf) {

}

class AIORequestModifier extends RequestModifier {
    constructor() {
        super();
    }
    
    modifyRequest(url, headers) {
        // Add the required headers for AiO content
        headers["Sec-Fetch-Dest"] = "audio";
        headers["range"] = "-";
        headers["X-Experience-Name"] = "Adventures In Odyssey";
        headers["Referer"] = "https://www.adventuresinodyssey.com/";
        headers["Connection"] = "keep-alive";
        
        return {
            url: url,
            headers: headers
        };
    }
}

// Define custom audio source class
class AIOAudioSource extends AudioUrlSource {
    constructor(obj) {
        super(obj);
    }

    getRequestModifier() {
        return new AIORequestModifier();
    }
}

// Define custom video source class  
class AIOVideoSource extends VideoUrlSource {
    constructor(obj) {
        super(obj);
    }

    getRequestModifier() {
        return new AIORequestModifier();
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
          throw new LoginRequiredException("Auth token expired. Login to fetch a new token.");
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


function formatDescription(desc, authors, characters, airDateRaw, bibleVerse) {
  let out = desc || "";

  // 1) Air Date
  if (airDateRaw) {
    // take "YYYY-MM-DD" before the "T", then swap dashes for slashes
    const dateOnly = airDateRaw.split("T")[0].replace(/-/g, "/");
    out += `\n\nAir Date: ${dateOnly}`;
  }

  // 2) Authors
  if (Array.isArray(authors) && authors.length) {
    out += "\n\n" + authors
      .map(a => `${a.role}: ${a.name}`)
      .join("\n");
  }

  // 3) Characters
  if (Array.isArray(characters) && characters.length) {
    out += "\n\nCharacters:\n" +
      characters
        .map(c => c.name)
        .join("\n");
  }

  // 4) Bible Verse
  if (bibleVerse) {
    out += `\n\nBible Verse: ${bibleVerse}`;
  }

  return out;
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
    
    const data = fetchWithErrorHandling(
        `https://fotf.my.site.com/aio/services/apexrest/v1/content/${contentId}?tag=true&series=true&recommendations=true&player=true&parent=true`,
        aioheaders
    );

    if (data.type !== "Audio" && data.type !== "Video") {
        log("Unsupported content type: " + data.type);
    }

    // Create the appropriate source descriptor based on content type
    let sourceDescriptor;
    if (data.type === "Audio") {
        sourceDescriptor = new UnMuxVideoSourceDescriptor(
            [], // No video sources for audio content
            [
                new AIOAudioSource({
                    name: data.short_name,
                    duration: data.media_length / 1000,
                    url: data.download_url
                })
            ]
        );
    } else {
        // For video content
        sourceDescriptor = new VideoSourceDescriptor([
            new AIOVideoSource({
                name: data.short_name,
                url: data.download_url
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
        description: formatDescription(data.description, data.authors, data.characters, data.air_date, data.bible_verse),
        video: sourceDescriptor
    });

    details.getContentRecommendations = function() {
        const album = data.in_album || [];
        const recs = data.recommendations || [];
        const combined = album.concat(recs);

        const videos = combined.map(item => new PlatformVideo({
            id: new PlatformID(PLATFORM_NAME, PLATFORM_LINK, item.id),
            name: item.short_name || "Untitled",
            uploadDate: Math.floor(new Date(item.air_date).getTime() / 1000) || Math.floor(new Date(item.last_published_date).getTime() / 1000),
            url: `https://app.adventuresinodyssey.com/content/${item.id}`,
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

        return new VideoPager(videos, /* hasMore= */ false, /* nextContext= */ null);
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

    // Use the fetchWithErrorHandling function
    const data = fetchWithErrorHandling(
      "https://fotf.my.site.com/aio/services/apexrest/v1/search",
      aioheaders,
      "POST",
      payload
    );

    log("Search response received successfully");
    log(JSON.stringify(data, null, 2));

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
    const results = [...playlists, ...videos];

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
      config.id),
    name: "Adventures In Odyssey Club",
    description: "Cool audio drama",
    url:  url,
    banner: BANNER_URL,
    thumbnail: "https://app.adventuresinodyssey.com/icons/Icon-167.png"
  });
};

class AIOChannelPager extends ChannelPager {
	constructor(results, hasMore, context) {
		super(results, hasMore, context);
	}
	
	nextPage() {
		return source.searchChannelContents(this.context.query, this.context.continuationToken);
	}
}


source.getChannelContents = function(
  url, type, order, filters, continuationToken
) {
  const page = continuationToken?.pageNumber || 1;
  // fetch & build videos + totalPages
  const { videos, totalPages } = fetchEpisodeHomePage(page);
  // hasMore if we haven’t reached the last page
  const hasMore = page < totalPages;
  // context passed into nextPage
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
    name:       item.name || item.short_name || "Untitled",
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
  
const badgeIdCache = {};

source.getComments = function(url, continuationToken) {
  try {
    const contentId = url.split("/").pop();
    const pageNumber = continuationToken?.pageNumber || 1;

    let targetId = contentId;
    let hasDirectComments = true;

    // Check if we already have cached data for this content
    const cacheKey = `${contentId}`;
    if (badgeIdCache[cacheKey]) {
      targetId = badgeIdCache[cacheKey].targetId;
      hasDirectComments = badgeIdCache[cacheKey].hasDirectComments;
      log(`Using cached data for ${contentId}: targetId=${targetId}, hasDirectComments=${hasDirectComments}`);
    } else {
      // First time - fetch content details to check comment availability
      const contentData = fetchWithErrorHandling(
        `https://fotf.my.site.com/aio/services/apexrest/v1/content/${contentId}?tag=true&series=true&recommendations=true&player=true&parent=true`,
        aioheaders
      );

      // Check if comments are enabled directly on this content
      hasDirectComments = contentData.enable_commenting || contentData.disable_comment_posting;
      
      if (!hasDirectComments) {
      // No direct comments, search for badge using short_name
      const shortName = contentData.short_name;
      if (!shortName) {
        log("No short_name found for badge search");
        return new AIOCommentPager([], false, { url, pageNumber: 1 });
      }
      
      // Clean the short_name by removing number prefix like "#1011: "
      const cleanedName = shortName.replace(/^#\d+:\s*/, '');
      log(`Searching for badge with cleaned name: ${cleanedName}`);
      
      // Search for badge using the cleaned name
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
      
      // Extract badge ID from search results
      const badgeResults = badgeSearchData.resultObjects?.[0]?.results;
      if (!badgeResults || badgeResults.length === 0) {
        log(`No badge found for search term: ${cleanedName}`);
        return new AIOCommentPager([], false, { url, pageNumber: 1 });
      }
      
        // Use the first badge result
        const badgeId = badgeResults[0].id;
        targetId = badgeId;
        log(`Found badge ID: ${badgeId}`);
      }
      
      // Cache the results for future pagination
      badgeIdCache[cacheKey] = {
        targetId: targetId,
        hasDirectComments: hasDirectComments
      };
      log(`Cached data for ${contentId}: targetId=${targetId}, hasDirectComments=${hasDirectComments}`);
    }

    // Fetch comments using either contentId or badgeId
    const payload = {
      orderBy: "CreatedDate DESC",
      pageSize: 10,
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
    const commentsJson = data.comments || [];

    const comments = commentsJson.map(c => {
      const author = new PlatformAuthorLink(
        new PlatformID(PLATFORM_NAME, c.viewerProfileId||"", c.viewerProfileId||""),
        c.userName || "",
        url,
        c.userProfilePicture || ""
      );
      const dateSec = Math.floor(new Date(c.createdDateTimestamp).getTime()/1000);

      return new Comment({
        contextUrl: url,
        author: author,
        message: c.message || "",
        rating: new RatingLikes(c.numberOfLikes||0),
        date: dateSec,
        replyCount: c.numberOfComments||0,
        context: { 
          claimId: contentId, 
          commentId: c.id, 
          pageNumber,
          searchType: hasDirectComments ? 'direct' : 'badge',
          searchId: targetId
        }
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
