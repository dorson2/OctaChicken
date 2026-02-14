let audioCtx, analyser, dataArray;
let isPlaying = false;
let hp = 100;
let score = 0;
let gameSpeed = 2.0; 
let charY = 0;         
let velocityY = 0;     

// --- 핵심 튜닝 수치 (체공 시간 결정) ---
const GRAVITY = 0.15;    // 중력을 기존 0.55에서 0.15로 대폭 낮춤 (천천히 하강)
const JUMP_FORCE = 0.4;  // 추진력을 부드럽게 설정하여 겹치기 점프가 가능하게 함
const MAX_VELOCITY = 6;  // 너무 빨리 솟구치지 않도록 최대 속도 제한
// ---------------------------------------

const charEl = document.getElementById('character');
const hpFill = document.getElementById('hp-fill');
const jellyScoreEl = document.getElementById('jelly-count');
const pitchBar = document.getElementById('pitch-bar');

document.getElementById('start-btn').addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        dataArray = new Float32Array(analyser.frequencyBinCount);

        document.getElementById('overlay').classList.add('hidden');
        isPlaying = true;
        
        gameLoop();
        spawnController();
        
        setInterval(() => {
            if (isPlaying) gameSpeed += 0.3;
        }, 20000);

    } catch (err) {
        alert("마이크 접근이 필요합니다.");
    }
});

function gameLoop() {
    if (!isPlaying) return;
    applyPhysics();
    moveEntities();
    updateUI();
    requestAnimationFrame(gameLoop);
}

function applyPhysics() {
    analyser.getFloatTimeDomainData(dataArray);
    let pitchData = autoCorrelate(dataArray, audioCtx.sampleRate);

    // 목소리 감지 시: 점진적으로 위로 힘을 가함
    if (pitchData.freq > 0 && pitchData.confidence > 0.8) {
        let octave = Math.log2(pitchData.freq / 261.63);
        
        // 옥타브에 비례해 추진력을 주되, 아주 부드럽게 상승
        let boost = JUMP_FORCE + (Math.max(0, octave) * 0.2);
        velocityY += boost; 
        
        pitchBar.style.width = Math.max(0, Math.min(100, (octave + 2) * 25)) + "%";
        charEl.classList.remove('run');
    } else {
        // 목소리 없을 때: 중력을 아주 약하게 적용 (낙하산 타는 느낌)
        velocityY -= GRAVITY;
        let currentW = parseFloat(pitchBar.style.width) || 0;
        pitchBar.style.width = Math.max(0, currentW - 3) + "%";
    }

    // 속도 제한: 부드러운 움직임을 위해 최대 속도를 낮게 유지
    if (velocityY > MAX_VELOCITY) velocityY = MAX_VELOCITY;
    if (velocityY < -MAX_VELOCITY) velocityY = -MAX_VELOCITY;

    charY += velocityY;

    // 바닥 제한
    if (charY <= 0) {
        charY = 0;
        velocityY = 0;
        if (isPlaying) charEl.classList.add('run');
    }

    // 투명 천장 제한 (화면 상단)
    const maxHeight = window.innerHeight - 160; 
    if (charY >= maxHeight) {
        charY = maxHeight;
        velocityY = 0; 
    }

    charEl.style.bottom = (60 + charY) + 'px';
}

function spawnController() {
    if (!isPlaying) return;
    
    const type = Math.random() > 0.4 ? 'jelly' : 'obstacle';
    const entity = document.createElement('div');
    entity.className = type;
    entity.style.right = '-60px';

    if (type === 'jelly') {
        entity.innerText = '🍬';
        // 공중에 넓게 분포 (천천히 떠올라 먹기 좋게 함)
        entity.style.bottom = (100 + Math.random() * (window.innerHeight - 250)) + 'px';
    } else {
        entity.innerText = '🌵';
        entity.style.bottom = '60px'; 
    }

    document.getElementById('game-container').appendChild(entity);
    let nextSpawn = 2000 / (gameSpeed / 2);
    setTimeout(spawnController, nextSpawn + Math.random() * 1000);
}

function moveEntities() {
    const entities = document.querySelectorAll('.jelly, .obstacle');
    entities.forEach(en => {
        let right = parseFloat(en.style.right || -60);
        right += gameSpeed;
        en.style.right = right + 'px';

        const charRect = charEl.getBoundingClientRect();
        const enRect = en.getBoundingClientRect();

        if (charRect.left < enRect.right - 15 && 
            charRect.right > enRect.left + 15 &&
            charRect.bottom > enRect.top + 15 && 
            charRect.top < enRect.bottom - 15) {
            
            if (en.classList.contains('jelly')) {
                score += 10;
                en.remove();
            } else {
                hp -= 10;
                en.remove();
                charEl.style.filter = "brightness(3)";
                setTimeout(() => charEl.style.filter = "none", 200);
            }
        }
        if (right > window.innerWidth + 100) en.remove();
    });

    hp -= 0.03; 
    if (hp <= 0) {
        hp = 0;
        gameOver();
    }
}

function updateUI() {
    hpFill.style.width = hp + "%";
    jellyScoreEl.innerText = score;
    if (score >= 100 && score < 300) charEl.innerText = "🐔";
    else if (score >= 300) {
        charEl.innerText = "🐉";
        charEl.style.fontSize = "100px";
    }
}

function gameOver() {
    isPlaying = false;
    document.getElementById('game-over').classList.remove('hidden');
    document.getElementById('final-score').innerText = score;
}

function autoCorrelate(buffer, sampleRate) {
    let size = buffer.length, rms = 0;
    for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / size);
    if (rms < 0.005) return { freq: -1, confidence: 0 };

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