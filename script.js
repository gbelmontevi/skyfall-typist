const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const WORDS = [
  "code",
  "dash",
  "glow",
  "spark",
  "pixel",
  "tempo",
  "orbit",
  "flash",
  "boost",
  "meteor",
  "rocket",
  "vector",
  "rhythm",
  "fusion",
  "starlight",
  "binary",
  "signal",
  "canvas",
  "phrase",
  "cipher",
  "module",
  "planet",
  "stream",
  "beacon",
  "cosmic",
  "quartz",
  "thrive",
  "syntax",
  "matrix",
  "nebula",
  "cascade",
  "momentum",
  "horizon",
  "pulse",
  "zenith",
];

const LEVEL_CLEAR_TARGET = 8;
const MAX_LIVES = 5;
const REFERENCE_PLAYFIELD_HEIGHT = 720;

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const clearsEl = document.getElementById("clears");
const modeLabelEl = document.getElementById("modeLabel");
const messageEl = document.getElementById("message");
const typedPreviewEl = document.getElementById("typedPreview");
const modeSelect = document.getElementById("modeSelect");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const shareButton = document.getElementById("shareButton");
const shareStatus = document.getElementById("shareStatus");
const gameOverScreen = document.getElementById("gameOverScreen");
const gameOverSummary = document.getElementById("gameOverSummary");
const gameArea = document.getElementById("gameArea");
const mobileInput = document.getElementById("mobileInput");

let targets = [];
let nextId = 1;
let activeInput = "";
let gameState = createInitialState();
let animationFrameId = null;
let spawnTimeoutId = null;
let lastFrameTime = 0;
let letterPool = [];
let wordPool = [];
let lastMobileValue = "";

function createInitialState() {
  return {
    running: false,
    score: 0,
    lives: MAX_LIVES,
    level: 1,
    clears: 0,
    mode: modeSelect.value,
  };
}

function updateHud() {
  const displayedMode = gameState.running ? gameState.mode : modeSelect.value;
  scoreEl.textContent = String(gameState.score);
  livesEl.textContent = String(gameState.lives);
  levelEl.textContent = String(gameState.level);
  clearsEl.textContent = String(gameState.clears);
  modeLabelEl.textContent = displayedMode === "letters" ? "Letters" : "Words";
  typedPreviewEl.textContent = `Typed: ${activeInput || "—"}`;
}

function levelConfig() {
  const speedBase = gameState.mode === "letters" ? 82 : 62;
  const speedStep = gameState.mode === "letters" ? 12 : 10;
  const intervalBase = gameState.mode === "letters" ? 1280 : 1700;
  const intervalFloor = gameState.mode === "letters" ? 480 : 720;
  const interval = Math.max(intervalFloor, intervalBase - (gameState.level - 1) * 90);

  return {
    fallSpeed: speedBase + (gameState.level - 1) * speedStep,
    spawnInterval: interval,
    scorePerClear: gameState.mode === "letters" ? 10 : 20,
  };
}

function setMessage(text) {
  messageEl.textContent = text;
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 900px)").matches;
}

function focusMobileInput() {
  if (!isMobileViewport()) {
    return;
  }

  requestAnimationFrame(() => {
    mobileInput.focus({ preventScroll: true });
    mobileInput.click();
  });
}

function setShareStatus(text) {
  shareStatus.textContent = text;
}

function buildShareText() {
  const modeLabel = gameState.mode === "letters" ? "Letters" : "Words";
  return `I scored ${gameState.score} in Skyfall Typist on ${modeLabel} mode, cleared ${gameState.clears} targets, and reached level ${gameState.level}. Can you beat me?`;
}

function resetGame() {
  clearTimeout(spawnTimeoutId);
  cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  spawnTimeoutId = null;
  targets.forEach((target) => target.node.remove());
  targets = [];
  nextId = 1;
  activeInput = "";
  gameState = createInitialState();
  lastFrameTime = 0;
  letterPool = [];
  wordPool = [];
  lastMobileValue = "";
  mobileInput.value = "";
  gameOverScreen.classList.add("hidden");
  setShareStatus("");
  updateHud();
}

