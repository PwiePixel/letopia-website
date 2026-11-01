import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { slugify } from "../src/shared/catalog.js";
import { isHexColor, SPRITE_NAMES, spriteSvg } from "../src/shared/sprites.js";
import { detectImage } from "../src/server/lib/images.js";

describe("Pixel-Icons", () => {
  it("kennt alle 16 Icons der alten Website", () => {
    assert.equal(SPRITE_NAMES.length, 16);
    for (const name of ["sword", "pickaxe", "axe", "helmet", "lantern", "potion", "shard", "rod", "banner", "star", "ingot", "gem", "stick", "dust", "string", "block"]) {
      assert.ok(SPRITE_NAMES.includes(name), name);
    }
  });

  it("erzeugt SVG mit der gewünschten Farbe", () => {
    const svg = spriteSvg("sword", "#FF0000");
    assert.match(svg, /^<svg class="px" viewBox="0 0 16 16"/);
    assert.match(svg, /fill="#ff0000"/);
  });

  it("lässt keine Fremdwerte ins SVG", () => {
    const svg = spriteSvg("<script>", "red\"/><script>alert(1)</script>");
    assert.ok(!svg.includes("<script>"));
    assert.match(svg, /fill="#cccccc"/);
    assert.equal(isHexColor("#abcdef"), true);
    assert.equal(isHexColor("#abc"), false);
  });
});

describe("Adressen (Slugs)", () => {
  it("wandelt Umlaute und Sonderzeichen um", () => {
    assert.equal(slugify("Grundstücke & Städte"), "grundstuecke-staedte");
    assert.equal(slugify("  Größe: 48×48!  "), "groesse-48-48");
    assert.equal(slugify("Café Crème"), "cafe-creme");
  });
});

describe("Bilderkennung", () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]), Buffer.from([0, 0, 0, 64, 0, 0, 0, 48]), Buffer.alloc(8)]);

  it("erkennt PNG mit Abmessungen", () => {
    assert.deepEqual(detectImage(png), { mime: "image/png", ext: "png", width: 64, height: 48 });
  });

  it("erkennt GIF, JPEG und WebP", () => {
    const gif = Buffer.concat([Buffer.from("GIF89a"), Buffer.from([10, 0, 20, 0]), Buffer.alloc(10)]);
    assert.deepEqual(detectImage(gif), { mime: "image/gif", ext: "gif", width: 10, height: 20 });
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0, 30, 0, 40, 3, 0, 0, 0, 0]);
    assert.deepEqual(detectImage(jpeg), { mime: "image/jpeg", ext: "jpg", width: 40, height: 30 });
    const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8X"), Buffer.alloc(8), Buffer.from([99, 0, 0, 49, 0, 0])]);
    assert.deepEqual(detectImage(webp), { mime: "image/webp", ext: "webp", width: 100, height: 50 });
  });

  it("lehnt SVG und Text ab", () => {
    assert.equal(detectImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>')), null);
    assert.equal(detectImage(Buffer.from("GIF8")), null);
  });
});
