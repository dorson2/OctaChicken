let audioCtx, analyser, dataArray;
let isPlaying = false;
let lives = 5;
let distance = 0;
let gameSpeed = 5;
let charY = 0;
let velocityY = 0;
const GRAVITY = 0.6;

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
        spawnObstacle();
        
        // 20초마다 속도 증가
        setInterval(() => {
            if (!isPlaying) return;
            gameSpeed += 1.5;
            showSpeedMsg();
        }, 20000);
        
    } catch (err) {
        alert("마이크 권한이 필요합니다!");
    }
});

function gameLoop() {
    if (!isPlaying) return;

    analyzePitch();
    applyPhysics();
    moveObstacles();
    updateUI();
    
    requestAnimationFrame(gameLoop);
}

function analyzePitch() {
    analyser.getFloatTimeDomainData(dataArray);
    let pitchData = autoCorrelate(dataArray, audioCtx.sampleRate);
    
    // 신뢰도 0.9 이상일 때만 반응 (들숨/날숨 방지)
    if (pitchData.freq > 0 && pitchData.confidence > 0.9) {
        let pitch = pitchData.freq;
        // 주파수가 높을수록 점프 힘이 강해짐 (200Hz ~ 800Hz 범위)
        let jumpForce = Math.min(15, (pitch / 100) * 2);
        if (charY <= 0) velocityY = jumpForce; 
        statusMsg.innerText = `현재 음정: ${Math.round(pitch)}Hz`;
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

function spawnObstacle() {
    if (!isPlaying) return;
    
    const ob = document.createElement('div');
    ob.className = 'obstacle';
    ob.innerHTML = '🌵';
    ob.style.right = '-100px';
    document.getElementById('world').appendChild(ob);
    
    // 다음 장애물 생성 시간 (랜덤)
    let nextSpawn = Math.random() * 2000 + (2000 / (gameSpeed/5));
    setTimeout(spawnObstacle, nextSpawn);
}

function moveObstacles() {
    const obstacles = document.querySelectorAll('.obstacle');
    obstacles.forEach(ob => {
        let right = parseFloat(ob.style.right);
        right += gameSpeed;
        ob.style.right = right + 'px';

        // 충돌 검사
        const charRect = charEl.getBoundingClientRect();
        const obRect = ob.getBoundingClientRect();

        if (
            charRect.left < obRect.right &&
            charRect.right > obRect.left &&
            charRect.bottom > obRect.top
        ) {
            hit();
            ob.remove();
        }

        // 화면 밖으로 나가면 삭제
        if (right > window.innerWidth + 100) {
            ob.remove();
        }
    });
}

function hit() {
    lives--;
    updateUI();
    charEl.style.opacity = "0.5";
    setTimeout(() => charEl.style.opacity = "1", 500);
    
    if (lives <= 0) {
        gameOver();
    }
}

function updateUI() {
    distance += gameSpeed / 10;
    distEl.innerText = Math.floor(distance);
    livesEl.innerText = "❤️".repeat(lives);
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

// 주파수 분석 알고리즘 (신뢰도 포함)
function autoCorrelate(buffer, sampleRate) {
    let size = buffer.length;
    let rms = 0;
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
    let confidence = maxval / c[0];
    return { freq: sampleRate / maxpos, confidence: confidence };
}