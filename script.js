let audioCtx, analyser, dataArray;
let isPlaying = false;
let hp = 100;
let score = 0;
let gameSpeed = 2; // 매우 느린 시작 속도
let charY = 0;
let targetY = 0;

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
        spawnItems();
        
        // 20초마다 속도 단계별 상승
        setInterval(() => {
            if (isPlaying) {
                gameSpeed += 0.5;
                console.log("Speed Up:", gameSpeed);
            }
        }, 20000);

    } catch (err) {
        alert("마이크를 연결하고 권한을 허용해주세요!");
    }
});

function gameLoop() {
    if (!isPlaying) return;
    
    analyzeVoice();
    moveEntities();
    updateUI();
    
    requestAnimationFrame(gameLoop);
}

function analyzeVoice() {
    analyser.getFloatTimeDomainData(dataArray);
    let pitchData = autoCorrelate(dataArray, audioCtx.sampleRate);

    if (pitchData.freq > 0 && pitchData.confidence > 0.8) {
        let octave = Math.log2(pitchData.freq / 261.63);
        // 고도 조절: 옥타브에 따라 위아래 위치 결정
        targetY = (octave + 1.5) * 120; 
        
        // UI 미터 업데이트
        let meterWidth = Math.max(0, Math.min(100, (octave + 2) * 25));
        pitchBar.style.width = meterWidth + "%";
    } else {
        targetY = 0; // 소리 없으면 바닥으로
        let currentW = parseFloat(pitchBar.style.width) || 0;
        pitchBar.style.width = Math.max(0, currentW - 2) + "%";
    }

    // 캐릭터 이동 보간 (부드러운 움직임)
    charY += (targetY - charY) * 0.08;
    charY = Math.max(0, Math.min(window.innerHeight - 180, charY));
    charEl.style.bottom = (80 + charY) + 'px';
}

function spawnItems() {
    if (!isPlaying) return;

    const type = Math.random() > 0.3 ? 'jelly' : 'obstacle';
    const entity = document.createElement('div');
    entity.className = type;
    entity.style.right = '-60px';

    if (type === 'jelly') {
        entity.innerText = '🍬';
        // 젤리는 물결 모양으로 배치하여 고도 조절 유도
        entity.style.bottom = (150 + Math.sin(Date.now() / 600) * 120) + 'px';
    } else {
        entity.innerText = '🌵';
        entity.style.bottom = '60px'; // 장애물은 바닥에 고정
    }

    document.getElementById('game-container').appendChild(entity);

    // 속도에 맞춘 생성 간격
    setTimeout(spawnItems, 1500 / (gameSpeed / 2));
}

function moveEntities() {
    const entities = document.querySelectorAll('.jelly, .obstacle');
    entities.forEach(en => {
        let right = parseFloat(en.style.right || -60);
        right += gameSpeed;
        en.style.right = right + 'px';

        // 충돌 검사
        const charRect = charEl.getBoundingClientRect();
        const enRect = en.getBoundingClientRect();

        if (
            charRect.left < enRect.right - 10 &&
            charRect.right > enRect.left + 10 &&
            charRect.bottom > enRect.top + 10 &&
            charRect.top < enRect.bottom - 10
        ) {
            if (en.classList.contains('jelly')) {
                score += 10;
                en.remove();
            } else {
                hp -= 20;
                en.remove();
                charEl.style.opacity = "0.5";
                setTimeout(() => charEl.style.opacity = "1", 300);
            }
        }

        if (right > window.innerWidth + 100) en.remove();
    });

    // 자동 체력 감소 (쿠키런 스타일)
    hp -= 0.02; 
    if (hp <= 0) gameOver();
}

function updateUI() {
    hpFill.style.width = hp + "%";
    jellyScoreEl.innerText = score;

    // 변신 로직
    if (score > 100 && score < 300) charEl.innerText = "🐔";
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

// 핵심 주파수 분석 함수
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