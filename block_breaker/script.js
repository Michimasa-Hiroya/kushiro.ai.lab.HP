const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreDisplay = document.getElementById('score');
const levelDisplay = document.getElementById('level');
const livesDisplay = document.getElementById('lives');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const clearScreen = document.getElementById('clear-screen');
const finalScoreDisplay = document.getElementById('final-score');
const clearScoreDisplay = document.getElementById('clear-score');

// Audio Context (Synth sounds)
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueCurveAtTime([440, 110], audioCtx.currentTime, 0.1);
        gainNode.gain.setValueCurveAtTime([0.1, 0.01], audioCtx.currentTime, 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'break') {
        osc.type = 'sawtooth';
        osc.frequency.setValueCurveAtTime([880, 220], audioCtx.currentTime, 0.15);
        gainNode.gain.setValueCurveAtTime([0.1, 0.01], audioCtx.currentTime, 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'item') {
        osc.type = 'sine';
        osc.frequency.setValueCurveAtTime([880, 1760], audioCtx.currentTime, 0.1);
        gainNode.gain.setValueCurveAtTime([0.1, 0.01], audioCtx.currentTime, 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'miss') {
        osc.type = 'triangle';
        osc.frequency.setValueCurveAtTime([220, 55], audioCtx.currentTime, 0.5);
        gainNode.gain.setValueCurveAtTime([0.2, 0.01], audioCtx.currentTime, 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    } else if (type === 'clear') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
        osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.3); // C6
        gainNode.gain.setValueCurveAtTime([0.1, 0.01], audioCtx.currentTime, 0.6);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
    }
}

// Global Variables
let score = 0;
let lives = 3;
let currentLevel = 1;
let isPlaying = false;
let isGameOver = false;
let isCleared = false;
let animationId;
let gameTime = 0;

// Entities
let paddle = { x: 350, y: 560, width: 100, height: 15, dx: 7, laserTimer: 0 };
let balls = [];
let blocks = [];
let items = [];
let lasers = [];

// Input
let rightPressed = false;
let leftPressed = false;

document.addEventListener('keydown', keyDownHandler, false);
document.addEventListener('keyup', keyUpHandler, false);
document.addEventListener('mousemove', mouseMoveHandler, false);
canvas.addEventListener('click', startOrRetry);

function keyDownHandler(e) {
    if (e.key === 'Right' || e.key === 'ArrowRight' || e.key === 'd') rightPressed = true;
    else if (e.key === 'Left' || e.key === 'ArrowLeft' || e.key === 'a') leftPressed = true;
    else if (e.key === ' ' || e.key === 'Enter') startOrRetry();
}

function keyUpHandler(e) {
    if (e.key === 'Right' || e.key === 'ArrowRight' || e.key === 'd') rightPressed = false;
    else if (e.key === 'Left' || e.key === 'ArrowLeft' || e.key === 'a') leftPressed = false;
}

function mouseMoveHandler(e) {
    if (!isPlaying) return;
    const relativeX = e.clientX - canvas.getBoundingClientRect().left;
    if (relativeX > 0 && relativeX < canvas.width) {
        paddle.x = relativeX - paddle.width / 2;
        if (paddle.x < 0) paddle.x = 0;
        if (paddle.x > canvas.width - paddle.width) paddle.x = canvas.width - paddle.width;
    }
}

function startOrRetry() {
    initAudio();
    if (isGameOver || isCleared) {
        score = 0;
        lives = 3;
        currentLevel = 1;
        isGameOver = false;
        isCleared = false;
        gameOverScreen.classList.remove('active');
        clearScreen.classList.remove('active');
        initGame();
        isPlaying = true;
    } else if (!isPlaying) {
        startScreen.classList.remove('active');
        initGame();
        isPlaying = true;
    }
}

function updateUI() {
    scoreDisplay.innerText = `SCORE: ${score.toString().padStart(6, '0')}`;
    levelDisplay.innerText = `STAGE: ${currentLevel}`;
    let hearts = '';
    for (let i = 0; i < 3; i++) hearts += i < lives ? '♥' : '♡';
    livesDisplay.innerText = `LIVES: ${hearts}`;
}

