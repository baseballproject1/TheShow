```javascript
/* =========================================================
   RTTS Baseball Game
   js/pitching.js
   투구 시스템 완성본
   ---------------------------------------------------------
   기능
   - 패스트볼 / 슬라이더 / 커브 / 체인지업
   - 투구 위치 조준
   - 구종별 속도 / 변화 / 제구
   - 수비 스탯 기반 투구 보정
   - 투구 미스 / 스트라이크 / 볼
   - 모바일 버튼 / 키보드 조작
   - game.js와 연동
   ========================================================= */

(function () {
    "use strict";

    const RTTS = window.RTTS || (window.RTTS = {});

    const PITCHES = {
        fastball: {
            name: "패스트볼",
            speed: 96,
            control: 82,
            movement: 8,
            miss: 5
        },

        slider: {
            name: "슬라이더",
            speed: 87,
            control: 72,
            movement: 68,
            miss: 11
        },

        curveball: {
            name: "커브",
            speed: 79,
            control: 66,
            movement: 82,
            miss: 15
        },

        changeup: {
            name: "체인지업",
            speed: 84,
            control: 75,
            movement: 48,
            miss: 9
        }
    };

    const state = {
        initialized: false,

        selectedPitch: "fastball",

        aimX: 50,
        aimY: 50,

        pitching: false,

        pitchStartedAt: 0,

        pitchDuration: 700,

        pitchNumber: 0,

        lastResult: "",

        lastVelocity: 0,

        lastControl: 0,

        lastMovement: 0
    };

    let elements = {};

    let pitchTimer = null;

    /* =========================================================
       공통
       ========================================================= */

    function getGame() {
        return RTTS.game || null;
    }

    function getPlayer() {
        if (
            typeof window.getCurrentPlayer ===
            "function"
        ) {
            return window.getCurrentPlayer();
        }

        if (
            RTTS.player &&
            typeof RTTS.player.get ===
            "function"
        ) {
            return RTTS.player.get();
        }

        try {
            return JSON.parse(
                localStorage.getItem(
                    "rtts_current_player"
                )
            );
        } catch (error) {
            return null;
        }
    }

    function getDefense() {
        const player = getPlayer();

        if (!player) {
            return 0;
        }

        if (
            RTTS.player &&
            typeof RTTS.player.getEffectiveStat ===
            "function"
        ) {
            return RTTS.player.getEffectiveStat(
                "defense"
            );
        }

        if (
            player.stats &&
            typeof player.stats.defense ===
            "number"
        ) {
            return player.stats.defense;
        }

        return 0;
    }

    function clamp(value, min, max) {
        return Math.max(
            min,
            Math.min(max, value)
        );
    }

    function random(min, max) {
        return Math.random() *
            (max - min) +
            min;
    }

    function chance(percent) {
        return Math.random() * 100 <
            percent;
    }

    function toast(message) {
        if (
            typeof window.showToast ===
            "function"
        ) {
            window.showToast(message);
        }
    }

    /* =========================================================
       DOM
       ========================================================= */

    function cacheElements() {
        elements = {
            controls:
                document.getElementById(
                    "pitchingControls"
                ),

            zone:
                document.getElementById(
                    "pitchZone"
                ),

            cursor:
                document.getElementById(
                    "pitchCursor"
                ),

            ball:
                document.getElementById(
                    "ball"
                ),

            buttons:
                document.querySelectorAll(
                    "[data-pitch]"
                )
        };
    }

    /* =========================================================
       초기화
       ========================================================= */

    function init() {
        cacheElements();

        if (state.initialized) {
            return;
        }

        state.initialized = true;

        bindEvents();

        updateUI();
    }

    function bindEvents() {
        if (elements.buttons) {
            elements.buttons.forEach(
                function (button) {
                    button.addEventListener(
                        "click",
                        function () {
                            selectPitch(
                                button.dataset.pitch
                            );
                        }
                    );
                }
            );
        }

        document.addEventListener(
            "keydown",
            handleKeyboard
        );
    }

    /* =========================================================
       구종 선택
       ========================================================= */

    function selectPitch(type) {
        if (!PITCHES[type]) {
            return;
        }

        state.selectedPitch =
            type;

        const game =
            getGame();

        if (
            game &&
            game.getState
        ) {
            game.getState()
                .pitching
                .selectedPitch =
                type;
        }

        updateUI();

        toast(
            PITCHES[type].name +
            " 선택"
        );
    }

    /* =========================================================
       투구 위치 조정
       ========================================================= */

    function moveAim(
        dx,
        dy
    ) {
        state.aimX =
            clamp(
                state.aimX + dx,
                0,
                100
            );

        state.aimY =
            clamp(
                state.aimY + dy,
                0,
                100
            );

        const game =
            getGame();

        if (
            game &&
            game.getState
        ) {
            const gameState =
                game.getState();

            gameState.pitching.cursorX =
                state.aimX;

            gameState.pitching.cursorY =
                state.aimY;
        }

        updateCursor();
    }

    function setAim(
        x,
        y
    ) {
        state.aimX =
            clamp(x, 0, 100);

        state.aimY =
            clamp(y, 0, 100);

        const game =
            getGame();

        if (
            game &&
            game.getState
        ) {
            const gameState =
                game.getState();

            gameState.pitching.cursorX =
                state.aimX;

            gameState.pitching.cursorY =
                state.aimY;
        }

        updateCursor();
    }

    function updateCursor() {
        if (!elements.cursor) {
            return;
        }

        elements.cursor.style.left =
            state.aimX + "%";

        elements.cursor.style.top =
            state.aimY + "%";
    }

    /* =========================================================
       투구 시작
       ========================================================= */

    function pitch() {
        const game =
            getGame();

        if (!game) {
            return;
        }

        const gameState =
            game.getState();

        if (
            !gameState.active
        ) {
            return;
        }

        if (
            gameState.mode !==
            "pitching"
        ) {
            return;
        }

        if (
            state.pitching
        ) {
            return;
        }

        const pitchData =
            PITCHES[
                state.selectedPitch
            ];

        if (!pitchData) {
            return;
        }

        state.pitching = true;

        state.pitchNumber++;

        state.pitchStartedAt =
            performance.now();

        state.pitchDuration =
            getPitchDuration(
                pitchData
            );

        const control =
            calculateControl(
                pitchData
            );

        const finalLocation =
            calculateFinalLocation(
                pitchData,
                control
            );

        state.lastControl =
            control;

        state.lastVelocity =
            calculateVelocity(
                pitchData
            );

        state.lastMovement =
            calculateMovement(
                pitchData
            );

        gameState.totalPitches++;

        gameState.currentPitch = {
            type:
                state.selectedPitch,

            x:
                finalLocation.x,

            y:
                finalLocation.y,

            active: true
        };

        updateBall(
            0
        );

        animatePitch();

        toast(
            pitchData.name +
            " " +
            Math.round(
                state.lastVelocity
            ) +
            " MPH"
        );
    }

    /* =========================================================
       투구 시간
       ========================================================= */

    function getPitchDuration(
        pitch
    ) {
        /*
         * 빠른 공일수록 도착 시간이 짧다.
         */

        const base =
            900 -
            pitch.speed * 3.2;

        const defense =
            getDefense();

        const bonus =
            defense * 1.1;

        return clamp(
            base - bonus,
            360,
            850
        );
    }

    /* =========================================================
       제구
       ========================================================= */

    function calculateControl(
        pitch
    ) {
        const defense =
            getDefense();

        let value =
            pitch.control +
            defense * 0.28;

        value +=
            random(
                -7,
                7
            );

        return clamp(
            value,
            0,
            100
        );
    }

    /* =========================================================
       최종 투구 위치
       ========================================================= */

    function calculateFinalLocation(
        pitch,
        control
    ) {
        const controlFactor =
            (100 - control) /
            100;

        const baseError =
            pitch.miss *
            controlFactor;

        const movementError =
            pitch.movement *
            0.035;

        let x =
            state.aimX +
            random(
                -baseError,
                baseError
            );

        let y =
            state.aimY +
            random(
                -baseError,
                baseError
            );

        /*
         * 변화구는 위치 변화가 조금 더 크다.
         */

        if (
            pitch.movement > 40
        ) {
            x += random(
                -movementError,
                movementError
            );

            y += random(
                -movementError,
                movementError
            );
        }

        return {
            x: clamp(
                x,
                0,
                100
            ),

            y: clamp(
                y,
                0,
                100
            )
        };
    }

    /* =========================================================
       구속
       ========================================================= */

    function calculateVelocity(
        pitch
    ) {
        const defense =
            getDefense();

        let velocity =
            pitch.speed +
            defense * 0.025;

        velocity +=
            random(
                -1.5,
                1.5
            );

        return velocity;
    }

    /* =========================================================
       변화량
       ========================================================= */

    function calculateMovement(
        pitch
    ) {
        let movement =
            pitch.movement;

        movement +=
            random(
                -4,
                4
            );

        return clamp(
            movement,
            0,
            100
        );
    }

    /* =========================================================
       공 애니메이션
       ========================================================= */

    function animatePitch() {
        if (!state.pitching) {
            return;
        }

        const elapsed =
            performance.now() -
            state.pitchStartedAt;

        const progress =
            clamp(
                elapsed /
                    state.pitchDuration,
                0,
                1
            );

        updateBall(
            progress
        );

        if (
            progress >= 1
        ) {
            finishPitch();

            return;
        }

        requestAnimationFrame(
            animatePitch
        );
    }

    function updateBall(
        progress
    ) {
        if (!elements.ball) {
            return;
        }

        const game =
            getGame();

        if (!game) {
            return;
        }

        const gameState =
            game.getState();

        const pitch =
            gameState.currentPitch;

        if (!pitch) {
            return;
        }

        const startX =
            50;

        const startY =
            7;

        const endX =
            pitch.x;

        const endY =
            pitch.y;

        /*
         * 변화구는 이동 중 약간 휘어 보인다.
         */

        let curveX = 0;
        let curveY = 0;

        const pitchData =
            PITCHES[
                pitch.type
            ];

        if (pitchData) {
            const curve =
                pitchData.movement /
                100;

            curveX =
                Math.sin(
                    progress *
                    Math.PI
                ) *
                curve *
                10;

            curveY =
                Math.sin(
                    progress *
                    Math.PI
                ) *
                curve *
                5;
        }

        const x =
            startX +
            (endX - startX) *
                progress +
            curveX;

        const y =
            startY +
            (endY - startY) *
                progress +
            curveY;

        elements.ball.style.left =
            clamp(
                x,
                0,
                100
            ) + "%";

        elements.ball.style.top =
            clamp(
                y,
                0,
                100
            ) + "%";

        elements.ball.classList.add(
            "active"
        );
    }

    /* =========================================================
       투구 종료
       ========================================================= */

    function finishPitch() {
        if (!state.pitching) {
            return;
        }

        state.pitching =
            false;

        const game =
            getGame();

        if (!game) {
            return;
        }

        const gameState =
            game.getState();

        if (
            !gameState.currentPitch
        ) {
            return;
        }

        const result =
            evaluatePitch(
                gameState
            );

        state.lastResult =
            result;

        applyPitchResult(
            result,
            gameState
        );

        if (
            elements.ball
        ) {
            elements.ball.classList.remove(
                "active"
            );
        }

        if (
            typeof game.save ===
            "function"
        ) {
            game.save();
        }
    }

    /* =========================================================
       투구 결과
       ========================================================= */

    function evaluatePitch(
        gameState
    ) {
        const pitch =
            gameState.currentPitch;

        const distance =
            Math.sqrt(
                Math.pow(
                    pitch.x - 50,
                    2
                ) +
                Math.pow(
                    pitch.y - 50,
                    2
                )
            );

        /*
         * 스트라이크 존
         */

        if (
            distance <= 38
        ) {
            /*
             * 아주 좋은 제구
             */

            if (
                state.lastControl >= 90 &&
                chance(18)
            ) {
                return "perfect_strike";
            }

            /*
             * 일반 스트라이크
             */

            return "strike";
        }

        /*
         * 스트라이크 존 바깥
         */

        return "ball";
    }

    /* =========================================================
       결과 적용
       ========================================================= */

    function applyPitchResult(
        result,
        gameState
    ) {
        switch (result) {
            case "perfect_strike":
                gameState.strikes++;

                toast(
                    "완벽한 제구! 스트라이크"
                );

                break;

            case "strike":
                gameState.strikes++;

                toast(
                    "스트라이크"
                );

                break;

            case "ball":
                gameState.balls++;

                toast(
                    "볼"
                );

                break;
        }

        /*
         * 삼진
         */

        if (
            gameState.strikes >= 3
        ) {
            gameState.outs++;

            gameState.strikes =
                0;

            gameState.balls =
                0;

            toast(
                "삼진 아웃!"
            );
        }

        /*
         * 볼넷
         */

        if (
            gameState.balls >= 4
        ) {
            gameState.balls =
                0;

            gameState.strikes =
                0;

            forceWalk(
                gameState
            );

            toast(
                "볼넷"
            );
        }

        /*
         * 3아웃
         */

        if (
            gameState.outs >= 3
        ) {
            gameState.outs =
                0;

            gameState.balls =
                0;

            gameState.strikes =
                0;

            gameState.bases = {
                first: null,
                second: null,
                third: null
            };

            gameState.half =
                gameState.half ===
                "top"
                    ? "bottom"
                    : "top";

            if (
                gameState.half ===
                "top"
            ) {
                gameState.inning++;
            }

            /*
             * 선수 역할에 따라
             * 다음 모드 결정
             */

            if (
                gameState.half ===
                "top"
            ) {
                gameState.mode =
                    "batting";
            } else {
                gameState.mode =
                    "pitching";
            }

            toast(
                gameState.inning +
                "회 " +
                (
                    gameState.half ===
                    "top"
                        ? "초"
                        : "말"
                )
            );
        }

        gameState.currentPitch.active =
            false;
    }

    /* =========================================================
       볼넷
       ========================================================= */

    function forceWalk(
        gameState
    ) {
        if (
            gameState.bases.first
        ) {
            if (
                gameState.bases.second
            ) {
                if (
                    gameState.bases.third
                ) {
                    if (
                        gameState.half ===
                        "top"
                    ) {
                        gameState.awayScore++;
                    } else {
                        gameState.homeScore++;
                    }

                    gameState.playerStats.runs++;
                } else {
                    gameState.bases.third =
                        gameState.bases.second;
                }
            }

            gameState.bases.second =
                gameState.bases.first;
        }

        gameState.bases.first =
            "player";
    }

    /* =========================================================
       키보드
       ========================================================= */

    function handleKeyboard(
        event
    ) {
        const game =
            getGame();

        if (!game) {
            return;
        }

        const gameState =
            game.getState();

        if (
            gameState.mode !==
            "pitching"
        ) {
            return;
        }

        const key =
            event.key.toLowerCase();

        const step = 4;

        if (
            key === "arrowleft" ||
            key === "a"
        ) {
            event.preventDefault();

            moveAim(
                -step,
                0
            );
        }

        if (
            key === "arrowright" ||
            key === "d"
        ) {
            event.preventDefault();

            moveAim(
                step,
                0
            );
        }

        if (
            key === "arrowup" ||
            key === "w"
        ) {
            event.preventDefault();

            moveAim(
                0,
                -step
            );
        }

        if (
            key === "arrowdown" ||
            key === "s"
        ) {
            event.preventDefault();

            moveAim(
                0,
                step
            );
        }

        /*
         * 숫자키로 구종 선택
         */

        if (key === "1") {
            selectPitch(
                "fastball"
            );
        }

        if (key === "2") {
            selectPitch(
                "slider"
            );
        }

        if (key === "3") {
            selectPitch(
                "curveball"
            );
        }

        if (key === "4") {
            selectPitch(
                "changeup"
            );
        }

        /*
         * 스페이스 / 엔터로 투구
         */

        if (
            key === " " ||
            key === "enter"
        ) {
            event.preventDefault();

            pitch();
        }
    }

    /* =========================================================
       공개 API
       ========================================================= */

    RTTS.pitching = {
        init:
            init,

        pitch:
            pitch,

        selectPitch:
            selectPitch,

        moveAim:
            moveAim,

        setAim:
            setAim,

        getState:
            function () {
                return state;
            },

        getPitchData:
            function (type) {
                return PITCHES[type] ||
                    null;
            },

        getPitches:
            function () {
                return PITCHES;
            }
    };

    window.rttsPitch =
        pitch;

    window.rttsSelectPitch =
        selectPitch;

    document.addEventListener(
        "DOMContentLoaded",
        function () {
            init();
        }
    );

})();
```
