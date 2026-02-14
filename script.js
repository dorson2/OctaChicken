let audioCtx, analyser, dataArray;
let isPlaying = false;
let lives = 5;
let distance = 0;
let gameSpeed = 5;
let charY = 0;
let velocityY = 0;
const GRAVITY = 0.5; // 중력

const charEl = document.getElementById('character');
const distEl = document.getElementById('dist');
const livesEl = document.getElementById('lives');
const statusMsg = document.getElementById('status-msg');

document.getElementById('start-btn').addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        dataArray = new Float32Array(analyser.frequencyBinCount);
        
        document.getElementById('overlay').classList.add('hidden');
        isPlaying = true;
        gameLoop();
        spawnController();
        
        // 20초마다 속도 증가
        setInterval(() => {
            if (!isPlaying) return;
            gameSpeed += 1.2;
            showSpeedMsg();
        }, 20000);
        
    } catch (err) {
        alert("마이크 권한이 필요합니다!");
    }
});

function gameLoop() {
    if (!isPlaying) return;

    analyzeOctave();
    applyPhysics();
    moveEntities();
    updateUI();
    
    requestAnimationFrame(gameLoop);
}

function analyzeOctave() {
    analyser.getFloatTimeDomainData(dataArray);
    let pitchData = autoCorrelate(dataArray, audioCtx.sampleRate);
    
    if (pitchData.freq > 0 && pitchData.confidence > 0.9) {
        let freq = pitchData.freq;
        // C4(261.63Hz) 기준 옥타브 계산 (-2 ~ 3 옥타브 정도 범위)
        let octave = Math.log2(freq / 261.63);
        
        // 낮은 음은 약하게, 높은 음은 강하게 점프
        // 옥타브가 높을수록 점프 힘이 배가됨
        let jumpPower = 10 + (octave * 4); 
        jumpPower = Math.max(5, Math.min(22, jumpPower)); // 최소/최대 제한

        if (charY <= 10) velocityY = jumpPower; 
        statusMsg.innerText = `PITCH: ${Math.round(freq)}Hz (Octave: ${octave.toFixed(1)})`;
    }
}

function applyPhysics() {
    charY += velocityY;
    if (charY > 0) {
        velocityY -= GRAVITY;
    } else {
        charY = 0;
        velocityY = 0;
    }
    charEl.style.bottom = (50 + charY) + "px";
}

// 장애물 및 아이템 생성 관리
function spawnController() {
    if (!isPlaying) return;
    
    const rand = Math.random();
    if (rand < 0.7) {
        spawnEntity('obstacle'); // 장애물 확률 높음
    } else {
        spawnEntity('energy'); // 에너지 아이템 확률
    }
    
    let nextSpawn = Math.random() * 1500 + (1500 / (gameSpeed/5));
    setTimeout(spawnController, nextSpawn);
}

function spawnEntity(type) {
    const entity = document.createElement('div');
    entity.className = type;
    if (type === 'energy') {
        entity.innerHTML = '⚡';
        // 에너지 아이템은 공중에 생성
        entity.style.bottom = (100 + Math.random() * 200) + 'px';
    }
    entity.style.right = '-100px';
    document.getElementById('world').appendChild(entity);
}

function moveEntities() {
    const entities = document.querySelectorAll('.obstacle, .energy');
    entities.forEach(en => {
        let right = parseFloat(en.style.right || -100);
        right += gameSpeed;
        en.style.right = right + 'px';

        const charRect = charEl.getBoundingClientRect();
        const enRect = en.getBoundingClientRect();

        // 충돌 검사 (살짝 여유를 줌)
        if (
            charRect.left < enRect.right - 10 &&
            charRect.right > enRect.left + 10 &&
            charRect.bottom > enRect.top + 10 &&
            charRect.top < enRect.bottom - 10
        ) {
            if (en.classList.contains('obstacle')) {
                hit();
            } else {
                heal();
            }
            en.remove();
        }

        if (right > window.innerWidth + 100) en.remove();
    });
}

function hit() {
    lives--;
    updateUI();
    charEl.style.filter = "invert(1)";
    setTimeout(() => charEl.style.filter = "none", 200);
    if (lives <= 0) gameOver();
}

function heal() {
    if (lives < 5) {
        lives++;
        statusMsg.innerText = "ENERGY RECOVERED! ⚡";
        updateUI();
    }
}

function updateUI() {
    distance += gameSpeed / 20;
    distEl.innerText = Math.floor(distance);
    livesEl.innerText = "❤️".repeat(lives);

    // 거리(점수)에 따른 실시간 변신
    let d = Math.floor(distance);
    if (d < 50) {
        charEl.innerText = "🐥";
    } else if (d < 150) {
        charEl.innerText = "🐔";
        charEl.style.fontSize = "70px";
    } else {
        charEl.innerText = "🐉";
        charEl.style.fontSize = "100px";
        charEl.style.filter = "drop-shadow(0 0 10px #00f3ff)";
    }
}

function showSpeedMsg() {
    const msg = document.getElementById('speed-msg');
    msg.style.opacity = "1";
    setTimeout(() => msg.style.opacity = "0", 1000);
}

function gameOver() {
    isPlaying = false;
    document.getElementById('game-over').classList.remove('hidden');
    document.getElementById('final-dist').innerText = Math.floor(distance);
}

function autoCorrelate(buffer, sampleRate) {
    let size = buffer.length, rms = 0;
    for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / size);
    if (rms < 0.01) return { freq: -1, confidence: 0 };

    let c = new Array(size).fill(0);
    for (let i = 0; i < size; i++)
        for (let j = 0; j < size - i; j++)
            c[i] = c[i] + buffer[j] * buffer[j + i];

    let d = 0; while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < size; i++) {
        if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    }
    return { freq: sampleRate / maxpos, confidence: maxval / c[0] };
}