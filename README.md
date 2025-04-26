# Adventures in Odyssey Club Grayjay Plugin
Grayjay plugin for https://app.adventuresinodyssey.com/.
I couldnt figure out how to sign the script so the qr code dont work
also you cant logout and the plugin will eventually "brick" itself cuz it doesnt get a new auth token. The fix i found is just to remove the auth header, inject the plugin and log out from the web view. then put the auth header back

![image](https://github.com/CATEIN/adventures-in-odyssey-club-plugin/blob/main/qr.png)

| Feature                             | Functional? | Note                              |
|-------------------------------------|-------------|-----------------------------------|
| Play Audio/Videos                   | Yes         |   Episodes dont display cover art                                |
| Play Radio Episodes                   | No         |   Need to implement fetching radio episodes    |
| Audio/Video Description | Yes         | Might need more work             |
| Reccomendations/In Album                  | Yes        |   Fully Functional       |
|  Like/Favourite Content | No          | Yet to be implemented             |
|  Club Playlists/Content Groupings | No          | Yet to be implemented             |
|  Grayjay Playlists | Yes          |   |
|  Grayjay Queue | Yes          |   |
| Comics     | No          | Not going to to be implemented |
|  Sharing/Reciving Timestamp in link | No          | Yet to be implemented             |
|  Search | Partially          | Cant load more results yet and doesnt search contentgroupings             |
|  Search Filters | No          | Yet to be implemented             |
|  Subscribing | Yes          | The clubs API is so anoyying cuz no upload date is given              |
|  Home Page | Partially          | Need to add albums as playlists             |
|  Downloads | No          | Grayjay might not have support for setting headers for download links yet            |
|  Casting | No          | Grayjay might not have support for setting headers for casting yet             |
| View Comments | Yes          |           |
| View Comment Replies | No          |   |
| Comment | No         |           |
|  Chicken Jockey | CHICKEN JOCKEY          | WATER BUCKET, RELEASE!  |

