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
];

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
};
