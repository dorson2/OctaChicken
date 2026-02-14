let audioCtx, analyser, dataArray;
let isPlaying = false;
let hp = 100;
let score = 0;
let gameSpeed = 2.5; 
let charY = 0;         
let velocityY = 0;     
const GRAVITY = 0.55;   // 중력 세기 (값이 클수록 빨리 떨어짐)
const JUMP_FORCE = 1.3; // 목소리 인식 시 위로 밀어올리는 힘

const charEl = document.getElementById('character');
const hpFill = document.getElementById('hp-fill');
const jellyScoreEl = document.getElementById('jelly-count');
const pitchBar = document.getElementById('pitch-bar');

// 시작 버튼 클릭 핸들러
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
        
        // 20초마다 속도 단계별 상승
        setInterval(() => {
            if (isPlaying) {
                gameSpeed += 0.4;
            }
        }, 20000);

    } catch (err) {
        alert("마이크 접근이 필요합니다. 브라우저 설정을 확인해주세요.");
    }
});

function gameLoop() {
    if (!isPlaying) return;
    
    applyPhysics();
    moveEntities();
    updateUI();
    
    requestAnimationFrame(gameLoop);
}

// 목소리 분석 및 물리 적용 (중력 + 연속점프)
function applyPhysics() {
    analyser.getFloatTimeDomainData(dataArray);
    let pitchData = autoCorrelate(dataArray, audioCtx.sampleRate);

    // 목소리가 감지되면 추진력(velocityY) 추가
    if (pitchData.freq > 0 && pitchData.confidence > 0.8) {
        let octave = Math.log2(pitchData.freq / 261.63);
        
        // 고음일수록 점프력이 더 강해짐
        let boost = JUMP_FORCE + (Math.max(0, octave) * 0.4);
        velocityY += boost; 
        
        // 게이지 바 업데이트
        pitchBar.style.width = Math.max(0, Math.min(100, (octave + 2) * 25)) + "%";
        charEl.classList.remove('run'); // 공중에선 달리기 모션 중지
    } else {
        // 소리가 없으면 중력에 의해 속도가 깎임
        velocityY -= GRAVITY;
        let currentW = parseFloat(pitchBar.style.width) || 0;
        pitchBar.style.width = Math.max(0, currentW - 4) + "%";
    }

    // 상승 속도 제한 (너무 빠르면 화면 뚫고 나감)
    if (velocityY > 12) velocityY = 12;

    charY += velocityY;

    // 바닥 충돌 제한
    if (charY <= 0) {
        charY = 0;
        velocityY = 0;
        if (isPlaying) charEl.classList.add('run'); // 바닥에선 달리기
    }

    // [투명 천장] 화면 상단 제한 로직
    const maxHeight = window.innerHeight - 160; 
    if (charY >= maxHeight) {
        charY = maxHeight;
        velocityY = 0; // 천장에 닿으면 상승 속도 초기화
    }

    charEl.style.bottom = (60 + charY) + 'px';
}

// 아이템 생성 관리
function spawnController() {
    if (!isPlaying) return;
    
    const type = Math.random() > 0.3 ? 'jelly' : 'obstacle';
    const entity = document.createElement('div');
    entity.className = type;
    entity.style.right = '-60px';

    if (type === 'jelly') {
        entity.innerText = '🍬';
        // 젤리는 공중 무작위 높이에 생성 (다중 점프 유도)
        entity.style.bottom = (100 + Math.random() * (window.innerHeight - 250)) + 'px';
    } else {
        entity.innerText = '🌵';
        entity.style.bottom = '60px'; // 장애물은 바닥 가시
    }

    document.getElementById('game-container').appendChild(entity);
    
    // 속도에 따라 생성 주기 조절
    let nextSpawn = 1800 / (gameSpeed / 2);
    setTimeout(spawnController, nextSpawn + Math.random() * 1000);
}

// 엔티티 이동 및 충돌 감지
function moveEntities() {
    const entities = document.querySelectorAll('.jelly, .obstacle');
    entities.forEach(en => {
        let right = parseFloat(en.style.right || -60);
        right += gameSpeed;
        en.style.right = right + 'px';

        const charRect = charEl.getBoundingClientRect();
        const enRect = en.getBoundingClientRect();

        // 히트박스 판정
        if (charRect.left < enRect.right - 15 && 
            charRect.right > enRect.left + 15 &&
            charRect.bottom > enRect.top + 15 && 
            charRect.top < enRect.bottom - 15) {
            
            if (en.classList.contains('jelly')) {
                score += 10;
                en.remove();
            } else {
                hp -= 15; // 장애물 충돌 시 대폭 감소
                en.remove();
                charEl.style.filter = "brightness(3) saturate(0)";
                setTimeout(() => charEl.style.filter = "none", 200);
            }
        }

        if (right > window.innerWidth + 100) en.remove();
    });

    // 쿠키런식 초당 체력 감소
    hp -= 0.04; 
    if (hp <= 0) {
        hp = 0;
        gameOver();
    }
}

function updateUI() {
    hpFill.style.width = hp + "%";
    jellyScoreEl.innerText = score;
    
    // 점수에 따른 외형 변화
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

// 오디오 주파수 추출 알고리즘
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