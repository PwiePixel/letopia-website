---
titel: Grundstücke
beschreibung: Wie du ein Grundstück bekommst, Freunde hinzufügst und es später erweiterst.
aktualisiert: 2026-09-14
---

Dein Grundstück ist dein Zuhause auf Letopia. Nur du (und wen du einträgst) kann dort bauen, Kisten öffnen oder Tiere anfassen.

## Dein erstes Grundstück

Mit `/p auto` bekommst du automatisch das nächste freie Grundstück in der Grundstückswelt. Ein Grundstück ist **48 × 48 Blöcke** groß und geht von der Höhe −64 bis 320.

Wenn du lieber selbst aussuchen möchtest, lauf durch die Welt und stell dich auf ein freies Grundstück. Mit `/p claim` gehört es dir.

> [!INFO]
> Wie viele Grundstücke du besitzen darfst, hängt von deinem Rang ab. Die Übersicht findest du unter [[raenge]].

## Freunde hinzufügen

Es gibt drei Stufen, wer auf deinem Grundstück was darf:

| Befehl | Bedeutung |
| --- | --- |
| `/p add Name` | darf bauen, **solange du online bist** |
| `/p trust Name` | darf **immer** bauen, auch wenn du offline bist |
| `/p deny Name` | darf dein Grundstück **nicht betreten** |

Mit `/p remove Name` nimmst du Rechte wieder weg.

> [!ACHTUNG]
> Gib `trust` nur Leuten, denen du wirklich vertraust. Was auf deinem Grundstück verschwindet, weil du jemandem volle Rechte gegeben hast, können wir nicht zurückholen.

## Grundstücke zusammenlegen

Besitzt du zwei nebeneinanderliegende Grundstücke, kannst du sie mit `/p merge` verbinden. Die Straße dazwischen verschwindet und du hast eine große Fläche. Mit `/p unlink` trennst du sie wieder.

## Einstellungen (Flags)

Unter `/p flag` kannst du einiges für dein Grundstück festlegen, zum Beispiel:

- **Zeit & Wetter** – bei dir ist es immer Tag oder es regnet nie
- **PvP** – standardmäßig aus
- **Begrüßung** – ein Text, der beim Betreten angezeigt wird
- **Tiere** – ob Besucher deine Tiere schlagen dürfen

## Grundstück aufgeben

Mit `/p delete` wird dein Grundstück **komplett zurückgesetzt**. Alles darauf ist danach weg – auch Kisten und ihr Inhalt. Überleg dir das also gut.

Wer länger als **60 Tage** nicht online war, verliert seine Grundstücke automatisch. Wenn du weißt, dass du länger weg bist, sag im Discord Bescheid.
