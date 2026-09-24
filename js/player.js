```javascript
/* =========================================================
   THE SHOW RTTS
   js/player.js
   선수 데이터 / 능력치 / 커리어 기본 정보
   ========================================================= */

(() => {
    "use strict";

    /* -----------------------------------------------------
       Constants
       ----------------------------------------------------- */

    const PLAYER_KEY = "rtts_current_player";

    const STAT_KEYS = [
        "contact",
        "power",
        "clutch",
        "baserunning",
        "defense"
    ];

    const POSITION_NAMES = {
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

    const LEVELS = [
        "Rookie",
        "A",
        "AA",
        "AAA",
        "MLB"
    ];

    const LEAGUES = {
        Rookie: "Minor",
        A: "Minor",
        AA: "Minor",
        AAA: "Minor",
        MLB: "MLB"
    };

    /* -----------------------------------------------------
       Default Player
       ----------------------------------------------------- */

    function createDefaultPlayer() {
        return {
            id: "",
            name: "",
            position: "SS",
            hand: "R-R",

            level: "Rookie",
            league: "Minor",

            team: "Free Agent",

            stats: {
                contact: 0,
                power: 0,
                clutch: 0,
                baserunning: 0,
                defense: 0
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

                runs: 0,
                doubles: 0,
                triples: 0,
                walks: 0,
                strikeouts: 0,

                wins: 0,
                losses: 0,
                saves: 0,

                salary: 0
            },

            seasonStats: {
                games: 0,
                plateAppearances: 0,
                atBats: 0,

                hits: 0,
                homeRuns: 0,
                rbi: 0,
                stolenBases: 0,

                runs: 0,
                doubles: 0,
                triples: 0,
                walks: 0,
                strikeouts: 0,

                wins: 0,
                losses: 0,
                saves: 0
            },

            equipment: {
                glove: null,
                shoes: null,
                bat: null,
                battingGloves: null,
                protective: null
            },

            inventory: [],

            progression: {
                trainingTokens: 0,
                experience: 0,
                nextLevelExperience: 100
            },

            awards: [],

            createdAt: new Date().toISOString(),

            updatedAt: new Date().toISOString()
        };
    }

    /* -----------------------------------------------------
       Normalize Player
       ----------------------------------------------------- */

    function normalizePlayer(input) {
        const base =
            createDefaultPlayer();

        if (
            !input ||
            typeof input !== "object"
        ) {
            return base;
        }

        const player = {
            ...base,
            ...input
        };

        player.stats = {
            ...base.stats,
            ...(input.stats || {})
        };

        player.career = {
            ...base.career,
            ...(input.career || {})
        };

        player.seasonStats = {
            ...base.seasonStats,
            ...(input.seasonStats || {})
        };

        player.equipment = {
            ...base.equipment,
            ...(input.equipment || {})
        };

        player.progression = {
            ...base.progression,
            ...(input.progression || {})
        };

        if (!Array.isArray(player.inventory)) {
            player.inventory = [];
        }

        if (!Array.isArray(player.awards)) {
            player.awards = [];
        }

        STAT_KEYS.forEach((stat) => {
            player.stats[stat] =
                clampInteger(
                    player.stats[stat],
                    0,
                    250
                );
        });

        player.level =
            LEVELS.includes(player.level)
                ? player.level
                : "Rookie";

        player.league =
            LEAGUES[player.level] ||
            "Minor";

        player.updatedAt =
            new Date().toISOString();

        return player;
    }

    /* -----------------------------------------------------
       Utility
       ----------------------------------------------------- */

    function clampInteger(
        value,
        min,
        max
    ) {
        const number =
            Number(value);

        if (!Number.isFinite(number)) {
            return min;
        }

        return Math.max(
            min,
            Math.min(
                max,
                Math.floor(number)
            )
        );
    }

    function positiveNumber(value) {
        const number =
            Number(value);

        if (
            !Number.isFinite(number) ||
            number < 0
        ) {
            return 0;
        }

        return number;
    }

    /* -----------------------------------------------------
       Save / Load Player
       ----------------------------------------------------- */

    function savePlayer(player = getPlayer()) {
        if (!player) {
            return false;
        }

        const normalized =
            normalizePlayer(player);

        normalized.updatedAt =
            new Date().toISOString();

        try {
            localStorage.setItem(
                PLAYER_KEY,
                JSON.stringify(normalized)
            );

            window.RTTS_PLAYER =
                normalized;

            return true;
        } catch (error) {
            console.error(
                "선수 저장 실패:",
                error
            );

            return false;
        }
    }

    function loadPlayer() {
        try {
            const raw =
                localStorage.getItem(
                    PLAYER_KEY
                );

            if (!raw) {
                return null;
            }

            const parsed =
                JSON.parse(raw);

            const player =
                normalizePlayer(parsed);

            window.RTTS_PLAYER =
                player;

            return player;
        } catch (error) {
            console.error(
                "선수 불러오기 실패:",
                error
            );

            return null;
        }
    }

    function getPlayer() {
        if (
            window.RTTS_PLAYER &&
            typeof window.RTTS_PLAYER ===
                "object"
        ) {
            return normalizePlayer(
                window.RTTS_PLAYER
            );
        }

        return loadPlayer();
    }

    function setPlayer(player) {
        const normalized =
            normalizePlayer(player);

        window.RTTS_PLAYER =
            normalized;

        savePlayer(normalized);

        return normalized;
    }

    /* -----------------------------------------------------
       Initialize Player
       ----------------------------------------------------- */

    function initializePlayer(playerData) {
        const player =
            normalizePlayer(
                playerData
            );

        if (!player.id) {
            player.id =
                "player_" +
                Date.now().toString(36);
        }

        if (!player.createdAt) {
            player.createdAt =
                new Date().toISOString();
        }

        player.updatedAt =
            new Date().toISOString();

        window.RTTS_PLAYER =
            player;

        savePlayer(player);

        updatePlayerUI();

        return player;
    }

    /* -----------------------------------------------------
       Player Name / Position
       ----------------------------------------------------- */

    function getPlayerName() {
        const player =
            getPlayer();

        return player?.name || "";
    }

    function getPlayerPosition() {
        const player =
            getPlayer();

        return player?.position || "SS";
    }

    function getPositionName(position) {
        return (
            POSITION_NAMES[position] ||
            position ||
            ""
        );
    }

    function getPlayerLevel() {
        const player =
            getPlayer();

        return player?.level || "Rookie";
    }

    function getPlayerTeam() {
        const player =
            getPlayer();

        return player?.team ||
            "Free Agent";
    }

    /* -----------------------------------------------------
       Stats
       ----------------------------------------------------- */

    function getStat(stat) {
        const player =
            getPlayer();

        if (
            !player ||
            !STAT_KEYS.includes(stat)
        ) {
            return 0;
        }

        return clampInteger(
            player.stats[stat],
            0,
            250
        );
    }

    function getAllStats() {
        const player =
            getPlayer();

        if (!player) {
            return {
                contact: 0,
                power: 0,
                clutch: 0,
                baserunning: 0,
                defense: 0
            };
        }

        return {
            contact: getStat("contact"),
            power: getStat("power"),
            clutch: getStat("clutch"),
            baserunning:
                getStat("baserunning"),
            defense:
                getStat("defense")
        };
    }

    function getTotalStats() {
        return STAT_KEYS.reduce(
            (total, stat) => {
                return (
                    total +
                    getStat(stat)
                );
            },
            0
        );
    }

    function addStat(
        stat,
        amount = 1
    ) {
        if (!STAT_KEYS.includes(stat)) {
            return false;
        }

        const player =
            getPlayer();

        if (!player) {
            return false;
        }

        const value =
            Number(amount);

        if (!Number.isFinite(value)) {
            return false;
        }

        player.stats[stat] =
            clampInteger(
                player.stats[stat] +
                    Math.floor(value),
                0,
                250
            );

        savePlayer(player);
        updatePlayerUI();

        return true;
    }

    function spendTrainingToken(stat) {
        const player =
            getPlayer();

        if (!player) {
            return false;
        }

        if (!STAT_KEYS.includes(stat)) {
            return false;
        }

        if (
            player.progression
                .trainingTokens <= 0
        ) {
            return false;
        }

        player.progression
            .trainingTokens -= 1;

        player.stats[stat] =
            clampInteger(
                player.stats[stat] + 1,
                0,
                250
            );

        savePlayer(player);
        updatePlayerUI();

        return true;
    }

    /* -----------------------------------------------------
       Training Tokens
       ----------------------------------------------------- */

    function addTrainingToken(
        amount = 1
    ) {
        const player =
            getPlayer();

        if (!player) {
            return false;
        }

        const value =
            Math.max(
                0,
                Math.floor(
                    Number(amount) || 0
                )
            );

        player.progression
            .trainingTokens += value;

        player.tokens =
            player.progression
                .trainingTokens;

        savePlayer(player);

        return true;
    }

    function getTrainingTokens() {
        const player =
            getPlayer();

        if (!player) {
            return 0;
        }

        return Math.max(
            0,
            Number(
                player.progression
                    ?.trainingTokens
            ) || 0
        );
    }

    /* -----------------------------------------------------
       Experience
       ----------------------------------------------------- */

    function getExperience() {
        const player =
            getPlayer();

        return Math.max(
            0,
            Number(
                player?.progression
                    ?.experience
            ) || 0
        );
    }

    function getNextLevelExperience() {
        const player =
            getPlayer();

        return Math.max(
            1,
            Number(
                player?.progression
                    ?.nextLevelExperience
            ) || 100
        );
    }

    function addExperience(
        amount = 0
    ) {
        const player =
            getPlayer();

        if (!player) {
            return false;
        }

        const value =
            Math.max(
                0,
                Math.floor(
                    Number(amount) || 0
                )
            );

        player.progression
            .experience += value;

        checkExperienceLevelUp(
            player
        );

        savePlayer(player);

        return true;
    }

    function checkExperienceLevelUp(
        player
    ) {
        while (
            player.progression
                .experience >=
            player.progression
                .nextLevelExperience
        ) {
            player.progression
                .experience -=
                player.progression
                    .nextLevelExperience;

            player.progression
                .nextLevelExperience =
                Math.floor(
                    player.progression
                        .nextLevelExperience *
                    1.25
                );

            addTrainingTokenInternal(
                player,
                1
            );
        }
    }

    function addTrainingTokenInternal(
        player,
        amount
    ) {
        player.progression
            .trainingTokens +=
            Math.max(
                0,
                Math.floor(
                    Number(amount) || 0
                )
            );

        player.tokens =
            player.progression
                .trainingTokens;
    }

    /* -----------------------------------------------------
       Level
       ----------------------------------------------------- */

    function setLevel(level) {
        const player =
            getPlayer();

        if (!player) {
            return false;
        }

        if (!LEVELS.includes(level)) {
            return false;
        }

        player.level = level;
        player.league =
            LEAGUES[level];

        savePlayer(player);
        updatePlayerUI();

        return true;
    }

    function advanceLevel() {
        const player =
            getPlayer();

        if (!player) {
            return false;
        }

        const index =
            LEVELS.indexOf(
                player.level
            );

        if (
            index < 0 ||
            index >=
                LEVELS.length - 1
        ) {
            return false;
        }

        player.level =
            LEVELS[index + 1];

        player.league =
            LEAGUES[
                player.level
            ];

        savePlayer(player);
        updatePlayerUI();

        return player.level;
    }

    /* -----------------------------------------------------
       Team
       ----------------------------------------------------- */

    function setTeam(teamName) {
        const player =
            getPlayer();

        if (!player) {
            return false;
        }

        player.team =
            String(
                teamName || "Free Agent"
            );

        savePlayer(player);
        updatePlayerUI();

        return true;
    }

    /* -----------------------------------------------------
       Salary
       ----------------------------------------------------- */

    function getSalary() {
        const player =
            getPlayer();

        return Math.max(
            0,
            Number(
                player?.career?.salary
            ) || 0
        );
    }

    function setSalary(amount) {
        const player =
            getPlayer();

        if (!player) {
            return false;
        }

        player.career.salary =
            Math.max(
                0,
                Math.floor(
                    Number(amount) || 0
                )
            );

        savePlayer(player);
        updatePlayerUI();

        return true;
    }

    function addSalary(amount) {
        return setSalary(
            getSalary() +
            Math.floor(
                Number(amount) || 0
            )
        );
    }

    /* -----------------------------------------------------
       Career Stats
       ----------------------------------------------------- */

    function getCareerStats() {
        const player =
            getPlayer();

        if (!player) {
            return null;
        }

        return {
            ...player.career
        };
    }

    function getSeasonStats() {
        const player =
            getPlayer();

        if (!player) {
            return null;
        }

        return {
            ...player.seasonStats
        };
    }

    function resetSeasonStats() {
        const player =
            getPlayer();

        if (!player) {
            return false;
        }

        player.seasonStats = {
            games: 0,
            plateAppearances: 0,
            atBats: 0,

            hits: 0,
            homeRuns: 0,
            rbi: 0,
            stolenBases: 0,

            runs: 0,
            doubles: 0,
            triples: 0,
            walks: 0,
            strikeouts: 0,

            wins: 0,
            losses: 0,
            saves: 0
        };

        savePlayer(player);

        return true;
    }

    function recordStat(
        stat,
        amount = 1
    ) {
        const player =
            getPlayer();

        if (!player) {
            return false;
        }

        const value =
            Math.floor(
                Number(amount) || 0
            );

        if (
            !Object.prototype.hasOwnProperty
                .call(
                    player.career,
                    stat
                )
        ) {
            return false;
        }

        player.career[stat] =
            Math.max(
                0,
                Number(
                    player.career[stat]
                ) + value
            );

        if (
            Object.prototype.hasOwnProperty
                .call(
                    player.seasonStats,
                    stat
                )
        ) {
            player.seasonStats[stat] =
                Math.max(
                    0,
                    Number(
                        player.seasonStats[
                            stat
                        ]
                    ) + value
                );
        }

        savePlayer(player);

        return true;
    }

    /* -----------------------------------------------------
       Batting Average
       ----------------------------------------------------- */

    function getBattingAverage(
        season = false
    ) {
        const player =
            getPlayer();

        if (!player) {
            return 0;
        }

        const stats =
            season
                ? player.seasonStats
                : player.career;

        if (!stats.atBats) {
            return 0;
        }

        return (
            stats.hits /
            stats.atBats
        );
    }

    /* -----------------------------------------------------
       On-Base Percentage
       ----------------------------------------------------- */

    function getOnBasePercentage(
        season = false
    ) {
        const player =
            getPlayer();

        if (!player) {
            return 0;
        }

        const stats =
            season
                ? player.seasonStats
                : player.career;

        const numerator =
            stats.hits +
            stats.walks;

        const denominator =
            stats.atBats +
            stats.walks;

        if (!denominator) {
            return 0;
        }

        return (
            numerator /
            denominator
        );
    }

    /* -----------------------------------------------------
       Slugging Percentage
       ----------------------------------------------------- */

    function getSluggingPercentage(
        season = false
    ) {
        const player =
            getPlayer();

        if (!player) {
            return 0;
        }

        const stats =
            season
                ? player.seasonStats
                : player.career;

        if (!stats.atBats) {
            return 0;
        }

        const singles =
            Math.max(
                0,
                stats.hits -
                stats.doubles -
                stats.triples -
                stats.homeRuns
            );

        const totalBases =
            singles +
            stats.doubles * 2 +
            stats.triples * 3 +
            stats.homeRuns * 4;

        return (
            totalBases /
            stats.atBats
        );
    }

    /* -----------------------------------------------------
       Equipment Effects
       ----------------------------------------------------- */

    function getEquipmentBonus(
        stat
    ) {
        const player =
            getPlayer();

        if (
            !player ||
            !STAT_KEYS.includes(stat)
        ) {
            return 0;
        }

        const mapping = {
            defense: "glove",
            baserunning: "shoes",
            power: "bat",
            contact: "battingGloves",
            clutch: "protective"
        };

        const slot =
            mapping[stat];

        const item =
            player.equipment?.[slot];

        if (!item) {
            return 0;
        }

        return Math.max(
            0,
            Number(
                item.bonus || 0
            )
        );
    }

    function getEffectiveStat(
        stat
    ) {
        return (
            getStat(stat) +
            getEquipmentBonus(stat)
        );
    }

    function getEffectiveStats() {
        return {
            contact:
                getEffectiveStat(
                    "contact"
                ),

            power:
                getEffectiveStat(
                    "power"
                ),

            clutch:
                getEffectiveStat(
                    "clutch"
                ),

            baserunning:
                getEffectiveStat(
                    "baserunning"
                ),

            defense:
                getEffectiveStat(
                    "defense"
                )
        };
    }

    /* -----------------------------------------------------
       Player Overall
       ----------------------------------------------------- */

    function getOverall() {
        const stats =
            getEffectiveStats();

        const values =
            Object.values(stats);

        if (!values.length) {
            return 0;
        }

        const total =
            values.reduce(
                (sum, value) =>
                    sum + value,
                0
            );

        return Math.round(
            total / values.length
        );
    }

    /* -----------------------------------------------------
       Position Check
       ----------------------------------------------------- */

    function isPitcher() {
        const position =
            getPlayerPosition();

        return (
            position === "SP" ||
            position === "RP"
        );
    }

    function isFielder() {
        return !isPitcher();
    }

    /* -----------------------------------------------------
       UI Update
       ----------------------------------------------------- */

    function updatePlayerUI() {
        const player =
            getPlayer();

        if (!player) {
            return;
        }

        const values = {
            careerPlayerName:
                player.name,

            careerTeam:
                player.team,

            careerLevel:
                player.level,

            careerCardName:
                player.name,

            careerCardPosition:
                getPositionName(
                    player.position
                ),

            careerCardTeam:
                player.team,

            careerContact:
                player.stats.contact,

            careerPower:
                player.stats.power,

            careerClutch:
                player.stats.clutch,

            careerBaserunning:
                player.stats.baserunning,

            careerDefense:
                player.stats.defense
        };

        Object.entries(values)
            .forEach(
                ([id, value]) => {
                    const element =
                        document.getElementById(
                            id
                        );

                    if (element) {
                        element.textContent =
                            String(value);
                    }
                }
            );

        const trainingTokens =
            document.getElementById(
                "trainingTokens"
            );

        if (trainingTokens) {
            trainingTokens.textContent =
                String(
                    getTrainingTokens()
                );
        }

        const equipmentSalary =
            document.getElementById(
                "equipmentSalary"
            );

        if (equipmentSalary) {
            equipmentSalary.textContent =
                formatMoney(
                    getSalary()
                );
        }
    }

    /* -----------------------------------------------------
       Money Format
       ----------------------------------------------------- */

    function formatMoney(
        amount
    ) {
        return (
            "$" +
            Math.max(
                0,
                Math.floor(
                    Number(amount) || 0
                )
            ).toLocaleString(
                "en-US"
            )
        );
    }

    /* -----------------------------------------------------
       Public API
       ----------------------------------------------------- */

    window.getPlayer =
        getPlayer;

    window.loadPlayer =
        loadPlayer;

    window.savePlayer =
        savePlayer;

    window.setPlayer =
        setPlayer;

    window.initializePlayer =
        initializePlayer;

    window.getPlayerName =
        getPlayerName;

    window.getPlayerPosition =
        getPlayerPosition;

    window.getPositionName =
        getPositionName;

    window.getPlayerLevel =
        getPlayerLevel;

    window.getPlayerTeam =
        getPlayerTeam;

    window.getStat =
        getStat;

    window.getAllStats =
        getAllStats;

    window.getTotalStats =
        getTotalStats;

    window.addStat =
        addStat;

    window.spendTrainingToken =
        spendTrainingToken;

    window.addTrainingToken =
        addTrainingToken;

    window.getTrainingTokens =
        getTrainingTokens;

    window.getExperience =
        getExperience;

    window.getNextLevelExperience =
        getNextLevelExperience;

    window.addExperience =
        addExperience;

    window.setLevel =
        setLevel;

    window.advanceLevel =
        advanceLevel;

    window.setTeam =
        setTeam;

    window.getSalary =
        getSalary;

    window.setSalary =
        setSalary;

    window.addSalary =
        addSalary;

    window.getCareerStats =
        getCareerStats;

    window.getSeasonStats =
        getSeasonStats;

    window.resetSeasonStats =
        resetSeasonStats;

    window.recordStat =
        recordStat;

    window.getBattingAverage =
        getBattingAverage;

    window.getOnBasePercentage =
        getOnBasePercentage;

    window.getSluggingPercentage =
        getSluggingPercentage;

    window.getEquipmentBonus =
        getEquipmentBonus;

    window.getEffectiveStat =
        getEffectiveStat;

    window.getEffectiveStats =
        getEffectiveStats;

    window.getOverall =
        getOverall;

    window.isPitcher =
        isPitcher;

    window.isFielder =
        isFielder;

    window.formatMoney =
        formatMoney;

    window.updatePlayerUI =
        updatePlayerUI;


    /* -----------------------------------------------------
       Automatic Load
       ----------------------------------------------------- */

    document.addEventListener(
        "DOMContentLoaded",
        () => {
            const player =
                loadPlayer();

            if (player) {
                updatePlayerUI();
            }
        },
        {
            once: true
        }
    );

})();
```
