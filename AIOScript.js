// AIOScript.js
const PLATFORM_NAME = "Adventures In Odyssey Club"
const PLATFORM_LINK = "app.adventuresinodyssey.com"
const BANNER_URL = "https://www.adventuresinodyssey.com/wp-content/uploads/whits-end-adventures-in-odyssey.jpg"

const ACCESS_TOKEN_URL = "https://fotf.my.site.com/aio/services/oauth2/token";

const local_http = http;
let local_settings;
let local_state;


let config = {};

source.enable = function (conf) {

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
      
      const details =  new PlatformVideoDetails({
        id: new PlatformID(PLATFORM_NAME, PLATFORM_NAME, contentId),
        thumbnails: new Thumbnails([
          new Thumbnail(data.thumbnail_small || "", 128)
        ]),
        author: new PlatformAuthorLink(
            new PlatformID(PLATFORM_NAME, PLATFORM_LINK, contentId), 
                PLATFORM_NAME, 
                PLATFORM_LINK, 
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
          { objectName:"Content__c", pageNumber:1, pageSize:20, fields:["Name","Thumbnail_Small__c","Subtype__c","media_length__c"]
           }
        ]
      };

    // Following the Bandcamp example pattern (which now works!)
    const response = http.POST(
      "https://fotf.my.site.com/aio/services/apexrest/v1/search",
      JSON.stringify(payload),
      {
        "x-experience-name": "Adventures In Odyssey",
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

source.isChannelUrl = function(input) {
  return input === "app.adventuresinodyssey.com"
      || input === "app.adventuresinodyssey.com/";
};

source.getChannel = function(url) {
  if (!source.isChannelUrl(url)) {
    throw new ScriptException(`Invalid channel URL: ${url}`);
  }

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

// 2) Subclass VideoPager so Grayjay knows how to load page N+1
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

// 3) Helper to fetch one page from your contentgrouping/search API
function fetchEpisodeHomePage(pageNumber) {
  const payload = {
    community:  "Adventures in Odyssey",
    pageNumber: String(pageNumber),
    pageSize:   "1",
    type:       "Episode Home",
    orderby:    "Order__c DESC NULLS LAST"
  };

  const resp = http.POST(
    "https://fotf.my.site.com/aio/services/apexrest/v1/contentgrouping/search",
    JSON.stringify(payload),
    {
      "x-experience-name": "Adventures In Odyssey",
      "Content-Type":      "application/json"
    },
    true
  ).body;

  const data = JSON.parse(resp);
  // grab metadata for total pages
  const totalPages = Number(data.metadata?.totalPageCount || 1);
  // newest-first: API gives oldest first within the page, so reverse
  const list = (data.contentGroupings?.[0]?.contentList || []).reverse();
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
    duration:   (item.media_length||0)/1000,
    viewCount:  item.views||0
  }));

  return { videos, totalPages };
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
    const contentId  = url.split("/").pop();
    const pageNumber = continuationToken?.pageNumber || 1;

    const payload = {
      orderBy:     "CreatedDate DESC",
      pageSize:    10,
      pageNumber:  pageNumber,
      relatedToId: contentId
    };

    // POST to comment/search endpoint :contentReference[oaicite:0]{index=0}
    const resp = http.POST(
      "https://fotf.my.site.com/aio/services/apexrest/v1/comment/search",
      JSON.stringify(payload),
      {
        "x-experience-name": "Adventures In Odyssey",
        "Content-Type":      "application/json"
      },
      true
    ).body;

    const data = JSON.parse(resp);

    const totalPages = Number(data.metadata?.totalPageCount || 1);
    const commentsJson = data.comments || [];

    const comments = commentsJson.map(c => {
      const author = new PlatformAuthorLink(
        new PlatformID("AIOClub", c.viewerProfileId||"", c.viewerProfileId||""),
        c.userName       || "",
        url,
        c.userProfilePicture || ""
      );
      const dateSec = Math.floor(new Date(c.createdDateTimestamp).getTime()/1000);

      return new Comment({
        contextUrl: url,
        author:     author,
        message:    c.message       || "",
        rating:     new RatingLikes(c.numberOfLikes||0),
        date:       dateSec,
        replyCount: c.numberOfComments||0,
        // carry both contentId and parent commentId into context
        context:    { claimId: contentId, commentId: c.id, pageNumber }
      });
    });

    const hasMore = pageNumber < totalPages;
    return new AIOCommentPager(comments, hasMore, { url, pageNumber });
  }
  catch (e) {
    log("getComments failed: " + e.message);
    return new AIOCommentPager([], false, { url, pageNumber: 1 });
  }
};

source.getSubComments = function(comment) {
}
