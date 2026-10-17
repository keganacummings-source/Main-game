/**
 * Starter verses that are not the class signature. Each kit is four new verses:
 * a main hit, a second trick, a ward or mend, and a way to move.
 */
type KitMove = {
  id: string;
  name: string;
  type: string;
  power: number;
  accuracy: number;
  crit: number;
  priority: number;
  effect: string;
  anim: string[];
  range: number;
  about: string;
  tactic: string;
  form?: string;
  react?: string;
  fail?: number;
  reach?: number;
  splash?: { radius: number; mult: number };
  chain?: { jumps: number; range: number; mult: number };
  nova?: number;
  echo?: number;
  multi?: { hits: number; gap: number; mult: number };
  selfBuff?: string;
  fx?: string;
  cdMult?: number;
  cls?: string;
};

const v = (
  id: string, name: string, type: string, power: number, acc: number, crit: number, pri: number,
  effect: string, tactic: string, about: string, extra: Partial<KitMove> = {},
): KitMove => ({
  id, name, type, power, accuracy: acc, crit, priority: pri, effect,
  anim: tactic === "heal" || tactic === "ward" ? ["shield", "orbit"] : tactic === "dash" || tactic === "surge" || tactic === "roll" ? ["spiral"] : ["slash", "burst"],
  range: extra.range ?? (tactic === "blink" || tactic === "lunge" ? 150 : tactic === "dash" || tactic === "surge" || tactic === "roll" || tactic === "heal" || tactic === "ward" ? 40 : extra.form === "ranged" ? 160 : extra.form === "spell" ? 140 : 52),
  about, tactic, ...extra,
});

const x = (cls: string, id: string, name: string, type: string, power: number, acc: number, crit: number, pri: number, effect: string, tactic: string, about: string, extra: Partial<KitMove> = {}): KitMove =>
  ({ ...v(id, name, type, power, acc, crit, pri, effect, tactic, about, ringFit(extra)), cls, cdMult: extra.cdMult ?? (extra.multi || extra.chain || extra.nova ? 1.25 : 1.1) });
/** A bespoke ring animation must match the ring: spell rings reach exactly as far, melee rings keep the stock slash. */
function ringFit(extra: Partial<KitMove>): Partial<KitMove> {
  if (!extra.fx || !extra.nova) return extra;
  if (extra.form === "melee") { const { fx: _fx, ...rest } = extra; return rest; }
  return { ...extra, reach: extra.nova };
}

