/**
 * Pixel-Icons für Custom Items und Crafting-Zutaten.
 * Wird serverseitig (Item-/Rezeptseiten) und im Browser (Live-Vorschau im Admin-Panel) genutzt.
 */

const MAPS: Record<string, readonly string[]> = {
  sword: [
    ".............oo.",
    "............ollo",
    "...........olmmo",
    "..........olmdo.",
    ".........olmdo..",
    "........olmdo...",
    "....o..olmdo....",
    "...ogoolmdo.....",
    "..ogoolmdo......",
    "..oGggmdo.......",
    "...oGggoo.......",
    "..oHhGgggo......",
    ".oHhooGgo.......",
    "oGho..oo........",
    "ogGo............",
    ".oo............."
  ],
  pickaxe: [
    "................",
    ".....oooooo.....",
    "....ollllllo....",
    "...olmmmmmmlo...",
    "..oldoooooohmo..",
    "...oo....ohodmo.",
    "........ohHodmo.",
    ".......ohHoodmo.",
    "......ohHo.odmo.",
    ".....ohHo..odmo.",
    "....ohHo...omo..",
    "...ohHo...omo...",
    "..ohHo.....o....",
    ".ohHo...........",
    ".oHo............",
    "..o............."
  ],
  axe: [
    ".......omo......",
    ".....oommmo..o..",
    "....ommmmmmooho.",
    "...olmmmmmmdhHo.",
    "..olllmmmmdhoo..",
    "...ollmmmdhHo...",
    "....oommdhoo....",
    "......oohHo.....",
    "......ohoo......",
    ".....ohHo.......",
    "....ohoo........",
    "...ohHo.........",
    "..ohoo..........",
    ".ohHo...........",
    "..oo............",
    "................"
  ],
  helmet: [
    "................",
    "................",
    ".....oooooo.....",
    "....ollmmmmo....",
    "...omlllmmmmo...",
    "..ollmmmmmmmdo..",
    ".omlmmmmmmmmmdo.",
    ".omlmmmmmmmmmdo.",
    ".ommmggggggmmdo.",
    ".ommdoooooommdo.",
    ".ommdo....ommdo.",
    ".ommdo....ommdo.",
    ".ommdo....ommdo.",
    "..ooo......ooo..",
    "................",
    "................"
  ],
  lantern: [
    "......oSSo......",
    ".....oSooSo.....",
    "....oSSSSSSo....",
    "...osssssssso...",
    "...oSssssssSo...",
    "...oSmmmmmmSo...",
    "...oSmllllmSo...",
    "...oSmlwwlmSo...",
    "...oSmlwllmSo...",
    "...oSmllllmSo...",
    "...oSmmmmmmSo...",
    "...oSmmmmmmSo...",
    "...osssssssso...",
    "....oSSSSSSo....",
    ".....oooooo.....",
    "................"
  ],
  potion: [
    ".......oo.......",
    "......ohho......",
    "......oHHo......",
    "......oxxo......",
    ".....ooxxoo.....",
    "....oxxxxxxo....",
    "...oxwxxxxxxo...",
    "..oxxwxxxxxxo...",
    "..ommmmmmmmmmo..",
    "..omllmmmmmmmo..",
    "..omlmmmmmmmdo..",
    "..ommmlmmmmmdo..",
    "...ommmmmmmdo...",
    "....ommmmmdo....",
    ".....oooooo.....",
    "................"
  ],
  shard: [
    "................",
    "................",
    ".........oo.....",
    "........olmo....",
    ".......olmmmo...",
    ".......olmmo....",
    "......olwmmo....",
    "......olmmo.....",
    ".....olmmmo.o...",
    ".....olmmo.omo..",
    "....olmmdo.omdo.",
    "....olmmo.owmo..",
    "...olmmdoommo...",
    "...ommdo.omdo...",
    "....ooo...oo....",
    "................"
  ],
  rod: [
    "................",
    ".............o..",
    "............oho.",
    "...........ohHFo",
    "..........ohooFo",
    ".........ohHooFo",
    "........ohoo.oFo",
    ".......ohHo..oFo",
    "......ohoo...oFo",
    ".....ohHo....oFo",
    "....ohoo.....oFo",
    "...omdo.....ooFo",
    "..omdo.....ososo",
    ".omdo.......osSo",
    "..oo.........oo.",
    "................"
  ],
  banner: [
    ".oooooooooooooo.",
    "oHhhhhhhhhhhhhHo",
    ".ooddddddddddoo.",
    "..olmmmmmmmmdo..",
    "..olmmmmmmmmdo..",
    "..olmmmggmmmdo..",
    "..olmmglggmmdo..",
    "..olmmggGgmmdo..",
    "..olmmmggmmmdo..",
    "..olmmmmmmmmdo..",
    "..olmmmmmmmmdo..",
    "..olmmmmmmmmdo..",
    "..ommmommommdo..",
    "...oooommoooo...",
    ".......oo.......",
    "................"
  ],
  star: [
    "................",
    "................",
    ".......oo.......",
    "......ollo......",
    "......ollo......",
    "..oooolwmmoooo..",
    ".olllllmmmmmmdo.",
    "..olllmmmmmmdo..",
    "...olmmmmmmdo...",
    "....ommmmmdo....",
    "....ommmmddo....",
    "....ommmdddo....",
    "...ommooooddo...",
    "...omo....odo...",
    "....o......o....",
    "................"
  ],
  ingot: [
    "................",
    "................",
    "................",
    "................",
    "......oooooooo..",
    ".....ollllllllo.",
    "....olllllllldo.",
    "...ollwwllllddo.",
    "..olllllllldddo.",
    ".olllllllldddo..",
    ".ommmmmmmmddo...",
    ".ommmmmmmmdo....",
    "..ooooooooo.....",
    "................",
    "................",
    "................"
  ],
  gem: [
    "................",
    ".....oooooo.....",
    "....ommmmmmo....",
    "...omllwmmmmo...",
    "..omllwmmmmmdo..",
    ".omllmmmmmmmdmo.",
    ".omlllllmmmmddo.",
    "..ommlmmmmmdmo..",
    "...omlmmmmdmo...",
    "....omlmmmdo....",
    "....ommmmdmo....",
    ".....ommmdo.....",
    "......omdo......",
    ".......oo.......",
    "................",
    "................"
  ],
  stick: [
    "................",
    "................",
    "............oo..",
    "...........omdo.",
    "..........ommo..",
    ".........olmo...",
    "........omdo....",
    ".......ommo.....",
    "......olmo......",
    ".....omdo.......",
    "....ommo........",
    "...olmo.........",
    "..omdo..........",
    "...oo...........",
    "................",
    "................"
  ],
  dust: [
    "................",
    "................",
    "................",
    "................",
    "......o.........",
    ".....olo...o....",
    "...o..oo..olo...",
    "..omo.olo..oo...",
    "...o.ololo.omo..",
    "....olmmmmo.o...",
    "...olommmomo....",
    "..olmmmmmdmdo...",
    "...ommmmmmdmdo..",
    "....ooooooooo...",
    "................",
    "................"
  ],
  string: [
    "................",
    "................",
    "................",
    "....oo..........",
    "...ommo....oo...",
    "..omoomo..omdo..",
    "...o..omoomoodo.",
    ".......ommoommo.",
    "....oo..ooomoo..",
    "...ommo..omo....",
    "..omoomoomo.....",
    ".omo..oddo......",
    "..o....oo.......",
    "................",
    "................",
    "................"
  ],
  block: [
    "................",
    "..oooooooooooo..",
    ".ollllllllllldo.",
    ".oldlmllmmmmddo.",
    ".olmdlldmmmmddo.",
    ".oldmmmmlmmmldo.",
    ".olmlmmmdmmmmdo.",
    ".olmmmmldmllmdo.",
    ".oldmmdmdmdmddo.",
    ".oldmdmmlldmmdo.",
    ".olddlmlmmmmmdo.",
    ".olldmmmmmmdddo.",
    ".olmlmmdlllmmdo.",
    ".oldddddddddddo.",
    "..oooooooooooo..",
    "................"
  ]
};

