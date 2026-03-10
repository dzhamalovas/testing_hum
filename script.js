const imageInput = document.getElementById("imageInput");
const rowsInput = document.getElementById("rowsInput");
const colsInput = document.getElementById("colsInput");
const solveBtn = document.getElementById("solveBtn");
const resultEl = document.getElementById("result");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let loadedImage = null;

function setResult(text, warn = false) {
  resultEl.textContent = text;
  resultEl.classList.toggle("warn", warn);
}

function drawImage(img) {
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
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

function tileDifference(a, b) {
  let diff = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    diff += Math.abs(a.data[i] - b.data[i]);
    diff += Math.abs(a.data[i + 1] - b.data[i + 1]);
    diff += Math.abs(a.data[i + 2] - b.data[i + 2]);
  }
  return diff / (a.data.length / 4);
}

function findBestPair(rows, cols) {
  const tileWidth = canvas.width / cols;
  const tileHeight = canvas.height / rows;

  if (!Number.isInteger(tileWidth) || !Number.isInteger(tileHeight)) {
    setResult("Размер изображения не делится на сетку без остатка. Подберите rows/cols.", true);
    return null;
  }

  const tiles = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const imageData = ctx.getImageData(c * tileWidth, r * tileHeight, tileWidth, tileHeight);
      tiles.push({ r, c, imageData });
    }
  }

  let best = null;
  for (let i = 0; i < tiles.length; i += 1) {
    for (let j = i + 1; j < tiles.length; j += 1) {
      const score = tileDifference(tiles[i].imageData, tiles[j].imageData);
      if (!best || score < best.score) {
        best = { first: tiles[i], second: tiles[j], score, tileWidth, tileHeight };
      }
    }
  }

  return best;
}

function highlightPair(best) {
  drawImage(loadedImage);
  ctx.lineWidth = Math.max(3, Math.round(best.tileWidth * 0.04));
  ctx.strokeStyle = "#ffd166";

  for (const t of [best.first, best.second]) {
    ctx.strokeRect(
      t.c * best.tileWidth + 2,
      t.r * best.tileHeight + 2,
      best.tileWidth - 4,
      best.tileHeight - 4
    );
  }
}

imageInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    loadedImage = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setResult("Ожидание изображения…");
    return;
  }

  try {
    loadedImage = await readFileAsImage(file);
    drawImage(loadedImage);
    setResult("Изображение загружено. Нажмите «Найти пару». ");
  } catch (error) {
    loadedImage = null;
    setResult(error.message, true);
  }
});

solveBtn.addEventListener("click", () => {
  if (!loadedImage) {
    setResult("Сначала загрузите изображение поля.", true);
    return;
  }

  const rows = Number(rowsInput.value);
  const cols = Number(colsInput.value);

  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2) {
    setResult("Укажите корректные rows/cols (целые числа >= 2).", true);
    return;
  }

  const best = findBestPair(rows, cols);
  if (!best) {
    return;
  }

  highlightPair(best);
  setResult(
    `Найдена наиболее похожая пара: (${best.first.r + 1}, ${best.first.c + 1}) и (${best.second.r + 1}, ${best.second.c + 1}).`
  );
});
