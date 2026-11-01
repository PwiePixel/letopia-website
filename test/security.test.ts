import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  base32Decode,
  base32Encode,
  generatePassword,
  generateTotpSecret,
  hashPassword,
  safeEqual,
  totpCode,
  verifyPassword,
  verifyTotp
} from "../src/server/lib/security.js";

describe("Passwörter", () => {
  it("hasht mit scrypt und prüft korrekt", async () => {
    const hash = await hashPassword("Ein sicheres Passwort!");
    assert.match(hash, /^scrypt\$32768\$8\$1\$/);
    assert.equal(await verifyPassword("Ein sicheres Passwort!", hash), true);
    assert.equal(await verifyPassword("ein sicheres Passwort!", hash), false);
    assert.equal(await verifyPassword("x", "kaputt"), false);
  });

  it("erzeugt jedes Mal einen anderen Salt", async () => {
    assert.notEqual(await hashPassword("gleich"), await hashPassword("gleich"));
  });

  it("erzeugt lesbare Zufallspasswörter", () => {
    const pw = generatePassword(16);
    assert.equal(pw.length, 16);
    assert.match(pw, /^[A-HJ-NP-Za-km-z2-9]+$/);
    assert.notEqual(generatePassword(), generatePassword());
  });

  it("vergleicht in konstanter Zeit", () => {
    assert.equal(safeEqual("abc", "abc"), true);
    assert.equal(safeEqual("abc", "abd"), false);
    assert.equal(safeEqual("abc", "abcd"), false);
  });
});

describe("Zwei-Faktor (TOTP)", () => {
  // Testvektor aus RFC 6238 (SHA-1, Geheimnis "12345678901234567890")
  const secret = base32Encode(Buffer.from("12345678901234567890"));

  it("kodiert Base32 hin und zurück", () => {
    assert.equal(secret, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    assert.equal(base32Decode(secret).toString(), "12345678901234567890");
  });

  it("berechnet die Codes aus RFC 6238", () => {
    assert.equal(totpCode(secret, 59_000), "287082");
    assert.equal(totpCode(secret, 1_111_111_109_000), "081804");
    assert.equal(totpCode(secret, 1_234_567_890_000), "005924");
  });

  it("akzeptiert ±30 Sekunden und lehnt Falsches ab", () => {
    const t = 1_234_567_890_000;
    assert.equal(verifyTotp(secret, "005924", t), true);
    assert.equal(verifyTotp(secret, "005924", t + 30_000), true);
    assert.equal(verifyTotp(secret, "005924", t + 90_000), false);
    assert.equal(verifyTotp(secret, "123456", t), false);
    assert.equal(verifyTotp(secret, "abc", t), false);
    assert.equal(generateTotpSecret().length, 32);
  });
});
