let audioCtx, analyser, dataArray;
let chickenX = 50, chickenY = 0, velocityY = 0;
let score = 0, hoverTimer = 0, feverCounter = 0;
let isFever = false, isReverse = false;

// 물리 상수 (천천히 움직이도록 조정)
const GRAVITY = 0.08, JUMP_POWER = 1.8, MOVE_SMOOTHING = 0.015;

const chickenEl = document.getElementById('chicken');
const scoreEl = document.getElementById('score-display');
const growthBar = document.getElementById('growth-bar');
const statusMsg = document.getElementById('status-msg');
const world = document.getElementById('game-container');

// [중요] 페이지 로드 즉시 병아리 위치를 잡아줍니다.
function init() {
    chickenEl.style.left = `calc(${chickenX}% - 50px)`;
    chickenEl.style.bottom = "100px";
}
window.onload = init;

// 시작 버튼 이벤트
document.getElementById('start-btn').addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        
        dataArray = new Float32Array(analyser.frequencyBinCount);
        
        document.getElementById('overlay').style.display = 'none';
        gameLoop();
        
        // 아이템 생성 및 특수 이벤트 주기적 실행
        setInterval(spawnManager, 1500);
        setInterval(toggleReverseZone, 12000);
        
    } catch (err) {
        alert("Microphone Error: Please allow mic access and ensure you are on Localhost or HTTPS.");
        console.error(err);
    }
});

function gameLoop() {
    analyzeVoice();
    updatePhysics();
    checkCollisions();
    requestAnimationFrame(gameLoop);
}

function analyzeVoice() {
    if (!analyser) return;
    analyser.getFloatTimeDomainData(dataArray);
    let freq = autoCorrelate(dataArray, audioCtx.sampleRate);

    if (freq > 0) {
        // C4(261.63Hz) 기준으로 옥타브 계산
        let octave = Math.max(-3, Math.min(3, Math.log2(freq / 261.63)));
        let direction = isReverse ? -1 : 1;
        let targetX = 50 + (octave * 13.33 * direction);
        
        chickenX += (targetX - chickenX) * MOVE_SMOOTHING;
        velocityY = JUMP_POWER;
        hoverTimer = 40;

        // 고음 유지 시 피버 카운트 상승
        if (octave > 1.2) {
            feverCounter++;
            if (feverCounter > 120 && !isFever) startFever();
        }
        statusMsg.innerText = `PITCH: ${Math.round(freq)}Hz | OCT: ${octave.toFixed(1)}`;
    } else {
        feverCounter = Math.max(0, feverCounter - 1);
        if (hoverTimer > 0) {
            hoverTimer--;
            velocityY *= 0.97;
        } else {
            velocityY -= GRAVITY;
        }
    }
}

function updatePhysics() {
    chickenY += velocityY;
    if (chickenY < 0) { chickenY = 0; velocityY = 0; }
    
    chickenX = Math.max(10, Math.min(90, chickenX));

    chickenEl.style.left = `calc(${chickenX}% - 50px)`;
    chickenEl.style.bottom = (100 + chickenY) + "px";

    // 점수에 따른 외형 변화
    if (score < 30) {
        chickenEl.innerText = "🐥";
    } else if (score < 100) {
        chickenEl.innerText = "🐔";
        chickenEl.style.fontSize = "75px";
    } else {
        chickenEl.innerText = "🐉";
        chickenEl.style.fontSize = "100px";
    }
    
    // 성장 바 업데이트
    let progress = score < 30 ? (score/30)*50 : (score < 100 ? 50+((score-30)/70)*50 : 100);
    growthBar.style.width = progress + "%";
}

function spawnManager() {
    if (isFever) { spawnItem('gold'); return; }
    
    const rand = Math.random();
    if (rand < 0.2) spawnItem('egg');
    else if (rand < 0.28) spawnItem('box');
    else if (rand < 0.45) spawnItem('gold');
    else if (rand < 0.7) spawnItem('silver');
    else spawnItem('bronze');
}

function spawnItem(type) {
    const item = document.createElement('div');
    item.style.left = (Math.random() * 80 + 10) + '%';
    item.style.top = '-60px';
    
    if (type === 'egg') {
        item.className = 'egg';
    } else if (type === 'box') {
        item.className = 'box';
        item.innerText = '🎁';
    } else {
        item.className = `item ${type}`;
        item.innerText = type === 'gold' ? '5' : (type === 'silver' ? '3' : '1');
    }
    world.appendChild(item);
    
    setTimeout(() => {
        if (item.parentNode === world) item.remove();
    }, 9000);
}

function checkCollisions() {
    const targets = document.querySelectorAll('.item, .egg, .box');
    targets.forEach(t => {
        const r1 = chickenEl.getBoundingClientRect();
        const r2 = t.getBoundingClientRect();
        
        if (!(r1.right < r2.left || r1.left > r2.right || r1.bottom < r2.top || r1.top > r2.bottom)) {
            if (t.classList.contains('egg')) {
                score = Math.max(0, score - 30);
            } else if (t.classList.contains('box')) {
                score += 20;
                statusMsg.innerText = "LUCKY BOX! +20";
            } else {
                if (t.classList.contains('gold')) score += 5;
                else if (t.classList.contains('silver')) score += 3;
                else score += 1;
            }
            t.remove();
            scoreEl.innerText = score.toString().padStart(3, '0');
        }
    });
}

function startFever() {
    isFever = true;
    statusMsg.innerText = "🔥 FEVER MODE ACTIVE! 🔥";
    chickenEl.classList.add("fever-glow");
    world.style.background = "radial-gradient(circle, #400, #000)";
    
    setTimeout(() => {
        isFever = false;
        feverCounter = 0;
        chickenEl.classList.remove("fever-glow");
        world.style.background = "radial-gradient(circle, #101820, #000)";
    }, 5000);
}

function toggleReverseZone() {
    if (Math.random() > 0.5 && !isFever) {
        isReverse = true;
        document.getElementById('reverse-zone').classList.add('zone-active');
        setTimeout(() => {
            isReverse = false;
            document.getElementById('reverse-zone').classList.remove('zone-active');
        }, 5000);
    }
}

// 주파수 분석 정밀 함수
function autoCorrelate(buffer, sampleRate) {
    let size = buffer.length;
    let rms = 0;
    for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
    if (Math.sqrt(rms / size) < 0.005) return -1;

    let c = new Array(size).fill(0);
    for (let i = 0; i < size; i++)
        for (let j = 0; j < size - i; j++)
            c[i] = c[i] + buffer[j] * buffer[j + i];

    let d = 0; while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < size; i++) {
        if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    }
    return maxpos > 0 ? sampleRate / maxpos : -1;
}