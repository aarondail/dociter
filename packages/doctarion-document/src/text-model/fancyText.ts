import { FancyGrapheme } from "./fancyGrapheme";

/**
 * FancyText is a combination of Graphemes, Emoji, and Emblems. This is opposed
 * to regular Text which is just Graphemes.
 *
 * Styling and formatting can be applied to both regular Text and FancyText, but
 * is handled separately.
 */
export type FancyText = readonly FancyGrapheme[];
