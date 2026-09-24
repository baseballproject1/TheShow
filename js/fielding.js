```javascript
/* =========================================================
   RTTS - Fielding System
   js/fielding.js
   완성본 / 별도 수정 필요 없음
   ========================================================= */

(() => {
    "use strict";

    const FIELDING_KEY = "rtts_fielding_state";

    const DEFAULT_FIELDING = {
        active: false,
        playerX: 50,
        playerY: 78,
        ballX: 50,
        ballY: 30,
        ballVX: 0,
        ballVY: 0,
        ballInAir: false,
        hasBall: false,
        catchWindow: false,
        catchProgress: 0,
        aimX: 50,
        aimY: 50,
        targetBase: "home",
        throwing: false,
        lastResult: "",
        lastError: false,
        lastPlayTime: 0
    };

    let state = { ...DEFAULT_FIELDING };
    let player = null;

    let fieldCanvas = null;
    let fieldPlayer = null;
    let ballElement = null;
    let throwAim = null;
    let throwTarget = null;
    let fieldingJoystick = null;

    let animationId = null;
    let lastFrame = 0;
    let catchHoldStart = 0;
    let lastTouchThrowAt = 0;

    const FIELD_WIDTH = 100;
    const FIELD_HEIGHT = 100;

    /* ---------------------------------------------------------
       기본 유틸
       --------------------------------------------------------- */

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function random(min, max) {
        return Math.random() * (max - min) + min;
    }

    function distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function getPlayer() {
        if (window.RTTS?.player?.get) {
            return window.RTTS.player.get();
        }

        if (window.getCurrentPlayer) {
            return window.getCurrentPlayer();
        }

        try {
            return JSON.parse(localStorage.getItem("rtts_current_player"));
        } catch {
            return null;
        }
    }

    function getDefense() {
        const p = getPlayer();

        if (!p) {
            return 0;
        }

        if (window.RTTS?.player?.getEffectiveStat) {
            return Number(
                window.RTTS.player.getEffectiveStat("defense")
            ) || 0;
        }

        return Number(p.stats?.defense) || 0;
    }

    function saveState() {
        try {
            localStorage.setItem(
                FIELDING_KEY,
                JSON.stringify(state)
            );
        } catch {
            // 저장 실패는 게임 진행을 막지 않음
        }
    }

    function loadState() {
        try {
            const saved = localStorage.getItem(FIELDING_KEY);

            if (!saved) {
                state = { ...DEFAULT_FIELDING };
                return;
            }

            state = {
                ...DEFAULT_FIELDING,
                ...JSON.parse(saved)
            };
        } catch {
            state = { ...DEFAULT_FIELDING };
        }
    }

    function showMessage(message, type = "") {
        if (window.showToast) {
            window.showToast(message, type);
            return;
        }

        const toast = document.getElementById("toast");

        if (toast) {
            toast.textContent = message;
            toast.classList.remove("hidden");

            clearTimeout(showMessage.timer);

            showMessage.timer = setTimeout(() => {
                toast.classList.add("hidden");
            }, 1400);
        }
    }

    /* ---------------------------------------------------------
       DOM
       --------------------------------------------------------- */

    function cacheElements() {
        fieldCanvas = document.getElementById("fieldCanvas");
        fieldPlayer = document.getElementById("fieldPlayer");
        ballElement = document.getElementById("ball");
        throwAim = document.getElementById("throwAim");
        throwTarget = document.querySelector(".throw-target");
        fieldingJoystick = document.getElementById("fieldingJoystick");
    }

    /* ---------------------------------------------------------
       필드 플레이어 위치
       --------------------------------------------------------- */

    function updatePlayerPosition() {
        if (!fieldPlayer) {
            return;
        }

        fieldPlayer.style.left = `${state.playerX}%`;
        fieldPlayer.style.top = `${state.playerY}%`;
    }

    function updateBallPosition() {
        if (!ballElement) {
            return;
        }

        ballElement.style.left = `${state.ballX}%`;
        ballElement.style.top = `${state.ballY}%`;

        if (state.ballInAir) {
            ballElement.classList.add("ball-flying");
        } else {
            ballElement.classList.remove("ball-flying");
        }
    }

    /* ---------------------------------------------------------
       송구 조준
       --------------------------------------------------------- */

    function updateThrowAim() {
        if (!throwAim) {
            return;
        }

        throwAim.style.left = `${state.aimX}%`;
        throwAim.style.top = `${state.aimY}%`;

        if (throwTarget) {
            throwTarget.style.left = `${state.aimX}%`;
            throwTarget.style.top = `${state.aimY}%`;
        }
    }

    function moveAim(dx, dy) {
        state.aimX = clamp(
            state.aimX + dx,
            5,
            95
        );

        state.aimY = clamp(
            state.aimY + dy,
            5,
            95
        );

        updateThrowAim();
        saveState();
    }

    function aimAtBase(base) {
        const targets = {
            "1": { x: 70, y: 67 },
            "2": { x: 50, y: 51 },
            "3": { x: 30, y: 67 },
            "home": { x: 50, y: 86 }
        };

        const target = targets[base];

        if (!target) {
            return;
        }

        state.targetBase = base;
        state.aimX = target.x;
        state.aimY = target.y;

        updateThrowAim();
        saveState();
    }

    /* ---------------------------------------------------------
       수비 능력치 계산
       --------------------------------------------------------- */

    function getMovementSpeed() {
        const defense = getDefense();

        // 수비 0에서도 움직일 수 있도록 기본 속도 제공
        return 16 + defense * 0.075;
    }

    function getCatchRadius() {
        const defense = getDefense();

        return clamp(
            4.5 + defense * 0.025,
            4.5,
            10
        );
    }

    function getThrowAccuracy() {
        const defense = getDefense();

        return clamp(
            0.68 + defense * 0.0025,
            0.68,
            0.98
        );
    }

    function getThrowPower() {
        const defense = getDefense();

        return 0.85 + defense * 0.003;
    }

    /* ---------------------------------------------------------
       직접 수비 이동
       --------------------------------------------------------- */

    function moveFielder(dx, dy, deltaSeconds = 1 / 60) {
        if (!state.active) {
            return;
        }

        const speed = getMovementSpeed();

        state.playerX += dx * speed * deltaSeconds;
        state.playerY += dy * speed * deltaSeconds;

        state.playerX = clamp(state.playerX, 5, 95);
        state.playerY = clamp(state.playerY, 8, 94);

        updatePlayerPosition();

        checkCatchRange();

        saveState();
    }

    function getJoystickDirection() {
        if (!fieldingJoystick) {
            return { x: 0, y: 0 };
        }

        const knob = fieldingJoystick.querySelector(".joystick-knob");

        if (!knob) {
            return { x: 0, y: 0 };
        }

        const rect = fieldingJoystick.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const knobRect = knob.getBoundingClientRect();

        const knobX = knobRect.left + knobRect.width / 2;
        const knobY = knobRect.top + knobRect.height / 2;

        const maxDistance = Math.max(
            1,
            Math.min(rect.width, rect.height) * 0.35
        );

        return {
            x: clamp(
                (knobX - centerX) / maxDistance,
                -1,
                1
            ),
            y: clamp(
                (knobY - centerY) / maxDistance,
                -1,
                1
            )
        };
    }

    /* ---------------------------------------------------------
       공 추적
       --------------------------------------------------------- */

    function updateBall(deltaSeconds) {
        if (!state.active || !state.ballInAir) {
            return;
        }

        state.ballX += state.ballVX * deltaSeconds;
        state.ballY += state.ballVY * deltaSeconds;

        // 약한 중력 효과
        state.ballVY += 3.2 * deltaSeconds;

        state.ballX = clamp(state.ballX, 2, 98);
        state.ballY = clamp(state.ballY, 4, 96);

        checkCatchRange();

        updateBallPosition();
    }

    function checkCatchRange() {
        if (!state.active || !state.ballInAir) {
            return;
        }

        const d = distance(
            state.playerX,
            state.playerY,
            state.ballX,
            state.ballY
        );

        const radius = getCatchRadius();

        if (d <= radius) {
            state.catchWindow = true;

            if (!catchHoldStart) {
                catchHoldStart = performance.now();
            }

            state.catchProgress = clamp(
                (radius - d) / radius,
                0,
                1
            );

            tryCatch();
        } else {
            state.catchWindow = false;
            state.catchProgress = 0;
            catchHoldStart = 0;
        }
    }

    /* ---------------------------------------------------------
       캐치
       --------------------------------------------------------- */

    function tryCatch() {
        if (!state.active) {
            return false;
        }

        if (!state.ballInAir) {
            return false;
        }

        if (!state.catchWindow) {
            return false;
        }

        const now = performance.now();

        // 너무 자주 판정되지 않도록 간격 제한
        if (
            state.lastPlayTime &&
            now - state.lastPlayTime < 180
        ) {
            return false;
        }

        const defense = getDefense();

        // 수비력이 높을수록 캐치 성공률 증가
        const successChance = clamp(
            0.78 + defense * 0.002,
            0.78,
            0.995
        );

        if (Math.random() <= successChance) {
            catchBall();
            return true;
        }

        // 실패하면 공을 놓치고 계속 진행
        state.lastResult = "catch-error";
        state.lastError = true;
        state.lastPlayTime = now;

        showMessage("수비 실수!");

        return false;
    }

    function catchBall() {
        state.hasBall = true;
        state.ballInAir = false;
        state.catchWindow = false;
        state.catchProgress = 1;
        state.ballVX = 0;
        state.ballVY = 0;
        state.ballX = state.playerX;
        state.ballY = state.playerY;
        state.lastResult = "catch";
        state.lastError = false;
        state.lastPlayTime = performance.now();

        catchHoldStart = 0;

        updateBallPosition();
        updatePlayerPosition();

        showMessage("캐치!");

        saveState();

        // 게임 엔진과 연결
        if (window.RTTS?.game?.state) {
            window.RTTS.game.state.fielding.hasBall = true;
        }

        return true;
    }

    /* ---------------------------------------------------------
       송구
       --------------------------------------------------------- */

    function calculateThrowError() {
        const accuracy = getThrowAccuracy();

        // 정확도가 높을수록 오차가 작아짐
        const maxError = 13 * (1 - accuracy);

        return {
            x: random(-maxError, maxError),
            y: random(-maxError, maxError)
        };
    }

    function throwBall(targetBase = null) {
        if (!state.active) {
            return false;
        }

        if (!state.hasBall) {
            showMessage("공을 잡은 뒤 송구하세요.");
            return false;
        }

        if (state.throwing) {
            return false;
        }

        if (targetBase) {
            aimAtBase(targetBase);
        }

        state.throwing = true;
        state.hasBall = false;

        const error = calculateThrowError();

        const targetX = clamp(
            state.aimX + error.x,
            5,
            95
        );

        const targetY = clamp(
            state.aimY + error.y,
            5,
            95
        );

        const power = getThrowPower();

        const dx = targetX - state.playerX;
        const dy = targetY - state.playerY;

        const distanceToTarget = Math.max(
            1,
            Math.sqrt(dx * dx + dy * dy)
        );

        const throwSpeed = 42 * power;

        state.ballX = state.playerX;
        state.ballY = state.playerY;
        state.ballVX = (dx / distanceToTarget) * throwSpeed;
        state.ballVY = (dy / distanceToTarget) * throwSpeed;
        state.ballInAir = true;

        state.lastError =
            Math.abs(error.x) > 5 ||
            Math.abs(error.y) > 5;

        state.lastResult = state.lastError
            ? "bad-throw"
            : "good-throw";

        if (state.lastError) {
            showMessage("송구가 빗나갔습니다.");
        } else {
            showMessage("정확한 송구!");
        }

        // 일정 시간 뒤 목표 지점에 도착했다고 처리
        const travelTime =
            clamp(
                distanceToTarget / throwSpeed,
                0.18,
                1.1
            ) * 1000;

        setTimeout(() => {
            if (!state.ballInAir) {
                return;
            }

            state.ballX = targetX;
            state.ballY = targetY;
            state.ballVX = 0;
            state.ballVY = 0;
            state.ballInAir = false;
            state.throwing = false;

            updateBallPosition();
            saveState();

            resolveThrow(targetX, targetY);
        }, travelTime);

        saveState();

        return true;
    }

    function resolveThrow(x, y) {
        state.throwing = false;

        const targetDistance = distance(
            x,
            y,
            state.aimX,
            state.aimY
        );

        if (targetDistance > 6) {
            state.lastResult = "throw-error";
            state.lastError = true;
        } else {
            state.lastResult = "throw-success";
            state.lastError = false;
        }

        saveState();

        /*
         * 향후 baserunning.js에서
         * 실제 주자/아웃 판정을 이어받을 수 있도록 이벤트 전달
         */
        window.dispatchEvent(
            new CustomEvent("rtts:throw-complete", {
                detail: {
                    targetBase: state.targetBase,
                    accurate: !state.lastError,
                    x,
                    y
                }
            })
        );
    }

    /* ---------------------------------------------------------
       수비 플레이 시작
       --------------------------------------------------------- */

    function startFielding(options = {}) {
        state.active = true;
        state.playerX = options.playerX ?? 50;
        state.playerY = options.playerY ?? 78;

        state.ballX = options.ballX ?? 50;
        state.ballY = options.ballY ?? 30;

        state.ballVX = options.ballVX ?? 0;
        state.ballVY = options.ballVY ?? 0;

        state.ballInAir =
            options.ballInAir !== undefined
                ? options.ballInAir
                : true;

        state.hasBall = false;
        state.catchWindow = false;
        state.catchProgress = 0;
        state.aimX = 50;
        state.aimY = 50;
        state.targetBase = "home";
        state.throwing = false;
        state.lastResult = "";
        state.lastError = false;

        updatePlayerPosition();
        updateBallPosition();
        updateThrowAim();

        startLoop();

        saveState();

        return { ...state };
    }

    function stopFielding() {
        state.active = false;
        state.throwing = false;
        state.catchWindow = false;

        stopLoop();

        saveState();
    }

    /* ---------------------------------------------------------
       애니메이션 루프
       --------------------------------------------------------- */

    function gameLoop(timestamp) {
        if (!state.active) {
            animationId = null;
            return;
        }

        if (!lastFrame) {
            lastFrame = timestamp;
        }

        const deltaSeconds = clamp(
            (timestamp - lastFrame) / 1000,
            0,
            0.05
        );

        lastFrame = timestamp;

        const direction = getJoystickDirection();

        if (
            Math.abs(direction.x) > 0.02 ||
            Math.abs(direction.y) > 0.02
        ) {
            moveFielder(
                direction.x,
                direction.y,
                deltaSeconds
            );
        }

        updateBall(deltaSeconds);

        animationId = requestAnimationFrame(gameLoop);
    }

    function startLoop() {
        if (animationId) {
            return;
        }

        lastFrame = 0;
        animationId = requestAnimationFrame(gameLoop);
    }

    function stopLoop() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }

        lastFrame = 0;
    }

    /* ---------------------------------------------------------
       키보드 조작
       --------------------------------------------------------- */

    function handleKeyboard(event) {
        if (!state.active) {
            return;
        }

        const key = event.key.toLowerCase();

        let handled = true;

        switch (key) {
            case "w":
            case "arrowup":
                moveFielder(0, -1);
                break;

            case "s":
            case "arrowdown":
                moveFielder(0, 1);
                break;

            case "a":
            case "arrowleft":
                moveFielder(-1, 0);
                break;

            case "d":
            case "arrowright":
                moveFielder(1, 0);
                break;

            case "i":
                moveAim(0, -3);
                break;

            case "k":
                moveAim(0, 3);
                break;

            case "j":
                moveAim(-3, 0);
                break;

            case "l":
                moveAim(3, 0);
                break;

            case "1":
                aimAtBase("1");
                break;

            case "2":
                aimAtBase("2");
                break;

            case "3":
                aimAtBase("3");
                break;

            case "4":
            case "h":
                aimAtBase("home");
                break;

            case " ":
            case "enter":
                if (state.hasBall) {
                    throwBall();
                } else if (state.catchWindow) {
                    tryCatch();
                }
                break;

            default:
                handled = false;
        }

        if (handled) {
            event.preventDefault();
        }
    }

    /* ---------------------------------------------------------
       송구 버튼 중복 방지
       --------------------------------------------------------- */

    function bindThrowButton() {
        const button = document.getElementById("throwButton");

        if (!button) {
            return;
        }

        /*
         * game.js에 이미 throwButton 이벤트가 존재하기 때문에
         * capture 단계에서 이 파일의 수비 시스템이 먼저 처리한다.
         */
        const handleTouchStart = event => {
            if (!state.active) {
                return;
            }

            event.preventDefault();
            event.stopImmediatePropagation();

            lastTouchThrowAt = Date.now();

            if (state.hasBall) {
                throwBall();
            } else if (state.catchWindow) {
                tryCatch();
            }
        };

        const handleClick = event => {
            if (!state.active) {
                return;
            }

            event.preventDefault();
            event.stopImmediatePropagation();

            // 모바일 touchstart 이후 발생하는 click 중복 방지
            if (Date.now() - lastTouchThrowAt < 500) {
                return;
            }

            if (state.hasBall) {
                throwBall();
            } else if (state.catchWindow) {
                tryCatch();
            }
        };

        button.addEventListener(
            "touchstart",
            handleTouchStart,
            {
                passive: false,
                capture: true
            }
        );

        button.addEventListener(
            "click",
            handleClick,
            {
                capture: true
            }
        );
    }

    /* ---------------------------------------------------------
       베이스 버튼
       --------------------------------------------------------- */

    function bindBaseButtons() {
        const buttons = document.querySelectorAll(
            "[data-base]"
        );

        buttons.forEach(button => {
            button.addEventListener("click", event => {
                if (!state.active) {
                    return;
                }

                const base =
                    event.currentTarget.dataset.base;

                aimAtBase(base);

                if (state.hasBall) {
                    throwBall(base);
                }
            });
        });
    }

    /* ---------------------------------------------------------
       초기화
       --------------------------------------------------------- */

    function init() {
        cacheElements();
        loadState();

        updatePlayerPosition();
        updateBallPosition();
        updateThrowAim();

        bindThrowButton();
        bindBaseButtons();

        document.addEventListener(
            "keydown",
            handleKeyboard
        );

        window.addEventListener(
            "rtts:game-start",
            () => {
                if (
                    window.RTTS?.game?.state?.fielding
                ) {
                    const gameFielding =
                        window.RTTS.game.state.fielding;

                    state.playerX =
                        gameFielding.playerX ?? 50;

                    state.playerY =
                        gameFielding.playerY ?? 78;

                    state.aimX =
                        gameFielding.aimX ?? 50;

                    state.aimY =
                        gameFielding.aimY ?? 50;

                    updatePlayerPosition();
                    updateThrowAim();
                }
            }
        );

        /*
         * 다른 시스템에서
         * "타구가 발생했다"는 이벤트를 보내면
         * 바로 수비 모드로 전환할 수 있다.
         */
        window.addEventListener(
            "rtts:ball-in-play",
            event => {
                const detail = event.detail || {};

                startFielding({
                    ballX: detail.ballX ?? 50,
                    ballY: detail.ballY ?? 30,
                    ballVX: detail.ballVX ?? 0,
                    ballVY: detail.ballVY ?? 0,
                    playerX: detail.playerX ?? 50,
                    playerY: detail.playerY ?? 78,
                    ballInAir: true
                });
            }
        );

        window.RTTS = window.RTTS || {};

        window.RTTS.fielding = {
            state,

            init,

            start: startFielding,
            stop: stopFielding,

            move: moveFielder,
            moveAim,

            aimAtBase,

            catchBall,
            tryCatch,

            throwBall,

            getDefense,
            getMovementSpeed,
            getCatchRadius,
            getThrowAccuracy,
            getThrowPower,

            getState: () => ({ ...state }),

            setBall(options = {}) {
                state.ballX =
                    options.x ?? state.ballX;

                state.ballY =
                    options.y ?? state.ballY;

                state.ballVX =
                    options.vx ?? state.ballVX;

                state.ballVY =
                    options.vy ?? state.ballVY;

                state.ballInAir =
                    options.inAir ?? true;

                updateBallPosition();
                saveState();
            }
        };

        // 기존 게임 엔진에서 사용할 수 있도록 연결
        window.rttsThrow = throwBall;

        window.startRTTSFielding = startFielding;
        window.stopRTTSFielding = stopFielding;

        // DOM이 이미 로드된 상태에서 파일이 실행될 경우
        if (
            document.body &&
            !state.active
        ) {
            updatePlayerPosition();
            updateBallPosition();
            updateThrowAim();
        }
    }

    /* ---------------------------------------------------------
       실행
       --------------------------------------------------------- */

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            init,
            { once: true }
        );
    } else {
        init();
    }

})();
```
