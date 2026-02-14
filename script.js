let audioCtx, analyser, dataArray;
let isPlaying = false;
let hp = 100;
let score = 0;
let gameSpeed = 1.8; // 시작 속도를 조금 더 늦춰서 더 편하게 조정
let charY = 0;         
let velocityY = 0;     

// --- [남녀노소 최적화 튜닝 수치] ---
const GRAVITY = 0.1;        // 중력을 극도로 낮춤 (깃털보다 가볍게 하강)
const ASCENT_SPEED = 0.22;   // 상승 가속도 (부드럽게 밀어올림)
const MAX_VELOCITY = 4.0;    // 최대 속도를 낮게 잡아 안정감 부여
const TARGET_OCTAVE = -2;    // [핵심] 낮은 저음(-2 옥타브)부터 인식하여 점프 허용
// ----------------------------------

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
        
        // 속도 증가 폭을 낮춰서 난이도 조절
        setInterval(() => {
            if (isPlaying) gameSpeed += 0.15;
        }, 25000);

    } catch (err) {
        alert("마이크 접근이 필요합니다. 권한 설정을 확인해주세요.");
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

    // 목소리 분석
    if (pitchData.freq > 0 && pitchData.confidence > 0.75) { // 신뢰도 기준도 약간 낮춰서 더 잘 인식하게 함
        let octave = Math.log2(pitchData.freq / 261.63);
        
        // 게이지 UI 업데이트 (옥타브가 낮아도 표시되도록 조정)
        let meterWidth = Math.max(0, Math.min(100, (octave + 3) * 20));
        pitchBar.style.width = meterWidth + "%";

        // [핵심] -2 옥타브 이상이면 무조건 부드럽게 상승
        if (octave >= TARGET_OCTAVE) {
            velocityY += ASCENT_SPEED; 
            charEl.classList.remove('run');
        } else {
            velocityY -= GRAVITY;
        }
    } else {
        // 소리가 없을 때 (부드러운 하강)
        velocityY -= GRAVITY;
        let currentW = parseFloat(pitchBar.style.width) || 0;
        pitchBar.style.width = Math.max(0, currentW - 1.5) + "%";
    }

    // 물리 한계값 적용
    if (velocityY > MAX_VELOCITY) velocityY = MAX_VELOCITY;
    if (velocityY < -MAX_VELOCITY) velocityY = -MAX_VELOCITY;

    charY += velocityY;

    // 바닥 제한
    if (charY <= 0) {
        charY = 0;
        velocityY = 0;
        if (isPlaying) charEl.classList.add('run');
    }

    // [투명 천장] 화면 상단 제한 (천장에 머리 대고 둥둥 떠다님)
    const maxHeight = window.innerHeight - 180; 
    if (charY >= maxHeight) {
        charY = maxHeight;
        if (velocityY > 0) velocityY = 0; 
    }

    charEl.style.bottom = (60 + charY) + 'px';
}

function spawnController() {
    if (!isPlaying) return;
    
    const type = Math.random() > 0.45 ? 'jelly' : 'obstacle';
    const entity = document.createElement('div');
    entity.className = type;
    entity.style.right = '-60px';

    if (type === 'jelly') {
        entity.innerText = '🍬';
        // 젤리 높이 범위를 넓혀서 고음/저음 유도
        entity.style.bottom = (100 + Math.random() * (window.innerHeight - 300)) + 'px';
    } else {
        entity.innerText = '🌵';
        entity.style.bottom = '60px'; 
    }

    document.getElementById('game-container').appendChild(entity);
    let nextSpawn = 2500 / (gameSpeed / 1.8);
    setTimeout(spawnController, nextSpawn + Math.random() * 1200);
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
                hp = Math.min(100, hp + 3); // 젤리 회복량 증가
                en.remove();
            } else {
                hp -= 10;
                en.remove();
                charEl.style.filter = "brightness(3) contrast(2)";
                setTimeout(() => charEl.style.filter = "none", 250);
            }
        }
        if (right > window.innerWidth + 100) en.remove();
    });

    hp -= 0.03; // 자연적인 체력 소모 속도 감소
    if (hp <= 0) gameOver();
}

function updateUI() {
    hpFill.style.width = hp + "%";
    jellyScoreEl.innerText = score;
    
    if (score >= 100 && score < 300) {
        charEl.innerText = "🐔";
    } else if (score >= 300) {
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