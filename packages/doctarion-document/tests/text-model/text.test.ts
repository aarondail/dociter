/* eslint-disable no-irregular-whitespace */
import { Text } from "../../src";

describe("Text", () => {
  test("fromString works", () => {
    expect(Text.fromString("ABC")).toMatchInlineSnapshot(`
      Array [
        "A",
        "B",
        "C",
      ]
    `);
    expect(Text.fromString("The fox 🦊 ate a 🍔. 👩‍👩‍👧‍👧 laughed.")).toMatchInlineSnapshot(`
      Array [
        "T",
        "h",
        "e",
        " ",
        "f",
        "o",
        "x",
        " ",
        "🦊",
        " ",
        "a",
        "t",
        "e",
        " ",
        "a",
        " ",
        "🍔",
        ".",
        " ",
        "👩‍👩‍👧‍👧",
        " ",
        "l",
        "a",
        "u",
        "g",
        "h",
        "e",
        "d",
        ".",
      ]
    `);

    expect(Text.fromString("工　丹冊　廾ヨ尺ヨ")).toMatchInlineSnapshot(`
      Array [
        "工",
        "　",
        "丹",
        "冊",
        "　",
        "廾",
        "ヨ",
        "尺",
        "ヨ",
      ]
    `);

    // This is a wild one
    expect(Text.fromString("Ȋ̴̟̙̺̜̜̮̝̎̋͐͆͘͜͠ ̴̧̗̃̍͝â̷̢̲̳̔̋̾͆m̴̪͎̝͔͔͕̾̎͗̾̍̒̎͑͝ͅ ̷̡̡̱̘̬̯͖̤̬̲̈̌͆͋͆̉́̿͆ḩ̷̢̰͔̩̲̥̭̪̏e̴̛̳͒̇͆͐͝r̷͔̍͒͋̍̓̋͘͝ë̷̦̟̫̼̞̟̺͍̪́̈́͜͝")).toMatchInlineSnapshot(`
      Array [
        "Ȋ̴̟̙̺̜̜̮̝̎̋͐͆͘͜͠",
        " ̴̧̗̃̍͝",
        "â̷̢̲̳̔̋̾͆",
        "m̴̪͎̝͔͔͕̾̎͗̾̍̒̎͑͝ͅ",
        " ̷̡̡̱̘̬̯͖̤̬̲̈̌͆͋͆̉́̿͆",
        "ḩ̷̢̰͔̩̲̥̭̪̏",
        "e̴̛̳͒̇͆͐͝",
        "r̷͔̍͒͋̍̓̋͘͝",
        "ë̷̦̟̫̼̞̟̺͍̪́̈́͜͝",
      ]
    `);

    expect(Text.fromString("🍇 ⋆ 🍉  🎀  𝐼 𝒶𝓂 𝒽𝑒𝓇𝑒  🎀  🍉 ⋆ 🍇")).toMatchInlineSnapshot(`
      Array [
        "🍇",
        " ",
        "⋆",
        " ",
        "🍉",
        " ",
        " ",
        "🎀",
        " ",
        " ",
        "𝐼",
        " ",
        "𝒶",
        "𝓂",
        " ",
        "𝒽",
        "𝑒",
        "𝓇",
        "𝑒",
        " ",
        " ",
        "🎀",
        " ",
        " ",
        "🍉",
        " ",
        "⋆",
        " ",
        "🍇",
      ]
    `);
  });
});