function startGame() {
  resetGame();
  startButton.blur();
  restartButton.blur();
  document.body.classList.add("game-active");
  gameState.mode = modeSelect.value;
  gameState.running = true;
  setMessage("Targets incoming. Type the glowing target before it hits the line.");
  updateHud();
  focusMobileInput();
  spawnTarget();
  queueNextSpawn();
  animationFrameId = requestAnimationFrame(gameLoop);
}

function randomTargetValue() {
  if (gameState.mode === "letters") {
    if (letterPool.length === 0) {
      letterPool = shuffle([...LETTERS]);
    }

    return letterPool.pop();
  }

  if (wordPool.length === 0) {
    wordPool = shuffle([...WORDS]);
  }

  return wordPool.pop().toUpperCase();
}

function shuffle(values) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }

  return values;
}

function createTargetNode(value) {
  const node = document.createElement("div");
  node.className = "target";
  node.setAttribute("data-value", value);

  value.split("").forEach((letter) => {
    const span = document.createElement("span");
    span.className = "target-letter";
    span.textContent = letter;
    node.appendChild(span);
  });

  return node;
}

function spawnTarget() {
  if (!gameState.running) {
    return;
  }

  const value = randomTargetValue();
  const node = createTargetNode(value);
  gameArea.appendChild(node);

  const areaWidth = gameArea.clientWidth;
  const targetWidth = gameState.mode === "letters" ? 148 : 180;
  node.style.width = `${targetWidth}px`;
  const x = Math.max(14, Math.random() * (areaWidth - targetWidth - 28));

  node.style.left = `${x}px`;
  node.style.top = "-30px";

  targets.push({
    id: nextId++,
    value,
    matchedCount: 0,
    progressLocked: false,
    x,
    y: -30,
    node,
  });

  highlightBestMatch();
}

function queueNextSpawn() {
  clearTimeout(spawnTimeoutId);
  const { spawnInterval } = levelConfig();
  spawnTimeoutId = window.setTimeout(() => {
    spawnTarget();
    queueNextSpawn();
  }, spawnInterval);
}

function gameLoop(timestamp) {
  if (!gameState.running) {
    return;
  }

  if (!lastFrameTime) {
    lastFrameTime = timestamp;
  }

  const deltaSeconds = (timestamp - lastFrameTime) / 1000;
  lastFrameTime = timestamp;

  const { fallSpeed } = levelConfig();
  const currentHeight = gameArea.clientHeight;
  const heightScale = currentHeight / REFERENCE_PLAYFIELD_HEIGHT;
  const scaledSpeed = fallSpeed * heightScale;
  const floor = currentHeight - 76;

  for (let index = targets.length - 1; index >= 0; index -= 1) {
    const target = targets[index];
    target.y += scaledSpeed * deltaSeconds;
    target.node.style.top = `${target.y}px`;

    if (target.y >= floor) {
      missTarget(target.id);
    }
  }

  animationFrameId = requestAnimationFrame(gameLoop);
}

function missTarget(id) {
  const index = targets.findIndex((target) => target.id === id);
  if (index === -1) {
    return;
  }

  const [target] = targets.splice(index, 1);
  target.node.classList.add("floor-hit");
  target.node.classList.add("miss");
  setTimeout(() => target.node.remove(), 380);

  gameState.lives -= 1;
  activeInput = "";
  updateHud();

  if (gameState.lives <= 0) {
    endGame();
    return;
  }

  setMessage(`Missed ${target.value}. Stay sharp, ${gameState.lives} lives left.`);
  highlightBestMatch();
}

function endGame() {
  gameState.running = false;
  clearTimeout(spawnTimeoutId);
  cancelAnimationFrame(animationFrameId);
  document.body.classList.remove("game-active");
  setMessage(`Game over. Final score: ${gameState.score}. Press start to jump back in.`);
  activeInput = "";
  gameOverSummary.textContent = `Final score: ${gameState.score} • Cleared: ${gameState.clears} • Reached level ${gameState.level}`;
  gameOverScreen.classList.remove("hidden");
  setShareStatus("");
  mobileInput.blur();
  updateHud();
}

function findBestMatchingTarget(input) {
  if (!input) {
    return null;
  }

  let best = null;

  for (const target of targets) {
    if (target.value.startsWith(input)) {
      if (!best || target.value.length < best.value.length || target.y > best.y) {
        best = target;
      }
    }
  }

  return best;
}

