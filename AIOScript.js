// AIOScript.js
const PLATFORM_NAME = "Adventures In Odyssey Club"
const PLATFORM_LINK = "app.adventuresinodyssey.com"

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
  
// Get content details from a URL
source.getContentDetails = function(url) {
    try {
      // Extract the content ID from the URL
      const contentId = url.split('/').pop();
      log("Fetching content ID: " + contentId);
      
      const response = http.GET(
        `https://fotf.my.site.com/aio/services/apexrest/v1/content/${contentId}?tag=true&series=true&recommendations=true&player=true&parent=true`,
        {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "x-experience-name":"Adventures In Odyssey"
        },
        true
      ).body;
      
      const data = JSON.parse(response);

      if (data.type !== "Audio" && data.type !== "Video") {
        log("Unsupported content type: " + data.type);
        throw new Error("Content format unsupported: " + data.type);
      }

      log("le url:" + data.download_url);
      
      const details =  new PlatformVideoDetails({
        id: new PlatformID(PLATFORM_NAME, PLATFORM_NAME, contentId),
        thumbnails: new Thumbnails([
                new Thumbnail(data.thumbnail_medium, 0),
            ]),
        author: new PlatformAuthorLink(
            new PlatformID(PLATFORM_NAME, PLATFORM_NAME, contentId), 
                PLATFORM_NAME, 
                PLATFORM_NAME, 
                "https://app.adventuresinodyssey.com/icons/Icon-167.png"),
        name: data.short_name,
        uploadDate: Math.floor(new Date(data.air_date).getTime() / 1000) || Math.floor(new Date(data.last_published_date).getTime() / 1000),
        duration: data.media_length / 1000,
        viewCount: data.views,
        url: url,
        description: formatDescription(data.description, data.authors, data.characters, data.air_date, data.bible_verse),
        
        video: new VideoSourceDescriptor([
            new VideoUrlSource({
                name: data.short_name,
                url: data.download_url,
                requestModifier: {
                    headers: {
                           "Sec-Fetch-Dest": "audio",
                           "range":"-",
                    }
                }
            })
        ])
    });

    details.getContentRecommendations = function() {
      // grab album items and recommendations (or empty arrays)
      const album = data.in_album    || [];
      const recs  = data.recommendations || [];
  
      // merge album → recommendations
      const combined = album.concat(recs);
  
      const videos = combined.map(item => new PlatformVideo({
        id: new PlatformID(PLATFORM_NAME, PLATFORM_NAME, item.id),
        name: item.short_name || "Untitled",
        url: `https://app.adventuresinodyssey.com/content/${item.id}`,
        thumbnails: new Thumbnails([
          new Thumbnail(item.thumbnail_small || "", 128)
        ]),
        author: new PlatformAuthorLink(
          new PlatformID(PLATFORM_NAME, PLATFORM_NAME, item.id),
          PLATFORM_NAME,
          PLATFORM_NAME,
          "https://app.adventuresinodyssey.com/icons/Icon-167.png"
        ),
        duration: (item.media_length || 0) / 1000,
        viewCount: item.views || 0
      }));
  
      return new VideoPager(videos, /* hasMore= */ false, /* nextContext= */ null);
    };
  
    return details;
    
    } catch (error) {
      log("Error getting content details: " + error.message);
      throw error;
    }
  };


source.searchSuggestions = query => [ query ];

source.getSearchCapabilities = () => ({
  types:  [ Type.Feed.Mixed ],
  sorts:  [],
  filters:[ ]
});

source.search = (query, type, order, filters, continuationToken) => {
  try {
    // Build payload as before
    const payload = {
        searchTerm: query,
        searchObjects: [
          { objectName:"Content__c", pageNumber:1, pageSize:9, fields:["Name","Thumbnail_Small__c","Subtype__c","media_length__c"] }
        ]
      };

    // Following the Bandcamp example pattern (which now works!)
    const response = http.POST(
      "https://fotf.my.site.com/aio/services/apexrest/v1/search",
      JSON.stringify(payload),
      {
        "Content-Type": "application/json"
      },
      false
    ).body;
    
    // Parse the response
    const data = JSON.parse(response);
    log("Response parsed successfully");

    // 3) Map into PlatformVideo using the correct keys
    const videos = [];
    for (const section of data.resultObjects || []) {
      for (const rec of section.results || []) {
        videos.push(new PlatformVideo({
            id: new PlatformID(
                PLATFORM_NAME,
                rec.id,
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
                "https://app.adventuresinodyssey.com/icons/Icon-167.png"),
            duration: rec.column4?.value / 1000,
            viewCount: 0
        }));
      }
    }

    return new VideoPager(videos, /* hasMore */ false, /* nextContext */ null);
  } catch (e) {
    log("Search failed: " + e.message);
    return new VideoPager([], false, null);
  }
};

source.isChannelUrl = function(url) {
  try {
    return new URL(url).hostname.toLowerCase() === "app.adventuresinodyssey.com";
  } catch (e) {
    return false;
  }
};