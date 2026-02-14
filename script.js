let audioCtx, analyser, dataArray, gainNode;
let isPlaying = false;
let score = 0;
let charY = window.innerHeight / 2 - 100;
let velocityY = 0;
let isGravityActive = false;
let lives = 3; // 생명력

// [기가 막힌 설정값]
const SENSITIVITY = 0.8;      // 감도 고정
const GRAVITY = 0.17;         // 체공 시간을 위한 낮은 중력
const ASCENT_SPEED = 0.42;    // 부드러운 상승력
const MAX_VELOCITY = 5.0;     // 안정성 확보
const VOLUME_LIMIT = 0.01;    // 인식 문턱값

const charEl = document.getElementById('character');
const bridgeEl = document.getElementById('start-bridge');
const volBar = document.getElementById('vol-bar');
const scoreVal = document.getElementById('distance-val');
const livesContainer = document.getElementById('lives-container');

document.getElementById('start-btn').addEventListener('click', initGame);

async function initGame() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } 
        });
        
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        
        // 입력 신호 부스팅
        gainNode = audioCtx.createGain();
        gainNode.gain.value = 2.5; 
        
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        
        source.connect(gainNode);
        gainNode.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        document.getElementById('overlay').classList.add('hidden');
        isPlaying = true;

        // 2초 유예 기간: 공중부양 및 대기
        setTimeout(() => {
            isGravityActive = true;
            if(bridgeEl) bridgeEl.style.transform = "translateX(-120%)";
        }, 2000);

        gameLoop();
        spawnObstacles();
    } catch (err) {
        alert("마이크를 연결하거나 권한을 허용해주세요!");
    }
}

function gameLoop() {
    if (!isPlaying) return;

    // 볼륨 분석
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        let v = (dataArray[i] - 128) / 128;
        sum += v * v;
    }
    let rms = Math.sqrt(sum / dataArray.length);

    // 고정 감도 보정 적용
    let adjustedVol = rms * SENSITIVITY;
    volBar.style.width = Math.min(100, adjustedVol * 1000) + "%";

    if (isGravityActive) {
        if (adjustedVol > VOLUME_LIMIT) {
            velocityY += ASCENT_SPEED;
            charEl.classList.remove('walk-anim');
        } else {
            velocityY -= GRAVITY;
        }

        if (velocityY > MAX_VELOCITY) velocityY = MAX_VELOCITY;
        charY += velocityY;

        // [즉사 판정] 바다에 빠지면 생명력 상관없이 게임오버
        if (charY <= 90) {
            gameOver("바다에 빠졌습니다! 🌊");
        }
    }

    // 천장 제한
    if (charY >= window.innerHeight - 120) {
        charY = window.innerHeight - 120;
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
    obs.style.cssText = `position:absolute; right:-100px; bottom:${150 + Math.random() * (window.innerHeight - 350)}px; font-size:50px; z-index:600;`;
    obs.innerText = Math.random() > 0.5 ? "🦅" : "🛸";
    document.getElementById('game-container').appendChild(obs);

    let pos = -100;
    const moveInterval = setInterval(() => {
        if(!isPlaying) { clearInterval(moveInterval); return; }
        pos += (4 + score/600); 
        obs.style.right = pos + "px";

        const c = charEl.getBoundingClientRect();
        const o = obs.getBoundingClientRect();
        
        // 장애물 충돌 판정 (생명력 차감)
        if (c.left < o.right - 25 && c.right > o.left + 25 && 
            c.bottom > o.top + 25 && c.top < o.bottom - 25) {
            takeDamage();
            obs.remove();
            clearInterval(moveInterval);
        }

        if (pos > window.innerWidth + 100) {
            obs.remove();
            clearInterval(moveInterval);
        }
    }, 20);

    setTimeout(spawnObstacles, 1800 + Math.random() * 1500);
}

function takeDamage() {
    lives--;
    updateLivesUI();
    
    // 시각적 피드백
    charEl.classList.add('hit-flash');
    setTimeout(() => charEl.classList.remove('hit-flash'), 400);

    if (lives <= 0) {
        gameOver("체력을 모두 소진했습니다! 💥");
    }
}

function updateLivesUI() {
    let hearts = "";
    for(let i=0; i<3; i++) {
        hearts += (i < lives) ? "❤️ " : "🖤 ";
    }
    livesContainer.innerText = hearts;
}

function gameOver(reason) {
    isPlaying = false;
    const goModal = document.getElementById('game-over');
    goModal.classList.remove('hidden');
    document.getElementById('death-reason').innerText = reason;
    document.getElementById('final-score-val').innerText = Math.floor(score);
}