function highlightBestMatch() {
  const best = findBestMatchingTarget(activeInput);

  targets.forEach((target) => {
    const letters = [...target.node.children];
    target.node.classList.toggle("active", best?.id === target.id);

    letters.forEach((letterNode, index) => {
      letterNode.classList.toggle("matched", best?.id === target.id && index < activeInput.length);
    });
  });
}

function clearTarget(target) {
  gameState.score += levelConfig().scorePerClear;
  gameState.clears += 1;

  if (gameState.clears > 0 && gameState.clears % LEVEL_CLEAR_TARGET === 0) {
    gameState.level += 1;
    setMessage(`Level ${gameState.level}. Targets are speeding up now.`);
    queueNextSpawn();
  } else {
    setMessage(`Cleared ${target.value}. Keep the streak going.`);
  }

  target.node.classList.add("pop");
  setTimeout(() => target.node.remove(), 400);
  targets = targets.filter((item) => item.id !== target.id);
  activeInput = "";
  updateHud();
  highlightBestMatch();
}

function handleTypedCharacter(key) {
  if (!gameState.running) {
    return;
  }

  const normalizedKey = key.toUpperCase();
  activeInput += normalizedKey;

  const matchingTarget = findBestMatchingTarget(activeInput);

  if (!matchingTarget) {
    activeInput = "";
    setMessage(`No target for "${normalizedKey}". Focus on the nearest match.`);
    updateHud();
    highlightBestMatch();
    return;
  }

  updateHud();
  highlightBestMatch();

  if (matchingTarget.value === activeInput) {
    clearTarget(matchingTarget);
  }
}

function handleCharacterInput(value) {
  if (/^[a-zA-Z]$/.test(value)) {
    handleTypedCharacter(value);
  }
}

document.addEventListener("keydown", (event) => {
  if (event.repeat) {
    return;
  }

  if (event.key === "Backspace") {
    activeInput = activeInput.slice(0, -1);
    updateHud();
    highlightBestMatch();
    return;
  }

  if (event.key === "Escape") {
    activeInput = "";
    updateHud();
    highlightBestMatch();
    return;
  }

  if (/^[a-zA-Z]$/.test(event.key)) {
    handleTypedCharacter(event.key);
  }
});

mobileInput.addEventListener("beforeinput", (event) => {
  if (!gameState.running) {
    return;
  }

  if (event.inputType === "deleteContentBackward") {
    activeInput = activeInput.slice(0, -1);
    updateHud();
    highlightBestMatch();
    return;
  }

  if (event.data && /^[a-zA-Z]$/.test(event.data)) {
    event.preventDefault();
    handleCharacterInput(event.data);
  }
});

mobileInput.addEventListener("input", () => {
  const value = mobileInput.value.toUpperCase();

  if (!gameState.running) {
    mobileInput.value = "";
    lastMobileValue = "";
    return;
  }

  if (value.length < lastMobileValue.length) {
    activeInput = activeInput.slice(0, -1);
    updateHud();
    highlightBestMatch();
  } else if (value.length > lastMobileValue.length) {
    const latest = value.at(-1);
    handleCharacterInput(latest);
  }

  lastMobileValue = value;
  mobileInput.value = "";
  lastMobileValue = "";
});

gameArea.addEventListener("pointerdown", () => {
  focusMobileInput();
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

shareButton.addEventListener("click", async () => {
  const shareText = buildShareText();
  const shareData = {
    title: "Skyfall Typist",
    text: shareText,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      setShareStatus("Score shared.");
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareText);
      setShareStatus("Score copied to clipboard.");
      return;
    }

    setShareStatus("Sharing is not supported in this browser.");
  } catch (error) {
    if (error?.name === "AbortError") {
      setShareStatus("Share canceled.");
      return;
    }

    setShareStatus("Could not share score.");
  }
});

modeSelect.addEventListener("change", () => {
  activeInput = "";
  updateHud();
  setMessage(
    gameState.running
      ? "Mode will apply on the next restart."
      : "Mode updated. Press start when you're ready."
  );
  highlightBestMatch();
});

startButton.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
  }
});

updateHud();
