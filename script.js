let hp = 100;
let score = 0;
let gameSpeed = 4;
let isPlaying = false;
let charY = 0;

// 목소리 분석 및 캐릭터 높낮이 조절
function analyzeVoice() {
    analyser.getFloatTimeDomainData(dataArray);
    let pitchData = autoCorrelate(dataArray, audioCtx.sampleRate);
    
    if (pitchData.freq > 0 && pitchData.confidence > 0.8) {
        let octave = Math.log2(pitchData.freq / 261.63); // 도(C4) 기준
        // 옥타브에 따라 고도 조절 (높은 소리 = 위로 뜸)
        let targetY = (octave + 1) * 150; 
        charY += (targetY - charY) * 0.1; // 부드러운 이동
    } else {
        charY *= 0.95; // 소리 없으면 서서히 바닥으로
    }
    
    // 바닥/천장 제한
    charY = Math.max(0, Math.min(window.innerHeight - 150, charY));
    document.getElementById('character').style.bottom = (80 + charY) + 'px';
}

// 쿠키런처럼 젤리 물결 생성
function spawnItems() {
    if(!isPlaying) return;
    const type = Math.random() > 0.8 ? 'obstacle' : 'jelly';
    const el = document.createElement('div');
    el.className = type;
    el.style.right = '-50px';
    
    // 젤리는 물결 모양(sin함수) 혹은 랜덤 높이
    if(type === 'jelly') {
        el.style.bottom = (150 + Math.sin(Date.now()/500) * 100) + 'px';
        el.innerText = "🍬";
    } else {
        el.style.bottom = "50px"; // 장애물은 바닥
        el.innerText = "🌵";
    }
    
    document.getElementById('game-container').appendChild(el);
    setTimeout(spawnItems, 1000 / (gameSpeed/4));
}