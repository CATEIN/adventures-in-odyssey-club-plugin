// AIOScript.js
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
      log("le url:" + data.download_url);
      
      return new PlatformVideoDetails({
        id: new PlatformID("Adventures In Odyssey Club", "rat", contentId),
        thumbnails: new Thumbnails([
                new Thumbnail(data.thumbnail_medium || "", 128)
            ]),
        author: new PlatformAuthorLink(
            new PlatformID("Adventures In Odyssey Club", "rat", contentId), 
                "Adventures In Odyssey Club", 
                "app.adventuresinodyssey.com", 
                "https://app.adventuresinodyssey.com/icons/Icon-167.png"),
        name: data.short_name,
        duration: data.media_length / 1000,
        viewCount: data.views,
        url: url,
        description: data.description,
        
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
          { objectName:"Content__c", pageNumber:1, pageSize:9, fields:["Name","Thumbnail_Small__c","Subtype__c","Episode_Number__c"] },
          { objectName:"Content_Grouping__c", pageNumber:1, pageSize:9, fields:["Name","Image_URL__c","Type__c"] },
          { objectName:"Topic__c", pageNumber:1, pageSize:9, fields:["Name"] },
          { objectName:"Author__c", pageNumber:1, pageSize:9, fields:["Name","Profile_Image_URL__c"] },
          { objectName:"Character__c", pageNumber:1, pageSize:9, fields:["Name","Thumbnail_Small__c"] },
          { objectName:"Badge__c", pageNumber:1, pageSize:9, fields:["Name","Icon__c","Type__c"] }
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
                "Adventures In Odyssey Club",
                rec.id,
                rec.id
            ),
            name: rec.column1?.value || "Untitled",
            thumbnails: new Thumbnails([
                new Thumbnail(rec.column2?.value || "", 128)
            ]),
            url: `https://app.adventuresinodyssey.com/content/${rec.id}`,
            author: new PlatformAuthorLink(
                new PlatformID("Adventures In Odyssey Club", "rat", rec.id), 
                "Adventures In Odyssey Club", 
                "app.adventuresinodyssey.com", 
                "https://app.adventuresinodyssey.com/icons/Icon-167.png"),
            duration: 0,
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