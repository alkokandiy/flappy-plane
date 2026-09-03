// Image loading. All sprites are local files, no dependencies.
// Usage: const img = await loadAssets(); img.plane[0] ...

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    el.src = src;
  });
}

export async function loadAssets(base = "assets") {
  const s = `${base}/sprites`;
  const [bgDay, bgNight, baseImg, pipe, ...rest] = await Promise.all([
    loadImage(`${s}/background-day.png`),
    loadImage(`${s}/background-night.png`),
    loadImage(`${s}/base.png`),
    loadImage(`${s}/pipe-skyscraper.png`),
    loadImage(`${s}/plane-upflap.png`),
    loadImage(`${s}/plane-midflap.png`),
    loadImage(`${s}/plane-downflap.png`),
    ...Array.from({ length: 10 }, (_, n) => loadImage(`${s}/${n}.png`)),
  ]);
  const [up, mid, down, ...numbers] = rest;
  return {
    backgrounds: [bgDay, bgNight],
    base: baseImg,
    pipe,
    plane: [up, mid, down],
    numbers,
  };
}
