/**
 * How big the witch is on screen, in one place.
 *
 * Class/witch sheets are 32×44 frames fitted to one 32px tile. WITCH_SIZE draws her half again
 * as tall as that fit, and everything that hugs her body reads the same number: the set aura,
 * the worn-gear motes, and any effect the engine places "N pixels above her feet".
 * Change this one value and the body and all of its effects grow together.
 */
export const WITCH_SIZE = 1.5;