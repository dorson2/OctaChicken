let audioCtx, analyser, dataArray;
let isPlaying = false;
let score = 0;
let gameSpeed = 2.5;
let charY = window.innerHeight / 2 - 100; // 화면 중앙
let velocityY = 0;
let isGravityActive = false; // 2초간 중력 무시

// --- [물리 및 볼륨 설정] ---
const GRAVITY = 0.15;        // 떨어지는 속도 (낮을수록 천천히 하강)
const ASCENT_SPEED = 0.35;   // 소리 낼 때 떠오르는 속도 (부드럽게 상승)
const MAX_VELOCITY = 4.5;    // 최대 속도 제한 (안정적인 비행)
const VOLUME_THRESHOLD = 0.008; // 감도 (낮을수록 작은 소리에도 반응)
// --------------------------

const charEl = document.getElementById('character');
const bridgeEl = document.getElementById('start-bridge');
const pitchBar = document.getElementById('pitch-bar');

document.getElementById('start-btn').addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        await audioCtx.resume();

        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        dataArray = new Float32Array(analyser.frequencyBinCount);

        document.getElementById('overlay').classList.add('hidden');
        isPlaying = true;
        
        // 초기 고정 상태
        charY = window.innerHeight / 2 - 100;
        velocityY = 0;
        isGravityActive = false;

        // [2초 유예 로직] 2초간 공중부양 후 중력 작동 및 흙길 제거
        setTimeout(() => {
            isGravityActive = true;
            if(bridgeEl) bridgeEl.style.transform = "translateX(-120%)";
        }, 2000);

        gameLoop();
        spawnObstacles();
    } catch (err) {
        alert("마이크 권한이 필요합니다! 브라우저 설정을 확인해주세요.");
    }
});

function gameLoop() {
    if (!isPlaying) return;
    
    // 볼륨(RMS) 분석
    analyser.getFloatTimeDomainData(dataArray);
    let rms = 0;
    for (let i = 0; i < dataArray.length; i++) rms += dataArray[i] * dataArray[i];
    rms = Math.sqrt(rms / dataArray.length);

    // 볼륨 게이지 시각화
    pitchBar.style.width = Math.min(100, rms * 800) + "%";

    // 물리 시스템 적용
    if (isGravityActive) {
        if (rms > VOLUME_THRESHOLD) {
            velocityY += ASCENT_SPEED; // 소리가 나면 추진력 발생
            charEl.classList.remove('run'); 
        } else {
            velocityY -= GRAVITY; // 무음이면 중력 적용
        }

        // 속도 제한
        if (velocityY > MAX_VELOCITY) velocityY = MAX_VELOCITY;
        if (velocityY < -MAX_VELOCITY) velocityY = -MAX_VELOCITY;

        charY += velocityY;

        // 바닥(바다) 즉사 판정
        const seaLevel = 80; 
        if (charY <= seaLevel) {
            charY = seaLevel;
            gameOver("바다에 빠졌습니다! 🌊");
        }
    } else {
        // 첫 2초간은 그 자리에서 걷기만 함 (공중부양)
        charEl.classList.add('run');
    }

    // 천장 제한
    const maxHeight = window.innerHeight - 150;
    if (charY >= maxHeight) {
        charY = maxHeight;
        velocityY = 0;
    }

    charEl.style.bottom = charY + "px";
    
    if(isGravityActive) score += 0.15;
    document.getElementById('jelly-count').innerText = Math.floor(score);

    requestAnimationFrame(gameLoop);
}

// 장애물 생성
function spawnObstacles() {
    if (!isPlaying) return;
    if (!isGravityActive) { 
        setTimeout(spawnObstacles, 500);
        return;
    }
    
    const obs = document.createElement('div');
    obs.style.position = "absolute";
    obs.style.right = "-60px";
    obs.style.bottom = (150 + Math.random() * (window.innerHeight - 350)) + "px";
    obs.style.fontSize = "50px";
    obs.innerText = "🦅"; 
    document.getElementById('game-container').appendChild(obs);

    const moveObs = setInterval(() => {
        if (!isPlaying) { clearInterval(moveObs); return; }
        let right = parseFloat(obs.style.right || -60);
        right += gameSpeed;
        obs.style.right = right + "px";

        const cRect = charEl.getBoundingClientRect();
        const oRect = obs.getBoundingClientRect();
        if (cRect.left < oRect.right - 15 && cRect.right > oRect.left + 15 &&
            cRect.bottom > oRect.top + 15 && cRect.top < oRect.bottom - 15) {
            gameOver("독수리와 충돌했습니다! 💥");
        }
        if (right > window.innerWidth + 100) { obs.remove(); clearInterval(moveObs); }
    }, 20);

    setTimeout(spawnObstacles, 1800 + Math.random() * 2000);
}

function gameOver(reason) {
    isPlaying = false;
    document.getElementById('game-over').classList.remove('hidden');
    document.getElementById('death-reason').innerText = reason;
    document.getElementById('final-score').innerText = Math.floor(score);
}