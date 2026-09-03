import pygame

from ..utils import GameConfig
from .entity import Entity


class GameOver(Entity):
    def __init__(self, config: GameConfig) -> None:
        super().__init__(
            config=config,
            image=config.images.game_over,
            x=(config.window.width - config.images.game_over.get_width()) // 2,
            y=int(config.window.height * 0.2),
        )
        # "You lose" picture above the banner. Optional: game still
        # works with just the banner if the file is missing.
        self.lose_image = None
        try:
            img = pygame.image.load("assets/sprites/lose.png").convert()
            h = 90
            w = int(h * img.get_width() / img.get_height())
            self.lose_image = pygame.transform.scale(img, (w, h))
            self.lose_rect = self.lose_image.get_rect()
            self.lose_rect.centerx = config.window.width // 2
            self.lose_rect.bottom = self.y - 6
        except Exception:
            self.lose_image = None

    def draw(self) -> None:
        if self.lose_image is not None:
            self.config.screen.blit(self.lose_image, self.lose_rect)
        super().draw()
