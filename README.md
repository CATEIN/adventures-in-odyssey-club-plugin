# Adventures in Odyssey Club Grayjay Plugin
Grayjay plugin for https://app.adventuresinodyssey.com/.

![qr code](https://github.com/CATEIN/adventures-in-odyssey-club-plugin/blob/main/qr.png?raw=true)

| Feature                             | Functional? | Note                              |
|-------------------------------------|-------------|-----------------------------------|
| Play Audio/Videos                   | Yes         |   Episode art is cropped cuz of grayjay                             |
| Play Radio Episodes                   | Yes         |       |
| Audio/Video Description | Yes         |             |
| Reccomendations/In Album                  | Yes        |   Fully Functional       |
| Randomizer                 | Yes        |   via setting      |
|  Club Playlists/Content Groupings |Yes        |           |
|  Themes | Yes       |           |
|  Grayjay Playlists | Yes          |   |
|  Grayjay Queue | Yes          |   |
|  Search | Yes          | only as good as the club search      |
|  Subscribing | Yes          |           |
|  Home Page | Yes          |           |
|  Chromecast | Yes          |             |
| View Comments | Yes          |           |
| View Comment Replies | Yes          |   |
|  Search Filters | No          | Might be implemented..             |
|  Downloads | No          | Gives 401 error, waiting for [download request modifier](https://gitlab.futo.org/videostreaming/grayjay/-/merge_requests/141) to be merged            |
|  F Cast | No          | Gives 401 error, headers arent applying           |
| Comment | No         |  No grayjay support yet         |
| Comics     | No          | Might be implemented... |

## Note for logged in users
Currently there is no way to automaticly get a new auth token. When it expires, you should get a LoginRequired exception error thrown.
To get a new token, either:

- Login by selecting Login on a LoginRequiredException.
- Going to plugin settings and logging out and in again.

