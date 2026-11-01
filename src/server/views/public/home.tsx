import type { FC } from "hono/jsx";
import { getSettings } from "../../repo/settings.js";
import { Icon, Layout, linkProps } from "./layout.js";

const SLIDES = [
  { scene: "dusk", seed: "marktplatz", cap: "Der Marktplatz am Spawn, kurz bevor die Sonne untergeht" },
  { scene: "night", seed: "hafenviertel", cap: "Das Hafenviertel bei Nacht – hier brennt fast immer irgendwo Licht" },
  { scene: "day", seed: "altstadt", cap: "Die Altstadt: Hier stehen die allerersten Grundstücke" },
  { scene: "dawn", seed: "neu-letopia", cap: "Frühmorgens in Neu-Letopia, der jüngsten Spielerstadt" }
];

const TREND = "M0 52 L30 50 L60 51 L90 46 L120 44 L150 45 L180 37 L210 33 L240 26 L270 20 L300 11";

export const HomePage: FC<{ origin: string }> = ({ origin }) => {
  const g = getSettings("general");
  const links = getSettings("links");
  const stats = getSettings("stats");
  const statusOn = g.statusSource !== "off";

  return (
    <Layout
      title="Letopia.net | Deutscher Minecraft CityBuild Server"
      description="Letopia ist ein deutscher Minecraft CityBuild Server für Java und Bedrock – mit eigenen Städten, Spielerwirtschaft, Custom Items und einer Community, die zusammen baut."
      nav="home"
      script="home"
      origin={origin}
      path="/"
    >
      <section class="hero" id="top">
        <canvas class="hero-scene" data-scene="night" data-seed="letopia-spawn" data-tall=".78" aria-hidden="true"></canvas>
        <div class="hero-shade"></div>

        <div class="hero-in">
          <h1 class="logo">
            <img src="/assets/img/logo.png" alt="Letopia Network" width={720} height={197} />
            <i class="sparkle" style="top:6%;left:3%;--d:.2s"></i>
            <i class="sparkle" style="top:-4%;left:48%;--d:1.4s"></i>
            <i class="sparkle" style="top:10%;right:1%;--d:.8s"></i>
            <i class="sparkle" style="bottom:4%;left:21%;--d:2s"></i>
            <i class="sparkle" style="bottom:-2%;right:24%;--d:1.1s"></i>
          </h1>

          <div class="hero-cta">
            <button class="pill pill-ip" data-copy="ip" aria-label="Server-IP kopieren">
              <span class="pill-ico"><Icon name="gamepad" /></span>
              <span class="pill-txt"><strong data-ip>{g.serverAddress}</strong><small>Klick zum Kopieren</small></span>
              <Icon name="copy" class="pill-copy" />
            </button>

            <div class="hero-btns">
              <a {...linkProps(links.discord)} class="btn btn-primary btn-lg"><Icon name="discord" filled />Discord beitreten</a>
              <a href="/voten" class="btn btn-ghost btn-lg"><Icon name="star" />Voten</a>
            </div>

            <div class="pill pill-status">
              <span class="pill-ico live"><Icon name="wifi" /></span>
              <span class="pill-txt">
                <strong>Schau vorbei!</strong>
                <small class={statusOn ? "js-online" : undefined}>{statusOn ? "Online: …" : `Java & Bedrock · ${g.serverAddress}`}</small>
              </span>
            </div>
          </div>
        </div>

        <a href="#about" class="scroll-hint" aria-label="Nach unten scrollen"><span></span></a>
      </section>

      <section class="sec" id="about">
        <img class="allay" src="/assets/img/allay.webp" alt="" width={173} height={166} />
        <div class="wrap">
          <header class="sec-head reveal">
            <span class="kicker">Über uns</span>
            <h2>Was ist <em>Letopia</em>?</h2>
            <p>Ein CityBuild-Server, auf dem aus einem leeren Grundstück mit der Zeit eine ganze Stadt werden kann.</p>
          </header>

          <div class="about-grid">
            <div class="gallery reveal">
              <div class="blob">
                {SLIDES.map((s, i) => (
                  <figure class={i === 0 ? "slide on" : "slide"} data-cap={s.cap}>
                    <canvas data-scene={s.scene} data-seed={s.seed} aria-hidden="true"></canvas>
                  </figure>
                ))}
              </div>
              <div class="gal-ctrl">
                <button class="gal-arrow prev" aria-label="Vorheriges Bild"><Icon name="left" /></button>
                <div class="gal-cap">
                  <p>{SLIDES[0]?.cap}</p>
                  <div class="dots"></div>
                </div>
                <button class="gal-arrow next" aria-label="Nächstes Bild"><Icon name="right" /></button>
              </div>
            </div>

            <div class="about-text reveal" style="--d:.12s">
              <p><b>Letopia</b> ist ein deutscher CityBuild-Server für alle, die lieber gemeinsam bauen, handeln und planen, statt nur nebeneinander her zu spielen. Du startest mit deinem eigenen Grundstück – was daraus wird, entscheidest du.</p>
              <p>Gründe mit Freunden eine <b>eigene Stadt</b>, eröffne einen Laden im <b>Marktviertel</b> oder hol dir in der <b>Farmwelt</b> das Material für dein nächstes Projekt. Viele unserer Plugins schreiben wir selbst, damit alles sauber ineinandergreift.</p>
              <p><b>Unser Anspruch:</b> kein Pay-to-Win, faire Ränge und ein Team, das nicht nur im Discord sitzt, sondern selbst auf dem Server unterwegs ist.</p>
              <ul class="chips">
                <li><Icon name="plug" />Eigene Plugins</li>
                <li><Icon name="building" />Städte gründen</li>
                <li><Icon name="shield" />Kein Pay-to-Win</li>
                <li><Icon name="users" />Aktives Team</li>
                <li><Icon name="calendar" />Events jede Woche</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section class="sec sec-dark" id="join">
        <span class="orb" style="width:220px;height:220px;top:-60px;right:8%"></span>
        <span class="orb" style="width:80px;height:80px;top:28%;left:10%;animation-delay:-4s"></span>
        <span class="orb" style="width:150px;height:150px;bottom:12%;left:4%;animation-delay:-8s"></span>
        <span class="orb" style="width:60px;height:60px;top:52%;right:12%;animation-delay:-2s"></span>

        <div class="wrap narrow">
          <header class="sec-head reveal">
            <span class="kicker">Mitspielen</span>
            <h2>So kommst du auf <em>Letopia</em></h2>
            <p>Ein paar Klicks und du bist drin – egal ob mit Java oder Bedrock.</p>
          </header>

          <div class="reveal" data-tabgroup>
            <div class="tabs" role="tablist" data-active="java">
              <button class="tab on" role="tab" aria-selected="true" data-tab="java">Java Edition</button>
              <button class="tab" role="tab" aria-selected="false" data-tab="bedrock">Bedrock Edition</button>
              <span class="tab-slider"></span>
            </div>

            <ol class="steps on" data-panel="java">
              <li><span class="num">1</span><p>Starte Minecraft und klicke auf <b>„Mehrspieler“</b> und danach auf <b>„Server hinzufügen“</b>.</p></li>
              <li><span class="num">2</span><p>Trage als Serveradresse <button class="code" data-copy="ip"><span data-ip>{g.serverAddress}</span><Icon name="copy" /></button> ein.</p></li>
              <li><span class="num">3</span><p>Klicke auf <b>„Fertig“</b>, wähle Letopia aus und dann <b>„Server beitreten“</b> – los geht’s!</p></li>
            </ol>

            <ol class="steps" data-panel="bedrock">
              <li><span class="num">1</span><p>Öffne <b>„Spielen“</b>, wechsle zum Reiter <b>„Server“</b> und tippe ganz unten auf <b>„Server hinzufügen“</b>.</p></li>
              <li><span class="num">2</span><p>Adresse <button class="code" data-copy="ip"><span data-ip>{g.serverAddress}</span><Icon name="copy" /></button> und Port <button class="code" data-copy="port"><span data-port>{g.bedrockPort}</span><Icon name="copy" /></button> eintragen.</p></li>
              <li><span class="num">3</span><p>Speichern, Letopia auswählen und beitreten – du landest in <b>derselben Welt</b> wie die Java-Spieler.</p></li>
            </ol>

            <p class="join-note">Empfohlen: <b>Java ab {g.javaVersion}</b> · Bedrock immer in der aktuellen Version · <a href="/wiki/server-beitreten">Probleme beim Verbinden?</a></p>
          </div>
        </div>
      </section>

      <section class="sec" id="features">
        <div class="wrap">
          <header class="sec-head reveal">
            <span class="kicker">Features</span>
            <h2>Was Letopia <em>ausmacht</em></h2>
            <p>Wenig Standard, viel Eigenes – jedes System ist auf CityBuild zugeschnitten und greift ins nächste.</p>
          </header>

          <div class="feat-grid">
            <article class="feat reveal">
              <span class="feat-ico"><Icon name="building" /></span>
              <h3>Grundstücke &amp; Städte</h3>
              <p>Mit <b>/p auto</b> holst du dir dein erstes Grundstück. Später gründest du mit Freunden eine Stadt – mit Bürgermeister, Stadtkasse und eigenen Regeln.</p>
              <a class="feat-more" href="/wiki/grundstuecke">Im Wiki nachlesen<Icon name="right" /></a>
            </article>
            <article class="feat reveal" style="--d:.08s">
              <span class="feat-ico"><Icon name="coins" /></span>
              <h3>Spielerwirtschaft</h3>
              <p>Preise machen bei uns die Spieler: im <b>Auktionshaus</b>, in eigenen Shops und über Aufträge. Jobs wie Holzfäller oder Händler bringen ein festes Einkommen.</p>
              <a class="feat-more" href="/wiki/geld-verdienen">Im Wiki nachlesen<Icon name="right" /></a>
            </article>
            <article class="feat reveal" style="--d:.16s">
              <span class="feat-ico"><Icon name="mountain" /></span>
              <h3>Farmwelten</h3>
              <p>Eigene Farmwelten für Overworld, Nether und End, die <b>regelmäßig zurückgesetzt</b> werden. Deine Grundstücke bleiben davon natürlich unberührt.</p>
              <a class="feat-more" href="/wiki/farmwelten">Im Wiki nachlesen<Icon name="right" /></a>
            </article>
            <article class="feat reveal" style="--d:.08s">
              <span class="feat-ico"><Icon name="calendar" /></span>
              <h3>Events</h3>
              <p>Bauwettbewerbe, Stadtfeste und Schatzsuchen am Wochenende. Die besten Bauten ziehen oft <b>direkt an den Spawn</b>.</p>
              <a class="feat-more" href="/wiki/events">Im Wiki nachlesen<Icon name="right" /></a>
            </article>
            <article class="feat reveal" style="--d:.16s">
              <span class="feat-ico"><Icon name="gem" /></span>
              <h3>Custom Items</h3>
              <p>Werkzeuge mit eigenen Verzauberungen, Möbel fürs Grundstück und saisonale Sammelstücke – <b>nichts davon</b> gibt es im Shop zu kaufen.</p>
              <a class="feat-more" href="/items">Alle Items ansehen<Icon name="right" /></a>
            </article>
          </div>
        </div>
      </section>

      <section class="sec sec-dark" id="zahlen">
        <span class="orb" style="width:260px;height:260px;top:-90px;left:-70px"></span>
        <span class="orb" style="width:300px;height:300px;bottom:-120px;right:-90px;animation-delay:-6s"></span>

        <div class="wrap">
          <header class="sec-head left reveal">
            <span class="kicker">Letopia in Zahlen</span>
            <h2>Was bei uns <em>los ist</em></h2>
            <p>Ein kurzer Blick auf den Server – und auf die Leute, die ihn jeden Tag ein Stück größer machen.</p>
          </header>

          <div class="stats">
            <div class="stat stat-wide reveal">
              <span class="stat-ico"><Icon name="users" /></span>
              <strong data-count={String(stats.players)} data-suffix="+">0</strong>
              <span class="lbl">Registrierte Spieler</span>
              <svg class="trend" viewBox="0 0 300 60" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#f0a830" stop-opacity=".28" />
                    <stop offset="1" stop-color="#f0a830" stop-opacity="0" />
                  </linearGradient>
                </defs>
                <path fill="url(#trend-fill)" d={`${TREND} L300 60 L0 60 Z`} />
                <path class="trend-line" d={TREND} />
              </svg>
            </div>

            <div class="stat stat-ring reveal" style="--d:.1s">
              <div class="ring">
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <circle class="ring-bg" cx="50" cy="50" r="42" />
                  <circle class="ring-fg" cx="50" cy="50" r="42" data-value={String(stats.uptime)} />
                </svg>
                <strong data-count={String(stats.uptime)} data-dec="1" data-suffix=" %">0</strong>
              </div>
              <span class="lbl">Server-Uptime</span>
            </div>

            <div class="stat reveal">
              <span class="stat-ico"><Icon name="pin" /></span>
              <strong data-count={String(stats.plots)} data-suffix="+">0</strong>
              <span class="lbl">Vergebene Grundstücke</span>
            </div>

            <div class="stat reveal" style="--d:.08s">
              <span class="stat-ico"><Icon name="flag" /></span>
              <strong data-count={String(stats.cities)}>0</strong>
              <span class="lbl">Gegründete Städte</span>
            </div>

            <div class="stat reveal" style="--d:.16s">
              <span class="stat-ico"><Icon name="coins" /></span>
              <strong data-count={String(stats.coins)} data-suffix="+">0</strong>
              <span class="lbl">Coins im Umlauf</span>
            </div>
          </div>

          {stats.date ? <p class="stand">Stand: {stats.date}</p> : null}

          <div class="dc reveal" id="discord">
            <img class="dc-art" src="/assets/img/discord-buddy.webp" alt="" width={280} height={280} loading="lazy" />
            <div>
              <span class="kicker">Community</span>
              <h2>Werde Teil unserer <em>Discord</em>-Community</h2>
              <p>Hier bekommst du Hilfe vom Team, erfährst von Updates als Erstes und findest Leute für dein nächstes Bauprojekt.</p>
              <ul class="chips">
                <li><Icon name="headset" />Support-Tickets</li>
                <li><Icon name="bell" />Ankündigungen</li>
                <li><Icon name="gift" />Events &amp; Gewinnspiele</li>
                <li><Icon name="users" />Mitspieler finden</li>
              </ul>
              <a {...linkProps(links.discord)} class="btn btn-dc"><Icon name="discord" filled />Discord beitreten</a>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};
