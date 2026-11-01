import type { FC } from "hono/jsx";
import { getSettings, pairs } from "../../repo/settings.js";
import { Icon, Layout, linkProps, PageHero } from "./layout.js";

const Consent: FC = () => (
  <div class="field full">
    <label class="check">
      <input type="checkbox" name="datenschutz" required />
      <span>Ich bin damit einverstanden, dass meine Angaben zur Bearbeitung der Bewerbung gespeichert werden. Mehr dazu in der <a href="/datenschutz" target="_blank">Datenschutzerklärung</a>.</span>
    </label>
  </div>
);

const Closed: FC<{ what: string }> = ({ what }) => {
  const discord = getSettings("links").discord;
  return (
    <div class="notice apply-closed">
      <Icon name="clock" />
      <div>
        <strong>Die {what}-Bewerbungsphase ist gerade geschlossen</strong>
        <p>Im Moment nehmen wir keine neuen {what}-Bewerbungen an. Sobald es wieder losgeht, sagen wir im <a {...linkProps(discord)}>Discord</a> Bescheid.</p>
      </div>
    </div>
  );
};

const Name: FC<{ id: string }> = ({ id }) => (
  <div class="field">
    <label for={id}>Minecraft-Name</label>
    <input id={id} name="spielername" required maxlength={17} pattern="\.?[A-Za-z0-9_]{3,16}" data-hint="3–16 Zeichen: Buchstaben, Zahlen und Unterstrich." autocomplete="nickname" />
  </div>
);

const Age: FC<{ id: string; min: number }> = ({ id, min }) => (
  <div class="field">
    <label for={id}>Alter</label>
    <input id={id} name="alter" type="number" required min={min} max={99} inputmode="numeric" />
  </div>
);

