let audioCtx, analyser, dataArray;
let isPlaying = false;
let lives = 5;
let distance = 0;
let gameSpeed = 3; // 시작 속도를 5에서 3으로 하향 (매우 천천히 시작)
let charY = 0;
let velocityY = 0;
const GRAVITY = 0.4; // 중력을 낮춰서 점프가 더 부드럽게 보이게 함

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
        
        // 20초마다 속도 조금씩 증가 (+0.8씩)
        setInterval(() => {
            if (!isPlaying) return;
            gameSpeed += 0.8; 
            showSpeedMsg();
        }, 20000);
        
    } catch (err) {
        alert("마이크 권한을 허용해주세요!");
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
    
    // 점프 안됨 해결: 신뢰도 기준을 0.85로 낮추고 감도 상향
    if (pitchData.freq > 0 && pitchData.confidence > 0.85) {
        let freq = pitchData.freq;
        let octave = Math.log2(freq / 261.63);
        
        // 바닥에 있거나 아주 낮은 높이일 때만 점프 가능
        if (charY < 5) {
            let jumpPower = 12 + (octave * 3); 
            velocityY = Math.max(8, Math.min(18, jumpPower));
            
            // 점프 시 걷기 애니메이션 중지
            charEl.classList.remove('walk');
            charEl.classList.add('jumping');
        }
        statusMsg.innerText = `점프 발생! (${Math.round(freq)}Hz)`;
    }
}

function applyPhysics() {
    charY += velocityY;
    if (charY > 0) {
        velocityY -= GRAVITY;
    } else {
        charY = 0;
        velocityY = 0;
        // 바닥에 닿으면 다시 걷기 애니메이션 시작
        if (isPlaying) {
            charEl.classList.add('walk');
            charEl.classList.remove('jumping');
        }
    }
    charEl.style.bottom = (50 + charY) + "px";
}

function spawnController() {
    if (!isPlaying) return;
    const rand = Math.random();
    if (rand < 0.7) spawnEntity('obstacle');
    else spawnEntity('energy');
    
    // 속도에 맞춰 생성 간격 조절
    let nextSpawn = Math.random() * 2000 + (2500 / (gameSpeed/3));
    setTimeout(spawnController, nextSpawn);
}

function spawnEntity(type) {
    const entity = document.createElement('div');
    entity.className = type;
    if (type === 'energy') {
        entity.innerHTML = '⚡';
        entity.style.bottom = (120 + Math.random() * 150) + 'px';
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
            if (en.classList.contains('obstacle')) hit();
            else heal();
            en.remove();
        }
        if (right > window.innerWidth + 100) en.remove();
    });
}

function hit() {
    lives--;
    updateUI();
    charEl.style.filter = "brightness(5) saturate(0)";
    setTimeout(() => charEl.style.filter = "none", 300);
    if (lives <= 0) gameOver();
}

function heal() {
    if (lives < 5) {
        lives++;
        updateUI();
    }
}

function updateUI() {
    distance += gameSpeed / 30;
    distEl.innerText = Math.floor(distance);
    livesEl.innerText = "❤️".repeat(lives);

    let d = Math.floor(distance);
    if (d < 50) charEl.innerText = "🐥";
    else if (d < 150) { charEl.innerText = "🐔"; charEl.style.fontSize = "70px"; }
    else { charEl.innerText = "🐉"; charEl.style.fontSize = "100px"; }
}

function showSpeedMsg() {
    const msg = document.getElementById('speed-msg');
    msg.style.opacity = "1";
    setTimeout(() => msg.style.opacity = "0", 1000);
}

function gameOver() {
    isPlaying = false;
    charEl.classList.remove('walk');
    document.getElementById('game-over').classList.remove('hidden');
    document.getElementById('final-dist').innerText = Math.floor(distance);
}

// 오디오 분석 알고리즘
function autoCorrelate(buffer, sampleRate) {
    let size = buffer.length, rms = 0;
    for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / size);
    if (rms < 0.008) return { freq: -1, confidence: 0 }; // rms 기준을 낮춰 더 작은 소리도 감지

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