let audioCtx, analyser, dataArray, gainNode;
let isPlaying = false;
let score = 0;
let charY = window.innerHeight / 2 - 100;
let velocityY = 0;
let isGravityActive = false;

// 게임 설정
let userSensitivity = 1.5;
const GRAVITY = 0.18;
const ASCENT_SPEED = 0.45;
const MAX_VELOCITY = 5.5;

const charEl = document.getElementById('character');
const bridgeEl = document.getElementById('start-bridge');
const volBar = document.getElementById('vol-bar');
const scoreVal = document.getElementById('distance-val');
const sensSlider = document.getElementById('sens-slider');
const sensDisplay = document.getElementById('sens-display');

// 감도 조절 이벤트
sensSlider.addEventListener('input', (e) => {
    userSensitivity = parseFloat(e.target.value);
    sensDisplay.innerText = userSensitivity.toFixed(1);
});

document.getElementById('start-btn').addEventListener('click', startExperience);

async function startExperience() {
    try {
        // 
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } 
        });
        
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        
        // 마이크 신호 증폭 노드 (Gain Node)
        gainNode = audioCtx.createGain();
        gainNode.gain.value = 2.0; // 기본 2배 증폭
        
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        
        source.connect(gainNode);
        gainNode.connect(analyser);
        
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        document.getElementById('overlay').classList.add('hidden');
        isPlaying = true;

        // 2초 유예 로직
        setTimeout(() => {
            isGravityActive = true;
            if(bridgeEl) bridgeEl.style.transform = "translateX(-120%)";
        }, 2000);

        gameLoop();
        spawnObstacles();
    } catch (err) {
        alert("마이크를 찾을 수 없거나 권한이 거부되었습니다. 주소창의 자물쇠 아이콘을 확인해주세요!");
    }
}

function gameLoop() {
    if (!isPlaying) return;

    // 실시간 볼륨 분석
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        let v = (dataArray[i] - 128) / 128;
        sum += v * v;
    }
    let rms = Math.sqrt(sum / dataArray.length);

    // 사용자의 감도 설정 적용
    let adjustedVol = rms * userSensitivity;
    volBar.style.width = Math.min(100, adjustedVol * 800) + "%";

    if (isGravityActive) {
        // 소리가 나면 상승, 아니면 하강
        if (adjustedVol > 0.01) {
            velocityY += ASCENT_SPEED;
            charEl.classList.remove('walk-anim');
        } else {
            velocityY -= GRAVITY;
        }

        // 속도 제한
        if (velocityY > MAX_VELOCITY) velocityY = MAX_VELOCITY;
        if (velocityY < -MAX_VELOCITY) velocityY = -MAX_VELOCITY;

        charY += velocityY;

        // 사망 판정 (바다 수면 높이 약 100px)
        if (charY <= 100) {
            charY = 100;
            gameOver("바다에 빠졌습니다! 🌊");
        }
    }

    // 천장 제한
    const maxHeight = window.innerHeight - 100;
    if (charY >= maxHeight) {
        charY = maxHeight;
        velocityY = 0;
    }

    charEl.style.bottom = charY + "px";
    
    if(isGravityActive) {
        score += 0.2;
        scoreVal.innerText = Math.floor(score);
    }

    requestAnimationFrame(gameLoop);
}

function spawnObstacles() {
    if (!isPlaying || !isGravityActive) {
        setTimeout(spawnObstacles, 1000);
        return;
    }

    const obs = document.createElement('div');
    obs.style.cssText = `position:absolute; right:-100px; bottom:${150 + Math.random() * (window.innerHeight - 300)}px; font-size:50px; z-index:600;`;
    obs.innerText = Math.random() > 0.5 ? "🦅" : "🛸";
    document.getElementById('game-container').appendChild(obs);

    let pos = -100;
    const moveInterval = setInterval(() => {
        if(!isPlaying) { clearInterval(moveInterval); return; }
        pos += (gameSpeed = 4 + score/500); // 갈수록 조금씩 빨라짐
        obs.style.right = pos + "px";

        const c = charEl.getBoundingClientRect();
        const o = obs.getBoundingClientRect();
        
        // 히트박스 판정
        if (c.left < o.right - 20 && c.right > o.left + 20 && 
            c.bottom > o.top + 20 && c.top < o.bottom - 20) {
            gameOver("장애물과 충돌했습니다! 💥");
        }

        if (pos > window.innerWidth + 100) {
            obs.remove();
            clearInterval(moveInterval);
        }
    }, 20);

    setTimeout(spawnObstacles, 1500 + Math.random() * 2000);
}

function gameOver(reason) {
    isPlaying = false;
    const goModal = document.getElementById('game-over');
    goModal.classList.remove('hidden');
    document.getElementById('death-reason').innerText = reason;
    document.getElementById('final-score-val').innerText = Math.floor(score);
}