export const SPRITE_NAMES = Object.keys(MAPS) as readonly string[];

const FIXED: Record<string, string> = {
  h: "#8a5a32",
  H: "#5b391d",
  g: "#f5cf45",
  G: "#b98a1c",
  s: "#9aa3ad",
  S: "#5d646c",
  w: "#ffffff",
  x: "#cfe3f2",
  F: "#e8e8e8"
};

const HEX = /^#[0-9a-f]{6}$/i;

export const isHexColor = (value: unknown): value is string => typeof value === "string" && HEX.test(value);

const mix = (a: string, b: string, t: number): string =>
  "#" + [1, 3, 5].map(i => {
    const x = parseInt(a.slice(i, i + 2), 16);
    const y = parseInt(b.slice(i, i + 2), 16);
    return Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  }).join("");

const cache = new Map<string, string>();

/** Liefert das Icon als SVG-Markup. Unbekannte Sprites/Farben fallen sicher auf Standardwerte zurück. */
export const spriteSvg = (name: string, color = "#cccccc"): string => {
  const safeColor = isHexColor(color) ? color.toLowerCase() : "#cccccc";
  const safeName = Object.hasOwn(MAPS, name) ? name : "block";
  const key = `${safeName}${safeColor}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const map = MAPS[safeName] ?? MAPS.block ?? [];
  const pal: Record<string, string> = {
    ...FIXED,
    m: safeColor,
    l: mix(safeColor, "#ffffff", .45),
    d: mix(safeColor, "#000000", .35),
    o: mix(safeColor, "#000000", .8)
  };
  const paths: Record<string, string[]> = {};
  map.forEach((row, y) => {
    let x = 0;
    while (x < 16) {
      const c = row[x] ?? ".";
      if (c === ".") {
        x++;
        continue;
      }
      let end = x;
      while (end < 16 && row[end] === c) end++;
      (paths[c] ??= []).push(`M${x} ${y}h${end - x}v1h-${end - x}z`);
      x = end;
    }
  });
  const body = Object.entries(paths).map(([c, d]) => `<path fill="${pal[c] ?? safeColor}" d="${d.join("")}"/>`).join("");
  const out = `<svg class="px" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
  cache.set(key, out);
  return out;
};
