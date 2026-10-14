export type GraveMode = "hunt" | "arena" | "hardcore";

export type GraveGear = {
  slot: string;
  name: string;
  level: number;
  quality: string;
  type: string;
  enchants: { name: string; power: number }[];
  moves: string[];
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
};

export type GraveRow = GraveBody & {
  id: number;
  username: string;
  createdAt: string;
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
