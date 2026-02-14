let audioCtx, analyser, dataArray;
let isPlaying = false;
let score = 0;
let gameSpeed = 2.5;
let charY = window.innerHeight / 2 - 100; // 화면 중앙 시작
let velocityY = 0;
let isBridgeSafe = true; // 유예 기간 상태

// --- [물리 및 볼륨 설정] ---
const GRAVITY = 0.18;
const ASCENT_SPEED = 0.45;
const MAX_VELOCITY = 5.5;
const VOLUME_THRESHOLD = 0.015;
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

        // [2초 로직] 2초 후에 흙길이 왼쪽으로 빠르게 사라집니다.
        setTimeout(() => {
            isBridgeSafe = false;
            if(bridgeEl) bridgeEl.style.transform = "translateX(-120%)";
        }, 2000);

        gameLoop();
        spawnObstacles();
    } catch (err) {
        alert("마이크 접근 권한이 필요합니다!");
    }
});

function gameLoop() {
    if (!isPlaying) return;
    
    // 볼륨 분석
    analyser.getFloatTimeDomainData(dataArray);
    let rms = 0;
    for (let i = 0; i < dataArray.length; i++) rms += dataArray[i] * dataArray[i];
    rms = Math.sqrt(rms / dataArray.length);

    // 볼륨 UI 업데이트
    pitchBar.style.width = Math.min(100, rms * 600) + "%";

    // 물리 법칙 적용
    if (rms > VOLUME_THRESHOLD) {
        velocityY += ASCENT_SPEED;
        charEl.classList.remove('run'); // 공중에서는 걷기 멈춤
    } else {
        velocityY -= GRAVITY;
    }

    // 속도 제한
    if (velocityY > MAX_VELOCITY) velocityY = MAX_VELOCITY;
    charY += velocityY;

    // 바닥/바다 판정 로직
    const seaLevel = 80; // 바다 수면 높이
    if (charY <= seaLevel) {
        if (isBridgeSafe) {
            // 2초 전에는 흙길이 캐릭터를 지탱
            charY = seaLevel;
            velocityY = 0;
            charEl.classList.add('run');
        } else {
            // 2초 후에는 바다에 풍덩! 게임 오버
            charY = seaLevel; // 수면에 고정
            gameOver("바다에 빠졌습니다! 🌊");
        }
    }

    // 천장 제한
    const maxHeight = window.innerHeight - 150;
    if (charY >= maxHeight) {
        charY = maxHeight;
        velocityY = 0;
    }

    charEl.style.bottom = charY + "px";
    
    // 점수(거리) 증가
    score += 0.15;
    document.getElementById('jelly-count').innerText = Math.floor(score);

    requestAnimationFrame(gameLoop);
}

// 장애물 생성 (독수리 등)
function spawnObstacles() {
    if (!isPlaying) return;
    
    const obs = document.createElement('div');
    obs.className = 'obstacle-unit'; // CSS 제어를 위해 클래스 추가 가능
    obs.style.position = "absolute";
    obs.style.right = "-60px";
    obs.style.bottom = (150 + Math.random() * (window.innerHeight - 350)) + "px";
    obs.style.fontSize = "50px";
    obs.style.zIndex = "95";
    obs.innerText = "🦅"; 
    document.getElementById('game-container').appendChild(obs);

    const moveObs = setInterval(() => {
        if (!isPlaying) { clearInterval(moveObs); return; }
        let right = parseFloat(obs.style.right);
        right += gameSpeed;
        obs.style.right = right + "px";

        // 충돌 감지
        const cRect = charEl.getBoundingClientRect();
        const oRect = obs.getBoundingClientRect();
        if (cRect.left < oRect.right - 15 && cRect.right > oRect.left + 15 &&
            cRect.bottom > oRect.top + 15 && cRect.top < oRect.bottom - 15) {
            gameOver("독수리와 충돌했습니다! 💥");
        }

        if (right > window.innerWidth + 100) {
            obs.remove();
            clearInterval(moveObs);
        }
    }, 20);

    // 생성 간격도 약간 줄여 더 다이나믹하게 조정
    setTimeout(spawnObstacles, 1500 + Math.random() * 2000);
}

function gameOver(reason) {
    isPlaying = false;
    const goScreen = document.getElementById('game-over');
    goScreen.classList.remove('hidden');
    document.getElementById('death-reason').innerText = reason;
    document.getElementById('final-score').innerText = Math.floor(score);
}