const levels = [
    [ // Stage 1
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 5, 1, 5, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],
    [ // Stage 2
        [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
        [0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0],
        [1, 0, 5, 0, 1, 0, 5, 0, 1, 0, 5, 0, 1, 0, 1],
        [0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0],
        [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]
    ],
    [ // Stage 3
        [0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0],
        [0, 0, 0, 3, 5, 3, 3, 3, 3, 3, 5, 3, 0, 0, 0],
        [0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0],
        [0, 0, 3, 0, 3, 3, 3, 3, 3, 3, 3, 0, 3, 0, 0],
        [0, 0, 3, 0, 3, 0, 0, 0, 0, 0, 3, 0, 3, 0, 0],
        [0, 0, 0, 0, 0, 3, 3, 0, 3, 3, 0, 0, 0, 0, 0]
    ],
    [ // Stage 4
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        [3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3],
        [3, 1, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 3],
        [3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3],
        [3, 3, 3, 3, 3, 3, 0, 0, 0, 3, 3, 3, 3, 3, 3]
    ],
    [ // Stage 5
        [4, 3, 3, 3, 3, 3, 4, 3, 4, 3, 3, 3, 3, 3, 4],
        [3, 5, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 5, 3],
        [3, 2, 3, 3, 3, 3, 2, 3, 2, 3, 3, 3, 3, 2, 3],
        [3, 2, 3, 5, 5, 3, 2, 3, 2, 3, 5, 5, 3, 2, 3],
        [3, 2, 3, 3, 3, 3, 2, 4, 2, 3, 3, 3, 3, 2, 3],
        [3, 2, 2, 2, 2, 2, 2, 4, 2, 2, 2, 2, 2, 2, 3],
        [4, 3, 3, 3, 3, 3, 4, 4, 4, 3, 3, 3, 3, 3, 4]
    ]
];

const blockInfo = { rowCount: 0, columnCount: 15, width: 48, height: 20, padding: 4, offsetTop: 50, offsetLeft: 12 };

function initGame() {
    paddle = { width: 100, height: 15, x: (canvas.width - 100) / 2, y: canvas.height - 30, dx: 7, laserTimer: 0 };
    let speedMult = 1 + (currentLevel * 0.1);
    balls = [{ x: canvas.width / 2, y: canvas.height - 50, dx: 4 * speedMult, dy: -4 * speedMult, radius: 6, color: '#fff', penetrating: 0 }];
    items = [];
    lasers = [];

    blocks = [];
    const layout = levels[currentLevel - 1];
    blockInfo.rowCount = layout.length;
    const totalW = blockInfo.columnCount * (blockInfo.width + blockInfo.padding) - blockInfo.padding;
    blockInfo.offsetLeft = (canvas.width - totalW) / 2;

    for (let r = 0; r < layout.length; r++) {
        blocks[r] = [];
        for (let c = 0; c < layout[r].length; c++) {
            let type = layout[r][c];
            if (type > 0) {
                blocks[r][c] = {
                    x: (c * (blockInfo.width + blockInfo.padding)) + blockInfo.offsetLeft,
                    y: (r * (blockInfo.height + blockInfo.padding)) + blockInfo.offsetTop,
                    hp: type === 5 ? 1 : (type === 4 ? 999 : type),
                    originalType: type
                };
            } else {
                blocks[r][c] = null;
            }
        }
    }
    updateUI();
}

const colors = { hp1: '#33ff33', hp2: '#ffff33', hp3: '#ff3333', indestructible: '#888888', item: '#3333ff' };
const itemTypes = ['E', 'S', 'M', 'P', 'L'];
const itemColors = { 'E': '#00ff00', 'S': '#ff0000', 'M': '#ffff00', 'P': '#ff00ff', 'L': '#00ffff' };

function spawnItem(x, y, forceDrop) {
    if (forceDrop || Math.random() < 0.15) {
        let type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        items.push({ x: x + blockInfo.width / 2 - 15, y: y, width: 30, height: 15, type: type, dy: 3 });
    }
}

function applyItem(type) {
    score += 500;
    playSound('item');
    if (type === 'E') paddle.width = Math.min(canvas.width, paddle.width + 40);
    else if (type === 'S') paddle.width = Math.max(40, paddle.width - 30);
    else if (type === 'M') {
        let newBalls = [];
        balls.forEach(b => {
            newBalls.push({ x: b.x, y: b.y, dx: -b.dx, dy: b.dy, radius: b.radius, color: b.color, penetrating: b.penetrating });
            newBalls.push({ x: b.x, y: b.y, dx: b.dx, dy: -b.dy, radius: b.radius, color: b.color, penetrating: b.penetrating });
        });
        balls = balls.concat(newBalls);
        if (balls.length > 30) balls.length = 30; // Max 30 balls
    } else if (type === 'P') {
        balls.forEach(b => b.penetrating = 600); // about 10 seconds
    } else if (type === 'L') {
        paddle.laserTimer = 600;
    }
}

function updatePhysics() {
    gameTime++;
    // Paddle Movement
    if (rightPressed && paddle.x < canvas.width - paddle.width) paddle.x += paddle.dx;
    else if (leftPressed && paddle.x > 0) paddle.x -= paddle.dx;

    // Lasers
    if (paddle.laserTimer > 0) {
        paddle.laserTimer--;
        if (gameTime % 10 === 0 && lasers.length < 5) {
            lasers.push({ x: paddle.x + 10, y: paddle.y, width: 4, height: 15, dy: -10 });
            lasers.push({ x: paddle.x + paddle.width - 14, y: paddle.y, width: 4, height: 15, dy: -10 });
            playSound('hit');
        }
    }

    for (let i = lasers.length - 1; i >= 0; i--) {
        let l = lasers[i];
        l.y += l.dy;
        let hit = false;
        for (let r = 0; r < blocks.length; r++) {
            for (let c = 0; c < blocks[r].length; c++) {
                let b = blocks[r][c];
                if (b && b.hp > 0 && b.hp < 900) {
                    if (l.x > b.x && l.x < b.x + blockInfo.width && l.y > b.y && l.y < b.y + blockInfo.height) {
                        hit = true;
                        b.hp--;
                        if (b.hp === 0) {
                            blocks[r][c] = null;
                            score += 100;
                            spawnItem(b.x, b.y, b.originalType === 5);
                            playSound('break');
                        } else {
                            playSound('hit');
                            score += 10;
                        }
                    }
                }
            }
        }
        if (hit || l.y < 0) lasers.splice(i, 1);
    }

    // Items
    for (let i = items.length - 1; i >= 0; i--) {
        let it = items[i];
        it.y += it.dy;
        if (it.y + it.height > paddle.y && it.y < paddle.y + paddle.height && it.x + it.width > paddle.x && it.x < paddle.x + paddle.width) {
            applyItem(it.type);
            items.splice(i, 1);
        } else if (it.y > canvas.height) {
            items.splice(i, 1);
        }
    }

    // Balls
    let allCleared = true;
    for (let i = balls.length - 1; i >= 0; i--) {
        let b = balls[i];
        if (b.penetrating > 0) b.penetrating--;

        // Wall hits
        if (b.x + b.dx > canvas.width - b.radius || b.x + b.dx < b.radius) { b.dx = -b.dx; playSound('hit'); }
        if (b.y + b.dy < b.radius) { b.dy = -b.dy; playSound('hit'); }
        else if (b.y + b.dy > paddle.y - b.radius && b.x > paddle.x - b.radius && b.x < paddle.x + paddle.width + b.radius) {
            // Paddle hit
            let hitPoint = b.x - (paddle.x + paddle.width / 2);
            b.dx = hitPoint * 0.15;
            if (Math.abs(b.dx) < 1) b.dx = b.dx > 0 ? 1 : -1;
            b.dy = -Math.abs(b.dy);
            b.y = paddle.y - b.radius;
            playSound('hit');
        } else if (b.y + b.dy > canvas.height) {
            balls.splice(i, 1);
            continue;
        }

        b.x += b.dx;
        b.y += b.dy;

        // Block hits
        for (let r = 0; r < blocks.length; r++) {
            for (let c = 0; c < blocks[r].length; c++) {
                let bl = blocks[r][c];
                if (bl && bl.hp > 0) {
                    if (bl.hp < 900) allCleared = false;

                    if (b.x + b.radius > bl.x && b.x - b.radius < bl.x + blockInfo.width &&
                        b.y + b.radius > bl.y && b.y - b.radius < bl.y + blockInfo.height) {

                        if (!(b.penetrating > 0 && bl.hp < 900)) {
                            let ballLeft = b.x - b.dx;
                            if (ballLeft + b.radius <= bl.x || ballLeft - b.radius >= bl.x + blockInfo.width) b.dx = -b.dx;
                            else b.dy = -b.dy;
                        }

                        if (bl.hp < 900) {
                            bl.hp--;
                            if (bl.hp <= 0) {
                                blocks[r][c] = null;
                                score += bl.originalType === 5 ? 200 : 100 * bl.originalType;
                                spawnItem(bl.x, bl.y, bl.originalType === 5);
                                playSound('break');
                            } else {
                                score += 10;
                                playSound('hit');
                            }
                        } else {
                            playSound('hit');
                        }
                    }
                }
            }
        }
    }

    // Check missing blocks (Level clear logic might be tricky dynamically, let's just do a final check)
    let hasBlocksRemaining = false;
    for (let r = 0; r < blocks.length; r++) {
        for (let c = 0; c < blocks[r].length; c++) {
            if (blocks[r][c] && blocks[r][c].hp > 0 && blocks[r][c].hp < 900) {
                hasBlocksRemaining = true;
                break;
            }
        }
    }

    if (!hasBlocksRemaining && isPlaying) {
        playSound('clear');
        currentLevel++;
        if (currentLevel > levels.length) {
            isCleared = true;
            isPlaying = false;
            clearScoreDisplay.innerText = score.toString().padStart(6, '0');
            clearScreen.classList.add('active');
        } else {
            lives++;
            initGame();
        }
    }

    if (balls.length === 0 && isPlaying) {
        lives--;
        playSound('miss');
        if (lives <= 0) {
            isPlaying = false;
            isGameOver = true;
            finalScoreDisplay.innerText = score.toString().padStart(6, '0');
            gameOverScreen.classList.add('active');
        } else {
            let speedMult = 1 + (currentLevel * 0.1);
            paddle.laserTimer = 0;
            balls = [{ x: paddle.x + paddle.width / 2, y: paddle.y - 10, dx: 4 * speedMult * (Math.random() > 0.5 ? 1 : -1), dy: -4 * speedMult, radius: 6, color: '#fff', penetrating: 0 }];
        }
    }
    updateUI();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background Grid
    ctx.strokeStyle = '#053305';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.height; i += 40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke(); }
    for (let i = 0; i < canvas.width; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }

    if (!isPlaying) { requestAnimationFrame(draw); return; }

    updatePhysics();

    // Draw Blocks
    for (let r = 0; r < blocks.length; r++) {
        for (let c = 0; c < blocks[r].length; c++) {
            let b = blocks[r][c];
            if (b && b.hp > 0) {
                ctx.beginPath();
                ctx.rect(b.x, b.y, blockInfo.width, blockInfo.height);
                if (b.hp > 900) ctx.fillStyle = colors.indestructible;
                else if (b.originalType === 5) ctx.fillStyle = colors.item;
                else if (b.hp === 3) ctx.fillStyle = colors.hp3;
                else if (b.hp === 2) ctx.fillStyle = colors.hp2;
                else ctx.fillStyle = colors.hp1;
                ctx.fill();

                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fillRect(b.x, b.y, blockInfo.width, 2);
                ctx.fillRect(b.x, b.y, 2, blockInfo.height);
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(b.x, b.y + blockInfo.height - 2, blockInfo.width, 2);
                ctx.fillRect(b.x + blockInfo.width - 2, b.y, 2, blockInfo.height);
                ctx.closePath();
            }
        }
    }

    // Draw Items
    ctx.font = '14px DotGothic16, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let it of items) {
        ctx.beginPath();
        ctx.rect(it.x, it.y, it.width, it.height);
        ctx.fillStyle = itemColors[it.type];
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.fillText(it.type, it.x + it.width / 2, it.y + it.height / 2 + 1);
        ctx.closePath();
    }

    // Draw Lasers
    ctx.fillStyle = '#ff00ff';
    for (let l of lasers) ctx.fillRect(l.x, l.y, l.width, l.height);

    // Draw Paddle
    ctx.beginPath();
    ctx.rect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.fillStyle = paddle.laserTimer > 0 ? '#ff00ff' : '#00ffff';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(paddle.x + 2, paddle.y + 2, paddle.width - 4, 3);
    ctx.closePath();

    // Draw Balls
    for (let b of balls) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = b.penetrating > 0 ? '#ff3333' : b.color;

        if (b.penetrating > 0) { ctx.shadowBlur = 10; ctx.shadowColor = '#ff3333'; }
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.closePath();
    }

    requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
