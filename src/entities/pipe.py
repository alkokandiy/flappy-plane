import random
from typing import List

import pygame

from ..utils import GameConfig
from .entity import Entity


class Pipe(Entity):
    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.vel_x = -4

    def draw(self) -> None:
        self.x += self.vel_x
        super().draw()


class Pipes(Entity):
    upper: List[Pipe]
    lower: List[Pipe]

    def __init__(self, config: GameConfig) -> None:
        super().__init__(config)
        self.pipe_gap = 160
        self.top = 0
        self.bottom = self.config.window.viewport_height
        self.upper = []
        self.lower = []
        # Impact flash shown at crash sites. Two sizes: wide bursts for
        # tower rims, even wider for ground/sky spots.
        self.hit_image = None
        self.spot_image = None
        self.marked_ids = set()
        self.spots = []
        try:
            img = pygame.image.load("assets/sprites/hit.png").convert_alpha()
            w = 110
            h = int(w * img.get_height() / img.get_width())
            self.hit_image = pygame.transform.scale(img, (w, h))
            w2 = 140
            h2 = int(w2 * img.get_height() / img.get_width())
            self.spot_image = pygame.transform.scale(img, (w2, h2))
        except Exception:
            self.hit_image = None
            self.spot_image = None
        self.spawn_initial_pipes()

    def tick(self) -> None:
        if self.can_spawn_pipes():
            self.spawn_new_pipes()
        self.remove_old_pipes()

        for up_pipe, low_pipe in zip(self.upper, self.lower):
            up_pipe.tick()
            low_pipe.tick()

    def stop(self) -> None:
        for pipe in self.upper + self.lower:
            pipe.vel_x = 0

    def mark_pair(self, upper, lower) -> None:
        """Flash the gap edges of one tower pair until reset."""
        if upper is not None and lower is not None:
            self.marked_ids.add(id(upper))
            self.marked_ids.add(id(lower))

    def mark_spot(self, x: float, y: float) -> None:
        """Flash one free point (ground line, sky exit) until reset."""
        self.spots.append((x, y))

    def pair_touching(self, player):
        """Return the (upper, lower) pair touching the player, if any."""
        for upper, lower in zip(self.upper, self.lower):
            if player.collide(upper) or player.collide(lower):
                return upper, lower
        return None, None

    def draw_markers(self) -> None:
        """Draw impact flashes. Call every frame; frozen world keeps them."""
        if self.hit_image is not None:
            w, h = self.hit_image.get_size()
            edges = [(p, "bottom") for p in self.upper] + [
                (p, "top") for p in self.lower
            ]
            for pipe, edge in edges:
                if id(pipe) not in self.marked_ids:
                    continue
                x = pipe.x + (pipe.w - w) / 2
                if edge == "bottom":  # upper tower: flash at its bottom rim
                    y = pipe.y + pipe.h - h / 2
                else:  # lower tower: flash at its top rim
                    y = pipe.y - h / 2
                self.config.screen.blit(self.hit_image, (x, y))
        if self.spot_image is not None:
            w2, h2 = self.spot_image.get_size()
            for x, y in self.spots:
                self.config.screen.blit(
                    self.spot_image, (x - w2 / 2, y - h2 / 2)
                )

    def can_spawn_pipes(self) -> bool:
        if not self.upper:
            return True
        last = self.upper[-1]

        return self.config.window.width - (last.x + last.w) > last.w * 2.5

    def spawn_new_pipes(self):
        # add new pipe when first pipe is about to touch left of screen
        upper, lower = self.make_random_pipes()
        self.upper.append(upper)
        self.lower.append(lower)

    def remove_old_pipes(self):
        # rebuild both lists (never remove while iterating:
        # that skips pipes and lets upper/lower desync, causing
        # overlapping/ghost obstacles). Paired pipes share x/w,
        # so filtering both keeps them in sync.
        self.upper = [p for p in self.upper if p.x >= -p.w]
        self.lower = [p for p in self.lower if p.x >= -p.w]
        # defensive: upper/lower must stay paired
        pairs = min(len(self.upper), len(self.lower))
        del self.upper[pairs:]
        del self.lower[pairs:]

    def spawn_initial_pipes(self):
        upper_1, lower_1 = self.make_random_pipes()
        upper_1.x = self.config.window.width + upper_1.w * 3
        lower_1.x = self.config.window.width + upper_1.w * 3
        self.upper.append(upper_1)
        self.lower.append(lower_1)

        upper_2, lower_2 = self.make_random_pipes()
        upper_2.x = upper_1.x + upper_1.w * 3.5
        lower_2.x = upper_1.x + upper_1.w * 3.5
        self.upper.append(upper_2)
        self.lower.append(lower_2)

    def make_random_pipes(self):
        """returns a randomly generated pipe"""
        # y of gap between upper and lower pipe
        base_y = self.config.window.viewport_height

        gap_y = random.randrange(0, int(base_y * 0.6 - self.pipe_gap))
        gap_y += int(base_y * 0.2)
        pipe_height = self.config.images.pipe[0].get_height()
        pipe_x = self.config.window.width + 10

        upper_pipe = Pipe(
            self.config,
            self.config.images.pipe[0],
            pipe_x,
            gap_y - pipe_height,
        )

        lower_pipe = Pipe(
            self.config,
            self.config.images.pipe[1],
            pipe_x,
            gap_y + self.pipe_gap,
        )

        return upper_pipe, lower_pipe
