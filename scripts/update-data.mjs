// Holt die aktuellen Charakterdaten aus der Blizzard-API (WoW Forever)
// und hängt einen Tagesstand an data/snapshots.json an.
//
// Benötigt die Umgebungsvariablen BLIZZARD_CLIENT_ID und BLIZZARD_CLIENT_SECRET
// (werden auf GitHub als "Secrets" hinterlegt). Keine Zusatzpakete nötig, Node 20+.

import { readFile, writeFile, mkdir } from "node:fs/promises";

const ROOT = new URL("..", import.meta.url);
const CONFIG_FILE = new URL("mitglieder.json", ROOT);
const DATA_FILE = new URL("data/snapshots.json", ROOT);
const KEEP_DAYS = 400;
const LOCALE = "de_DE";

// Ermöglicht Tests gegen einen lokalen Server; normal leer lassen.
const API_BASE_OVERRIDE = process.env.BLIZZARD_API_BASE || "";
const OAUTH_URL = process.env.BLIZZARD_OAUTH_URL || "https://oauth.battle.net/token";

const config = JSON.parse(await readFile(CONFIG_FILE, "utf8"));
const region = (config.region || "eu").toLowerCase();
const NAMESPACE = `profile-forever-${region}`;
const API = API_BASE_OVERRIDE || `https://${region}.api.blizzard.com`;

const { BLIZZARD_CLIENT_ID: clientId, BLIZZARD_CLIENT_SECRET: clientSecret } = process.env;
if (!clientId || !clientSecret) {
  console.error("Fehler: BLIZZARD_CLIENT_ID und BLIZZARD_CLIENT_SECRET fehlen. Bitte als Secrets im GitHub-Repository hinterlegen.");
  process.exit(1);
}

async function getToken() {
  const res = await fetch(OAUTH_URL, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Anmeldung bei Blizzard fehlgeschlagen (HTTP ${res.status}). Stimmen Client-ID und Secret?`);
  return (await res.json()).access_token;
}

async function api(path, token) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${API}${path}${sep}namespace=${NAMESPACE}&locale=${LOCALE}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 404) return null;
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) { await new Promise(r => setTimeout(r, 1500 * attempt)); continue; }
    throw new Error(`${path}: HTTP ${res.status}`);
  }
  throw new Error(`${path}: keine Antwort nach 3 Versuchen`);
}

const optional = p => p.catch(err => { console.warn("  Hinweis:", err.message); return null; });
const slugOf = (vorname, nachname) => `${vorname}-${nachname}`.trim().toLowerCase().replace(/\s+/g, "-");
const textOf = v => (v && typeof v === "object" ? (v[LOCALE] ?? v.de_DE ?? v.en_US ?? Object.values(v)[0]) : v) ?? "";

function itemLevel(profile, equipment) {
  const direct = profile.equipped_item_level ?? profile.average_item_level;
  if (typeof direct === "number" && direct > 0) return direct;
  const skip = new Set(["SHIRT", "TABARD"]);
  const levels = (equipment?.equipped_items || [])
    .filter(i => !skip.has(i.slot?.type))
    .map(i => i.level?.value ?? i.item_level)
    .filter(v => typeof v === "number");
  return levels.length ? Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 10) / 10 : 0;
}

function todayBerlin() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }); // JJJJ-MM-TT
}

// ---------------------------------------------------------------------------

let data;
try { data = JSON.parse(await readFile(DATA_FILE, "utf8")); }
catch { data = { members: [], snapshots: [] }; }
const prevSnap = data.snapshots[data.snapshots.length - 1];
const prevMembers = Object.fromEntries((data.members || []).map(m => [m.id, m]));

const token = await getToken();
const members = [];
const today = { date: todayBerlin(), members: {} };
let found = 0;

for (const entry of config.mitglieder) {
  const id = slugOf(entry.vorname, entry.nachname);
  const label = `${entry.vorname} ${entry.nachname}`;
  const base = `/profile/wow/character/${encodeURIComponent(id)}`;
  let profile = null;
  try { profile = await api(base, token); }
  catch (err) { console.warn(`! ${label}: ${err.message}`); }

  if (!profile) {
    console.warn(`! ${label}: nicht gefunden (unter Stufe 10, noch nie ausgeloggt oder Name falsch geschrieben?)`);
    // Letzten bekannten Stand behalten, damit Diagramme nicht einbrechen.
    if (prevMembers[id] && prevSnap?.members[id]) {
      members.push({ ...prevMembers[id], rank: entry.rang || prevMembers[id].rank });
      today.members[id] = prevSnap.members[id];
    }
    continue;
  }

  const [equipment, pvp, media] = await Promise.all([
    optional(api(`${base}/equipment`, token)),
    optional(api(`${base}/pvp-summary`, token)),
    optional(api(`${base}/character-media`, token)),
  ]);

  const avatar = (media?.assets || []).find(a => a.key === "avatar")?.value || prevMembers[id]?.avatar || "";
  members.push({
    id,
    name: profile.name || entry.vorname,
    surname: profile.surname || entry.nachname,
    cls: textOf(profile.character_class?.name) || prevMembers[id]?.cls || "Unbekannt",
    race: textOf(profile.race?.name) || "",
    rank: entry.rang || "Mitglied",
    avatar,
  });
  today.members[id] = {
    level: profile.level ?? 0,
    ilvl: itemLevel(profile, equipment),
    ach: profile.achievement_points ?? 0,
    hk: pvp?.honorable_kills ?? prevSnap?.members[id]?.hk ?? 0,
  };
  found++;
  console.log(`✓ ${label}: Level ${today.members[id].level}, Itemlevel ${today.members[id].ilvl}`);
}

if (found === 0) {
  console.error("Kein einziger Charakter gefunden. Daten bleiben unverändert. " +
    "Prüfe die Namen in mitglieder.json – oder die Blizzard-API liefert für WoW Forever gerade keine Daten.");
  process.exit(1);
}

// Ein Stand pro Tag: heutigen Eintrag ersetzen, sonst anhängen.
if (prevSnap && prevSnap.date === today.date) data.snapshots[data.snapshots.length - 1] = today;
else data.snapshots.push(today);
data.snapshots = data.snapshots.slice(-KEEP_DAYS);

const out = {
  guild: { name: config.gilde, game: "WoW Forever", region: region.toUpperCase(), ruleset: config.regelwerk || "Normal" },
  updated: new Date().toISOString(),
  members,
  snapshots: data.snapshots,
};
await mkdir(new URL("data/", ROOT), { recursive: true });
await writeFile(DATA_FILE, JSON.stringify(out));
console.log(`Fertig: ${found} von ${config.mitglieder.length} Charakteren aktualisiert (${today.date}).`);
