```javascript
/* =========================================================
   RTTS - Baserunning System
   js/baserunning.js
   ========================================================= */

(() => {
    "use strict";

    const BASERUNNING_KEY = "rtts_baserunning_state";

    const DEFAULT_STATE = {
        active: false,

        runners: {
            first: false,
            second: false,
            third: false
        },

        selectedRunner: null,

        runnerPositions: {
            first: 1,
            second: 2,
            third: 3
        },

        stealing: false,
        sliding: false,

        lastAction: "",
        lastResult: ""
    };

    let state = { ...DEFAULT_STATE };

    let joystick = null;
    let runnerElements = {};

    let animationId = null;
    let lastTime = 0;

    /* ---------------------------------------------------------
       Utility
       --------------------------------------------------------- */

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function saveState() {
        try {
            localStorage.setItem(
                BASERUNNING_KEY,
                JSON.stringify(state)
            );
        } catch {
            // 저장 실패 시 게임 진행은 계속
        }
    }

    function loadState() {
        try {
            const saved =
                localStorage.getItem(BASERUNNING_KEY);

            if (!saved) {
                state = {
                    ...DEFAULT_STATE,
                    runners: {
                        ...DEFAULT_STATE.runners
                    },
                    runnerPositions: {
                        ...DEFAULT_STATE.runnerPositions
                    }
                };
                return;
            }

            const parsed = JSON.parse(saved);

            state = {
                ...DEFAULT_STATE,
                ...parsed,
                runners: {
                    ...DEFAULT_STATE.runners,
                    ...(parsed.runners || {})
                },
                runnerPositions: {
                    ...DEFAULT_STATE.runnerPositions,
                    ...(parsed.runnerPositions || {})
                }
            };
        } catch {
            state = {
                ...DEFAULT_STATE,
                runners: {
                    ...DEFAULT_STATE.runners
                },
                runnerPositions: {
                    ...DEFAULT_STATE.runnerPositions
                }
            };
        }
    }

    function showMessage(message, type = "") {
        if (window.showToast) {
            window.showToast(message, type);
            return;
        }

        const toast =
            document.getElementById("toast");

        if (!toast) {
            return;
        }

        toast.textContent = message;
        toast.classList.remove("hidden");

        clearTimeout(showMessage.timer);

        showMessage.timer = setTimeout(() => {
            toast.classList.add("hidden");
        }, 1400);
    }

    function getPlayer() {
        if (window.RTTS?.player?.get) {
            return window.RTTS.player.get();
        }

        if (window.getCurrentPlayer) {
            return window.getCurrentPlayer();
        }

        try {
            return JSON.parse(
                localStorage.getItem(
                    "rtts_current_player"
                )
            );
        } catch {
            return null;
        }
    }

    function getBaserunningStat() {
        const player = getPlayer();

        if (!player) {
            return 0;
        }

        if (
            window.RTTS?.player
                ?.getEffectiveStat
        ) {
            return Number(
                window.RTTS.player.getEffectiveStat(
                    "baserunning"
                )
            ) || 0;
        }

        return Number(
            player.stats?.baserunning
        ) || 0;
    }

    /* ---------------------------------------------------------
       DOM
       --------------------------------------------------------- */

    function cacheElements() {
        joystick =
            document.getElementById(
                "runningJoystick"
            );

        runnerElements = {
            first:
                document.querySelector(
                    '[data-runner="first"]'
                ),

            second:
                document.querySelector(
                    '[data-runner="second"]'
                ),

            third:
                document.querySelector(
                    '[data-runner="third"]'
                )
        };
    }

    /* ---------------------------------------------------------
       Speed / success
       --------------------------------------------------------- */

    function getRunnerSpeed() {
        const stat = getBaserunningStat();

        return 0.8 + stat * 0.006;
    }

    function getStealSuccess() {
        const stat = getBaserunningStat();

        return clamp(
            0.55 + stat * 0.003,
            0.55,
            0.97
        );
    }

    function getSlideSuccess() {
        const stat = getBaserunningStat();

        return clamp(
            0.72 + stat * 0.002,
            0.72,
            0.98
        );
    }

    /* ---------------------------------------------------------
       Runner display
       --------------------------------------------------------- */

    function updateRunnerUI() {
        Object.keys(runnerElements)
            .forEach(base => {
                const element =
                    runnerElements[base];

                if (!element) {
                    return;
                }

                element.classList.toggle(
                    "active",
                    !!state.runners[base]
                );

                element.classList.toggle(
                    "selected",
                    state.selectedRunner === base
                );
            });
    }

    /* ---------------------------------------------------------
       Base state
       --------------------------------------------------------- */

    function setRunners(first, second, third) {
        state.runners.first = !!first;
        state.runners.second = !!second;
        state.runners.third = !!third;

        updateRunnerUI();
        saveState();
    }

    function clearBases() {
        setRunners(
            false,
            false,
            false
        );

        state.selectedRunner = null;
        state.stealing = false;
        state.sliding = false;

        saveState();
    }

    function addRunner(base) {
        if (!state.runners[base]) {
            state.runners[base] = true;
            updateRunnerUI();
            saveState();
        }
    }

    function removeRunner(base) {
        if (state.runners[base]) {
            state.runners[base] = false;

            if (
                state.selectedRunner === base
            ) {
                state.selectedRunner = null;
            }

            updateRunnerUI();
            saveState();
        }
    }

    /* ---------------------------------------------------------
       Runner selection
       --------------------------------------------------------- */

    function selectRunner(base) {
        if (!state.active) {
            return false;
        }

        if (!state.runners[base]) {
            showMessage(
                "해당 베이스에 주자가 없습니다."
            );

            return false;
        }

        state.selectedRunner = base;

        updateRunnerUI();
        saveState();

        return true;
    }

    function selectNearestRunner(direction) {
        const order =
            direction === "forward"
                ? ["third", "second", "first"]
                : ["first", "second", "third"];

        for (const base of order) {
            if (state.runners[base]) {
                selectRunner(base);
                return base;
            }
        }

        return null;
    }

    /* ---------------------------------------------------------
       Base advancement
       --------------------------------------------------------- */

    function moveRunner(
        from,
        to,
        options = {}
    ) {
        if (!state.runners[from]) {
            return false;
        }

        state.runners[from] = false;

        if (to === "home") {
            scoreRun(options.rbi === true);
        } else {
            state.runners[to] = true;
        }

        state.runnerPositions[from] =
            Number(to === "home" ? 4 : to);

        state.lastAction =
            `${from}->${to}`;

        updateRunnerUI();
        saveState();

        return true;
    }

    function advanceAllRunners(bases) {
        const newRunners = {
            first: false,
            second: false,
            third: false
        };

        const order = [
            {
                base: "third",
                value: 3
            },
            {
                base: "second",
                value: 2
            },
            {
                base: "first",
                value: 1
            }
        ];

        order.forEach(runner => {
            if (!state.runners[runner.base]) {
                return;
            }

            const destination =
                runner.value + bases;

            if (destination >= 4) {
                scoreRun();
            } else if (destination === 3) {
                newRunners.third = true;
            } else if (destination === 2) {
                newRunners.second = true;
            } else {
                newRunners.first = true;
            }
        });

        state.runners = newRunners;

        updateRunnerUI();
        saveState();
    }

    function scoreRun() {
        const game =
            window.RTTS?.game;

        if (
            game?.state &&
            game.state.scores
        ) {
            if (
                game.state.half ===
                "bottom"
            ) {
                game.state.scores.home += 1;
            } else {
                game.state.scores.away += 1;
            }

            if (
                game.updateUI
            ) {
                game.updateUI();
            }
        }

        state.lastResult = "run";

        recordRun();

        showMessage("주자 홈인!");
    }

    function recordRun() {
        const player = getPlayer();

        if (
            !player ||
            !window.RTTS?.player
        ) {
            return;
        }

        if (
            typeof window.RTTS.player
                .recordStat === "function"
        ) {
            window.RTTS.player.recordStat(
                "runs",
                1
            );
        }
    }

    /* ---------------------------------------------------------
       Stealing
       --------------------------------------------------------- */

    function steal() {
        if (!state.active) {
            return false;
        }

        const base =
            state.selectedRunner ||
            selectNearestRunner("forward");

        if (!base) {
            showMessage(
                "도루할 주자가 없습니다."
            );

            return false;
        }

        if (base === "third") {
            showMessage(
                "더 이상 도루할 베이스가 없습니다."
            );

            return false;
        }

        if (state.stealing) {
            return false;
        }

        state.stealing = true;
        state.lastAction = "steal";

        const success =
            Math.random() <=
            getStealSuccess();

        setTimeout(() => {
            state.stealing = false;

            if (!success) {
                state.lastResult =
                    "caught-stealing";

                state.runners[base] = false;

                state.selectedRunner = null;

                updateRunnerUI();
                saveState();

                showMessage(
                    "도루 실패! 아웃!"
                );

                registerOut();

                return;
            }

            const nextBase =
                base === "first"
                    ? "second"
                    : "third";

            state.runners[base] = false;
            state.runners[nextBase] = true;
            state.selectedRunner =
                nextBase;

            state.lastResult =
                "steal-success";

            updateRunnerUI();
            saveState();

            showMessage(
                `${getBaseName(nextBase)} 도루 성공!`
            );
        }, 650);

        return true;
    }

    function getBaseName(base) {
        const names = {
            first: "1루",
            second: "2루",
            third: "3루",
            home: "홈"
        };

        return names[base] || base;
    }

    /* ---------------------------------------------------------
       Sliding
       --------------------------------------------------------- */

    function slide(base = null) {
        if (!state.active) {
            return false;
        }

        const selected =
            base ||
            state.selectedRunner;

        if (!selected) {
            return false;
        }

        if (!state.runners[selected]) {
            return false;
        }

        state.sliding = true;

        const success =
            Math.random() <=
            getSlideSuccess();

        setTimeout(() => {
            state.sliding = false;

            state.lastAction = "slide";

            if (success) {
                state.lastResult =
                    "safe-slide";

                showMessage(
                    "세이프!"
                );
            } else {
                state.lastResult =
                    "out-slide";

                state.runners[selected] =
                    false;

                state.selectedRunner = null;

                registerOut();

                showMessage(
                    "태그 아웃!"
                );
            }

            updateRunnerUI();
            saveState();
        }, 350);

        return true;
    }

    /* ---------------------------------------------------------
       Out
       --------------------------------------------------------- */

    function registerOut() {
        const game =
            window.RTTS?.game;

        if (
            game?.state
        ) {
            game.state.outs =
                clamp(
                    Number(game.state.outs || 0) + 1,
                    0,
                    3
                );

            if (
                game.updateUI
            ) {
                game.updateUI();
            }
        }

        state.lastResult = "out";

        saveState();

        if (
            window.RTTS?.game
                ?.changeHalfInning
        ) {
            if (
                window.RTTS.game.state.outs >=
                3
            ) {
                window.RTTS.game
                    .changeHalfInning();
            }
        }
    }

    /* ---------------------------------------------------------
       Batting result integration
       --------------------------------------------------------- */

    function handleHit(detail = {}) {
        if (!state.active) {
            return;
        }

        const result =
            detail.result || "single";

        const bases = {
            single: 1,
            double: 2,
            triple: 3,
            homerun: 4,
            home_run: 4
        };

        const advance =
            bases[result] ?? 1;

        if (advance >= 4) {
            advanceAllRunners(4);
            return;
        }

        advanceAllRunners(advance);

        if (
            advance === 1 &&
            detail.playerHit !== false
        ) {
            state.runners.first = true;
        } else if (
            advance === 2
        ) {
            state.runners.second = true;
        } else if (
            advance === 3
        ) {
            state.runners.third = true;
        }

        updateRunnerUI();
        saveState();
    }

    function handleWalk() {
        if (!state.active) {
            return;
        }

        if (state.runners.first) {
            if (state.runners.second) {
                if (state.runners.third) {
                    scoreRun();
                }

                state.runners.third =
                    true;
            }

            state.runners.second =
                true;
        }

        state.runners.first = true;

        updateRunnerUI();
        saveState();
    }

    /* ---------------------------------------------------------
       Joystick
       --------------------------------------------------------- */

    function getJoystickDirection() {
        if (!joystick) {
            return {
                x: 0,
                y: 0
            };
        }

        const knob =
            joystick.querySelector(
                ".joystick-knob"
            );

        if (!knob) {
            return {
                x: 0,
                y: 0
            };
        }

        const rect =
            joystick.getBoundingClientRect();

        const centerX =
            rect.left +
            rect.width / 2;

        const centerY =
            rect.top +
            rect.height / 2;

        const knobRect =
            knob.getBoundingClientRect();

        const knobX =
            knobRect.left +
            knobRect.width / 2;

        const knobY =
            knobRect.top +
            knobRect.height / 2;

        const maxDistance =
            Math.max(
                1,
                Math.min(
                    rect.width,
                    rect.height
                ) * 0.35
            );

        return {
            x: clamp(
                (knobX - centerX) /
                maxDistance,
                -1,
                1
            ),

            y: clamp(
                (knobY - centerY) /
                maxDistance,
                -1,
                1
            )
        };
    }

    function updateJoystickMovement(
        deltaSeconds
    ) {
        if (
            !state.active ||
            !state.selectedRunner
        ) {
            return;
        }

        const direction =
            getJoystickDirection();

        if (
            Math.abs(direction.x) < 0.05 &&
            Math.abs(direction.y) < 0.05
        ) {
            return;
        }

        /*
         * RTTS에서는 주자의 실제 위치를
         * 화면상으로 이동시키는 대신
         * 선택된 주자의 주루 의도를 기록한다.
         */
        const speed =
            getRunnerSpeed();

        if (
            direction.x > 0.65
        ) {
            state.lastAction =
                "advance";
        } else if (
            direction.x < -0.65
        ) {
            state.lastAction =
                "retreat";
        }

        if (
            direction.y < -0.65
        ) {
            state.lastAction =
                "advance";
        }

        if (
            direction.y > 0.65
        ) {
            state.lastAction =
                "retreat";
        }

        // 주루 속도에 따른 반응값
        state.runnerSpeed =
            speed;

        saveState();
    }

    /* ---------------------------------------------------------
       Base button controls
       --------------------------------------------------------- */

    function bindBaseButtons() {
        const buttons =
            document.querySelectorAll(
                "[data-base]"
            );

        buttons.forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    const base =
                        button.dataset.base;

                    if (
                        ["1", "2", "3"]
                            .includes(base)
                    ) {
                        const baseName = {
                            "1": "first",
                            "2": "second",
                            "3": "third"
                        }[base];

                        selectRunner(baseName);
                    }

                    if (base === "home") {
                        const selected =
                            state.selectedRunner;

                        if (selected) {
                            moveRunner(
                                selected,
                                "home"
                            );
                        }
                    }
                }
            );
        });
    }

    /* ---------------------------------------------------------
       Keyboard
       --------------------------------------------------------- */

    function handleKeyboard(event) {
        if (!state.active) {
            return;
        }

        const key =
            event.key.toLowerCase();

        switch (key) {
            case "1":
                selectRunner("first");
                break;

            case "2":
                selectRunner("second");
                break;

            case "3":
                selectRunner("third");
                break;

            case "s":
                steal();
                break;

            case " ":
                slide();
                event.preventDefault();
                break;

            case "arrowright":
            case "d":
                if (state.selectedRunner) {
                    moveRunner(
                        state.selectedRunner,
                        getNextBase(
                            state.selectedRunner
                        )
                    );
                }
                break;

            case "arrowleft":
            case "a":
                retreatRunner();
                break;

            default:
                return;
        }

        event.preventDefault();
    }

    function getNextBase(base) {
        if (base === "first") {
            return "second";
        }

        if (base === "second") {
            return "third";
        }

        return "home";
    }

    function retreatRunner() {
        const base =
            state.selectedRunner;

        if (!base) {
            return;
        }

        if (base === "third") {
            if (!state.runners.second) {
                moveRunner(
                    "third",
                    "second"
                );
            }
        } else if (
            base === "second"
        ) {
            if (!state.runners.first) {
                moveRunner(
                    "second",
                    "first"
                );
            }
        }
    }

    /* ---------------------------------------------------------
       Start / Stop
       --------------------------------------------------------- */

    function startBaserunning() {
        state.active = true;

        updateRunnerUI();

        startLoop();
        saveState();

        return {
            ...state,
            runners: {
                ...state.runners
            }
        };
    }

    function stopBaserunning() {
        state.active = false;
        state.stealing = false;
        state.sliding = false;

        stopLoop();
        saveState();
    }

    function startLoop() {
        if (animationId) {
            return;
        }

        lastTime = 0;

        animationId =
            requestAnimationFrame(loop);
    }

    function stopLoop() {
        if (animationId) {
            cancelAnimationFrame(
                animationId
            );

            animationId = null;
        }

        lastTime = 0;
    }

    function loop(timestamp) {
        if (!state.active) {
            animationId = null;
            return;
        }

        if (!lastTime) {
            lastTime = timestamp;
        }

        const deltaSeconds =
            clamp(
                (timestamp - lastTime) /
                1000,
                0,
                0.05
            );

        lastTime = timestamp;

        updateJoystickMovement(
            deltaSeconds
        );

        animationId =
            requestAnimationFrame(loop);
    }

    /* ---------------------------------------------------------
       Event integration
       --------------------------------------------------------- */

    function bindGameEvents() {
        window.addEventListener(
            "rtts:hit",
            event => {
                handleHit(
                    event.detail || {}
                );
            }
        );

        window.addEventListener(
            "rtts:walk",
            () => {
                handleWalk();
            }
        );

        window.addEventListener(
            "rtts:game-start",
            () => {
                startBaserunning();
            }
        );

        window.addEventListener(
            "rtts:game-end",
            () => {
                stopBaserunning();
            }
        );
    }

    /* ---------------------------------------------------------
       Initialization
       --------------------------------------------------------- */

    function init() {
        cacheElements();
        loadState();

        updateRunnerUI();

        bindBaseButtons();
        bindGameEvents();

        document.addEventListener(
            "keydown",
            handleKeyboard
        );

        window.RTTS =
            window.RTTS || {};

        window.RTTS.baserunning = {
            state,

            init,

            start:
                startBaserunning,

            stop:
                stopBaserunning,

            setRunners,

            clearBases,

            addRunner,

            removeRunner,

            selectRunner,

            selectNearestRunner,

            moveRunner,

            advanceAllRunners,

            steal,

            slide,

            scoreRun,

            registerOut,

            handleHit,

            handleWalk,

            getBaserunningStat,

            getRunnerSpeed,

            getStealSuccess,

            getSlideSuccess,

            getState() {
                return {
                    ...state,
                    runners: {
                        ...state.runners
                    }
                };
            }
        };

        window.startRTTSBaserunning =
            startBaserunning;

        window.stopRTTSBaserunning =
            stopBaserunning;

        window.rttsSteal =
            steal;

        window.rttsSlide =
            slide;
    }

    if (
        document.readyState ===
        "loading"
    ) {
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

