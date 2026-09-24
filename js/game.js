```javascript
/* =========================================================
   RTTS Baseball Game
   js/game.js
   경기 핵심 엔진
   ---------------------------------------------------------
   역할
   - 경기 화면 초기화
   - 경기 상태 관리
   - 타격 / 투구 / 수비 / 주루 기본 엔진
   - 가상 조이스틱
   - 경기 진행
   - 이닝 / 아웃 / 볼 / 스트라이크
   - 선수 스탯 연동
   - 미래 batting.js / pitching.js / fielding.js /
     baserunning.js와 연결할 수 있는 Hook 제공

   외부 라이브러리 없음
   ========================================================= */

(function () {
    "use strict";

    const RTTS = window.RTTS || (window.RTTS = {});

    const GAME_KEY = "rtts_game_state";

    /* =========================================================
       기본 상수
       ========================================================= */

    const GAME_MODE = {
        BATTING: "batting",
        PITCHING: "pitching",
        FIELDING: "fielding",
        BASERUNNING: "baserunning"
    };

    const GAME_RESULT = {
        OUT: "out",
        STRIKE: "strike",
        BALL: "ball",
        FOUL: "foul",
        SINGLE: "single",
        DOUBLE: "double",
        TRIPLE: "triple",
        HOMERUN: "homerun",
        WALK: "walk"
    };

    const BASES = {
        HOME: 0,
        FIRST: 1,
        SECOND: 2,
        THIRD: 3
    };

    const PITCH_TYPES = {
        fastball: {
            name: "패스트볼",
            speed: 96,
            control: 78,
            break: 8
        },
        slider: {
            name: "슬라이더",
            speed: 87,
            control: 70,
            break: 65
        },
        curveball: {
            name: "커브",
            speed: 79,
            control: 64,
            break: 82
        },
        changeup: {
            name: "체인지업",
            speed: 84,
            control: 72,
            break: 45
        }
    };

    const DEFAULT_TEAMS = [
        "Arizona",
        "Atlanta",
        "Baltimore",
        "Boston",
        "Chicago",
        "Cincinnati",
        "Cleveland",
        "Colorado",
        "Detroit",
        "Houston",
        "Kansas City",
        "Los Angeles",
        "Miami",
        "Milwaukee",
        "Minnesota",
        "New York",
        "Oakland",
        "Philadelphia",
        "Pittsburgh",
        "San Diego",
        "San Francisco",
        "Seattle",
        "St. Louis",
        "Tampa Bay",
        "Texas",
        "Toronto",
        "Washington"
    ];

    /* =========================================================
       경기 상태
       ========================================================= */

    const defaultGameState = {
        active: false,

        mode: GAME_MODE.BATTING,

        awayTeam: "Away",
        homeTeam: "Home",

        playerTeam: "",
        playerRole: "batter",

        inning: 1,
        half: "top",

        outs: 0,

        balls: 0,
        strikes: 0,

        awayScore: 0,
        homeScore: 0,

        totalPitches: 0,

        currentPitch: {
            type: "fastball",
            x: 0,
            y: 0,
            active: false
        },

        batting: {
            cursorX: 50,
            cursorY: 50,
            swingPressed: false,
            swingCooldown: false,
            timing: 0
        },

        pitching: {
            selectedPitch: "fastball",
            cursorX: 50,
            cursorY: 50,
            pitching: false
        },

        fielding: {
            playerX: 50,
            playerY: 65,
            aimX: 50,
            aimY: 50,
            hasBall: false
        },

        baserunning: {
            runnerBase: 0,
            targetBase: 0,
            autoAdvance: false
        },

        bases: {
            first: null,
            second: null,
            third: null
        },

        lastResult: "",
        lastMessage: "",

        atBat: {
            hits: 0,
            pitches: 0,
            contactAttempts: 0
        },

        playerStats: {
            games: 0,
            plateAppearances: 0,
            atBats: 0,
            hits: 0,
            homeRuns: 0,
            doubles: 0,
            triples: 0,
            singles: 0,
            walks: 0,
            strikeouts: 0,
            runs: 0,
            rbi: 0,
            stolenBases: 0
        },

        startedAt: 0
    };

    let game = clone(defaultGameState);

    let elements = {};

    let joystickStates = {};

    let gameTimer = null;

    let pitchTimer = null;

    let messageTimer = null;

    /* =========================================================
       공통 유틸
       ========================================================= */

    function clone(object) {
        return JSON.parse(JSON.stringify(object));
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function random(min, max) {
        return Math.random() * (max - min) + min;
    }

    function randomInt(min, max) {
        return Math.floor(random(min, max + 1));
    }

    function chance(percent) {
        return Math.random() * 100 < percent;
    }

    function getPlayer() {
        if (typeof window.getCurrentPlayer === "function") {
            return window.getCurrentPlayer();
        }

        if (RTTS.player && typeof RTTS.player.get === "function") {
            return RTTS.player.get();
        }

        try {
            return JSON.parse(localStorage.getItem("rtts_current_player")) || null;
        } catch (error) {
            return null;
        }
    }

    function saveGameState() {
        try {
            localStorage.setItem(GAME_KEY, JSON.stringify(game));
        } catch (error) {
            console.warn("경기 저장 실패:", error);
        }
    }

    function loadGameState() {
        try {
            const saved = localStorage.getItem(GAME_KEY);

            if (!saved) {
                return false;
            }

            const parsed = JSON.parse(saved);

            if (!parsed || typeof parsed !== "object") {
                return false;
            }

            game = Object.assign(clone(defaultGameState), parsed);

            return true;
        } catch (error) {
            console.warn("경기 불러오기 실패:", error);
            return false;
        }
    }

    function showToast(message) {
        if (typeof window.showToast === "function") {
            window.showToast(message);
            return;
        }

        const toast = document.getElementById("toast");

        if (!toast) {
            return;
        }

        toast.textContent = message;
        toast.classList.remove("hidden");

        clearTimeout(messageTimer);

        messageTimer = setTimeout(function () {
            toast.classList.add("hidden");
        }, 1800);
    }

    /* =========================================================
       DOM 캐시
       ========================================================= */

    function cacheElements() {
        elements = {
            screen: document.getElementById("gameScreen"),

            awayTeam: document.getElementById("gameAwayTeam"),
            homeTeam: document.getElementById("gameHomeTeam"),
            score: document.getElementById("gameScore"),

            fieldCanvas: document.getElementById("fieldCanvas"),
            fieldPlayer: document.getElementById("fieldPlayer"),
            ball: document.getElementById("ball"),

            inning: document.getElementById("gameInning"),
            outs: document.getElementById("gameOuts"),
            balls: document.getElementById("gameBalls"),
            strikes: document.getElementById("gameStrikes"),

            battingControls: document.getElementById("battingControls"),
            battingZone: document.getElementById("battingZone"),
            battingCursor: document.getElementById("battingCursor"),
            battingJoystick: document.getElementById("battingJoystick"),
            swingButton: document.getElementById("swingButton"),

            pitchingControls: document.getElementById("pitchingControls"),
            pitchZone: document.getElementById("pitchZone"),
            pitchCursor: document.getElementById("pitchCursor"),

            fieldingControls: document.getElementById("fieldingControls"),
            fieldingJoystick: document.getElementById("fieldingJoystick"),
            throwAim: document.getElementById("throwAim"),
            throwButton: document.getElementById("throwButton"),

            baserunningControls: document.getElementById("baserunningControls"),
            runningJoystick: document.getElementById("runningJoystick")
        };

        elements.pitchButtons = document.querySelectorAll(
            "[data-pitch]"
        );

        elements.baseButtons = document.querySelectorAll(
            "[data-base]"
        );
    }

    /* =========================================================
       경기 초기화
       ========================================================= */

    function initializeGame() {
        cacheElements();

        if (!elements.screen) {
            return;
        }

        bindGameEvents();

        const player = getPlayer();

        if (player) {
            game.playerTeam = player.team || "";
        }

        updateGameUI();
    }

    function startGame() {
        const player = getPlayer();

        game = clone(defaultGameState);

        game.active = true;
        game.startedAt = Date.now();

        game.playerTeam = player && player.team
            ? player.team
            : "My Team";

        game.awayTeam = game.playerTeam;
        game.homeTeam = "Opponent";

        game.playerRole = "batter";

        game.mode = GAME_MODE.BATTING;

        game.playerStats = {
            games: 0,
            plateAppearances: 0,
            atBats: 0,
            hits: 0,
            homeRuns: 0,
            doubles: 0,
            triples: 0,
            singles: 0,
            walks: 0,
            strikeouts: 0,
            runs: 0,
            rbi: 0,
            stolenBases: 0
        };

        game.bases = {
            first: null,
            second: null,
            third: null
        };

        updateGameUI();

        showToast("경기를 시작합니다.");

        saveGameState();

        startGameLoop();
    }

    function endGame() {
        game.active = false;

        stopGameLoop();

        saveGameState();

        const player = getPlayer();

        if (player && RTTS.player && typeof RTTS.player.save === "function") {
            RTTS.player.save();
        }

        updateGameUI();

        showToast("경기가 종료되었습니다.");
    }

    function startGameLoop() {
        stopGameLoop();

        gameTimer = setInterval(function () {
            if (!game.active) {
                return;
            }

            updateDynamicElements();
        }, 50);
    }

    function stopGameLoop() {
        if (gameTimer) {
            clearInterval(gameTimer);
            gameTimer = null;
        }

        if (pitchTimer) {
            clearTimeout(pitchTimer);
            pitchTimer = null;
        }
    }

    /* =========================================================
       경기 화면 업데이트
       ========================================================= */

    function updateGameUI() {
        if (!elements || !elements.screen) {
            return;
        }

        if (elements.awayTeam) {
            elements.awayTeam.textContent = game.awayTeam;
        }

        if (elements.homeTeam) {
            elements.homeTeam.textContent = game.homeTeam;
        }

        if (elements.score) {
            elements.score.textContent =
                game.awayScore + " - " + game.homeScore;
        }

        if (elements.inning) {
            elements.inning.textContent =
                game.inning + "회 " +
                (game.half === "top" ? "초" : "말");
        }

        if (elements.outs) {
            elements.outs.textContent = game.outs;
        }

        if (elements.balls) {
            elements.balls.textContent = game.balls;
        }

        if (elements.strikes) {
            elements.strikes.textContent = game.strikes;
        }

        setControlVisibility();

        updateBattingCursor();

        updatePitchCursor();

        updateFieldPlayer();

        updateThrowAim();

        updateBaserunningUI();
    }

    function setControlVisibility() {
        const controls = [
            [elements.battingControls, game.mode === GAME_MODE.BATTING],
            [elements.pitchingControls, game.mode === GAME_MODE.PITCHING],
            [elements.fieldingControls, game.mode === GAME_MODE.FIELDING],
            [elements.baserunningControls, game.mode === GAME_MODE.BASERUNNING]
        ];

        controls.forEach(function (item) {
            const element = item[0];
            const visible = item[1];

            if (!element) {
                return;
            }

            element.classList.toggle("hidden", !visible);
        });
    }

    function updateDynamicElements() {
        if (!game.active) {
            return;
        }

        updateBattingCursor();
        updatePitchCursor();
        updateFieldPlayer();
        updateThrowAim();
    }

    /* =========================================================
       이벤트 연결
       ========================================================= */

    function bindGameEvents() {
        if (elements.swingButton) {
            elements.swingButton.addEventListener(
                "click",
                handleSwing
            );

            elements.swingButton.addEventListener(
                "touchstart",
                function (event) {
                    event.preventDefault();
                    handleSwing();
                },
                { passive: false }
            );
        }

        if (elements.throwButton) {
            elements.throwButton.addEventListener(
                "click",
                handleThrow
            );

            elements.throwButton.addEventListener(
                "touchstart",
                function (event) {
                    event.preventDefault();
                    handleThrow();
                },
                { passive: false }
            );
        }

        if (elements.pitchButtons) {
            elements.pitchButtons.forEach(function (button) {
                button.addEventListener("click", function () {
                    const pitch = button.dataset.pitch;

                    selectPitch(pitch);
                });
            });
        }

        if (elements.baseButtons) {
            elements.baseButtons.forEach(function (button) {
                button.addEventListener("click", function () {
                    const base = Number(button.dataset.base);

                    chooseBaseTarget(base);
                });
            });
        }

        setupJoystick(
            elements.battingJoystick,
            "batting"
        );

        setupJoystick(
            elements.fieldingJoystick,
            "fielding"
        );

        setupJoystick(
            elements.runningJoystick,
            "running"
        );

        setupMouseKeyboardControls();
    }

    /* =========================================================
       키보드 조작
       ========================================================= */

    function setupMouseKeyboardControls() {
        document.addEventListener("keydown", function (event) {
            if (!game.active) {
                return;
            }

            const key = event.key.toLowerCase();

            if (key === " " || key === "enter") {
                if (game.mode === GAME_MODE.BATTING) {
                    event.preventDefault();
                    handleSwing();
                }

                if (game.mode === GAME_MODE.FIELDING) {
                    event.preventDefault();
                    handleThrow();
                }
            }

            if (game.mode === GAME_MODE.BATTING) {
                if (key === "arrowleft" || key === "a") {
                    game.batting.cursorX -= 4;
                }

                if (key === "arrowright" || key === "d") {
                    game.batting.cursorX += 4;
                }

                if (key === "arrowup" || key === "w") {
                    game.batting.cursorY -= 4;
                }

                if (key === "arrowdown" || key === "s") {
                    game.batting.cursorY += 4;
                }

                game.batting.cursorX =
                    clamp(game.batting.cursorX, 0, 100);

                game.batting.cursorY =
                    clamp(game.batting.cursorY, 0, 100);

                updateBattingCursor();
            }

            if (game.mode === GAME_MODE.PITCHING) {
                if (key === "arrowleft" || key === "a") {
                    game.pitching.cursorX -= 4;
                }

                if (key === "arrowright" || key === "d") {
                    game.pitching.cursorX += 4;
                }

                if (key === "arrowup" || key === "w") {
                    game.pitching.cursorY -= 4;
                }

                if (key === "arrowdown" || key === "s") {
                    game.pitching.cursorY += 4;
                }

                game.pitching.cursorX =
                    clamp(game.pitching.cursorX, 0, 100);

                game.pitching.cursorY =
                    clamp(game.pitching.cursorY, 0, 100);

                updatePitchCursor();
            }

            if (game.mode === GAME_MODE.FIELDING) {
                if (key === "arrowleft" || key === "a") {
                    game.fielding.playerX -= 4;
                }

                if (key === "arrowright" || key === "d") {
                    game.fielding.playerX += 4;
                }

                if (key === "arrowup" || key === "w") {
                    game.fielding.playerY -= 4;
                }

                if (key === "arrowdown" || key === "s") {
                    game.fielding.playerY += 4;
                }

                game.fielding.playerX =
                    clamp(game.fielding.playerX, 0, 100);

                game.fielding.playerY =
                    clamp(game.fielding.playerY, 0, 100);

                updateFieldPlayer();
            }
        });
    }

    /* =========================================================
       가상 조이스틱
       ========================================================= */

    function setupJoystick(element, type) {
        if (!element) {
            return;
        }

        const knob =
            element.querySelector(".joystick-knob");

        if (!knob) {
            return;
        }

        const state = {
            active: false,
            pointerId: null,
            x: 0,
            y: 0
        };

        joystickStates[type] = state;

        element.addEventListener(
            "pointerdown",
            function (event) {
                event.preventDefault();

                state.active = true;
                state.pointerId = event.pointerId;

                if (element.setPointerCapture) {
                    try {
                        element.setPointerCapture(
                            event.pointerId
                        );
                    } catch (error) {
                        // 모바일 브라우저에 따라 무시
                    }
                }

                updateJoystick(
                    element,
                    knob,
                    state,
                    event.clientX,
                    event.clientY,
                    type
                );
            }
        );

        element.addEventListener(
            "pointermove",
            function (event) {
                if (!state.active) {
                    return;
                }

                updateJoystick(
                    element,
                    knob,
                    state,
                    event.clientX,
                    event.clientY,
                    type
                );
            }
        );

        const endJoystick = function () {
            state.active = false;
            state.pointerId = null;
            state.x = 0;
            state.y = 0;

            knob.style.transform =
                "translate(-50%, -50%)";
        };

        element.addEventListener(
            "pointerup",
            endJoystick
        );

        element.addEventListener(
            "pointercancel",
            endJoystick
        );

        element.addEventListener(
            "pointerleave",
            function () {
                if (state.active) {
                    state.active = false;

                    state.x = 0;
                    state.y = 0;

                    knob.style.transform =
                        "translate(-50%, -50%)";
                }
            }
        );
    }

    function updateJoystick(
        element,
        knob,
        state,
        clientX,
        clientY,
        type
    ) {
        const rect = element.getBoundingClientRect();

        const centerX =
            rect.left + rect.width / 2;

        const centerY =
            rect.top + rect.height / 2;

        let dx = clientX - centerX;
        let dy = clientY - centerY;

        const radius =
            Math.min(rect.width, rect.height) * 0.36;

        const distance =
            Math.sqrt(dx * dx + dy * dy);

        if (distance > radius) {
            dx = dx / distance * radius;
            dy = dy / distance * radius;
        }

        state.x = dx / radius;
        state.y = dy / radius;

        knob.style.transform =
            "translate(calc(-50% + " +
            dx +
            "px), calc(-50% + " +
            dy +
            "px))";

        applyJoystickInput(type, state.x, state.y);
    }

    function applyJoystickInput(type, x, y) {
        const strength = 2.8;

        if (type === "batting") {
            game.batting.cursorX += x * strength;
            game.batting.cursorY += y * strength;

            game.batting.cursorX =
                clamp(game.batting.cursorX, 0, 100);

            game.batting.cursorY =
                clamp(game.batting.cursorY, 0, 100);

            updateBattingCursor();
        }

        if (type === "fielding") {
            game.fielding.playerX += x * strength;
            game.fielding.playerY += y * strength;

            game.fielding.playerX =
                clamp(game.fielding.playerX, 0, 100);

            game.fielding.playerY =
                clamp(game.fielding.playerY, 0, 100);

            updateFieldPlayer();
        }

        if (type === "running") {
            if (Math.abs(x) > 0.2) {
                game.baserunning.targetBase +=
                    x > 0 ? 0.03 : -0.03;
            }

            if (Math.abs(y) > 0.2) {
                game.baserunning.targetBase +=
                    y < 0 ? 0.03 : -0.03;
            }

            game.baserunning.targetBase =
                clamp(
                    game.baserunning.targetBase,
                    0,
                    4
                );
        }
    }

    /* =========================================================
       타격
       ========================================================= */

    function updateBattingCursor() {
        if (!elements.battingCursor) {
            return;
        }

        elements.battingCursor.style.left =
            game.batting.cursorX + "%";

        elements.battingCursor.style.top =
            game.batting.cursorY + "%";
    }

    function handleSwing() {
        if (!game.active) {
            return;
        }

        if (game.mode !== GAME_MODE.BATTING) {
            return;
        }

        if (game.batting.swingCooldown) {
            return;
        }

        game.batting.swingPressed = true;
        game.batting.swingCooldown = true;

        game.atBat.contactAttempts++;

        const result = resolveSwing();

        processBattingResult(result);

        setTimeout(function () {
            game.batting.swingCooldown = false;
            game.batting.swingPressed = false;
        }, 220);
    }

    function resolveSwing() {
        const player = getPlayer();

        const contact =
            getEffectiveStat(player, "contact");

        const power =
            getEffectiveStat(player, "power");

        const clutch =
            getEffectiveStat(player, "clutch");

        const cursorAccuracy =
            getCursorAccuracy();

        const timing =
            getSwingTiming();

        const quality =
            contact * 0.35 +
            power * 0.15 +
            clutch * 0.15 +
            cursorAccuracy * 0.2 +
            timing * 0.15;

        const roll = random(0, 100);

        game.atBat.pitches++;

        if (roll > quality + 20) {
            return GAME_RESULT.STRIKE;
        }

        if (roll > quality + 8) {
            return GAME_RESULT.FOUL;
        }

        if (quality < 45) {
            return GAME_RESULT.OUT;
        }

        if (quality < 60) {
            return GAME_RESULT.SINGLE;
        }

        if (quality < 73) {
            return chance(
                25 + power * 0.25
            )
                ? GAME_RESULT.DOUBLE
                : GAME_RESULT.SINGLE;
        }

        if (quality < 84) {
            return chance(
                18 + power * 0.35
            )
                ? GAME_RESULT.HOMERUN
                : GAME_RESULT.DOUBLE;
        }

        if (quality >= 84) {
            const powerChance =
                25 + power * 0.55;

            if (chance(powerChance)) {
                return GAME_RESULT.HOMERUN;
            }

            if (chance(25)) {
                return GAME_RESULT.TRIPLE;
            }

            return GAME_RESULT.DOUBLE;
        }

        return GAME_RESULT.OUT;
    }

    function getCursorAccuracy() {
        const x =
            game.batting.cursorX;

        const y =
            game.batting.cursorY;

        const centerDistance =
            Math.sqrt(
                Math.pow(x - 50, 2) +
                Math.pow(y - 50, 2)
            );

        return clamp(
            100 - centerDistance * 1.4,
            0,
            100
        );
    }

    function getSwingTiming() {
        if (
            !game.currentPitch ||
            !game.currentPitch.active
        ) {
            return random(40, 75);
        }

        const dx =
            Math.abs(
                game.batting.cursorX -
                game.currentPitch.x
            );

        const dy =
            Math.abs(
                game.batting.cursorY -
                game.currentPitch.y
            );

        const distance =
            Math.sqrt(
                dx * dx +
                dy * dy
            );

        return clamp(
            100 - distance * 2,
            0,
            100
        );
    }

    function processBattingResult(result) {
        game.lastResult = result;

        switch (result) {
            case GAME_RESULT.STRIKE:
                game.strikes++;

                showToast("스트라이크");

                if (game.strikes >= 3) {
                    registerStrikeout();
                }

                break;

            case GAME_RESULT.FOUL:
                if (game.strikes < 2) {
                    game.strikes++;
                }

                showToast("파울");

                break;

            case GAME_RESULT.BALL:
                game.balls++;

                if (game.balls >= 4) {
                    registerWalk();
                } else {
                    showToast("볼");
                }

                break;

            case GAME_RESULT.OUT:
                registerOut("타구 아웃");

                break;

            case GAME_RESULT.SINGLE:
                registerHit(1);

                break;

            case GAME_RESULT.DOUBLE:
                registerHit(2);

                break;

            case GAME_RESULT.TRIPLE:
                registerHit(3);

                break;

            case GAME_RESULT.HOMERUN:
                registerHomeRun();

                break;
        }

        game.currentPitch.active = false;

        updateGameUI();

        saveGameState();
    }

    /* =========================================================
       타격 기록
       ========================================================= */

    function registerStrikeout() {
        game.playerStats.strikeouts++;

        if (RTTS.player && RTTS.player.recordStat) {
            RTTS.player.recordStat(
                "strikeouts",
                1
            );
        }

        registerAtBatComplete();

        registerOut("삼진");
    }

    function registerOut(message) {
        game.outs++;

        game.playerStats.atBats++;

        registerAtBatComplete(false);

        showToast(message);

        resetCount();

        if (game.outs >= 3) {
            changeHalfInning();
        }
    }

    function registerHit(bases) {
        game.playerStats.hits++;
        game.playerStats.atBats++;

        if (bases === 1) {
            game.playerStats.singles++;
            showToast("안타!");
        }

        if (bases === 2) {
            game.playerStats.doubles++;
            showToast("2루타!");
        }

        if (bases === 3) {
            game.playerStats.triples++;
            showToast("3루타!");
        }

        advanceRunners(bases);

        registerAtBatComplete(true);

        resetCount();
    }

    function registerHomeRun() {
        game.playerStats.hits++;
        game.playerStats.homeRuns++;
        game.playerStats.atBats++;

        let runs = 1;

        if (game.bases.first) {
            runs++;
        }

        if (game.bases.second) {
            runs++;
        }

        if (game.bases.third) {
            runs++;
        }

        scoreRuns(runs);

        game.bases = {
            first: null,
            second: null,
            third: null
        };

        registerAtBatComplete(true);

        resetCount();

        showToast(
            runs >= 4
                ? "만루 홈런!"
                : "홈런!"
        );
    }

    function registerWalk() {
        game.playerStats.walks++;

        game.playerStats.plateAppearances++;

        forceWalk();

        resetCount();

        showToast("볼넷");
    }

    function registerAtBatComplete(hit) {
        game.playerStats.plateAppearances++;

        if (RTTS.player &&
            typeof RTTS.player.recordStat === "function") {

            RTTS.player.recordStat(
                "plateAppearances",
                1
            );

            if (hit) {
                RTTS.player.recordStat(
                    "hits",
                    1
                );
            }
        }

        game.atBat = {
            hits: 0,
            pitches: 0,
            contactAttempts: 0
        };
    }

    /* =========================================================
       주자 처리
       ========================================================= */

    function advanceRunners(hitBases) {
        const oldBases = {
            first: game.bases.first,
            second: game.bases.second,
            third: game.bases.third
        };

        game.bases = {
            first: null,
            second: null,
            third: null
        };

        let scored = 0;

        if (oldBases.third) {
            scored++;
        }

        if (oldBases.second) {
            if (hitBases >= 2) {
                scored++;
            } else {
                game.bases.third = oldBases.second;
            }
        }

        if (oldBases.first) {
            if (hitBases >= 2) {
                if (!game.bases.third) {
                    game.bases.third = oldBases.first;
                } else {
                    scored++;
                }
            } else {
                game.bases.second = oldBases.first;
            }
        }

        if (hitBases === 1) {
            game.bases.first = "player";
        }

        if (hitBases === 2) {
            game.bases.second = "player";
        }

        if (hitBases === 3) {
            game.bases.third = "player";
        }

        if (scored > 0) {
            scoreRuns(scored);
        }
    }

    function forceWalk() {
        if (game.bases.first) {
            if (game.bases.second) {
                if (game.bases.third) {
                    scoreRuns(1);
                } else {
                    game.bases.third = game.bases.second;
                }
            }

            game.bases.second = game.bases.first;
        }

        game.bases.first = "player";
    }

    function scoreRuns(runs) {
        if (runs <= 0) {
            return;
        }

        if (game.half === "top") {
            game.awayScore += runs;
        } else {
            game.homeScore += runs;
        }

        game.playerStats.runs += runs;

        if (RTTS.player &&
            typeof RTTS.player.recordStat === "function") {

            RTTS.player.recordStat(
                "runs",
                runs
            );

            RTTS.player.recordStat(
                "rbi",
                runs
            );
        }
    }

    /* =========================================================
       카운트 / 이닝
       ========================================================= */

    function resetCount() {
        game.balls = 0;
        game.strikes = 0;
    }

    function changeHalfInning() {
        game.outs = 0;

        resetCount();

        game.bases = {
            first: null,
            second: null,
            third: null
        };

        if (game.half === "top") {
            game.half = "bottom";
        } else {
            game.half = "top";
            game.inning++;
        }

        game.mode =
            game.half === "top"
                ? GAME_MODE.BATTING
                : GAME_MODE.PITCHING;

        showToast(
            game.inning +
            "회 " +
            (game.half === "top" ? "초" : "말")
        );

        checkGameEnd();
    }

    function checkGameEnd() {
        if (game.inning <= 9) {
            return;
        }

        if (
            game.inning > 9 &&
            game.awayScore !== game.homeScore
        ) {
            endGame();
            return;
        }

        if (game.inning >= 12) {
            endGame();
        }
    }

    /* =========================================================
       투구
       ========================================================= */

    function updatePitchCursor() {
        if (!elements.pitchCursor) {
            return;
        }

        elements.pitchCursor.style.left =
            game.pitching.cursorX + "%";

        elements.pitchCursor.style.top =
            game.pitching.cursorY + "%";
    }

    function selectPitch(type) {
        if (!PITCH_TYPES[type]) {
            return;
        }

        game.pitching.selectedPitch = type;

        if (elements.pitchButtons) {
            elements.pitchButtons.forEach(function (button) {
                button.classList.toggle(
                    "active",
                    button.dataset.pitch === type
                );
            });
        }

        showToast(
            PITCH_TYPES[type].name +
            " 선택"
        );
    }

    function throwPitch() {
        if (!game.active) {
            return;
        }

        if (game.mode !== GAME_MODE.PITCHING) {
            return;
        }

        const type =
            PITCH_TYPES[
                game.pitching.selectedPitch
            ] ||
            PITCH_TYPES.fastball;

        game.totalPitches++;

        game.pitching.pitching = true;

        game.currentPitch = {
            type: game.pitching.selectedPitch,
            x: game.pitching.cursorX,
            y: game.pitching.cursorY,
            active: true
        };

        updateBallPosition();

        pitchTimer = setTimeout(function () {
            resolvePitch(type);
        }, 650);
    }

    function resolvePitch(type) {
        if (!game.currentPitch.active) {
            return;
        }

        const control =
            type.control;

        const error =
            random(-20, 20) *
            (100 - control) /
            100;

        const finalX =
            clamp(
                game.currentPitch.x + error,
                0,
                100
            );

        const finalY =
            clamp(
                game.currentPitch.y + error,
                0,
                100
            );

        const zoneDistance =
            Math.sqrt(
                Math.pow(finalX - 50, 2) +
                Math.pow(finalY - 50, 2)
            );

        game.currentPitch.x = finalX;
        game.currentPitch.y = finalY;

        game.currentPitch.active = false;

        if (zoneDistance > 42) {
            game.balls++;

            showToast("볼");

            if (game.balls >= 4) {
                registerWalk();
            }
        } else {
            const strikeChance =
                55 +
                type.control * 0.3;

            if (chance(strikeChance)) {
                game.strikes++;

                showToast(
                    type.name +
                    " 스트라이크"
                );

                if (game.strikes >= 3) {
                    game.outs++;

                    game.strikes = 0;
                    game.balls = 0;

                    showToast("삼진");

                    if (game.outs >= 3) {
                        changeHalfInning();
                    }
                }
            } else {
                game.balls++;

                showToast("볼");
            }
        }

        game.pitching.pitching = false;

        updateGameUI();

        saveGameState();
    }

    /* =========================================================
       수비
       ========================================================= */

    function updateFieldPlayer() {
        if (!elements.fieldPlayer) {
            return;
        }

        elements.fieldPlayer.style.left =
            game.fielding.playerX + "%";

        elements.fieldPlayer.style.top =
            game.fielding.playerY + "%";
    }

    function updateThrowAim() {
        if (!elements.throwAim) {
            return;
        }

        const target =
            elements.throwAim.querySelector(
                ".throw-target"
            );

        if (!target) {
            return;
        }

        target.style.left =
            game.fielding.aimX + "%";

        target.style.top =
            game.fielding.aimY + "%";
    }

    function handleThrow() {
        if (!game.active) {
            return;
        }

        if (game.mode !== GAME_MODE.FIELDING) {
            return;
        }

        if (!game.fielding.hasBall) {
            showToast("공을 먼저 잡아야 합니다.");
            return;
        }

        const player = getPlayer();

        const defense =
            getEffectiveStat(
                player,
                "defense"
            );

        const targetDistance =
            Math.sqrt(
                Math.pow(
                    game.fielding.aimX - 50,
                    2
                ) +
                Math.pow(
                    game.fielding.aimY - 50,
                    2
                )
            );

        const accuracy =
            clamp(
                defense -
                targetDistance * 0.6 +
                random(-10, 10),
                0,
                100
            );

        game.fielding.hasBall = false;

        if (accuracy >= 55) {
            showToast("정확한 송구!");

            registerOut("송구 아웃");
        } else {
            showToast("송구 실책!");

            game.lastMessage =
                "송구 실책";

            advanceRunnerAfterError();
        }

        updateGameUI();

        saveGameState();
    }

    function advanceRunnerAfterError() {
        if (game.bases.first) {
            game.bases.second = game.bases.first;
            game.bases.first = null;
        } else if (game.bases.second) {
            game.bases.third = game.bases.second;
            game.bases.second = null;
        } else if (game.bases.third) {
            scoreRuns(1);
            game.bases.third = null;
        }
    }

    /* =========================================================
       주루
       ========================================================= */

    function updateBaserunningUI() {
        if (!elements.baserunningControls) {
            return;
        }

        const target =
            Math.round(
                game.baserunning.targetBase
            );

        elements.baserunningControls.dataset.targetBase =
            String(target);
    }

    function chooseBaseTarget(base) {
        if (!game.active) {
            return;
        }

        game.baserunning.targetBase =
            clamp(base, 0, 4);

        if (game.mode !== GAME_MODE.BASERUNNING) {
            return;
        }

        executeBaseRun(base);
    }

    function executeBaseRun(base) {
        const player = getPlayer();

        const baserunning =
            getEffectiveStat(
                player,
                "baserunning"
            );

        const success =
            55 +
            baserunning * 0.35;

        if (base <= 0) {
            return;
        }

        if (chance(success)) {
            game.playerStats.stolenBases++;

            if (RTTS.player &&
                typeof RTTS.player.recordStat === "function") {

                RTTS.player.recordStat(
                    "stolenBases",
                    1
                );
            }

            showToast(
                base === 2
                    ? "2루 도루 성공!"
                    : "주루 성공!"
            );
        } else {
            game.outs++;

            showToast("도루 실패");

            if (game.outs >= 3) {
                changeHalfInning();
            }
        }

        updateGameUI();

        saveGameState();
    }

    /* =========================================================
       경기 모드 전환
       ========================================================= */

    function setMode(mode) {
        if (
            mode !== GAME_MODE.BATTING &&
            mode !== GAME_MODE.PITCHING &&
            mode !== GAME_MODE.FIELDING &&
            mode !== GAME_MODE.BASERUNNING
        ) {
            return;
        }

        game.mode = mode;

        updateGameUI();
    }

    function setPlayerRole(role) {
        game.playerRole = role;

        if (role === "batter") {
            game.mode = GAME_MODE.BATTING;
        }

        if (role === "pitcher") {
            game.mode = GAME_MODE.PITCHING;
        }

        updateGameUI();
    }

    /* =========================================================
       공 위치
       ========================================================= */

    function updateBallPosition() {
        if (!elements.ball) {
            return;
        }

        if (!game.currentPitch.active) {
            elements.ball.classList.remove("active");
            return;
        }

        elements.ball.classList.add("active");

        elements.ball.style.left =
            game.currentPitch.x + "%";

        elements.ball.style.top =
            game.currentPitch.y + "%";
    }

    /* =========================================================
       스탯 계산
       ========================================================= */

    function getEffectiveStat(
        player,
        stat
    ) {
        if (!player) {
            return 0;
        }

        let base = 0;

        if (
            player.stats &&
            typeof player.stats[stat] === "number"
        ) {
            base = player.stats[stat];
        }

        let bonus = 0;

        if (
            RTTS.player &&
            typeof RTTS.player.getEffectiveStat === "function"
        ) {
            return RTTS.player.getEffectiveStat(stat);
        }

        if (
            player.equipment &&
            player.equipment.bonuses &&
            typeof player.equipment.bonuses[stat] === "number"
        ) {
            bonus =
                player.equipment.bonuses[stat];
        }

        return base + bonus;
    }

    /* =========================================================
       경기 통계 → 선수 통계 연동
       ========================================================= */

    function applyGameStatsToPlayer() {
        const player = getPlayer();

        if (!player) {
            return;
        }

        if (!player.seasonStats) {
            player.seasonStats = {};
        }

        Object.keys(game.playerStats).forEach(
            function (key) {
                if (
                    typeof game.playerStats[key] !==
                    "number"
                ) {
                    return;
                }

                if (
                    typeof player.seasonStats[key] !==
                    "number"
                ) {
                    player.seasonStats[key] = 0;
                }

                player.seasonStats[key] +=
                    game.playerStats[key];
            }
        );

        if (
            RTTS.player &&
            typeof RTTS.player.save === "function"
        ) {
            RTTS.player.save();
        } else {
            try {
                localStorage.setItem(
                    "rtts_current_player",
                    JSON.stringify(player)
                );
            } catch (error) {
                console.warn(
                    "선수 저장 실패:",
                    error
                );
            }
        }
    }

    /* =========================================================
       외부에서 경기 시작 시 사용하는 함수
       ========================================================= */

    function onGameScreenOpened() {
        cacheElements();

        if (!game.active) {
            startGame();
        } else {
            updateGameUI();
            startGameLoop();
        }
    }

    /* =========================================================
       화면을 나갈 때
       ========================================================= */

    function onGameScreenClosed() {
        saveGameState();

        if (!game.active) {
            stopGameLoop();
        }
    }

    /* =========================================================
       공개 API
       ========================================================= */

    RTTS.game = {
        getState: function () {
            return game;
        },

        start: startGame,

        end: endGame,

        initialize: initializeGame,

        setMode: setMode,

        setPlayerRole: setPlayerRole,

        selectPitch: selectPitch,

        throwPitch: throwPitch,

        swing: handleSwing,

        throwBall: handleThrow,

        chooseBase: chooseBaseTarget,

        save: saveGameState,

        load: loadGameState,

        applyStats: applyGameStatsToPlayer,

        getEffectiveStat: getEffectiveStat,

        onScreenOpened: onGameScreenOpened,

        onScreenClosed: onGameScreenClosed,

        modes: GAME_MODE,

        pitchTypes: PITCH_TYPES
    };

    /* =========================================================
       전역 호환 함수
       ========================================================= */

    window.startRTTSGame = startGame;

    window.endRTTSGame = endGame;

    window.rttsSwing = handleSwing;

    window.rttsThrow = handleThrow;

    window.rttsThrowPitch = throwPitch;

    window.rttsSelectPitch = selectPitch;

    window.rttsSetGameMode = setMode;

    /* =========================================================
       DOM 준비
       ========================================================= */

    document.addEventListener(
        "DOMContentLoaded",
        function () {
            initializeGame();
        }
    );

})();
```
