/**
 * Runtime: 10-slot quest board, all unlocked for new characters, 30-min refresh.
 *
 * NOT WIRED YET (same as V5): nothing calls installQuestBoard(game), and the engine
 * snapshot has no `questBoard` field, so the Quest Board panel in turbz-app.tsx renders
 * empty. To finish: call installQuestBoard(game) next to installBlackMarket(game) in
 * turbz-app.tsx, add `questBoard` to the engine Snap, and hook kills/wins/gather/explore
 * events into the quest progress.
 */
import { mulberry32, nextUid } from "./content";

export type BoardQuest = {
  id: string;
  name: string;
  about: string;
  rewardKyo: number;
  active?: boolean;
  progress?: number;
  need?: number;
  kind: "kills" | "wins" | "gather" | "explore";
  target?: string;
};

const TEMPLATES: Omit<BoardQuest, "id" | "active" | "progress">[] = [
  { name: "First Blood", about: "Defeat 3 foes anywhere.", rewardKyo: 35, need: 3, kind: "kills" },
  { name: "Warm-up Hunt", about: "Win 2 battles.", rewardKyo: 30, need: 2, kind: "wins" },
  { name: "Scavenger", about: "Gather from 2 resource nodes.", rewardKyo: 25, need: 2, kind: "gather" },
  { name: "Trail Walker", about: "Visit 2 different regions.", rewardKyo: 40, need: 2, kind: "explore" },
  { name: "Spirit Watch", about: "Defeat 4 foes.", rewardKyo: 45, need: 4, kind: "kills" },
  { name: "Coin Purse", about: "Win 3 battles for the ledger.", rewardKyo: 50, need: 3, kind: "wins" },
  { name: "Herb Run", about: "Gather from 3 nodes.", rewardKyo: 40, need: 3, kind: "gather" },
  { name: "Border Scout", about: "Travel through 3 regions.", rewardKyo: 55, need: 3, kind: "explore" },
  { name: "Hard Day", about: "Defeat 6 foes.", rewardKyo: 70, need: 6, kind: "kills" },
  { name: "Champion's Mark", about: "Win 5 battles.", rewardKyo: 80, need: 5, kind: "wins" },
  { name: "Ash Sweep", about: "Defeat 5 foes in the wilds.", rewardKyo: 60, need: 5, kind: "kills" },
  { name: "Quiet Work", about: "Gather from 4 nodes.", rewardKyo: 55, need: 4, kind: "gather" },
];

export function installQuestBoard(game: any): void {
  if (!game || game.__qbInstalled) return;
  game.__qbInstalled = true;

  game.ensureQuestBoard = function ensureQuestBoard(force = false) {
    const save = this.save;
    if (!save) return;
    const now = Date.now();
    const period = 30 * 60 * 1000;
    if (!force && this.questBoardState && this.questBoardState.until > now) return;

    const seed = (Math.floor(now / period) * 7919 + (save.name?.length || 0) * 17 + (save.level | 0)) >>> 0;
    const rng = mulberry32(seed);
    const pool = TEMPLATES.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picks = pool.slice(0, 10).map((t, i) => {
      const id = `bq_${seed}_${i}_${nextUid()}`;
      return {
        ...t,
        id,
        active: false,
        progress: 0,
      } as BoardQuest;
    });

    this.questBoardState = {
      until: Math.floor(now / period) * period + period,
      seed,
      quests: picks,
      activeId: null as string | null,
      progress: {} as Record<string, number>,
    };
  };

  game.questBoardSnap = function questBoardSnap() {
    this.ensureQuestBoard(false);
    const st = this.questBoardState;
    if (!st) return [];
    const refreshIn = Math.max(0, Math.floor((st.until - Date.now()) / 1000));
    return st.quests.map((q: BoardQuest) => ({
      id: q.id,
      name: q.name,
      about: q.about,
      rewardKyo: q.rewardKyo,
      active: st.activeId === q.id,
      progress: st.activeId === q.id ? (st.progress[q.id] ?? 0) : 0,
      need: q.need ?? 1,
      refreshIn,
    }));
  };

  game.acceptQuest = function acceptQuest(id: string) {
    const save = this.save;
    if (!save) return;
    this.ensureQuestBoard(false);
    const st = this.questBoardState;
    const q = st?.quests?.find((x: BoardQuest) => x.id === id);
    if (!q) return this.say?.("That contract is gone. Wait for the board to refresh.");
    st.activeId = id;
    st.progress[id] = st.progress[id] ?? 0;
    this.say?.(`Accepted: ${q.name}. ${q.about}`);
    this.syncHud?.(true);
  };

  game.tickBoardQuest = function tickBoardQuest(kind: BoardQuest["kind"], amount = 1) {
    const st = this.questBoardState;
    if (!st?.activeId) return;
    const q = st.quests.find((x: BoardQuest) => x.id === st.activeId);
    if (!q || q.kind !== kind) return;
    st.progress[q.id] = (st.progress[q.id] ?? 0) + amount;
    if (st.progress[q.id] >= (q.need ?? 1)) {
      this.completeBoardQuest(q.id);
    } else {
      this.say?.(`${q.name}: ${st.progress[q.id]}/${q.need}`);
      this.syncHud?.(true);
    }
  };

  game.completeBoardQuest = function completeBoardQuest(id: string) {
    const save = this.save;
    const st = this.questBoardState;
    if (!save || !st) return;
    const q = st.quests.find((x: BoardQuest) => x.id === id);
    if (!q) return;
    save.kyo += Math.floor(q.rewardKyo * (1 + (this.skillN?.("social") ?? 0) * 0.0015));
    st.quests = st.quests.filter((x: BoardQuest) => x.id !== id);
    if (st.activeId === id) st.activeId = null;
    delete st.progress[id];
    this.gainSkill?.("adventuring", 18);
    this.gainSkill?.("social", 8);
    this.say?.(`Contract complete: ${q.name}. +${q.rewardKyo} kyo`);
    this.persist?.();
    this.syncHud?.(true);
  };

  const origQuestKill = game.questKill?.bind(game);
  game.questKill = function (mob: unknown) {
    origQuestKill?.(mob);
    this.tickBoardQuest?.("kills", 1);
    this.tickBoardQuest?.("wins", 1);
  };

  const origGain = game.gainSkill?.bind(game);
  game.gainSkill = function (id: string, n: number) {
    origGain?.(id, n);
    if (id === "gathering" || id === "foraging" || id === "mining" || id === "woodcutting") {
      this.tickBoardQuest?.("gather", 1);
    }
  };
}
