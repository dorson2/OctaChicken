let audioCtx, analyser, dataArray, gainNode;
let isPlaying = false;
let isGravityActive = false;
let score = 0;
let charY = window.innerHeight / 2;
let velocityY = 0;
let lives = 3;

// GLOBAL GAME CONFIG
const SENSITIVITY = 0.8;      // Fixed sensitivity
const GRAVITY = 0.17;         
const ASCENT_SPEED = 0.42;    
const MAX_VELOCITY = 5.0;
const MIC_THRESHOLD = 0.01;

const charEl = document.getElementById('character');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');
const volBar = document.getElementById('vol-bar');
const scoreVal = document.getElementById('distance-val');
const livesContainer = document.getElementById('lives-container');

document.getElementById('start-btn').addEventListener('click', startSequence);

async function startSequence() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        
        // Signal Boosting Node
        gainNode = audioCtx.createGain();
        gainNode.gain.value = 2.5; 
        
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(gainNode);
        gainNode.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        document.getElementById('overlay').classList.add('hidden');
        countdownOverlay.classList.remove('hidden');

        // COUNTDOWN: 3 -> 2 -> 1 -> GO!
        const steps = ['3', '2', '1', 'GO!'];
        for (let step of steps) {
            countdownNumber.innerText = step;
            countdownNumber.classList.remove('pop-effect');
            void countdownNumber.offsetWidth; // Trigger reflow
            countdownNumber.classList.add('pop-effect');
            await new Promise(r => setTimeout(r, 1000));
        }

        countdownOverlay.classList.add('hidden');
        isPlaying = true;
        isGravityActive = true;

        gameLoop();
        spawnEnemies();
    } catch (err) {
        alert("Microphone access is required to play!");
    }
}

function gameLoop() {
    if (!isPlaying) return;

    // VOLUME ANALYSIS
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        let v = (dataArray[i] - 128) / 128;
        sum += v * v;
    }
    let rms = Math.sqrt(sum / dataArray.length);
    let adjustedVol = rms * SENSITIVITY;
    volBar.style.width = Math.min(100, adjustedVol * 1000) + "%";

    if (isGravityActive) {
        if (adjustedVol > MIC_THRESHOLD) {
            velocityY += ASCENT_SPEED;
            charEl.classList.remove('float-anim');
        } else {
            velocityY -= GRAVITY;
        }
        if (velocityY > MAX_VELOCITY) velocityY = MAX_VELOCITY;
        charY += velocityY;

        // INSTANT DEATH: Ocean
        if (charY <= 90) gameOver("Drowned in the ocean! 🌊");
    }

    // CEILING LIMIT
    if (charY >= window.innerHeight - 120) {
        charY = window.innerHeight - 120;
        velocityY = 0;
    }

    charEl.style.bottom = charY + "px";
    score += 0.2;
    scoreVal.innerText = Math.floor(score);

    requestAnimationFrame(gameLoop);
}

function spawnEnemies() {
    if (!isPlaying) return;
    const enemy = document.createElement('div');
    enemy.style.cssText = `position:absolute; right:-100px; bottom:${150 + Math.random() * (window.innerHeight - 350)}px; font-size:50px; z-index:600;`;
    enemy.innerText = Math.random() > 0.5 ? "🦅" : "🛸";
    document.getElementById('game-container').appendChild(enemy);

    let pos = -100;
    const move = setInterval(() => {
        if(!isPlaying) { clearInterval(move); return; }
        pos += (4 + score/600); 
        enemy.style.right = pos + "px";

        const c = charEl.getBoundingClientRect();
        const e = enemy.getBoundingClientRect();
        
        // DAMAGE COLLISION
        if (c.left < e.right - 25 && c.right > e.left + 25 && c.bottom > e.top + 25 && c.top < e.bottom - 25) {
            handleDamage();
            enemy.remove();
            clearInterval(move);
        }
        if (pos > window.innerWidth + 100) { enemy.remove(); clearInterval(move); }
    }, 20);
    setTimeout(spawnEnemies, 1800 + Math.random() * 1500);
}

function handleDamage() {
    lives--;
    let hearts = "";
    for(let i=0; i<3; i++) hearts += (i < lives) ? "❤️ " : "🖤 ";
    livesContainer.innerText = hearts;
    charEl.classList.add('hit-flash');
    setTimeout(() => charEl.classList.remove('hit-flash'), 400);
    
    if (lives <= 0) gameOver("Out of health! 💥");
}

function gameOver(reason) {
    isPlaying = false;
    document.getElementById('game-over').classList.remove('hidden');
    document.getElementById('death-reason').innerText = reason;
    document.getElementById('final-score-val').innerText = Math.floor(score);
}