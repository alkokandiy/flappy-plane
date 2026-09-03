import asyncio
import sys

import pygame
from pygame.locals import K_ESCAPE, K_SPACE, K_UP, KEYDOWN, QUIT

from .entities import (
    Background,
    Floor,
    GameOver,
    Pipes,
    Player,
    PlayerMode,
    Score,
    WelcomeMessage,
)
from .utils import GameConfig, Images, Sounds, Window
from .utils.music import start_background_music


class Flappy:
    def __init__(self):
        pygame.init()
        pygame.display.set_caption("Flappy Plane")
        try:
            icon = pygame.image.load("assets/sprites/icon.png")
            pygame.display.set_icon(icon)
        except Exception:
            pass
        window = Window(288, 512)
        screen = pygame.display.set_mode((window.width, window.height))
        images = Images()

        self.config = GameConfig(
            screen=screen,
            clock=pygame.time.Clock(),
            fps=30,
            window=window,
            images=images,
            sounds=Sounds(),
        )

    async def start(self):
        while True:
            self.background = Background(self.config)
            self.floor = Floor(self.config)
            self.player = Player(self.config)
            self.welcome_message = WelcomeMessage(self.config)
            self.game_over_message = GameOver(self.config)
            self.pipes = Pipes(self.config)
            self.score = Score(self.config)
            await self.splash()
            await self.play()
            await self.game_over()

    async def splash(self):
        """Shows welcome splash screen animation of flappy bird"""

        self.player.set_mode(PlayerMode.SHM)

        while True:
            for event in pygame.event.get():
                self.check_quit_event(event)
                if self.is_tap_event(event):
                    return

            self.background.tick()
            self.floor.tick()
            self.player.tick()
            self.welcome_message.tick()

            pygame.display.update()
            await asyncio.sleep(0)
            self.config.tick()

    def check_quit_event(self, event):
        if event.type == QUIT or (
            event.type == KEYDOWN and event.key == K_ESCAPE
        ):
            pygame.quit()
            sys.exit()

    def is_tap_event(self, event):
        # Event-based only (never pygame.mouse.get_pressed()):
        # polling the held button re-fires every frame, causing
        # accidental double-taps between screens and auto-flap
        # when the button is held down. Works for mouse (PC),
        # touch (mobile browsers synthesize button/touch events).
        if event.type == KEYDOWN and event.key in (K_SPACE, K_UP):
            return True
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            return True
        if event.type == pygame.FINGERDOWN:
            return True
        return False

    async def play(self):
        self.score.reset()
        self.player.set_mode(PlayerMode.NORMAL)
        start_background_music()  # music only during real gameplay

        while True:
            if self.player.collided(self.pipes, self.floor):
                entity = self.player.crash_entity
                if entity == "pipe":
                    upper, lower = self.pipes.pair_touching(self.player)
                    self.pipes.mark_pair(upper, lower)
                elif entity == "floor":
                    self.pipes.mark_spot(self.player.cx, self.floor.y)
                else:  # flew away: flash where it left the top edge
                    x = min(max(self.player.cx, 0), self.config.window.width)
                    self.pipes.mark_spot(x, self.player.h / 2)
                return

            for i, pipe in enumerate(self.pipes.upper):
                if self.player.crossed(pipe):
                    self.score.add()
                    if self.score.score <= 0:
                        # Countdown finished: flash the final tower.
                        if i < len(self.pipes.lower):
                            self.pipes.mark_pair(pipe, self.pipes.lower[i])
                        return

            for event in pygame.event.get():
                self.check_quit_event(event)
                if self.is_tap_event(event):
                    self.player.flap()

            self.background.tick()
            self.floor.tick()
            self.pipes.tick()
            self.pipes.draw_markers()
            self.score.tick()
            self.player.tick()

            pygame.display.update()
            await asyncio.sleep(0)
            self.config.tick()

    async def game_over(self):
        """crashes the player down and shows gameover image"""

        self.player.set_mode(PlayerMode.CRASH)
        # Music keeps playing through the game-over screen;
        # starting a new run restarts it.
        self.pipes.stop()
        self.floor.stop()
        # Let the crash moment read first: hit-stop, then the lose
        # banner ~1.2s (36 ticks at 30fps) after the impact.
        over_ticks = 0

        while True:
            for event in pygame.event.get():
                self.check_quit_event(event)
                if self.is_tap_event(event):
                    if self.player.y + self.player.h >= self.floor.y - 1:
                        return

            self.background.tick()
            self.floor.tick()
            self.pipes.tick()
            self.pipes.draw_markers()
            self.score.tick()
            over_ticks += 1
            if over_ticks < 6:
                # Hit-stop: freeze on the impact frame for punch.
                pygame.display.update()
                await asyncio.sleep(0)
                self.config.tick()
                continue
            self.player.tick()
            if over_ticks >= 36:
                self.game_over_message.tick()

            self.config.tick()
            pygame.display.update()
            await asyncio.sleep(0)