export const ApplyPage: FC<{ origin: string }> = ({ origin }) => {
  const s = getSettings("applications");
  const minAge = Math.max(1, s.minAge);
  const perks = pairs(s.creatorPerks);
  return (
    <Layout title="Bewerben | Letopia.net" description="Bewirb dich für das Letopia-Team oder als Creator." nav="bewerben" script="apply" origin={origin} path="/bewerben">
      <PageHero
        scene="dawn"
        seed="bewerbung-hafen"
        crumbs={["Bewerben"]}
        heading={<>Werde Teil von <em>Letopia</em></>}
        lead="Ob im Team oder als Creator: Hier kannst du dich bewerben. Nimm dir ein paar Minuten Zeit – wir lesen jede Bewerbung."
      />

      <section class="page-body" data-tabgroup>
        <div class="wrap">
          <div class="tabs apply-tabs reveal" role="tablist" data-active="team">
            <button class="tab on" role="tab" aria-selected="true" data-tab="team">Team</button>
            <button class="tab" role="tab" aria-selected="false" data-tab="creator">Creator</button>
            <span class="tab-slider"></span>
          </div>

          <div class="apply-panel apply-layout on" data-panel="team">
            <div class="form-card reveal">
              {s.teamOpen ? (
                <>
                  <form class="apply-form" autocomplete="on">
                    <h2>Team-Bewerbung</h2>
                    <p>Erzähl uns, wer du bist und wobei du helfen möchtest. Pflichtfelder sind alle ohne „optional“.</p>
                    <input type="hidden" name="typ" value="team" />
                    <div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex={-1} autocomplete="off" /></label></div>

                    <div class="form-grid">
                      <Name id="t-name" />
                      <div class="field">
                        <label for="t-discord">Discord-Name</label>
                        <input id="t-discord" name="discord" required maxlength={40} placeholder="z. B. steve.baut" />
                      </div>
                      <Age id="t-alter" min={minAge} />
                      <div class="field">
                        <label for="t-position">Gewünschte Position</label>
                        <select id="t-position" name="position" required>
                          <option value="">Bitte wählen</option>
                          {s.teamPositions.map(p => <option>{p}</option>)}
                        </select>
                      </div>
                      <div class="field">
                        <label for="t-seit">Auf Letopia seit</label>
                        <select id="t-seit" name="spielzeit" required>
                          <option value="">Bitte wählen</option>
                          <option>Weniger als 1 Monat</option>
                          <option>1–3 Monate</option>
                          <option>3–6 Monate</option>
                          <option>Länger als 6 Monate</option>
                        </select>
                      </div>
                      <div class="field">
                        <label for="t-stunden">Zeit pro Woche (Stunden)</label>
                        <input id="t-stunden" name="stunden" type="number" required min={1} max={80} inputmode="numeric" />
                      </div>
                      <div class="field full">
                        <label for="t-erfahrung">Erfahrung <span class="opt">(optional)</span></label>
                        <textarea id="t-erfahrung" name="erfahrung" maxlength={1500} placeholder="Warst du schon auf anderen Servern im Team? Was hast du dort gemacht?"></textarea>
                      </div>
                      <div class="field full">
                        <label for="t-motivation">Warum möchtest du ins Team?</label>
                        <textarea id="t-motivation" name="motivation" required minlength={100} maxlength={2000} placeholder="Was macht dich zu einer guten Wahl? Was würdest du auf Letopia verbessern?"></textarea>
                      </div>
                      <div class="field full">
                        <label for="t-staerken">Stärken &amp; Schwächen <span class="opt">(optional)</span></label>
                        <textarea id="t-staerken" name="staerken" maxlength={1000}></textarea>
                      </div>
                      <Consent />
                    </div>

                    <div class="form-foot">
                      <p class="form-msg" role="alert"></p>
                      <button class="btn btn-primary" type="submit"><Icon name="send" />Bewerbung absenden</button>
                    </div>
                  </form>

                  <div class="apply-done" hidden>
                    <div class="done-ico"><Icon name="check" /></div>
                    <h2>Danke, <span class="apply-done-name"></span>!</h2>
                    <p>Deine Bewerbung ist angekommen. Wir melden uns innerhalb von sieben Tagen per Discord bei dir – halte deine Direktnachrichten offen.</p>
                  </div>
                </>
              ) : <Closed what="Team" />}
            </div>

            <aside>
              {s.teamRequirements.length ? (
                <div class="side-card reveal">
                  <h3><Icon name="check" />Voraussetzungen</h3>
                  <ul class="check-list">{s.teamRequirements.map(r => <li><Icon name="check" />{r}</li>)}</ul>
                </div>
              ) : null}
              <div class="side-card reveal">
                <h3><Icon name="clock" />Wie es weitergeht</h3>
                <ol class="num-list">
                  <li><b>Prüfung</b>Das Team liest deine Bewerbung und bespricht sie gemeinsam.</li>
                  <li><b>Gespräch</b>Passt es, laden wir dich zu einem kurzen Gespräch im Discord ein.</li>
                  <li><b>Probezeit</b>Die ersten vier Wochen sind eine Probezeit – mit Ansprechpartner aus dem Team.</li>
                </ol>
              </div>
            </aside>
          </div>

          <div class="apply-panel apply-layout" data-panel="creator">
            <div class="form-card reveal">
              {s.creatorOpen ? (
                <>
                  <form class="apply-form" autocomplete="on">
                    <h2>Creator-Bewerbung</h2>
                    <p>Du machst Videos, Streams oder Clips? Dann zeig uns deinen Kanal.</p>
                    <input type="hidden" name="typ" value="creator" />
                    <div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex={-1} autocomplete="off" /></label></div>

                    <div class="form-grid">
                      <Name id="c-name" />
                      <div class="field">
                        <label for="c-discord">Discord-Name</label>
                        <input id="c-discord" name="discord" required maxlength={40} />
                      </div>
                      <Age id="c-alter" min={minAge} />
                      <div class="field">
                        <label for="c-plattform">Plattform</label>
                        <select id="c-plattform" name="plattform" required>
                          <option value="">Bitte wählen</option>
                          {s.creatorPlatforms.map(p => <option>{p}</option>)}
                        </select>
                      </div>
                      <div class="field full">
                        <label for="c-kanal">Link zu deinem Kanal</label>
                        <input id="c-kanal" name="kanal" type="url" required maxlength={200} placeholder="https://" />
                      </div>
                      <div class="field">
                        <label for="c-follower">Follower / Abonnenten</label>
                        <input id="c-follower" name="follower" type="number" required min={0} max={100000000} inputmode="numeric" />
                      </div>
                      <div class="field">
                        <label for="c-aufrufe">Ø Aufrufe pro Video <span class="opt">(optional)</span></label>
                        <input id="c-aufrufe" name="aufrufe" type="number" min={0} max={100000000} inputmode="numeric" />
                      </div>
                      <div class="field full">
                        <label for="c-idee">Welchen Content möchtest du auf Letopia machen?</label>
                        <textarea id="c-idee" name="idee" required minlength={60} maxlength={2000} placeholder="Serie, Stream, Shorts … erzähl uns von deiner Idee."></textarea>
                      </div>
                      <Consent />
                    </div>

                    <div class="form-foot">
                      <p class="form-msg" role="alert"></p>
                      <button class="btn btn-primary" type="submit"><Icon name="send" />Bewerbung absenden</button>
                    </div>
                  </form>

                  <div class="apply-done" hidden>
                    <div class="done-ico"><Icon name="check" /></div>
                    <h2>Danke, <span class="apply-done-name"></span>!</h2>
                    <p>Deine Creator-Bewerbung ist angekommen. Wir schauen uns deinen Kanal an und melden uns per Discord.</p>
                  </div>
                </>
              ) : <Closed what="Creator" />}
            </div>

            <aside>
              {s.creatorRequirements.length ? (
                <div class="side-card reveal">
                  <h3><Icon name="check" />Voraussetzungen</h3>
                  <ul class="check-list">{s.creatorRequirements.map(r => <li><Icon name="check" />{r}</li>)}</ul>
                </div>
              ) : null}
              {perks.length ? (
                <div class="side-card reveal">
                  <h3><Icon name="gift" />Was du bekommst</h3>
                  <ul class="reward-list">{perks.map(p => <li>{p.label}<b>{p.value}</b></li>)}</ul>
                </div>
              ) : null}
            </aside>
          </div>
        </div>
      </section>
    </Layout>
  );
};
