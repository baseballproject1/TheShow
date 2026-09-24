```javascript
/* =========================================================
   RTTS Baseball Game
   js/batting.js
   타격 시스템
   ---------------------------------------------------------
   - 타격 조준
   - 타격 타이밍
   - 투구 궤적
   - 스윙 판정
   - 컨택 / 파워 / 클러치 스탯 반영
   - 장타 / 안타 / 파울 / 헛스윙
   - 좌우 타격 보정
   - 모바일 터치 및 키보드 지원
   ========================================================= */

(function () {
    "use strict";

    const RTTS = window.RTTS || (window.RTTS = {});

    let state = {
        initialized: false,
        swingLocked: false,
        pitchActive: false,
        pitchStartedAt: 0,
        pitchDuration: 850,
        lastPitchResult: "",
        contactQuality: 0,
        timingQuality: 0,
        locationQuality: 0
    };

    let elements = {};

    const DEFAULT_PITCH_SPEED = {
        fastball: 650,
        slider: 780,
        curveball: 920,
        changeup: 860
    };

    const RESULT_TEXT = {
        perfect: "완벽한 타이밍!",
        great: "좋은 타격!",
        good: "좋은 타구!",
        late: "늦었습니다",
        early: "빠른 타이밍",
        miss: "헛스윙",
        foul: "파울",
        single: "안타!",
        double: "2루타!",
        triple: "3루타!",
        homerun: "홈런!"
    };

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

    function getStat(stat) {
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
                stat
            );
        }

        const base =
            player.stats &&
            typeof player.stats[stat] ===
                "number"
                ? player.stats[stat]
                : 0;

        return base;
    }

    /* =========================================================
       DOM
       ========================================================= */

    function cacheElements() {
        elements = {
            zone:
                document.getElementById(
                    "battingZone"
                ),

            cursor:
                document.getElementById(
                    "battingCursor"
                ),

            ball:
                document.getElementById(
                    "ball"
                ),

            field:
                document.getElementById(
                    "fieldCanvas"
                ),

            swing:
                document.getElementById(
                    "swingButton"
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

        resetBattingState();
    }

    function bindEvents() {
        if (!elements.swing) {
            return;
        }

        elements.swing.addEventListener(
            "click",
            function (event) {
                event.preventDefault();
                swing();
            }
        );

        elements.swing.addEventListener(
            "touchstart",
            function (event) {
                event.preventDefault();
                swing();
            },
            {
                passive: false
            }
        );
    }

    /* =========================================================
       타격 상태
       ========================================================= */

    function resetBattingState() {
        state.pitchActive = false;
        state.swingLocked = false;
        state.pitchStartedAt = 0;
        state.lastPitchResult = "";
        state.contactQuality = 0;
        state.timingQuality = 0;
        state.locationQuality = 0;

        const game =
            getGame();

        if (!game) {
            return;
        }

        if (game.batting) {
            game.batting.cursorX = 50;
            game.batting.cursorY = 50;
            game.batting.swingPressed = false;
            game.batting.swingCooldown = false;
        }
    }

    /* =========================================================
       투구 시작
       ========================================================= */

    function startPitch(
        pitchType,
        x,
        y
    ) {
        const game =
            getGame();

        if (!game) {
            return;
        }

        if (!game.getState) {
            return;
        }

        const gameState =
            game.getState();

        if (
            gameState.mode !==
            "batting"
        ) {
            return;
        }

        const duration =
            DEFAULT_PITCH_SPEED[
                pitchType
            ] ||
            800;

        state.pitchActive = true;
        state.pitchStartedAt =
            performance.now();

        state.pitchDuration =
            duration;

        gameState.currentPitch = {
            type:
                pitchType ||
                "fastball",

            x:
                clamp(
                    typeof x ===
                        "number"
                        ? x
                        : 50,
                    0,
                    100
                ),

            y:
                clamp(
                    typeof y ===
                        "number"
                        ? y
                        : 50,
                    0,
                    100
                ),

            active: true
        };

        animatePitch();
    }

    function animatePitch() {
        if (!state.pitchActive) {
            return;
        }

        const game =
            getGame();

        if (!game) {
            return;
        }

        const gameState =
            game.getState();

        if (
            !gameState.currentPitch.active
        ) {
            state.pitchActive = false;
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

        moveBall(progress);

        if (progress >= 1) {
            state.pitchActive =
                false;

            gameState.currentPitch.active =
                false;

            resolvePitchWithoutSwing();

            return;
        }

        requestAnimationFrame(
            animatePitch
        );
    }

    function moveBall(progress) {
        if (!elements.ball) {
            return;
        }

        const game =
            getGame();

        if (!game) {
            return;
        }

        const pitch =
            game.getState()
                .currentPitch;

        if (!pitch) {
            return;
        }

        /*
         * 투수가 공을 던지는 위치에서
         * 홈플레이트 쪽으로 이동하는 느낌을
         * 2D UI로 표현한다.
         */

        const startX = 50;
        const startY = 8;

        const endX =
            pitch.x;

        const endY =
            pitch.y;

        const x =
            startX +
            (endX - startX) *
                progress;

        const y =
            startY +
            (endY - startY) *
                progress;

        elements.ball.style.left =
            x + "%";

        elements.ball.style.top =
            y + "%";

        elements.ball.classList.add(
            "active"
        );
    }

    /* =========================================================
       자동 투구
       ========================================================= */

    function generatePitch() {
        const game =
            getGame();

        if (!game) {
            return;
        }

        const gameState =
            game.getState();

        if (
            gameState.mode !==
            "batting"
        ) {
            return;
        }

        if (
            state.pitchActive ||
            gameState.currentPitch.active
        ) {
            return;
        }

        const pitchTypes = [
            "fastball",
            "slider",
            "curveball",
            "changeup"
        ];

        const pitchType =
            pitchTypes[
                Math.floor(
                    Math.random() *
                    pitchTypes.length
                )
            ];

        /*
         * 스트라이크 존 주변에 공을 생성한다.
         * 일부는 존 밖으로 생성되어 볼이 된다.
         */

        const x =
            random(20, 80);

        const y =
            random(20, 80);

        startPitch(
            pitchType,
            x,
            y
        );
    }

    /* =========================================================
       스윙
       ========================================================= */

    function swing() {
        const game =
            getGame();

        if (!game) {
            return null;
        }

        const gameState =
            game.getState();

        if (
            gameState.mode !==
            "batting"
        ) {
            return null;
        }

        if (
            state.swingLocked
        ) {
            return null;
        }

        state.swingLocked = true;

        setTimeout(
            function () {
                state.swingLocked =
                    false;
            },
            230
        );

        if (
            !gameState.currentPitch ||
            !gameState.currentPitch.active
        ) {
            /*
             * 투구가 아직 시작되지 않았으면
             * 바로 새로운 공을 만든다.
             */
            generatePitch();

            setTimeout(
                function () {
                    swing();
                },
                90
            );

            return null;
        }

        const timing =
            calculateTiming();

        const location =
            calculateLocation();

        const contact =
            calculateContact(
                timing,
                location
            );

        state.timingQuality =
            timing;

        state.locationQuality =
            location;

        state.contactQuality =
            contact;

        const result =
            calculateResult(
                contact,
                timing,
                location
            );

        state.lastPitchResult =
            result;

        applyResult(
            result,
            contact,
            timing,
            location
        );

        return result;
    }

    /* =========================================================
       타이밍 계산
       ========================================================= */

    function calculateTiming() {
        const game =
            getGame();

        if (!game) {
            return 0;
        }

        const gameState =
            game.getState();

        const pitch =
            gameState.currentPitch;

        if (!pitch) {
            return 0;
        }

        const now =
            performance.now();

        const elapsed =
            now -
            state.pitchStartedAt;

        const progress =
            clamp(
                elapsed /
                    state.pitchDuration,
                0,
                1
            );

        /*
         * 0.82~0.98 정도가 가장 좋은 타이밍.
         */

        const ideal =
            0.90;

        const distance =
            Math.abs(
                progress -
                ideal
            );

        return clamp(
            100 -
                distance * 520,
            0,
            100
        );
    }

    /* =========================================================
       위치 계산
       ========================================================= */

    function calculateLocation() {
        const game =
            getGame();

        if (!game) {
            return 0;
        }

        const gameState =
            game.getState();

        const pitch =
            gameState.currentPitch;

        if (!pitch) {
            return 0;
        }

        const cursorX =
            gameState.batting.cursorX;

        const cursorY =
            gameState.batting.cursorY;

        const dx =
            cursorX -
            pitch.x;

        const dy =
            cursorY -
            pitch.y;

        const distance =
            Math.sqrt(
                dx * dx +
                dy * dy
            );

        return clamp(
            100 -
                distance * 2.2,
            0,
            100
        );
    }

    /* =========================================================
       컨택 계산
       ========================================================= */

    function calculateContact(
        timing,
        location
    ) {
        const contact =
            getStat("contact");

        const clutch =
            getStat("clutch");

        let value =
            timing * 0.42 +
            location * 0.38 +
            contact * 0.15 +
            clutch * 0.05;

        value +=
            random(-5, 5);

        return clamp(
            value,
            0,
            100
        );
    }

    /* =========================================================
       결과 계산
       ========================================================= */

    function calculateResult(
        contact,
        timing,
        location
    ) {
        const power =
            getStat("power");

        const contactStat =
            getStat("contact");

        const clutch =
            getStat("clutch");

        /*
         * 완벽한 타격
         */

        if (
            contact >= 93 &&
            timing >= 92 &&
            location >= 92
        ) {
            const homeRunChance =
                12 +
                power * 0.45;

            if (
                chance(
                    homeRunChance
                )
            ) {
                return "homerun";
            }

            if (
                chance(
                    28 +
                    power * 0.2
                )
            ) {
                return "double";
            }

            return "single";
        }

        /*
         * 매우 좋은 타격
         */

        if (
            contact >= 80
        ) {
            const powerRoll =
                random(0, 100);

            const homeRunChance =
                4 +
                power * 0.32;

            if (
                powerRoll <
                homeRunChance
            ) {
                return "homerun";
            }

            if (
                powerRoll <
                30 +
                power * 0.25
            ) {
                return "double";
            }

            if (
                chance(
                    5 +
                    power * 0.08
                )
            ) {
                return "triple";
            }

            return "single";
        }

        /*
         * 보통 타격
         */

        if (
            contact >= 63
        ) {
            if (
                chance(
                    12 +
                    power * 0.2
                )
            ) {
                return "double";
            }

            return "single";
        }

        /*
         * 낮은 컨택
         */

        if (
            contact >= 48
        ) {
            if (
                chance(
                    34 +
                    contactStat * 0.25 +
                    clutch * 0.08
                )
            ) {
                return "foul";
            }

            return "out";
        }

        /*
         * 매우 낮은 컨택
         */

        if (
            timing < 35
        ) {
            return "miss";
        }

        return chance(25)
            ? "foul"
            : "out";
    }

    /* =========================================================
       결과 적용
       ========================================================= */

    function applyResult(
        result,
        contact,
        timing,
        location
    ) {
        const game =
            getGame();

        if (!game) {
            return;
        }

        const gameState =
            game.getState();

        /*
         * 다음 투구를 준비할 수 있도록
         * 현재 공을 종료한다.
         */

        gameState.currentPitch.active =
            false;

        state.pitchActive = false;

        if (
            elements.ball
        ) {
            elements.ball.classList.remove(
                "active"
            );
        }

        /*
         * game.js의 기본 판정 엔진과 연결
         */

        switch (result) {
            case "homerun":
                processBaseResult(
                    game,
                    "homerun"
                );

                toast(
                    RESULT_TEXT.homerun
                );

                break;

            case "triple":
                processBaseResult(
                    game,
                    "triple"
                );

                toast(
                    RESULT_TEXT.triple
                );

                break;

            case "double":
                processBaseResult(
                    game,
                    "double"
                );

                toast(
                    RESULT_TEXT.double
                );

                break;

            case "single":
                processBaseResult(
                    game,
                    "single"
                );

                toast(
                    RESULT_TEXT.single
                );

                break;

            case "foul":
                gameState.strikes =
                    Math.min(
                        gameState.strikes + 1,
                        2
                    );

                toast(
                    RESULT_TEXT.foul
                );

                break;

            case "miss":
                gameState.strikes++;

                toast(
                    RESULT_TEXT.miss
                );

                if (
                    gameState.strikes >= 3
                ) {
                    gameState.outs++;
                    gameState.strikes = 0;
                    gameState.balls = 0;

                    toast(
                        "삼진 아웃"
                    );

                    if (
                        gameState.outs >= 3
                    ) {
                        if (
                            typeof game.setMode ===
                            "function"
                        ) {
                            game.setMode(
                                "pitching"
                            );
                        }
                    }
                }

                break;

            case "out":
                gameState.outs++;

                gameState.strikes = 0;
                gameState.balls = 0;

                toast(
                    "타구 아웃"
                );

                if (
                    gameState.outs >= 3
                ) {
                    if (
                        typeof game.setMode ===
                        "function"
                    ) {
                        game.setMode(
                            "pitching"
                        );
                    }
                }

                break;
        }

        if (
            typeof game.save ===
            "function"
        ) {
            game.save();
        }

        updateHitVisual(
            result,
            contact,
            timing,
            location
        );
    }

    /* =========================================================
       실제 경기 엔진 연결
       ========================================================= */

    function processBaseResult(
        game,
        result
    ) {
        /*
         * game.js의 내부 함수는 직접 노출되지 않기 때문에
         * 게임 상태를 이용하여 기록한다.
         */

        const state =
            game.getState();

        const playerStats =
            state.playerStats;

        playerStats.hits++;
        playerStats.atBats++;
        playerStats.plateAppearances++;

        if (
            result === "single"
        ) {
            playerStats.singles++;
            advanceBases(
                game,
                1
            );
        }

        if (
            result === "double"
        ) {
            playerStats.doubles++;
            advanceBases(
                game,
                2
            );
        }

        if (
            result === "triple"
        ) {
            playerStats.triples++;
            advanceBases(
                game,
                3
            );
        }

        if (
            result === "homerun"
        ) {
            playerStats.homeRuns++;

            let runs = 1;

            if (
                state.bases.first
            ) {
                runs++;
            }

            if (
                state.bases.second
            ) {
                runs++;
            }

            if (
                state.bases.third
            ) {
                runs++;
            }

            if (
                state.half ===
                "top"
            ) {
                state.awayScore +=
                    runs;
            } else {
                state.homeScore +=
                    runs;
            }

            playerStats.runs +=
                runs;

            state.bases = {
                first: null,
                second: null,
                third: null
            };
        }

        state.balls = 0;
        state.strikes = 0;
    }

    function advanceBases(
        game,
        bases
    ) {
        const state =
            game.getState();

        const old =
            Object.assign(
                {},
                state.bases
            );

        state.bases = {
            first: null,
            second: null,
            third: null
        };

        let runs = 0;

        if (
            old.third
        ) {
            runs++;
        }

        if (
            old.second
        ) {
            if (
                bases >= 2
            ) {
                runs++;
            } else {
                state.bases.third =
                    old.second;
            }
        }

        if (
            old.first
        ) {
            if (
                bases >= 2
            ) {
                state.bases.third =
                    state.bases.third ||
                    old.first;
            } else {
                state.bases.second =
                    old.first;
            }
        }

        if (
            bases === 1
        ) {
            state.bases.first =
                "player";
        }

        if (
            bases === 2
        ) {
            state.bases.second =
                "player";
        }

        if (
            bases === 3
        ) {
            state.bases.third =
                "player";
        }

        if (
            runs > 0
        ) {
            if (
                state.half ===
                "top"
            ) {
                state.awayScore +=
                    runs;
            } else {
                state.homeScore +=
                    runs;
            }

            state.playerStats.runs +=
                runs;
        }
    }

    /* =========================================================
       투구가 끝났는데 스윙하지 않은 경우
       ========================================================= */

    function resolvePitchWithoutSwing() {
        const game =
            getGame();

        if (!game) {
            return;
        }

        const state =
            game.getState();

        /*
         * 스트라이크 존에 들어온 공인지 계산
         */

        const x =
            state.currentPitch.x;

        const y =
            state.currentPitch.y;

        const distance =
            Math.sqrt(
                Math.pow(
                    x - 50,
                    2
                ) +
                Math.pow(
                    y - 50,
                    2
                )
            );

        if (
            distance <= 38
        ) {
            state.strikes++;

            toast(
                "스트라이크"
            );

            if (
                state.strikes >= 3
            ) {
                state.outs++;

                state.strikes = 0;
                state.balls = 0;

                toast(
                    "삼진 아웃"
                );
            }
        } else {
            state.balls++;

            toast(
                "볼"
            );

            if (
                state.balls >= 4
            ) {
                state.balls = 0;
                state.strikes = 0;

                toast(
                    "볼넷"
                );
            }
        }

        if (
            state.outs >= 3
        ) {
            if (
                typeof game.setMode ===
                "function"
            ) {
                game.setMode(
                    "pitching"
                );
            }
        }

        if (
            typeof game.save ===
            "function"
        ) {
            game.save();
        }
    }

    /* =========================================================
       타격 시각 효과
       ========================================================= */

    function updateHitVisual(
        result,
        contact,
        timing,
        location
    ) {
        if (!elements.field) {
            return;
        }

        elements.field.dataset.hitResult =
            result;

        elements.field.dataset.contact =
            Math.round(
                contact
            );

        elements.field.dataset.timing =
            Math.round(
                timing
            );

        elements.field.dataset.location =
            Math.round(
                location
            );

        setTimeout(
            function () {
                if (
                    elements.field
                ) {
                    delete elements
                        .field
                        .dataset
                        .hitResult;
                }
            },
            700
        );
    }

    /* =========================================================
       외부 API
       ========================================================= */

    RTTS.batting = {
        init: init,

        swing: swing,

        generatePitch:
            generatePitch,

        startPitch:
            startPitch,

        reset:
            resetBattingState,

        getState:
            function () {
                return state;
            },

        getTiming:
            calculateTiming,

        getLocation:
            calculateLocation,

        getContact:
            calculateContact
    };

    window.rttsSwing =
        swing;

    window.rttsGeneratePitch =
        generatePitch;

    document.addEventListener(
        "DOMContentLoaded",
        function () {
            init();
        }
    );

})();
```