export const KIT_MOVES: KitMove[] = [
  // Bulwark
  v("ck_rampart", "Rampart", "earth", 36, 96, 6, 2, "expose", "strike", "Bulwark starter. A short plated punch that cracks the guard.", { form: "melee", reach: 44 }),
  v("ck_walldrop", "Wall Drop", "earth", 70, 80, 8, 0, "root", "heavy", "Bulwark starter. Drop the shield like a falling gate.", { form: "melee", reach: 60 }),
  v("ck_bulwarkward", "Bulwark Ward", "earth", 0, 100, 0, 3, "shell", "ward", "Bulwark starter. The shield drinks the next blow."),
  v("ck_shieldrush", "Shield Rush", "earth", 32, 90, 8, 1, "root", "lunge", "Bulwark starter. Charge with the shield up and pin them.", { form: "melee", react: "move", fail: 18 }),
  // Spellweaver
  v("ck_staticneedle", "Static Needle", "electric", 28, 100, 12, 3, "spark", "strike", "Spellweaver starter. A fast needle of lightning.", { form: "spell" }),
  v("ck_weaverlash", "Weaver Lash", "electric", 46, 92, 14, 1, "spark", "strike", "Spellweaver starter. A lash that jumps to one more foe.", { form: "spell", chain: { jumps: 1, range: 120, mult: 0.7 } }),
  v("ck_stormward", "Storm Ward", "electric", 0, 100, 0, 3, "shell", "ward", "Spellweaver starter. A cage of sparks around you."),
  v("ck_stormstep", "Storm Step", "electric", 16, 100, 10, 3, "spark", "blink", "Spellweaver starter. Step through the bolt to their side.", { form: "spell", react: "move", fail: 16 }),
  // Spirit Caller
  v("ck_choirpull", "Choir Pull", "spirit", 36, 94, 8, 1, "leech", "strike", "Spirit Caller starter. The choir takes a sip and hands it back.", { form: "spell" }),
  v("ck_sixfold", "Sixfold Ring", "spirit", 30, 100, 6, 1, "gloom", "strike", "Spirit Caller starter. A ring of spirits hits everyone close.", { form: "spell", nova: 88 }),
  v("ck_graveward", "Grave Ward", "spirit", 0, 100, 0, 3, "shell", "ward", "Spirit Caller starter. The dead stand between you and the blow."),
  v("ck_bellstep", "Bell Step", "spirit", 12, 100, 8, 3, "none", "blink", "Spirit Caller starter. A bell, and you are somewhere else.", { form: "spell", react: "move", fail: 16 }),
  // Nightblade
  v("ck_throatnick", "Throat Nick", "void", 30, 98, 34, 3, "expose", "strike", "Nightblade starter. A small cut in the gap. It likes to crit.", { form: "melee", reach: 40 }),
  v("ck_openingcut", "Opening Cut", "void", 44, 94, 18, 2, "expose", "strike", "Nightblade starter. The first honest cut after the feint.", { form: "melee", reach: 52 }),
  v("ck_feintsurge", "Feint", "void", 0, 100, 0, 3, "none", "surge", "Nightblade starter. Sell the feint. Feet and crits sharpen."),
  v("ck_voidroll", "Void Roll", "void", 10, 100, 12, 3, "gloom", "roll", "Nightblade starter. Roll through them and leave a chill.", { form: "melee", react: "roll", fail: 12 }),
  // Pathfinder
  v("ck_windpin", "Wind Pin", "air", 34, 94, 10, 1, "root", "strike", "Pathfinder starter. An arrow that nails their foot to the ground.", { form: "ranged" }),
  v("ck_markingflare", "Marking Flare", "air", 26, 100, 8, 2, "expose", "strike", "Pathfinder starter. A flare that opens the guard for the volley.", { form: "ranged" }),
  v("ck_crowshot", "Crow Shot", "air", 48, 90, 22, 1, "none", "strike", "Pathfinder starter. One careful shot. It looks for the eye.", { form: "ranged" }),
  v("ck_rangestep", "Range Step", "air", 0, 100, 0, 3, "none", "dash", "Pathfinder starter. Two steps back, still on the string.", { fail: 8 }),
  // Ironpalm
  v("ck_palmcheck", "Palm Check", "normal", 26, 100, 10, 3, "none", "strike", "Ironpalm starter. A checking palm. It always arrives first.", { form: "melee", reach: 40 }),
  v("ck_templeheavy", "Temple Bell", "normal", 64, 82, 10, 0, "expose", "heavy", "Ironpalm starter. One heavy palm to the temple.", { form: "melee", reach: 48 }),
  v("ck_breathroll", "Breath Roll", "normal", 8, 100, 8, 3, "none", "roll", "Ironpalm starter. Roll on the exhale. Rarely slips.", { form: "melee", react: "roll", fail: 8 }),
  v("ck_ironrush", "Iron Rush", "normal", 32, 92, 12, 2, "none", "lunge", "Ironpalm starter. Close the step and the palms follow.", { form: "melee", react: "move", fail: 16 }),
  // Bloodrager
  v("ck_ragecleave", "Rage Cleave", "fire", 50, 88, 12, 1, "burn", "strike", "Bloodrager starter. A wide burning cut. Neighbours catch it too.", { form: "melee", reach: 60, splash: { radius: 48, mult: 0.45 } }),
  v("ck_painwell", "Pain Well", "fire", 22, 100, 0, 2, "mend", "heal", "Bloodrager starter. Hurt becomes a little health."),
  v("ck_furydash", "Fury Dash", "fire", 14, 100, 10, 3, "burn", "dash", "Bloodrager starter. Dash through and leave a scorch.", { fail: 12 }),
  v("ck_bloodrush", "Blood Rush", "fire", 40, 86, 14, 1, "burn", "lunge", "Bloodrager starter. A screaming charge that sets them alight.", { form: "melee", react: "move", fail: 20 }),
  // Dreadknight
  v("ck_platebite", "Plate Bite", "ghoul", 42, 92, 12, 1, "leech", "strike", "Dreadknight starter. The plate bites, and you drink.", { form: "melee", reach: 48 }),
  v("ck_boneward", "Bone Ward", "ghoul", 0, 100, 0, 3, "shell", "ward", "Dreadknight starter. Ribs lock across the next hit."),
  v("ck_gravesurge", "Grave Surge", "ghoul", 0, 100, 0, 3, "none", "surge", "Dreadknight starter. The hunger hurries the body."),
  v("ck_hungerstep", "Hunger Step", "ghoul", 28, 92, 14, 2, "leech", "lunge", "Dreadknight starter. Step in and take a mouthful.", { form: "melee", react: "move", fail: 18 }),
  // Vanguard
  v("ck_longwinter", "Long Winter", "ice", 40, 94, 10, 1, "root", "strike", "Vanguard starter. A patient cut that freezes the feet.", { form: "melee", reach: 56 }),
  v("ck_icebreath", "Ice Breath", "ice", 24, 100, 0, 2, "mend", "heal", "Vanguard starter. Cold air knits what the line broke."),
  v("ck_rimeguard", "Rime Guard", "ice", 0, 100, 0, 3, "shell", "ward", "Vanguard starter. Rime plates the next wound shut."),
  v("ck_skatesurge", "Skate", "ice", 0, 100, 0, 3, "none", "surge", "Vanguard starter. Skate on your own frost for a few seconds."),
  // Channeler
  v("ck_heldflame", "Held Flame", "fire", 58, 86, 10, 0, "burn", "channel", "Channeler starter. Hold it until the flame is too big to keep.", { form: "spell" }),
  v("ck_cinderlane", "Cinder Lane", "fire", 36, 94, 8, 1, "burn", "strike", "Channeler starter. A lane of coals between you and them.", { form: "spell" }),
  v("ck_kilnward", "Kiln Ward", "fire", 0, 100, 0, 3, "shell", "ward", "Channeler starter. The kiln door shuts on the next hit."),
  v("ck_ashblink", "Ash Blink", "fire", 14, 100, 8, 3, "burn", "blink", "Channeler starter. Leave as ash and arrive as fire.", { form: "spell", react: "move", fail: 16 }),
  // Wellspring
  v("ck_springwell", "Spring Well", "water", 34, 94, 6, 1, "soak", "strike", "Wellspring starter. A well opens under them and soaks the ring.", { form: "spell", splash: { radius: 50, mult: 0.4 } }),
  v("ck_springmend", "Spring Mend", "water", 40, 100, 0, 2, "mend", "heal", "Wellspring starter. The spring closes the cut."),
  v("ck_brineward", "Brine Ward", "water", 0, 100, 0, 3, "shell", "ward", "Wellspring starter. Salt on the skin. The next blow is smaller."),
  v("ck_tidestep", "Tide Step", "water", 10, 100, 6, 3, "soak", "dash", "Wellspring starter. Step with the tide.", { fail: 10 }),
  // Outrider
  v("ck_tailstrike", "Tail Strike", "air", 36, 96, 16, 2, "none", "strike", "Outrider starter. A shot loosed without slowing down.", { form: "ranged" }),
  v("ck_gustroll", "Gust Roll", "air", 8, 100, 10, 3, "none", "roll", "Outrider starter. The wind rolls you out of the blow.", { react: "roll", fail: 8 }),
  v("ck_overhill", "Over the Hill", "air", 0, 100, 0, 3, "none", "surge", "Outrider starter. Already gone. Faster for a few seconds."),
  v("ck_slipstream", "Slipstream", "air", 12, 100, 12, 3, "none", "dash", "Outrider starter. Dash on the slipstream and nick what you pass.", { fail: 8 }),
  // Earthshaker
  v("ck_hilldrop", "Hill Drop", "earth", 76, 78, 8, 0, "root", "heavy", "Earthshaker starter. A hill's worth of stone, on their head.", { form: "melee", reach: 64, splash: { radius: 56, mult: 0.5 } }),
  v("ck_quakenova", "Quake", "earth", 32, 100, 6, 1, "root", "strike", "Earthshaker starter. Stomp. Everyone close loses their footing.", { form: "melee", nova: 70, reach: 64 }),
  v("ck_stoneward", "Stone Ward", "earth", 0, 100, 0, 2, "shell", "ward", "Earthshaker starter. A slab between you and the hit."),
  v("ck_rootstep", "Root Step", "earth", 28, 88, 8, 1, "root", "lunge", "Earthshaker starter. The roots drag you in and hold them.", { form: "melee", react: "move", fail: 20 }),
  // Beacon
  v("ck_revealbeam", "Reveal Beam", "light", 34, 98, 10, 2, "expose", "strike", "Beacon starter. A beam that shows the gap.", { form: "spell" }),
  v("ck_noonlance", "Noon Lance", "light", 48, 90, 20, 1, "expose", "strike", "Beacon starter. Noon, shaped into a lance.", { form: "spell" }),
  v("ck_lanternward", "Lantern Ward", "light", 0, 100, 0, 3, "shell", "ward", "Beacon starter. The lantern takes the blow."),
  v("ck_dawnblink", "Dawn Blink", "light", 12, 100, 10, 3, "expose", "blink", "Beacon starter. Blink on a ray and leave them lit.", { form: "spell", react: "move", fail: 16 }),
  // Phasewalker
  v("ck_stare", "The Stare", "void", 44, 90, 12, 1, "gloom", "strike", "Phasewalker starter. Let the rift look at them.", { form: "spell" }),
  v("ck_riftward", "Rift Ward", "void", 0, 100, 0, 3, "shell", "ward", "Phasewalker starter. The hole swallows one hit."),
  v("ck_nowhere", "Nowhere", "void", 0, 100, 0, 3, "none", "dash", "Phasewalker starter. A step that does not quite happen here.", { fail: 10 }),
  v("ck_phasecut", "Phase Cut", "void", 22, 96, 16, 3, "gloom", "blink", "Phasewalker starter. Arrive already cutting.", { form: "spell", react: "move", fail: 14 }),
  // Absolver
  v("ck_forgiven", "Forgiven", "light", 24, 100, 6, 2, "expose", "strike", "Absolver starter. A soft blow that still opens the guard.", { form: "spell" }),
  v("ck_fullgrace", "Full Grace", "light", 46, 100, 0, 2, "mend", "heal", "Absolver starter. The long prayer, said shorter."),
  v("ck_mercyward", "Mercy Ward", "light", 0, 100, 0, 3, "shell", "ward", "Absolver starter. Mercy, worn like armor."),
  v("ck_pilgrimstep", "Pilgrim Step", "light", 0, 100, 0, 3, "none", "dash", "Absolver starter. A pilgrim's step out of the swing.", { fail: 10 }),
  // Vigilant
  v("ck_watchmend", "Watch Mend", "spirit", 30, 100, 0, 2, "mend", "heal", "Vigilant starter. The watch mends its own."),
  v("ck_lanternring", "Lantern Ring", "spirit", 28, 100, 6, 1, "gloom", "strike", "Vigilant starter. Fear rolls out in a ring.", { form: "spell", nova: 96 }),
  v("ck_nightwatch", "Night Watch", "spirit", 0, 100, 0, 3, "shell", "ward", "Vigilant starter. The watch takes the hit."),
  v("ck_fearstep", "Fear Step", "spirit", 14, 100, 8, 3, "gloom", "blink", "Vigilant starter. Step out of sight and leave them afraid.", { form: "spell", react: "move", fail: 16 }),
  // Coinmaster
  v("ck_oddsmark", "Odds Mark", "normal", 28, 100, 8, 2, "expose", "strike", "Coinmaster starter. Mark them. The next coin lands worse.", { form: "ranged" }),
  v("ck_interest", "Interest", "normal", 40, 92, 18, 1, "none", "strike", "Coinmaster starter. The debt comes due as a thrown coin.", { form: "ranged" }),
  v("ck_dealdash", "Deal Dash", "normal", 0, 100, 0, 3, "none", "dash", "Coinmaster starter. Leave the table. Quickly.", { fail: 8 }),
  v("ck_pursehook", "Purse Hook", "normal", 22, 94, 12, 2, "none", "lunge", "Coinmaster starter. Hook in and collect.", { form: "melee", react: "move", fail: 16 }),
  // Hexbinder
  v("ck_signedcut", "Signed Cut", "spirit", 40, 92, 12, 1, "leech", "strike", "Hexbinder starter. A cut with your name already on the blood.", { form: "spell" }),
  v("ck_debtnova", "Debt Ring", "spirit", 26, 100, 8, 1, "gloom", "strike", "Hexbinder starter. Everyone near you owes a little life.", { form: "spell", nova: 84 }),
  v("ck_hexward", "Hex Ward", "spirit", 0, 100, 0, 3, "shell", "ward", "Hexbinder starter. The hex sits on the next blow instead."),
  v("ck_pactstep", "Pact Step", "spirit", 16, 96, 12, 3, "leech", "blink", "Hexbinder starter. Step through the pact and take a drop.", { form: "spell", react: "move", fail: 16 }),
  // Corsair
  v("ck_lowblow", "Low Blow", "water", 34, 96, 22, 2, "soak", "strike", "Corsair starter. Below the belt. Salt in it.", { form: "melee", reach: 44 }),
  v("ck_plunder", "Plunder", "water", 46, 90, 14, 1, "soak", "strike", "Corsair starter. Take the cut and the coin of blood.", { form: "melee", reach: 52 }),
  v("ck_saltroll", "Salt Roll", "water", 10, 100, 10, 3, "soak", "roll", "Corsair starter. Roll under the swing, soaking as you go.", { form: "melee", react: "roll", fail: 10 }),
  v("ck_boardlunge", "Boarding Lunge", "water", 32, 90, 14, 2, "soak", "lunge", "Corsair starter. Board them. The deck is wherever you land.", { form: "melee", react: "move", fail: 16 }),
  // Warlord
  v("ck_commandstrike", "Command Strike", "normal", 44, 94, 10, 1, "expose", "strike", "Warlord starter. A blow that tells the line where to look.", { form: "melee", reach: 56 }),
  v("ck_fieldheal", "Field Mend", "normal", 26, 100, 0, 2, "mend", "heal", "Warlord starter. A short mend between orders."),
  v("ck_bannerward", "Banner Ward", "normal", 0, 100, 0, 3, "shell", "ward", "Warlord starter. The banner takes the hit."),
  v("ck_linecharge", "Line Charge", "normal", 36, 88, 10, 1, "expose", "lunge", "Warlord starter. The line charges with you.", { form: "melee", react: "move", fail: 18 }),
  // Nightlord
  v("ck_drinkspell", "Drink", "ghoul", 42, 92, 12, 1, "leech", "strike", "Nightlord starter. A short drink across the air.", { form: "spell" }),
  v("ck_thirstheavy", "Deep Thirst", "ghoul", 62, 84, 10, 0, "leech", "channel", "Nightlord starter. Hold the thirst until it is a river.", { form: "spell" }),
  v("ck_veinward", "Vein Ward", "ghoul", 0, 100, 0, 3, "shell", "ward", "Nightlord starter. Their blood, worn as a ward."),
  v("ck_bloodblink", "Blood Blink", "ghoul", 18, 94, 14, 3, "leech", "blink", "Nightlord starter. Blink on a vein and arrive fed.", { form: "spell", react: "move", fail: 16 }),
  // Songweaver
  v("ck_versehook", "Verse Hook", "air", 36, 96, 10, 2, "gloom", "strike", "Songweaver starter. A hooked note that unsettles.", { form: "spell" }),
  v("ck_restnote", "Rest Note", "air", 32, 100, 0, 2, "mend", "heal", "Songweaver starter. The quiet bar. It mends."),
  v("ck_chorus", "Chorus", "air", 28, 100, 8, 1, "gloom", "strike", "Songweaver starter. The chorus hits everyone in the ring.", { form: "spell", nova: 90 }),
  v("ck_dancestep", "Dance Step", "air", 8, 100, 12, 3, "none", "dash", "Songweaver starter. A dance step out of the measure.", { fail: 8 }),
  // Oathkeeper
  v("ck_answerblade", "Answer", "light", 40, 94, 14, 2, "expose", "strike", "Oathkeeper starter. The answer to being hit.", { form: "melee", reach: 56 }),
  v("ck_vowstrike", "Vow", "light", 68, 82, 12, 0, "expose", "heavy", "Oathkeeper starter. The vow, spoken with steel.", { form: "melee", reach: 60 }),
  v("ck_swornward", "Sworn Ward", "light", 0, 100, 0, 3, "shell", "ward", "Oathkeeper starter. The oath stands in front of you."),
  v("ck_oathcharge", "Oath Charge", "light", 34, 90, 12, 1, "expose", "lunge", "Oathkeeper starter. Charge because you said you would.", { form: "melee", react: "move", fail: 18 }),
  // Ronin
  v("ck_seconddraw", "Second Draw", "fire", 36, 96, 28, 3, "burn", "strike", "Ronin starter. The cut after the draw. Still early.", { form: "melee", reach: 52 }),
  v("ck_burningedge", "Burning Edge", "fire", 48, 90, 16, 1, "burn", "strike", "Ronin starter. The edge stays hot.", { form: "melee", reach: 56 }),
  v("ck_sheathdash", "Sheath Dash", "fire", 8, 100, 14, 3, "none", "dash", "Ronin starter. Sheathe and leave.", { fail: 8 }),
  v("ck_iailunge", "Draw Lunge", "fire", 34, 92, 22, 2, "burn", "lunge", "Ronin starter. Draw on the way in.", { form: "melee", react: "move", fail: 16 }),
  // Seraph
  v("ck_feathercut", "Feather Cut", "light", 32, 96, 14, 2, "expose", "strike", "Seraph starter. A cut from above.", { form: "spell" }),
  v("ck_skymend", "Sky Mend", "light", 28, 100, 0, 2, "mend", "heal", "Seraph starter. Mend on the wing."),
  v("ck_glideward", "Glide Ward", "light", 0, 100, 0, 3, "shell", "ward", "Seraph starter. Feathers take the blow."),
  v("ck_ascent", "Ascent", "light", 0, 100, 0, 3, "none", "surge", "Seraph starter. Climb. The ground stops mattering."),
  // Moonhopper
  v("ck_bouncecut", "Bounce Cut", "air", 30, 98, 18, 3, "none", "strike", "Moonhopper starter. A cut on the bounce.", { form: "ranged" }),
  v("ck_moonkick", "Moon Kick", "air", 38, 90, 16, 1, "none", "lunge", "Moonhopper starter. A kick from too far away.", { form: "melee", react: "move", fail: 14 }),
  v("ck_fliproll", "Flip", "air", 8, 100, 16, 3, "none", "roll", "Moonhopper starter. Flip out of the hit.", { react: "roll", fail: 8 }),
  v("ck_hopdash", "Hop Dash", "air", 10, 100, 14, 3, "none", "dash", "Moonhopper starter. Another hop. They still haven't pinned you.", { fail: 6 }),
  // Bladedancer
  v("ck_stepcut", "Step Cut", "spirit", 34, 98, 16, 3, "none", "strike", "Bladedancer starter. The cut is the step.", { form: "melee", reach: 52 }),
  v("ck_tempo", "Tempo", "spirit", 0, 100, 0, 3, "none", "surge", "Bladedancer starter. The tempo lifts. Verses come back hungry."),
  v("ck_silkroll", "Silk Roll", "spirit", 10, 100, 14, 3, "gloom", "roll", "Bladedancer starter. Silk, then you are behind the swing.", { form: "melee", react: "roll", fail: 8 }),
  v("ck_spinlunge", "Spin Lunge", "spirit", 32, 92, 18, 2, "gloom", "lunge", "Bladedancer starter. Spin in and keep spinning.", { form: "melee", react: "move", fail: 14 }),
  // Sovereign
  v("ck_edict", "Edict", "light", 36, 96, 8, 2, "silence", "strike", "Sovereign starter. A shorter decree. Still rude.", { form: "spell" }),
  v("ck_levy", "Levy", "light", 44, 90, 10, 1, "expose", "strike", "Sovereign starter. The crown collects, in light.", { form: "spell" }),
  v("ck_crownward", "Crown Ward", "light", 0, 100, 0, 3, "shell", "ward", "Sovereign starter. The crown takes the blow."),
  v("ck_courtstep", "Court Step", "light", 0, 100, 0, 3, "none", "dash", "Sovereign starter. The court makes way.", { fail: 10 }),
  // ---- Signature batch: two complex verses per class (multi-hit, combos, areas, chains, self-buffs) ----
  x("warden", "sx_aegisquake", "Aegis Quake", "earth", 58, 90, 8, 0, "root", "heavy", "Slam the shield three times; the ground ripples out each time.", { form: "melee", reach: 56, nova: 72, multi: { hits: 3, gap: 0.22, mult: 0.45 }, fx: "fissure" }),
  x("warden", "sx_bulwarkcharge", "Bulwark Charge", "earth", 40, 92, 6, 1, "expose", "lunge", "Charge behind the shield, cracking guards, then brace.", { form: "melee", react: "move", fail: 16, splash: { radius: 44, mult: 0.5 }, selfBuff: "shell" }),
  x("spellweaver", "sx_stormlattice", "Storm Lattice", "electric", 46, 94, 12, 1, "spark", "strike", "A lattice of bolts that leaps across five foes.", { form: "spell", chain: { jumps: 4, range: 130, mult: 0.8 }, fx: "chain" }),
  x("spellweaver", "sx_thunderglyph", "Thunder Glyph", "electric", 62, 86, 10, 0, "spark", "channel", "Draw a glyph and let it strike four times.", { form: "spell", multi: { hits: 4, gap: 0.18, mult: 0.35 }, splash: { radius: 52, mult: 0.4 }, fx: "sigil" }),
  x("spiritbinder", "sx_requiem", "Requiem", "spirit", 40, 96, 8, 1, "gloom", "strike", "The choir sings in a ring, then sings again.", { form: "spell", nova: 104, echo: 0.6, fx: "spectral" }),
  x("spiritbinder", "sx_soulweave", "Soul Weave", "spirit", 34, 100, 6, 2, "leech", "strike", "Thread the dead between foes; every stitch drinks.", { form: "spell", chain: { jumps: 3, range: 120, mult: 0.85 } }),
  x("nightblade", "sx_thousandcuts", "Thousand Cuts", "void", 22, 98, 30, 2, "expose", "strike", "Five cuts so fast they land as one.", { form: "melee", reach: 44, multi: { hits: 5, gap: 0.08, mult: 0.7 } }),
  x("nightblade", "sx_umbralstep", "Umbral Step", "void", 30, 96, 26, 3, "gloom", "blink", "Step through their shadow and stab twice on arrival.", { form: "melee", react: "move", fail: 12, multi: { hits: 2, gap: 0.12, mult: 0.8 }, selfBuff: "swift" }),
  x("pathfinder", "sx_stormvolley", "Storm Volley", "air", 30, 92, 12, 1, "none", "strike", "Six arrows in a fan; the far ones still bite.", { form: "ranged", multi: { hits: 3, gap: 0.12, mult: 0.6 }, splash: { radius: 48, mult: 0.5 }, fx: "barrage" }),
  x("pathfinder", "sx_hunterstrap", "Hunter's Trap", "air", 36, 96, 10, 1, "root", "strike", "A snare arrow that pins the target and everyone beside it.", { form: "ranged", splash: { radius: 60, mult: 0.6 } }),
  x("ironpalm", "sx_dragoncombo", "Dragon Combo", "normal", 24, 98, 14, 2, "none", "strike", "Jab, jab, palm, knee, uppercut: a five-step string.", { form: "melee", reach: 42, multi: { hits: 5, gap: 0.12, mult: 0.75 }, selfBuff: "swift" }),
  x("ironpalm", "sx_shockwavepalm", "Shockwave Palm", "normal", 60, 88, 10, 0, "expose", "heavy", "One palm so heavy the air behind them breaks.", { form: "melee", reach: 48, splash: { radius: 70, mult: 0.55 }, fx: "wave" }),
  x("bloodrager", "sx_carnage", "Carnage", "fire", 44, 88, 14, 1, "burn", "strike", "Three wide burning swings that chew through a crowd.", { form: "melee", reach: 60, nova: 68, multi: { hits: 3, gap: 0.2, mult: 0.55 } }),
  x("bloodrager", "sx_skullsplitter", "Skullsplitter", "fire", 88, 78, 18, 0, "expose", "heavy", "Raise the axe high and bring it down through the guard.", { form: "melee", reach: 60, splash: { radius: 40, mult: 0.5 }, fx: "meteor" }),
  x("ghoulknight", "sx_deathknell", "Death Knell", "ghoul", 50, 90, 10, 1, "leech", "strike", "The greatsword rings twice and the dead answer.", { form: "melee", reach: 58, echo: 0.7, nova: 60 }),
  x("ghoulknight", "sx_marrowcleave", "Marrow Cleave", "ghoul", 72, 84, 12, 0, "leech", "heavy", "A slow cleave that drinks from everyone it touches.", { form: "melee", reach: 62, splash: { radius: 56, mult: 0.6 }, selfBuff: "shell" }),
  x("frostblade", "sx_permafrost", "Permafrost", "ice", 48, 92, 8, 1, "root", "strike", "Plant the blade; ice spikes burst in a ring.", { form: "melee", reach: 56, nova: 84, fx: "pillar" }),
  x("frostblade", "sx_avalanche", "Avalanche", "ice", 34, 90, 10, 1, "root", "lunge", "Crash forward like falling snow, three heavy blows.", { form: "melee", react: "move", fail: 18, multi: { hits: 3, gap: 0.16, mult: 0.6 } }),
  x("pyromancer", "sx_firestorm", "Firestorm", "fire", 40, 90, 8, 0, "burn", "channel", "Meteors fall in waves around the target.", { form: "spell", multi: { hits: 4, gap: 0.25, mult: 0.45 }, splash: { radius: 64, mult: 0.6 }, fx: "meteor" }),
  x("pyromancer", "sx_flamewhip", "Flame Whip", "fire", 38, 94, 10, 1, "burn", "strike", "A whip of fire that cracks across three foes.", { form: "spell", chain: { jumps: 2, range: 110, mult: 0.85 }, echo: 0.4 }),
  x("tidecaller", "sx_tsunami", "Tsunami", "water", 50, 90, 6, 0, "soak", "strike", "A wall of water that rolls over everything in front of it.", { form: "spell", splash: { radius: 80, mult: 0.7 }, fx: "wave" }),
  x("tidecaller", "sx_whirlpool", "Whirlpool", "water", 28, 100, 6, 1, "soak", "strike", "A whirlpool that keeps pulling, hit after hit.", { form: "spell", multi: { hits: 4, gap: 0.3, mult: 0.5 }, nova: 70, fx: "vortex" }),
  x("stormrider", "sx_galeblades", "Gale Blades", "air", 30, 96, 16, 2, "none", "strike", "Four wind blades that boomerang back.", { form: "ranged", multi: { hits: 2, gap: 0.1, mult: 0.8 }, echo: 0.6, fx: "boomerang" }),
  x("stormrider", "sx_jetstream", "Jetstream", "air", 26, 100, 12, 3, "none", "dash", "Ride the jetstream and cut a line through the pack.", { fail: 8, nova: 60, selfBuff: "swift" }),
  x("briarmage", "sx_tectonicfury", "Tectonic Fury", "earth", 54, 86, 8, 0, "root", "heavy", "Three quakes, each wider than the last.", { form: "melee", reach: 64, nova: 96, multi: { hits: 3, gap: 0.3, mult: 0.5 }, fx: "fissure" }),
  x("briarmage", "sx_bouldertoss", "Boulder Toss", "earth", 64, 84, 10, 0, "root", "strike", "Rip up a boulder and throw it. It shatters on landing.", { form: "ranged", splash: { radius: 70, mult: 0.6 }, fx: "meteor" }),
  x("lightbringer", "sx_prism", "Prism Ray", "light", 40, 96, 18, 1, "expose", "strike", "A ray that splits through a prism to four more foes.", { form: "spell", chain: { jumps: 4, range: 140, mult: 0.75 } }),
  x("lightbringer", "sx_daybreak", "Daybreak", "light", 46, 92, 14, 1, "expose", "strike", "The sun rises in a ring around you, twice.", { form: "spell", nova: 96, echo: 0.6, fx: "nova" }),
  x("voidwalker", "sx_eventhorizon", "Event Horizon", "void", 44, 90, 12, 0, "gloom", "channel", "A small black hole that chews everything near it.", { form: "spell", multi: { hits: 4, gap: 0.22, mult: 0.45 }, splash: { radius: 66, mult: 0.6 }, fx: "vortex" }),
  x("voidwalker", "sx_mirrorrift", "Mirror Rift", "void", 30, 96, 18, 3, "gloom", "blink", "Blink, leaving a rift that cuts on both ends.", { form: "spell", react: "move", fail: 12, echo: 0.8 }),
  x("absolver", "sx_sanctuary", "Sanctuary", "light", 44, 100, 0, 2, "mend", "heal", "A long mend that keeps knitting after the prayer.", { selfBuff: "shell" }),
  x("absolver", "sx_judgmentbell", "Judgment Bell", "light", 34, 98, 8, 1, "silence", "strike", "A bell rings out over everyone close and silences them.", { form: "spell", nova: 92, fx: "pillar" }),
  x("vigilant", "sx_wardingcircle", "Warding Circle", "spirit", 30, 100, 6, 1, "gloom", "strike", "A circle of lanterns that frightens and then flares.", { form: "spell", nova: 100, echo: 0.5, selfBuff: "shell" }),
  x("vigilant", "sx_sentinelshot", "Sentinel Shot", "spirit", 40, 96, 14, 2, "gloom", "strike", "A watchfire bolt that jumps to two more foes.", { form: "spell", chain: { jumps: 2, range: 120, mult: 0.8 } }),
  x("coinmaster", "sx_jackpot", "Jackpot", "normal", 18, 96, 20, 2, "none", "strike", "Seven coins, fired so fast they sound like one.", { form: "ranged", multi: { hits: 7, gap: 0.06, mult: 0.6 }, fx: "barrage" }),
  x("coinmaster", "sx_goldrush", "Gold Rush", "normal", 32, 100, 10, 3, "expose", "dash", "Dash through the crowd scattering sharp coins.", { fail: 8, nova: 64, selfBuff: "swift" }),
  x("hexbinder", "sx_hexchain", "Hex Chain", "spirit", 36, 94, 10, 1, "leech", "strike", "A cursed chain that binds four foes together.", { form: "spell", chain: { jumps: 3, range: 110, mult: 0.9 } }),
  x("hexbinder", "sx_voodoo", "Voodoo Doll", "spirit", 24, 100, 8, 1, "gloom", "strike", "Pins in the doll, one at a time.", { form: "spell", multi: { hits: 4, gap: 0.2, mult: 0.7 }, fx: "sigil" }),
  x("corsair", "sx_broadside", "Broadside", "water", 40, 88, 12, 0, "soak", "strike", "A pistol volley and a cutlass slash in one motion.", { form: "ranged", multi: { hits: 3, gap: 0.14, mult: 0.6 }, splash: { radius: 44, mult: 0.5 } }),
  x("corsair", "sx_riptide", "Riptide Slash", "water", 30, 96, 18, 2, "soak", "strike", "A cross slash, then a reverse.", { form: "melee", reach: 50, multi: { hits: 2, gap: 0.1, mult: 0.9 }, echo: 0.5 }),
  x("warlord", "sx_warpath", "Warpath", "normal", 44, 90, 10, 1, "expose", "lunge", "Lead the charge: a lunge, a cleave, a shoulder.", { form: "melee", react: "move", fail: 16, multi: { hits: 3, gap: 0.18, mult: 0.55 } }),
  x("warlord", "sx_commandersarc", "Commander's Arc", "normal", 50, 92, 10, 1, "expose", "strike", "A wide sweeping cut that tells the line to follow.", { form: "melee", reach: 60, nova: 70, selfBuff: "swift" }),
  x("nightlord", "sx_batswarm", "Bat Swarm", "ghoul", 22, 100, 8, 1, "leech", "strike", "A swarm that bites five times and returns the blood.", { form: "spell", multi: { hits: 5, gap: 0.12, mult: 0.6 }, chain: { jumps: 1, range: 100, mult: 0.7 } }),
  x("nightlord", "sx_hemorrhage", "Hemorrhage", "ghoul", 58, 88, 10, 0, "leech", "channel", "Open every vein close by.", { form: "spell", nova: 88, fx: "bloom" }),
  x("songweaver", "sx_crescendo", "Crescendo", "air", 26, 100, 8, 1, "gloom", "strike", "Each note louder than the last, four in all.", { form: "spell", multi: { hits: 4, gap: 0.18, mult: 0.7 }, nova: 80 }),
  x("songweaver", "sx_lullaby", "Lullaby", "air", 20, 96, 0, 1, "sleep", "strike", "A soft tune that puts a whole ring to sleep.", { form: "spell", nova: 96, fx: "wave" }),
  x("oathkeeper", "sx_divinesmite", "Divine Smite", "light", 70, 86, 14, 0, "expose", "heavy", "A pillar of light follows the blade down.", { form: "melee", reach: 58, splash: { radius: 56, mult: 0.6 }, fx: "pillar" }),
  x("oathkeeper", "sx_crusade", "Crusade", "light", 36, 92, 12, 1, "expose", "lunge", "Charge, strike, strike again, then raise the shield.", { form: "melee", react: "move", fail: 16, multi: { hits: 2, gap: 0.16, mult: 0.8 }, selfBuff: "shell" }),
  x("ronin", "sx_crescentmoon", "Crescent Moon", "fire", 38, 94, 30, 2, "burn", "strike", "A crescent arc of flame off the drawn blade.", { form: "melee", reach: 60, nova: 64, echo: 0.5 }),
  x("ronin", "sx_eightfold", "Eightfold Cut", "fire", 18, 98, 34, 2, "burn", "strike", "Eight cuts in a single breath.", { form: "melee", reach: 48, multi: { hits: 8, gap: 0.06, mult: 0.55 } }),
  x("seraph", "sx_featherstorm", "Feather Storm", "light", 24, 98, 14, 1, "expose", "strike", "A storm of razor feathers falling around the target.", { form: "spell", multi: { hits: 4, gap: 0.14, mult: 0.6 }, splash: { radius: 56, mult: 0.5 }, fx: "barrage" }),
  x("seraph", "sx_divebomb", "Divebomb", "light", 50, 90, 16, 1, "expose", "lunge", "Climb, then dive wings-first into the crowd.", { form: "melee", react: "move", fail: 14, nova: 70 }),
  x("moonhopper", "sx_lunarbarrage", "Lunar Barrage", "air", 22, 96, 20, 2, "none", "strike", "Moonbeam kicks from above, three hops in a row.", { form: "ranged", multi: { hits: 3, gap: 0.16, mult: 0.75 }, splash: { radius: 40, mult: 0.5 } }),
  x("moonhopper", "sx_cratercrash", "Crater Crash", "air", 54, 88, 14, 0, "root", "heavy", "Hop to the moon and land on them.", { form: "melee", reach: 60, nova: 80, fx: "meteor" }),
  x("bladedancer", "sx_veilstorm", "Veil Storm", "spirit", 26, 98, 16, 2, "gloom", "strike", "A spinning storm of silk and steel, six cuts around you.", { form: "melee", reach: 50, nova: 70, multi: { hits: 3, gap: 0.12, mult: 0.6 } }),
  x("bladedancer", "sx_ribbonlunge", "Ribbon Lunge", "spirit", 30, 96, 18, 2, "gloom", "lunge", "Lunge on a ribbon and keep moving.", { form: "melee", react: "move", fail: 12, echo: 0.6, selfBuff: "swift" }),
  x("sovereign", "sx_crownfall", "Crownfall", "light", 52, 90, 10, 0, "silence", "strike", "A golden crown falls from the sky and shatters.", { form: "spell", splash: { radius: 72, mult: 0.65 }, fx: "meteor" }),
  x("sovereign", "sx_royalguard", "Royal Guard", "light", 30, 100, 6, 1, "expose", "strike", "Phantom guards strike every foe near the throne.", { form: "spell", nova: 92, multi: { hits: 2, gap: 0.2, mult: 0.7 }, selfBuff: "shell" }),
  // Crying Girl
  x("cryinggirl", "ck_tearlance", "Tear Lance", "water", 48, 94, 12, 1, "soak", "strike", "Crying Girl signature. A lance of tears that pierces three foes.", { form: "spell", chain: { jumps: 2, range: 120, mult: 0.85 } }),
  x("cryinggirl", "ck_sobwave", "Sob Wave", "water", 30, 100, 6, 1, "soak", "strike", "One sob, and a wave rolls out around her.", { form: "spell", nova: 90, fx: "wave" }),
  x("cryinggirl", "ck_sorrowmend", "Sorrow Mend", "water", 36, 100, 0, 2, "mend", "heal", "Crying it out. It helps."),
  x("cryinggirl", "ck_puddlestep", "Puddle Step", "water", 10, 100, 8, 3, "soak", "blink", "Sink into a puddle and come up somewhere else.", { form: "spell", react: "move", fail: 14 }),
  x("cryinggirl", "sx_monsoon", "Monsoon", "water", 22, 98, 8, 1, "soak", "channel", "The sky cries with her: five falling waves.", { form: "spell", multi: { hits: 5, gap: 0.2, mult: 0.55 }, splash: { radius: 70, mult: 0.5 }, fx: "barrage" }),
  x("cryinggirl", "sx_weepingblade", "Weeping Blade", "water", 26, 98, 16, 2, "soak", "strike", "A blade of tears: three quick cuts, then she weeps again.", { form: "melee", reach: 52, multi: { hits: 3, gap: 0.12, mult: 0.7 } }),
  x("cryinggirl", "sx_heartbreak", "Heartbreak", "water", 66, 86, 18, 0, "gloom", "heavy", "Everything she held in, all at once.", { form: "spell", nova: 80, echo: 0.5, fx: "bloom" }),
];

