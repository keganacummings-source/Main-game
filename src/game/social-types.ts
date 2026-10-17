export type GraveMode = "hunt" | "arena" | "hardcore" | "turbz";

export type GraveGear = {
  slot: string;
  name: string;
  level: number;
  quality: string;
  type: string;
  enchants: { name: string; power: number }[];
  moves: string[];
  /** The piece's signature FX (wings, tail…), if it has one. */
  fx?: string;
};

export type GraveGhost = { name: string; type: string; level: number; rarity: number; shiny: boolean };

/** How she looked: race, class, worn pieces with their FX genes and set aura. */
export type GraveLook = {
  race: string; classId?: string; female: boolean; hair: number; skin: number; tall?: number;
  pieces: { slot: string; style: number; type: string; fxSeed: number; quality: number; gene?: number }[];
  setFx: string | null; setOn: boolean; setVariant?: number; scale?: number; direction?: string;
};

export type GraveBody = {
  mode: GraveMode;
  score: number;
  name: string;
  race: string;
  level: number;
  accountScore: number;
  skills: { name: string; level: number }[];
  gear: GraveGear[];
  note: string;
  className?: string;
  cause?: string;
  place?: string;
  effects?: string[];
  ghosts?: GraveGhost[];
  look?: GraveLook | null;
  /** Base64 GIF for Discord. Sent with the death, never stored on the board. */
  gif?: string;
};

export type GraveRow = GraveBody & {
  id: number;
  username: string;
  createdAt: string;
  at?: number;
};

export type ChatLine = {
  id: number;
  username: string;
  channel: "global" | "friends";
  body: string;
  mine: boolean;
};

export type FriendRow = {
  username: string;
  status: "pending-in" | "pending-out" | "accepted";
};
