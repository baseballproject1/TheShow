```javascript
/* =========================================================
   THE SHOW RTTS
   js/season.js
   시즌 진행 / 경기 일정 / 성적 / 승급 / 시즌 종료
   ========================================================= */

(function () {
    "use strict";

    const SEASON_KEY = "rtts_season_state";

    const LEVELS = ["Rookie", "A", "AA", "AAA", "MLB"];

    const LEVEL_INFO = {
        Rookie: {
            games: 30,
            next: "A",
            minXP: 0
        },
        A: {
            games: 60,
            next: "AA",
            minXP: 0
        },
        AA: {
            games: 80,
            next: "AAA",
            minXP: 0
        },
        AAA: {
            games: 100,
            next: "MLB",
            minXP: 0
        },
        MLB: {
            games: 162,
            next: null,
            minXP: 0
        }
    };

    const DEFAULT_STATE = {
        seasonNumber: 1,
        level: "Rookie",
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        currentGame: 1,
        totalGames: 30,
        completed: false,
        postseasonQualified: false,
        postseasonRound: 0,
        postseasonWins: 0,
        worldSeriesChampion: false,
        seasonAwards: [],
        lastSeasonResult: null,
        lastUpdated: null
    };

    let state = null;

    /* =========================================================
       기본 유틸
       ========================================================= */

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function getPlayer() {
        if (window.RTTS && RTTS.player && typeof RTTS.player.get === "function") {
            return RTTS.player.get();
        }

        if (typeof window.getCurrentPlayer === "function") {
            return window.getCurrentPlayer();
        }

        return null;
    }

    function savePlayer(player) {
        if (!player) return;

        if (window.RTTS && RTTS.player && typeof RTTS.player.save === "function") {
            RTTS.player.save(player);
        }
    }

    /* =========================================================
       시즌 데이터
       ========================================================= */

    function normalizeState(data) {
        const result = {
            ...clone(DEFAULT_STATE),
            ...(data || {})
        };

        const player = getPlayer();

        if (player && player.level) {
            result.level = player.level;
        }

        if (!LEVEL_INFO[result.level]) {
            result.level = "Rookie";
        }

        result.totalGames = LEVEL_INFO[result.level].games;

        result.seasonNumber = Math.max(
            1,
            Number(result.seasonNumber) || 1
        );

        result.gamesPlayed = clamp(
            Number(result.gamesPlayed) || 0,
            0,
            result.totalGames
        );

        result.currentGame = clamp(
            Number(result.currentGame) || 1,
            1,
            result.totalGames
        );

        result.wins = Math.max(0, Number(result.wins) || 0);
        result.losses = Math.max(0, Number(result.losses) || 0);
        result.draws = Math.max(0, Number(result.draws) || 0);

        if (!Array.isArray(result.seasonAwards)) {
            result.seasonAwards = [];
        }

        return result;
    }

    function saveState() {
        if (!state) return;

        state.lastUpdated = Date.now();

        try {
            localStorage.setItem(
                SEASON_KEY,
                JSON.stringify(state)
            );
        } catch (error) {
            console.error("시즌 저장 실패:", error);
        }
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(SEASON_KEY);

            if (!raw) {
                state = normalizeState(DEFAULT_STATE);
                saveState();
                return state;
            }

            state = normalizeState(JSON.parse(raw));
            return state;
        } catch (error) {
            console.error("시즌 불러오기 실패:", error);

            state = normalizeState(DEFAULT_STATE);
            saveState();

            return state;
        }
    }

    /* =========================================================
       시즌 초기화
       ========================================================= */

    function createSeason(level) {
        const selectedLevel = LEVEL_INFO[level]
            ? level
            : "Rookie";

        state = {
            ...clone(DEFAULT_STATE),
            level: selectedLevel,
            totalGames: LEVEL_INFO[selectedLevel].games,
            currentGame: 1,
            lastUpdated: Date.now()
        };

        saveState();
        updateUI();

        return state;
    }

    function startNewSeason() {
        const player = getPlayer();

        const level = player && player.level
            ? player.level
            : "Rookie";

        const previousNumber = state
            ? Number(state.seasonNumber) || 1
            : 0;

        state = {
            ...clone(DEFAULT_STATE),
            seasonNumber: previousNumber + 1,
            level: LEVEL_INFO[level] ? level : "Rookie",
            totalGames: LEVEL_INFO[level]
                ? LEVEL_INFO[level].games
                : LEVEL_INFO.Rookie.games,
            currentGame: 1,
            lastUpdated: Date.now()
        };

        saveState();
        updateUI();

        return state;
    }

    /* =========================================================
       현재 시즌 정보
       ========================================================= */

    function getState() {
        if (!state) {
            loadState();
        }

        return state;
    }

    function getLevel() {
        return getState().level;
    }

    function getSeasonNumber() {
        return getState().seasonNumber;
    }

    function getGamesPlayed() {
        return getState().gamesPlayed;
    }

    function getTotalGames() {
        return getState().totalGames;
    }

    function getRemainingGames() {
        return Math.max(
            0,
            getState().totalGames - getState().gamesPlayed
        );
    }

    function getWinRate() {
        const total =
            state.wins +
            state.losses +
            state.draws;

        if (total <= 0) return 0;

        return state.wins / total;
    }

    function getProgress() {
        if (!state || state.totalGames <= 0) {
            return 0;
        }

        return clamp(
            state.gamesPlayed / state.totalGames,
            0,
            1
        );
    }

    /* =========================================================
       경기 시작
       ========================================================= */

    function startGame() {
        if (!state) {
            loadState();
        }

        if (state.completed) {
            showMessage("이번 시즌은 이미 종료되었습니다.");
            return false;
        }

        if (state.gamesPlayed >= state.totalGames) {
            finishSeason();
            return false;
        }

        state.currentGame =
            state.gamesPlayed + 1;

        saveState();
        updateUI();

        return true;
    }

    /* =========================================================
       경기 결과
       ========================================================= */

    function recordGameResult(result) {
        if (!state) {
            loadState();
        }

        if (state.completed) {
            return false;
        }

        const normalized = String(result || "")
            .toLowerCase()
            .trim();

        if (
            normalized !== "win" &&
            normalized !== "loss" &&
            normalized !== "draw"
        ) {
            console.warn(
                "잘못된 경기 결과:",
                result
            );

            return false;
        }

        if (state.gamesPlayed >= state.totalGames) {
            finishSeason();
            return false;
        }

        state.gamesPlayed += 1;

        if (normalized === "win") {
            state.wins += 1;
        } else if (normalized === "loss") {
            state.losses += 1;
        } else {
            state.draws += 1;
        }

        state.currentGame =
            Math.min(
                state.gamesPlayed + 1,
                state.totalGames
            );

        saveState();
        updateUI();

        if (state.gamesPlayed >= state.totalGames) {
            finishSeason();
        }

        return true;
    }

    function recordWin() {
        return recordGameResult("win");
    }

    function recordLoss() {
        return recordGameResult("loss");
    }

    function recordDraw() {
        return recordGameResult("draw");
    }

    /* =========================================================
       시즌 종료
       ========================================================= */

    function finishSeason() {
        if (!state) {
            loadState();
        }

        if (state.completed) {
            return;
        }

        state.completed = true;

        /*
         * RTTS에서는 시즌 성적을 기준으로
         * 다음 단계 진입 여부를 결정한다.
         *
         * 여기서는 선수 개인의 시즌 진행을 중심으로
         * 다음 레벨 진입이 가능하도록 구성한다.
         */

        const player = getPlayer();

        let promoted = false;

        if (player) {
            const currentIndex =
                LEVELS.indexOf(player.level);

            if (
                currentIndex >= 0 &&
                currentIndex < LEVELS.length - 1
            ) {
                const nextLevel =
                    LEVELS[currentIndex + 1];

                player.level = nextLevel;

                if (!player.progression) {
                    player.progression = {};
                }

                player.progression.lastPromotion = {
                    from: LEVELS[currentIndex],
                    to: nextLevel,
                    season: state.seasonNumber,
                    date: Date.now()
                };

                savePlayer(player);

                state.level = nextLevel;
                promoted = true;
            }
        }

        state.lastSeasonResult = {
            season: state.seasonNumber,
            level: state.level,
            wins: state.wins,
            losses: state.losses,
            draws: state.draws,
            winRate: getWinRate(),
            promoted: promoted,
            date: Date.now()
        };

        if (promoted) {
            state.seasonAwards.push(
                `${state.lastSeasonResult.level} 승급`
            );
        }

        saveState();
        updateUI();

        showSeasonFinishMessage(promoted);
    }

    /* =========================================================
       시즌 종료 메시지
       ========================================================= */

    function showSeasonFinishMessage(promoted) {
        let message =
            `시즌 ${state.seasonNumber} 종료! ` +
            `${state.wins}승 ${state.losses}패 ${state.draws}무`;

        if (promoted) {
            message += ` · ${state.level} 승급!`;
        }

        showMessage(message);
    }

    /* =========================================================
       포스트시즌
       ========================================================= */

    function qualifyPostseason() {
        if (!state) {
            loadState();
        }

        /*
         * 정규시즌 승률을 기준으로 포스트시즌 진출 여부를
         * 결정한다.
         *
         * 최소 50% 이상 승률이면 진출.
         */

        const qualified =
            getWinRate() >= 0.5;

        state.postseasonQualified =
            qualified;

        saveState();
        updateUI();

        return qualified;
    }

    function startPostseason() {
        if (!state) {
            loadState();
        }

        if (!state.completed) {
            return false;
        }

        if (!state.postseasonQualified) {
            return false;
        }

        state.postseasonRound = 1;
        state.postseasonWins = 0;
        state.worldSeriesChampion = false;

        saveState();

        return true;
    }

    function recordPostseasonWin() {
        if (!state.postseasonQualified) {
            return false;
        }

        state.postseasonWins += 1;

        /*
         * 4승을 하면 월드시리즈 우승 처리.
         */
        if (state.postseasonWins >= 4) {
            state.worldSeriesChampion = true;
            state.seasonAwards.push("월드시리즈 우승");
        }

        saveState();
        updateUI();

        return true;
    }

    /* =========================================================
       다음 시즌
       ========================================================= */

    function prepareNextSeason() {
        if (!state || !state.completed) {
            return false;
        }

        return startNewSeason();
    }

    /* =========================================================
       선수 시즌 기록 초기화
       ========================================================= */

    function resetPlayerSeasonStats() {
        const player = getPlayer();

        if (!player) return;

        if (!player.seasonStats) {
            player.seasonStats = {};
        }

        player.seasonStats = {
            games: 0,
            plateAppearances: 0,
            atBats: 0,
            hits: 0,
            doubles: 0,
            triples: 0,
            homeRuns: 0,
            runs: 0,
            rbi: 0,
            walks: 0,
            strikeouts: 0,
            stolenBases: 0,
            caughtStealing: 0,
            errors: 0,
            inningsPitched: 0,
            wins: 0,
            losses: 0,
            saves: 0
        };

        savePlayer(player);
    }

    /* =========================================================
       시즌 기록
       ========================================================= */

    function getRecord() {
        if (!state) {
            loadState();
        }

        return {
            wins: state.wins,
            losses: state.losses,
            draws: state.draws,
            games: state.gamesPlayed,
            winRate: getWinRate()
        };
    }

    function getSeasonSummary() {
        if (!state) {
            loadState();
        }

        return {
            season: state.seasonNumber,
            level: state.level,
            gamesPlayed: state.gamesPlayed,
            totalGames: state.totalGames,
            remainingGames: getRemainingGames(),
            wins: state.wins,
            losses: state.losses,
            draws: state.draws,
            winRate: getWinRate(),
            progress: getProgress(),
            completed: state.completed,
            postseasonQualified:
                state.postseasonQualified,
            worldSeriesChampion:
                state.worldSeriesChampion
        };
    }

    /* =========================================================
       UI
       ========================================================= */

    function updateUI() {
        if (!state) return;

        const seasonNumber =
            document.getElementById("seasonNumber");

        const seasonGames =
            document.getElementById("seasonGames");

        const seasonLevel =
            document.getElementById("seasonLevel");

        const seasonProgress =
            document.getElementById("seasonProgress");

        const seasonProgressText =
            document.getElementById(
                "seasonProgressText"
            );

        if (seasonNumber) {
            seasonNumber.textContent =
                `시즌 ${state.seasonNumber}`;
        }

        if (seasonGames) {
            seasonGames.textContent =
                `${state.gamesPlayed} / ${state.totalGames}`;
        }

        if (seasonLevel) {
            seasonLevel.textContent =
                state.level;
        }

        const progress =
            getProgress() * 100;

        if (seasonProgress) {
            seasonProgress.style.width =
                `${progress}%`;
        }

        if (seasonProgressText) {
            seasonProgressText.textContent =
                `${state.gamesPlayed} / ${state.totalGames} 경기`;
        }

        updateSeasonDetails();
    }

    function updateSeasonDetails() {
        const seasonScreen =
            document.getElementById("seasonScreen");

        if (!seasonScreen) return;

        let recordElement =
            document.getElementById(
                "seasonRecord"
            );

        if (!recordElement) {
            recordElement =
                document.createElement("div");

            recordElement.id =
                "seasonRecord";

            recordElement.className =
                "season-record";

            const panel =
                seasonScreen.querySelector(
                    ".panel"
                );

            if (panel) {
                panel.appendChild(recordElement);
            }
        }

        recordElement.innerHTML = `
            <div class="season-record-row">
                <span>승</span>
                <strong>${state.wins}</strong>
            </div>

            <div class="season-record-row">
                <span>패</span>
                <strong>${state.losses}</strong>
            </div>

            <div class="season-record-row">
                <span>무</span>
                <strong>${state.draws}</strong>
            </div>

            <div class="season-record-row">
                <span>승률</span>
                <strong>${(
                    getWinRate() * 100
                ).toFixed(1)}%</strong>
            </div>
        `;
    }

    function showMessage(message) {
        if (typeof window.showToast === "function") {
            window.showToast(message);
            return;
        }

        const toast =
            document.getElementById("toast");

        if (!toast) return;

        toast.textContent = message;
        toast.classList.remove("hidden");

        clearTimeout(
            showMessage.timer
        );

        showMessage.timer =
            setTimeout(() => {
                toast.classList.add("hidden");
            }, 2500);
    }

    /* =========================================================
       경기 종료 이벤트 연결
       ========================================================= */

    function handleGameEnd(event) {
        const detail =
            event && event.detail
                ? event.detail
                : {};

        let result =
            detail.result ||
            detail.outcome ||
            null;

        if (!result && detail.winner) {
            const player =
                getPlayer();

            if (
                player &&
                detail.winner ===
                    player.team
            ) {
                result = "win";
            } else {
                result = "loss";
            }
        }

        if (!result) {
            return;
        }

        recordGameResult(result);
    }

    function handleGameStart() {
        startGame();
    }

    /* =========================================================
       시즌 화면 버튼
       ========================================================= */

    function bindButtons() {
        const negotiationButton =
            document.getElementById(
                "salaryNegotiationButton"
            );

        if (negotiationButton) {
            negotiationButton.addEventListener(
                "click",
                function () {
                    if (!state.completed) {
                        showMessage(
                            "시즌이 끝난 뒤 연봉 협상을 할 수 있습니다."
                        );
                        return;
                    }

                    if (
                        typeof window.showScreen ===
                        "function"
                    ) {
                        window.showScreen(
                            "contractScreen"
                        );
                    }
                }
            );
        }
    }

    /* =========================================================
       이벤트
       ========================================================= */

    function bindEvents() {
        document.addEventListener(
            "rtts:game-start",
            handleGameStart
        );

        document.addEventListener(
            "rtts:game-end",
            handleGameEnd
        );
    }

    /* =========================================================
       초기화
       ========================================================= */

    function init() {
        loadState();
        bindButtons();
        bindEvents();
        updateUI();
    }

    /* =========================================================
       API
       ========================================================= */

    window.RTTS = window.RTTS || {};

    RTTS.season = {
        init,
        getState,
        getLevel,
        getSeasonNumber,
        getGamesPlayed,
        getTotalGames,
        getRemainingGames,
        getWinRate,
        getProgress,
        createSeason,
        startNewSeason,
        startGame,
        recordGameResult,
        recordWin,
        recordLoss,
        recordDraw,
        finishSeason,
        qualifyPostseason,
        startPostseason,
        recordPostseasonWin,
        prepareNextSeason,
        resetPlayerSeasonStats,
        getRecord,
        getSeasonSummary,
        updateUI
    };

    /* =========================================================
       전역 함수
       ========================================================= */

    window.startRTTSSeason =
        startNewSeason;

    window.startRTTSGameSeason =
        startGame;

    window.recordRTTSWin =
        recordWin;

    window.recordRTTSLoss =
        recordLoss;

    window.recordRTTSDraw =
        recordDraw;

    window.finishRTTSSeason =
        finishSeason;

    window.getRTTSSeason =
        getSeasonSummary;

    /* =========================================================
       실행
       ========================================================= */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            init
        );
    } else {
        init();
    }
})();
```
