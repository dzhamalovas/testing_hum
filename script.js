const imageInput = document.getElementById("imageInput");
const rowsInput = document.getElementById("rowsInput");
const colsInput = document.getElementById("colsInput");
const solveBtn = document.getElementById("solveBtn");
const resetAreaBtn = document.getElementById("resetAreaBtn");
const resultEl = document.getElementById("result");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const SAMPLE_SIZE = 18;
let loadedImage = null;
let selection = null;
let dragStart = null;

function setResult(text, warn = false) {
  resultEl.textContent = text;
  resultEl.classList.toggle("warn", warn);
}

function clampRect(rect) {
  const x = Math.max(0, Math.min(rect.x, canvas.width - 1));
  const y = Math.max(0, Math.min(rect.y, canvas.height - 1));
  const w = Math.max(1, Math.min(rect.w, canvas.width - x));
  const h = Math.max(1, Math.min(rect.h, canvas.height - y));
  return { x, y, w, h };
}

function defaultSelection() {
  const padX = Math.round(canvas.width * 0.08);
  const padY = Math.round(canvas.height * 0.1);
  selection = {
    x: padX,
    y: padY,
    w: canvas.width - padX * 2,
    h: canvas.height - padY * 2
  };
}

function drawSelection(rect, color = "#7ae2ff") {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, Math.round(Math.min(rect.w, rect.h) * 0.01));
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function drawImageWithOverlay() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!loadedImage) return;
  ctx.drawImage(loadedImage, 0, 0);
  if (selection) drawSelection(selection);
}

function getMousePos(event) {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * sx,
    y: (event.clientY - rect.top) * sy
  };
}

function readFileAsImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось загрузить изображение."));
    };
    img.src = url;
  });
}

function captureTileSample(x, y, w, h) {
  const insetX = w * 0.18;
  const insetY = h * 0.18;
  const sx = x + insetX;
  const sy = y + insetY;
  const sw = Math.max(2, w - insetX * 2);
  const sh = Math.max(2, h - insetY * 2);

  const off = document.createElement("canvas");
  off.width = SAMPLE_SIZE;
  off.height = SAMPLE_SIZE;
  const offCtx = off.getContext("2d", { willReadFrequently: true });
  offCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  return offCtx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
}

function tileDifference(a, b) {
  let diff = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const grayA = 0.299 * a.data[i] + 0.587 * a.data[i + 1] + 0.114 * a.data[i + 2];
    const grayB = 0.299 * b.data[i] + 0.587 * b.data[i + 1] + 0.114 * b.data[i + 2];
    diff += Math.abs(grayA - grayB);
  }
  return diff / (a.data.length / 4);
}

function findBestPair(rows, cols, area) {
  const tileWidth = area.w / cols;
  const tileHeight = area.h / rows;

  const tiles = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = area.x + c * tileWidth;
      const y = area.y + r * tileHeight;
      const sample = captureTileSample(x, y, tileWidth, tileHeight);
      tiles.push({ r, c, x, y, w: tileWidth, h: tileHeight, sample });
    }
  }

  let best = null;
  for (let i = 0; i < tiles.length; i += 1) {
    for (let j = i + 1; j < tiles.length; j += 1) {
      const score = tileDifference(tiles[i].sample, tiles[j].sample);
      if (!best || score < best.score) {
        best = { first: tiles[i], second: tiles[j], score };
      }
    }
  }

  return best;
}

function highlightRect(tile, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, Math.round(Math.min(tile.w, tile.h) * 0.05));
  ctx.strokeRect(tile.x + 2, tile.y + 2, tile.w - 4, tile.h - 4);
  ctx.restore();
}

imageInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    loadedImage = null;
    selection = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setResult("Ожидание изображения…");
    return;
  }

  try {
    loadedImage = await readFileAsImage(file);
    canvas.width = loadedImage.width;
    canvas.height = loadedImage.height;
    defaultSelection();
    drawImageWithOverlay();
    setResult("Изображение загружено. При необходимости выделите мышкой область с сеткой карточек.");
  } catch (error) {
    loadedImage = null;
    selection = null;
    setResult(error.message, true);
  }
});

canvas.addEventListener("mousedown", (event) => {
  if (!loadedImage) return;
  dragStart = getMousePos(event);
});

canvas.addEventListener("mousemove", (event) => {
  if (!loadedImage || !dragStart) return;
  const current = getMousePos(event);
  selection = clampRect({
    x: Math.min(dragStart.x, current.x),
    y: Math.min(dragStart.y, current.y),
    w: Math.abs(current.x - dragStart.x),
    h: Math.abs(current.y - dragStart.y)
  });
  drawImageWithOverlay();
});

window.addEventListener("mouseup", () => {
  if (!dragStart) return;
  dragStart = null;
  if (!selection || selection.w < 30 || selection.h < 30) {
    defaultSelection();
    drawImageWithOverlay();
  }
});

resetAreaBtn.addEventListener("click", () => {
  if (!loadedImage) return;
  defaultSelection();
  drawImageWithOverlay();
  setResult("Область сброшена. Можно нажать «Найти пару». ");
});

solveBtn.addEventListener("click", () => {
  if (!loadedImage || !selection) {
    setResult("Сначала загрузите изображение поля.", true);
    return;
  }

  const rows = Number(rowsInput.value);
  const cols = Number(colsInput.value);
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2) {
    setResult("Укажите корректные rows/cols (целые числа >= 2).", true);
    return;
  }

  drawImageWithOverlay();
  const best = findBestPair(rows, cols, selection);
  if (!best) {
    setResult("Не удалось найти пару.", true);
    return;
  }

  highlightRect(best.first, "#ffd166");
  highlightRect(best.second, "#ffd166");
  drawSelection(selection, "#7ae2ff");

  setResult(
    `Пара найдена: (${best.first.r + 1}, ${best.first.c + 1}) и (${best.second.r + 1}, ${best.second.c + 1}), score=${best.score.toFixed(2)}.`
  );
});
