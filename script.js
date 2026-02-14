let audioCtx, analyser, dataArray;
let isPlaying = false;
let score = 0;
let gameSpeed = 2.0; 
let charY = 150;       // 시작할 때 공중에서 시작하도록 설정
let velocityY = 0;     

// --- [볼륨 모드 최적화 튜닝 수치] ---
const GRAVITY = 0.15;        // 중력 (천천히 하강)
const ASCENT_SPEED = 0.4;     // 소리 낼 때 올라가는 힘
const MAX_VELOCITY = 5.0;     // 최대 속도 제한
const VOLUME_THRESHOLD = 0.01; // 소리 인식 최소 크기 (작게 내도 인식됨)
// ----------------------------------

const charEl = document.getElementById('character');
const jellyScoreEl = document.getElementById('jelly-count');
const pitchBar = document.getElementById('pitch-bar');
const pitchText = document.getElementById('pitch-text');

document.getElementById('start-btn').addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512; // 볼륨 분석은 작은 사이즈로도 충분
        source.connect(analyser);
        dataArray = new Float32Array(analyser.frequencyBinCount);

        document.getElementById('overlay').classList.add('hidden');
        isPlaying = true;
        charY = 200; // 시작 시 약간 공중에서 시작
        
        gameLoop();
        spawnController();
        
        setInterval(() => {
            if (isPlaying) gameSpeed += 0.2;
        }, 15000);

    } catch (err) {
        alert("마이크 접근이 필요합니다. 권한 설정을 확인해주세요.");
    }
});

function gameLoop() {
    if (!isPlaying) return;
    applyVolumePhysics();
    moveEntities();
    updateUI();
    requestAnimationFrame(gameLoop);
}

function applyVolumePhysics() {
    analyser.getFloatTimeDomainData(dataArray);
    
    // 1. 볼륨(RMS) 계산
    let rms = 0;
    for (let i = 0; i < dataArray.length; i++) {
        rms += dataArray[i] * dataArray[i];
    }
    rms = Math.sqrt(rms / dataArray.length);

    // 볼륨 게이지 업데이트 (시각화)
    let volumePercent = Math.min(100, rms * 500); 
    pitchBar.style.width = volumePercent + "%";
    pitchText.innerText = "VOLUME METER";

    // 2. 볼륨이 일정 수준 이상이면 상승
    if (rms > VOLUME_THRESHOLD) {
        velocityY += ASCENT_SPEED; 
        charEl.classList.remove('run');
    } else {
        // 소리가 없으면 하강
        velocityY -= GRAVITY;
    }

    // 속도 제한
    if (velocityY > MAX_VELOCITY) velocityY = MAX_VELOCITY;
    if (velocityY < -MAX_VELOCITY) velocityY = -MAX_VELOCITY;

    charY += velocityY;

    // 3. [핵심] 바닥 사망 판정
    if (charY <= 0) {
        charY = 0;
        gameOver("바닥에 추락했습니다!");
    }

    // 4. 천장 제한
    const maxHeight = window.innerHeight - 180; 
    if (charY >= maxHeight) {
        charY = maxHeight;
        if (velocityY > 0) velocityY = 0; 
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
        // 젤리를 공중에 다양하게 배치
        entity.style.bottom = (100 + Math.random() * (window.innerHeight - 300)) + 'px';
    } else {
        entity.innerText = '🌵';
        entity.style.bottom = (80 + Math.random() * (window.innerHeight - 250)) + 'px'; // 장애물도 공중에 나타남
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
                // 장애물 충돌 시에도 즉사하거나 큰 감점 (여기서는 즉사로 설정 가능)
                gameOver("장애물에 충돌했습니다!");
            }
        }
        if (right > window.innerWidth + 100) en.remove();
    });
}

function updateUI() {
    jellyScoreEl.innerText = score;
    // 체력 바는 이제 필요 없으므로 숨기거나 고정 (HP 바 제거는 HTML/CSS에서 가능)
    const hpBar = document.getElementById('hp-fill');
    if(hpBar) hpBar.style.width = "100%";

    if (score >= 100 && score < 300) charEl.innerText = "🐔";
    else if (score >= 300) {
        charEl.innerText = "🐉";
        charEl.style.fontSize = "100px";
    }
}

function gameOver(reason) {
    isPlaying = false;
    const gameOverScreen = document.getElementById('game-over');
    gameOverScreen.classList.remove('hidden');
    gameOverScreen.querySelector('h1').innerText = reason;
    document.getElementById('final-score').innerText = score;
}