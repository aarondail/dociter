import { Node } from "../document-model-rd4";
import { Emblem, Emoji, Grapheme } from "../text-model-rd4";

export type PseudoNode = Node | Grapheme | Emoji | Emblem;
