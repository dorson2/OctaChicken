let audioCtx, analyser, dataArray;
let isPlaying = false;
let lives = 5;
let distance = 0;
let gameSpeed = 1.5; // 기존 3에서 1.5로 대폭 하향 (거북이 속도)
let charY = 0;
let velocityY = 0;
const GRAVITY = 0.35; 

const charEl = document.getElementById('character');
const distEl = document.getElementById('dist');
const livesEl = document.getElementById('lives');
const pitchBar = document.getElementById('pitch-bar');
const pitchText = document.getElementById('pitch-text');
const speedMsg = document.getElementById('speed-msg');

document.getElementById('start-btn').addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // 오디오 컨텍스트가 중단된 상태면 재개
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
        
        // 20초마다 아주 조금씩 속도 증가 (+0.4)
        setInterval(() => {
            if (!isPlaying) return;
            gameSpeed += 0.4;
            showSpeedMsg();
        }, 20000);
        
    } catch (err) {
        alert("마이크 연결에 실패했습니다. 권한 설정을 확인해주세요!");
    }
});

function gameLoop() {
    if (!isPlaying) return;
    analyzeVoice();
    applyPhysics();
    moveEntities();
    updateUI();
    requestAnimationFrame(gameLoop);
}

function analyzeVoice() {
    analyser.getFloatTimeDomainData(dataArray);
    let pitchData = autoCorrelate(dataArray, audioCtx.sampleRate);
    
    // 인식 감도를 더 높이기 위해 confidence 기준을 0.8로 낮춤
    if (pitchData.freq > 0 && pitchData.confidence > 0.8) {
        let freq = pitchData.freq;
        // 옥타브 수치화 (C4 기준)
        let octave = Math.log2(freq / 261.63);
        
        // 옥타브 미터 업데이트 (UI)
        let meterPercent = Math.max(0, Math.min(100, (octave + 2) * 20)); 
        pitchBar.style.width = meterPercent + "%";
        pitchText.innerText = `OCTAVE: ${octave.toFixed(1)} (${Math.round(freq)}Hz)`;

        // 점프 로직 (바닥 근처에서만 발동)
        if (charY < 10) {
            let jumpPower = 10 + (octave * 3.5); 
            velocityY = Math.max(7, Math.min(20, jumpPower));
            charEl.classList.remove('walk');
        }
    } else {
        // 소리가 없을 때 게이지 천천히 감소
        let currentWidth = parseFloat(pitchBar.style.width) || 0;
        pitchBar.style.width = Math.max(0, currentWidth - 2) + "%";
    }
}

function applyPhysics() {
    charY += velocityY;
    if (charY > 0) {
        velocityY -= GRAVITY;
    } else {
        charY = 0;
        velocityY = 0;
        if (isPlaying) charEl.classList.add('walk');
    }
    charEl.style.bottom = (50 + charY) + "px";
}

function spawnController() {
    if (!isPlaying) return;
    const rand = Math.random();
    if (rand < 0.75) spawnEntity('obstacle');
    else spawnEntity('energy');
    
    // 속도가 느릴수록 생성 간격도 길게 조절
    let nextSpawn = Math.random() * 2000 + (3000 / (gameSpeed/1.5));
    setTimeout(spawnController, nextSpawn);
}

function spawnEntity(type) {
    const entity = document.createElement('div');
    entity.className = type;
    if (type === 'energy') {
        entity.innerHTML = '⚡';
        entity.style.bottom = (130 + Math.random() * 150) + 'px';
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

        if (
            charRect.left < enRect.right - 15 &&
            charRect.right > enRect.left + 15 &&
            charRect.bottom > enRect.top + 15 &&
            charRect.top < enRect.bottom - 15
        ) {
            if (en.classList.contains('obstacle')) {
                lives--;
                charEl.style.filter = "brightness(5)";
                setTimeout(() => charEl.style.filter = "none", 200);
            } else {
                if (lives < 5) lives++;
            }
            en.remove();
            if (lives <= 0) gameOver();
        }
        if (right > window.innerWidth + 100) en.remove();
    });
}

function updateUI() {
    distance += gameSpeed / 50; // 거리 증가량도 속도에 맞춰 하향
    distEl.innerText = Math.floor(distance);
    livesEl.innerText = "❤️".repeat(lives);

    let d = Math.floor(distance);
    if (d < 50) charEl.innerText = "🐥";
    else if (d < 150) { charEl.innerText = "🐔"; charEl.style.fontSize = "70px"; }
    else { charEl.innerText = "🐉"; charEl.style.fontSize = "100px"; }
}

function showSpeedMsg() {
    speedMsg.style.opacity = "1";
    setTimeout(() => speedMsg.style.opacity = "0", 1000);
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
    
    // 감도를 극대화 (0.005 이하의 아주 미세한 소리도 감지)
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