const SIGNATURE_BATCH = KIT_MOVES.filter((m) => m.cls);

export const STARTER_KITS: Record<string, string[]> = {
  warden: ["shieldbash", "ck_rampart", "ck_walldrop", "ck_bulwarkward", "ck_shieldrush"],
  spellweaver: ["arcbolt", "ck_staticneedle", "ck_weaverlash", "ck_stormward", "ck_stormstep"],
  spiritbinder: ["soulmend", "ck_choirpull", "ck_sixfold", "ck_graveward", "ck_bellstep"],
  nightblade: ["shadowstrike", "ck_throatnick", "ck_openingcut", "ck_feintsurge", "ck_voidroll"],
  pathfinder: ["piercingvolley", "ck_windpin", "ck_markingflare", "ck_crowshot", "ck_rangestep"],
  ironpalm: ["hundredpalm", "ck_palmcheck", "ck_templeheavy", "ck_breathroll", "ck_ironrush"],
  bloodrager: ["rampage", "ck_ragecleave", "ck_painwell", "ck_furydash", "ck_bloodrush"],
  ghoulknight: ["soulreap", "ck_platebite", "ck_boneward", "ck_gravesurge", "ck_hungerstep"],
  frostblade: ["glaciercharge", "ck_longwinter", "ck_icebreath", "ck_rimeguard", "ck_skatesurge"],
  pyromancer: ["inferno", "ck_heldflame", "ck_cinderlane", "ck_kilnward", "ck_ashblink"],
  tidecaller: ["maelstrom", "ck_springwell", "ck_springmend", "ck_brineward", "ck_tidestep"],
  stormrider: ["cyclone", "ck_tailstrike", "ck_gustroll", "ck_overhill", "ck_slipstream"],
  briarmage: ["tectonic", "ck_hilldrop", "ck_quakenova", "ck_stoneward", "ck_rootstep"],
  lightbringer: ["sunburst", "ck_revealbeam", "ck_noonlance", "ck_lanternward", "ck_dawnblink"],
  voidwalker: ["abyssrift", "ck_stare", "ck_riftward", "ck_nowhere", "ck_phasecut"],
  absolver: ["absolution", "ck_forgiven", "ck_fullgrace", "ck_mercyward", "ck_pilgrimstep"],
  vigilant: ["vigilward", "ck_watchmend", "ck_lanternring", "ck_nightwatch", "ck_fearstep"],
  coinmaster: ["cointoss", "ck_oddsmark", "ck_interest", "ck_dealdash", "ck_pursehook"],
  hexbinder: ["bloodpact", "ck_signedcut", "ck_debtnova", "ck_hexward", "ck_pactstep"],
  corsair: ["cutlass", "ck_lowblow", "ck_plunder", "ck_saltroll", "ck_boardlunge"],
  warlord: ["rallycry", "ck_commandstrike", "ck_fieldheal", "ck_bannerward", "ck_linecharge"],
  nightlord: ["crimsondrain", "ck_drinkspell", "ck_thirstheavy", "ck_veinward", "ck_bloodblink"],
  songweaver: ["ballad", "ck_versehook", "ck_restnote", "ck_chorus", "ck_dancestep"],
  oathkeeper: ["judgment", "ck_answerblade", "ck_vowstrike", "ck_swornward", "ck_oathcharge"],
  ronin: ["iaido", "ck_seconddraw", "ck_burningedge", "ck_sheathdash", "ck_iailunge"],
  seraph: ["wingburst", "ck_feathercut", "ck_skymend", "ck_glideward", "ck_ascent"],
  moonhopper: ["moonhop", "ck_bouncecut", "ck_moonkick", "ck_fliproll", "ck_hopdash"],
  bladedancer: ["whirlingveil", "ck_stepcut", "ck_tempo", "ck_silkroll", "ck_spinlunge"],
  sovereign: ["royaldecree", "ck_edict", "ck_levy", "ck_crownward", "ck_courtstep"],
  cryinggirl: ["ck_tearlance", "ck_sobwave", "ck_sorrowmend", "ck_puddlestep"],
};
for (const m of SIGNATURE_BATCH) {
  const kit = STARTER_KITS[m.cls!];
  if (kit && !kit.includes(m.id)) kit.push(m.id);
}
