import os

import pygame

MUSIC_DIR = "assets/music"
# .m4a is NOT supported by SDL_mixer / browsers: use .ogg (best), .mp3 or .wav
SUPPORTED_EXTS = (".ogg", ".mp3", ".wav")


def find_music_track(music_dir=MUSIC_DIR):
    if not os.path.isdir(music_dir):
        return None
    files = sorted(
        f for f in os.listdir(music_dir) if f.lower().endswith(SUPPORTED_EXTS)
    )
    if not files:
        return None
    return os.path.join(music_dir, files[0])


def start_background_music(music_dir=MUSIC_DIR, volume=0.4):
    """Play first supported track in music_dir on loop. Silent if none."""
    track = find_music_track(music_dir)
    if track is None:
        return
    try:
        pygame.mixer.music.load(track)
        pygame.mixer.music.set_volume(volume)
        pygame.mixer.music.play(-1)  # loop forever
        print(f"Background music: {track}")
    except Exception as e:
        print(f"Background music skipped: {e}")


def stop_background_music():
    """Stop gameplay music (called on crash / game over). Never raises."""
    try:
        pygame.mixer.music.stop()
    except Exception:
        pass
