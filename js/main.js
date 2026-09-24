```javascript
/* =========================================================
   THE SHOW RTTS
   js/main.js
   메인 게임 진입점 / 화면 전환 / 초기화
   ========================================================= */

(() => {
    "use strict";

    /* -----------------------------------------------------
       Global Game Object
       ----------------------------------------------------- */

    const RTTS = {
        version: "1.0.0",

        state: {
            currentScreen: "startScreen",
            initialized: false,
            playerCreated: false,
            gameStarted: false
        },

        screens: [
            "startScreen",
            "createPlayerScreen",
            "careerScreen",
            "gameScreen",
            "trainingScreen",
            "equipmentScreen",
            "seasonScreen",
            "statsScreen",
            "standingsScreen",
            "saveScreen",
            "contractScreen"
        ],

        init() {
            if (this.state.initialized) {
                return;
            }

            this.cacheElements();
            this.bindEvents();
            this.prepareInitialState();
            this.showScreen("startScreen");

            this.state.initialized = true;
        },

        /* -------------------------------------------------
           Element Cache
           ------------------------------------------------- */

        cacheElements() {
            this.elements = {};

            this.screens.forEach((id) => {
                this.elements[id] = document.getElementById(id);
            });

            this.elements.newCareerButton =
                document.getElementById("newCareerButton");

            this.elements.continueButton =
                document.getElementById("continueButton");

            this.elements.saveLoadButton =
                document.getElementById("saveLoadButton");

            this.elements.languageButton =
                document.getElementById("languageButton");

            this.elements.createPlayerButton =
                document.getElementById("createPlayerButton");

            this.elements.careerSaveButton =
                document.getElementById("careerSaveButton");

            this.elements.toast =
                document.getElementById("toast");

            this.elements.loadingScreen =
                document.getElementById("loadingScreen");
        },

        /* -------------------------------------------------
           Global Events
           ------------------------------------------------- */

        bindEvents() {
            this.bindStartScreenEvents();
            this.bindPlayerCreationEvents();
            this.bindCareerEvents();
            this.bindBackButtons();
            this.bindGenericNavigation();
        },

        bindStartScreenEvents() {
            if (this.elements.newCareerButton) {
                this.elements.newCareerButton.addEventListener(
                    "click",
                    () => {
                        this.startNewCareer();
                    }
                );
            }

            if (this.elements.continueButton) {
                this.elements.continueButton.addEventListener(
                    "click",
                    () => {
                        this.continueCareer();
                    }
                );
            }

            if (this.elements.saveLoadButton) {
                this.elements.saveLoadButton.addEventListener(
                    "click",
                    () => {
                        this.showScreen("saveScreen");
                    }
                );
            }

            if (this.elements.languageButton) {
                this.elements.languageButton.addEventListener(
                    "click",
                    () => {
                        this.toggleLanguage();
                    }
                );
            }
        },

        bindPlayerCreationEvents() {
            const statButtons =
                document.querySelectorAll(".stat-plus, .stat-minus");

            statButtons.forEach((button) => {
                button.addEventListener("click", () => {
                    const stat = button.dataset.stat;

                    if (!stat) {
                        return;
                    }

                    const direction =
                        button.classList.contains("stat-plus")
                            ? 1
                            : -1;

                    this.changeCreationStat(stat, direction);
                });
            });

            const playerName =
                document.getElementById("playerName");

            const playerPosition =
                document.getElementById("playerPosition");

            if (playerName) {
                playerName.addEventListener("input", () => {
                    this.updatePlayerPreview();
                });
            }

            if (playerPosition) {
                playerPosition.addEventListener("change", () => {
                    this.updatePlayerPreview();
                });
            }

            if (this.elements.createPlayerButton) {
                this.elements.createPlayerButton.addEventListener(
                    "click",
                    () => {
                        this.createPlayer();
                    }
                );
            }
        },

        bindCareerEvents() {
            const careerButtons =
                document.querySelectorAll(".career-button");

            careerButtons.forEach((button) => {
                button.addEventListener("click", () => {
                    const page = button.dataset.page;

                    if (!page) {
                        return;
                    }

                    this.openCareerPage(page);
                });
            });

            if (this.elements.careerSaveButton) {
                this.elements.careerSaveButton.addEventListener(
                    "click",
                    () => {
                        this.showScreen("saveScreen");
                    }
                );
            }
        },

        bindBackButtons() {
            const backButtons =
                document.querySelectorAll(
                    "[data-back-screen]"
                );

            backButtons.forEach((button) => {
                button.addEventListener("click", () => {
                    const target =
                        button.dataset.backScreen ||
                        "careerScreen";

                    this.showScreen(target);
                });
            });
        },

        bindGenericNavigation() {
            const navigationButtons =
                document.querySelectorAll(
                    "[data-screen]"
                );

            navigationButtons.forEach((button) => {
                button.addEventListener("click", () => {
                    const target =
                        button.dataset.screen;

                    if (target) {
                        this.showScreen(target);
                    }
                });
            });
        },

        /* -------------------------------------------------
           Initial State
           ------------------------------------------------- */

        prepareInitialState() {
            this.updateContinueButton();
            this.resetCreationForm();
            this.updatePlayerPreview();
            this.updateCreationTokens();
        },

        /* -------------------------------------------------
           Screen Navigation
           ------------------------------------------------- */

        showScreen(screenId) {
            if (!this.screens.includes(screenId)) {
                return;
            }

            this.screens.forEach((id) => {
                const screen =
                    document.getElementById(id);

                if (!screen) {
                    return;
                }

                screen.classList.remove("active");
            });

            const target =
                document.getElementById(screenId);

            if (!target) {
                return;
            }

            target.classList.add("active");

            this.state.currentScreen = screenId;

            window.scrollTo({
                top: 0,
                left: 0,
                behavior: "auto"
            });

            this.onScreenOpened(screenId);
        },

        onScreenOpened(screenId) {
            if (
                screenId === "careerScreen" &&
                typeof window.updateCareerUI === "function"
            ) {
                window.updateCareerUI();
            }

            if (
                screenId === "trainingScreen" &&
                typeof window.updateTrainingUI === "function"
            ) {
                window.updateTrainingUI();
            }

            if (
                screenId === "equipmentScreen" &&
                typeof window.updateEquipmentUI === "function"
            ) {
                window.updateEquipmentUI();
            }

            if (
                screenId === "seasonScreen" &&
                typeof window.updateSeasonUI === "function"
            ) {
                window.updateSeasonUI();
            }

            if (
                screenId === "statsScreen" &&
                typeof window.updateStatsUI === "function"
            ) {
                window.updateStatsUI();
            }

            if (
                screenId === "standingsScreen" &&
                typeof window.updateStandingsUI === "function"
            ) {
                window.updateStandingsUI();
            }

            if (
                screenId === "saveScreen" &&
                typeof window.updateSaveUI === "function"
            ) {
                window.updateSaveUI();
            }

            if (
                screenId === "contractScreen" &&
                typeof window.updateContractUI === "function"
            ) {
                window.updateContractUI();
            }
        },

        /* -------------------------------------------------
           New Career
           ------------------------------------------------- */

        startNewCareer() {
            this.resetCreationForm();
            this.updatePlayerPreview();
            this.updateCreationTokens();

            this.state.playerCreated = false;
            this.state.gameStarted = false;

            this.showScreen("createPlayerScreen");
        },

        /* -------------------------------------------------
           Continue
           ------------------------------------------------- */

        continueCareer() {
            let loaded = false;

            if (
                typeof window.loadLatestSave === "function"
            ) {
                loaded = Boolean(
                    window.loadLatestSave()
                );
            }

            if (!loaded) {
                this.showToast(
                    "저장된 커리어가 없습니다."
                );
                return;
            }

            this.state.playerCreated = true;

            this.showScreen("careerScreen");
        },

        updateContinueButton() {
            if (!this.elements.continueButton) {
                return;
            }

            let hasSave = false;

            try {
                if (
                    typeof window.hasAnySave === "function"
                ) {
                    hasSave = Boolean(
                        window.hasAnySave()
                    );
                } else {
                    hasSave =
                        localStorage.getItem(
                            "rtts_save_1"
                        ) !== null ||
                        localStorage.getItem(
                            "rtts_save_2"
                        ) !== null ||
                        localStorage.getItem(
                            "rtts_save_3"
                        ) !== null;
                }
            } catch (error) {
                hasSave = false;
            }

            this.elements.continueButton.disabled =
                !hasSave;
        },

        /* -------------------------------------------------
           Player Creation
           ------------------------------------------------- */

        getCreationData() {
            const defaultStats = {
                contact: 0,
                power: 0,
                clutch: 0,
                baserunning: 0,
                defense: 0
            };

            const data = {
                name: "",
                position: "SS",
                hand: "R-R",
                stats: {
                    ...defaultStats
                }
            };

            const playerName =
                document.getElementById("playerName");

            const playerPosition =
                document.getElementById("playerPosition");

            const playerHand =
                document.getElementById("playerHand");

            if (playerName) {
                data.name =
                    playerName.value.trim();
            }

            if (playerPosition) {
                data.position =
                    playerPosition.value || "SS";
            }

            if (playerHand) {
                data.hand =
                    playerHand.value || "R-R";
            }

            Object.keys(defaultStats).forEach(
                (stat) => {
                    const element =
                        document.getElementById(
                            `${stat}Stat`
                        );

                    if (element) {
                        data.stats[stat] =
                            Number(
                                element.textContent
                            ) || 0;
                    }
                }
            );

            return data;
        },

        resetCreationForm() {
            const playerName =
                document.getElementById("playerName");

            const playerPosition =
                document.getElementById("playerPosition");

            const playerHand =
                document.getElementById("playerHand");

            if (playerName) {
                playerName.value = "";
            }

            if (playerPosition) {
                playerPosition.value = "SS";
            }

            if (playerHand) {
                playerHand.value = "R-R";
            }

            const stats = [
                "contact",
                "power",
                "clutch",
                "baserunning",
                "defense"
            ];

            stats.forEach((stat) => {
                const element =
                    document.getElementById(
                        `${stat}Stat`
                    );

                if (element) {
                    element.textContent = "0";
                }
            });

            this.updateCreationTokens();
        },

        changeCreationStat(stat, amount) {
            const validStats = [
                "contact",
                "power",
                "clutch",
                "baserunning",
                "defense"
            ];

            if (!validStats.includes(stat)) {
                return;
            }

            const element =
                document.getElementById(
                    `${stat}Stat`
                );

            if (!element) {
                return;
            }

            const current =
                Number(element.textContent) || 0;

            const total =
                this.getTotalCreationStats();

            const maxTokens = 250;

            if (amount > 0) {
                if (total >= maxTokens) {
                    this.showToast(
                        "사용할 수 있는 토큰이 없습니다."
                    );
                    return;
                }

                element.textContent =
                    String(current + 1);
            } else {
                if (current <= 0) {
                    return;
                }

                element.textContent =
                    String(current - 1);
            }

            this.updateCreationTokens();
        },

        getTotalCreationStats() {
            const stats = [
                "contact",
                "power",
                "clutch",
                "baserunning",
                "defense"
            ];

            return stats.reduce(
                (total, stat) => {
                    const element =
                        document.getElementById(
                            `${stat}Stat`
                        );

                    return (
                        total +
                        (
                            Number(
                                element?.textContent
                            ) || 0
                        )
                    );
                },
                0
            );
        },

        updateCreationTokens() {
            const used =
                this.getTotalCreationStats();

            const remaining =
                Math.max(0, 250 - used);

            const element =
                document.getElementById(
                    "remainingTokens"
                );

            if (element) {
                element.textContent =
                    String(remaining);
            }

            const tokenLabel =
                document.getElementById(
                    "creationTokens"
                );

            if (tokenLabel) {
                tokenLabel.textContent =
                    `시작 토큰 250 · 사용 ${used}`;
            }
        },

        updatePlayerPreview() {
            const data =
                this.getCreationData();

            const previewName =
                document.getElementById(
                    "playerPreviewName"
                );

            const previewPosition =
                document.getElementById(
                    "playerPreviewPosition"
                );

            if (previewName) {
                previewName.textContent =
                    data.name || "NEW PLAYER";
            }

            if (previewPosition) {
                previewPosition.textContent =
                    this.getPositionName(
                        data.position
                    );
            }
        },

        getPositionName(position) {
            const names = {
                C: "포수",
                "1B": "1루수",
                "2B": "2루수",
                "3B": "3루수",
                SS: "유격수",
                LF: "좌익수",
                CF: "중견수",
                RF: "우익수",
                SP: "선발투수",
                RP: "구원투수"
            };

            return names[position] || position;
        },

        /* -------------------------------------------------
           Create Player
           ------------------------------------------------- */

        createPlayer() {
            const data =
                this.getCreationData();

            if (!data.name) {
                this.showToast(
                    "선수 이름을 입력해주세요."
                );
                return;
            }

            const totalStats =
                Object.values(
                    data.stats
                ).reduce(
                    (sum, value) =>
                        sum + Number(value),
                    0
                );

            if (totalStats !== 250) {
                this.showToast(
                    "시작 토큰 250개를 모두 배분해주세요."
                );
                return;
            }

            const playerData = {
                id: this.createPlayerId(),
                name: data.name,
                position: data.position,
                hand: data.hand,

                level: "Rookie",
                league: "Minor",

                stats: {
                    contact: data.stats.contact,
                    power: data.stats.power,
                    clutch: data.stats.clutch,
                    baserunning:
                        data.stats.baserunning,
                    defense: data.stats.defense
                },

                tokens: 0,

                career: {
                    season: 1,
                    games: 0,
                    plateAppearances: 0,
                    atBats: 0,
                    hits: 0,
                    homeRuns: 0,
                    rbi: 0,
                    stolenBases: 0,
                    salary: 0
                },

                team: "Free Agent",

                equipment: {
                    glove: null,
                    shoes: null,
                    bat: null,
                    battingGloves: null,
                    protective: null
                },

                inventory: [],

                createdAt:
                    new Date().toISOString()
            };

            this.state.playerCreated = true;

            this.storePlayerData(playerData);

            if (
                typeof window.initializePlayer ===
                "function"
            ) {
                window.initializePlayer(
                    playerData
                );
            }

            if (
                typeof window.initializeCareer ===
                "function"
            ) {
                window.initializeCareer(
                    playerData
                );
            }

            this.updateCareerBasicInfo();

            this.showToast(
                "선수 생성 완료!"
            );

            setTimeout(() => {
                this.showScreen(
                    "careerScreen"
                );
            }, 350);
        },

        createPlayerId() {
            return (
                "player_" +
                Date.now().toString(36) +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(2, 8)
            );
        },

        storePlayerData(playerData) {
            try {
                localStorage.setItem(
                    "rtts_current_player",
                    JSON.stringify(
                        playerData
                    )
                );
            } catch (error) {
                console.error(
                    "선수 데이터 저장 실패:",
                    error
                );
            }

            window.RTTS_PLAYER =
                playerData;
        },

        /* -------------------------------------------------
           Career
           ------------------------------------------------- */

        openCareerPage(page) {
            const pageMap = {
                game: "gameScreen",
                training: "trainingScreen",
                equipment: "equipmentScreen",
                season: "seasonScreen",
                stats: "statsScreen",
                standings: "standingsScreen"
            };

            const screenId =
                pageMap[page];

            if (!screenId) {
                return;
            }

            if (!this.state.playerCreated) {
                const player =
                    this.getStoredPlayer();

                if (!player) {
                    this.showToast(
                        "먼저 선수를 생성해주세요."
                    );
                    return;
                }

                this.state.playerCreated = true;
            }

            this.showScreen(screenId);
        },

        updateCareerBasicInfo() {
            const player =
                this.getStoredPlayer();

            if (!player) {
                return;
            }

            const name =
                document.getElementById(
                    "careerPlayerName"
                );

            const team =
                document.getElementById(
                    "careerTeam"
                );

            const level =
                document.getElementById(
                    "careerLevel"
                );

            const cardName =
                document.getElementById(
                    "careerCardName"
                );

            const cardPosition =
                document.getElementById(
                    "careerCardPosition"
                );

            const cardTeam =
                document.getElementById(
                    "careerCardTeam"
                );

            if (name) {
                name.textContent =
                    player.name;
            }

            if (team) {
                team.textContent =
                    player.team;
            }

            if (level) {
                level.textContent =
                    player.level;
            }

            if (cardName) {
                cardName.textContent =
                    player.name;
            }

            if (cardPosition) {
                cardPosition.textContent =
                    this.getPositionName(
                        player.position
                    );
            }

            if (cardTeam) {
                cardTeam.textContent =
                    player.team;
            }

            const statIds = {
                contact: "careerContact",
                power: "careerPower",
                clutch: "careerClutch",
                baserunning:
                    "careerBaserunning",
                defense: "careerDefense"
            };

            Object.entries(
                statIds
            ).forEach(
                ([stat, id]) => {
                    const element =
                        document.getElementById(id);

                    if (element) {
                        element.textContent =
                            String(
                                player.stats?.[
                                    stat
                                ] || 0
                            );
                    }
                }
            );
        },

        getStoredPlayer() {
            if (
                window.RTTS_PLAYER &&
                typeof window.RTTS_PLAYER ===
                    "object"
            ) {
                return window.RTTS_PLAYER;
            }

            try {
                const raw =
                    localStorage.getItem(
                        "rtts_current_player"
                    );

                if (!raw) {
                    return null;
                }

                const player =
                    JSON.parse(raw);

                window.RTTS_PLAYER =
                    player;

                return player;
            } catch (error) {
                console.error(
                    "선수 데이터 불러오기 실패:",
                    error
                );

                return null;
            }
        },

        /* -------------------------------------------------
           Language
           ------------------------------------------------- */

        toggleLanguage() {
            /*
             * 게임의 기본 언어는 한국어.
             * 추후 영어 UI를 추가할 수 있도록
             * 상태만 먼저 준비한다.
             */

            const current =
                localStorage.getItem(
                    "rtts_language"
                ) || "ko";

            const next =
                current === "ko"
                    ? "en"
                    : "ko";

            localStorage.setItem(
                "rtts_language",
                next
            );

            this.showToast(
                next === "ko"
                    ? "한국어로 설정되었습니다."
                    : "English mode selected."
            );
        },

        /* -------------------------------------------------
           Toast
           ------------------------------------------------- */

        showToast(message, duration = 1800) {
            const toast =
                this.elements.toast ||
                document.getElementById(
                    "toast"
                );

            if (!toast) {
                return;
            }

            toast.textContent =
                String(message);

            toast.classList.remove("show");

            void toast.offsetWidth;

            toast.classList.add("show");

            clearTimeout(
                this.toastTimer
            );

            this.toastTimer =
                setTimeout(() => {
                    toast.classList.remove(
                        "show"
                    );
                }, duration);
        },

        /* -------------------------------------------------
           Loading
           ------------------------------------------------- */

        showLoading(show = true) {
            const loading =
                this.elements.loadingScreen ||
                document.getElementById(
                    "loadingScreen"
                );

            if (!loading) {
                return;
            }

            loading.classList.toggle(
                "hidden",
                !show
            );
        }
    };


    /* -----------------------------------------------------
       Global Access
       ----------------------------------------------------- */

    window.RTTS = RTTS;

    window.showScreen = (
        screenId
    ) => {
        RTTS.showScreen(screenId);
    };

    window.showToast = (
        message,
        duration
    ) => {
        RTTS.showToast(
            message,
            duration
        );
    };

    window.getCurrentPlayer = () => {
        return RTTS.getStoredPlayer();
    };


    /* -----------------------------------------------------
       DOM Ready
       ----------------------------------------------------- */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            () => {
                RTTS.init();
            },
            {
                once: true
            }
        );
    } else {
        RTTS.init();
    }

})();
```
