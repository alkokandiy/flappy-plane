PUT YOUR BACKGROUND MUSIC HERE

- Drop a .ogg, .mp3 or .wav file into this folder.
- The game auto-plays it on loop, ONLY while you are actually playing
  (it starts when you tap to start, stops when you crash).
- .ogg is best (works on desktop AND in the browser).
- .m4a does NOT work (browsers/pygame can't play it) - convert it first:
      ffmpeg -i yoursong.m4a -c:a libvorbis -q:a 4 yoursong.ogg
- No file here = game runs silently, no error.
