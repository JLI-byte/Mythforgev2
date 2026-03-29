/**
 * betaSeedData.ts
 * Beta testing seed data — populates the store with a complete example world.
 * Call seedBetaData(store) once to inject all example content.
 * Safe to call multiple times — checks if beta world already exists.
 */

import { WorkspaceState, COVER_COLORS } from '@/store/workspaceStore';

// ArticleTab format (mirrors ArticleGridEditor types without importing from component)
interface SeedWidget {
  id: string;
  type: 'text' | 'heading' | 'image' | 'divider' | 'quote' | 'statblock' | 'table';
  x: number;
  y: number;
  width: number;
  height: number;
  content: Record<string, unknown>;
}

interface SeedTab {
  id: string;
  name: string;
  widgets: SeedWidget[];
}

function uuid(): string {
  return crypto.randomUUID();
}

function makeArticleDoc(tabs: SeedTab[]): string {
  return JSON.stringify(tabs);
}

function mainTab(widgets: SeedWidget[]): SeedTab {
  return { id: uuid(), name: 'Main', widgets };
}

function tab(name: string, widgets: SeedWidget[]): SeedTab {
  return { id: uuid(), name, widgets };
}

function heading(text: string, level: number, x: number, y: number): SeedWidget {
  return { id: uuid(), type: 'heading', x, y, width: 580, height: 80, content: { text, level } };
}

function textBlock(html: string, x: number, y: number, w = 560, h = 180): SeedWidget {
  return { id: uuid(), type: 'text', x, y, width: w, height: h, content: { html } };
}

function divider(x: number, y: number): SeedWidget {
  return { id: uuid(), type: 'divider', x, y, width: 560, height: 40, content: {} };
}

function quote(text: string, attribution: string, x: number, y: number): SeedWidget {
  return { id: uuid(), type: 'quote', x, y, width: 480, height: 140, content: { text, attribution } };
}

function statblock(rows: { label: string; value: string }[], x: number, y: number): SeedWidget {
  return { id: uuid(), type: 'statblock', x, y, width: 300, height: 40 + rows.length * 48, content: { rows } };
}

function tableWidget(headers: string[], rows: string[][], x: number, y: number): SeedWidget {
  return { id: uuid(), type: 'table', x, y, width: 560, height: 200, content: { headers, rows } };
}

/** Scene content filler — varied prose for each scene */
const SCENE_CONTENT: Record<string, string> = {
  s1: `<p>The city of Veldrath sprawled beneath a sky the color of bruised iron. Kael moved through the lower markets with his hood drawn, fingers brushing the weight of the Shard through his coat. Three days since the Conclave had declared him rogue. He'd learned to count time in small increments since then.</p><p>A child offered him a paper lantern. He shook his head. Light was the last thing he needed tonight.</p>`,
  s2: `<p>The safe house was a cooper's workshop, long shuttered. Kael lit a single candle and spread the map across the workbench. Eleven red marks — the Conclave's checkpoints. Two routes remained. One led through the Ashen Quarter. The other through the harbor, where Mira had contacts, or had claimed to before everything fell apart.</p><p>He chose the harbor. He always chose wrong.</p>`,
  s3: `<p>She was already there when he arrived. Sitting on an overturned crate, sharpening a blade she absolutely did not need to sharpen, because Mira never needed to do anything the normal way.</p><p>"You look terrible," she said.</p><p>"Thank you. I've been working on it." He sat across from her. The harbor smelled of salt and rot and, beneath both, the faint copper tang of spent magic. Someone had been using the old resonance lines. "Tell me you have good news."</p><p>"I have news." She held up the blade to the moonlight. "Whether it's good depends on how much you value your current lifestyle."</p>`,
  s4: `<p>The eastern gate was supposed to be unguarded on rotation night. It was not. Three wardens stood at their post, one of them holding a lantern high enough that its light caught every face in the queue. Kael kept his face down, kept his breathing steady, kept his hand off the Shard.</p><p>Mira bumped his shoulder. "Relax. You look like someone who's hiding something."</p><p>"I am hiding something."</p><p>"Yes, but only one of us looks it."</p>`,
  s5: `<p>Commander Adra Vel reviewed the dossier for the third time that evening. Kael Morvant. Former Conclave archivist. Elevated to field rank at twenty-six — the youngest in four decades. She had read his commendations. She had also read what came after.</p><p>The Shard changed people. She knew that. Every senior warden knew it. What the official reports didn't say — what the official reports were very careful not to say — was that sometimes the change was not damage. Sometimes the change was an improvement in directions the Conclave found inconvenient.</p>`,
  s6: `<p>The interrogation room smelled of lime and old fear. Sev sat across the table with his hands folded, giving nothing, because there was nothing to give. He had been careful. He had been very careful. He had also, apparently, not been careful enough, because here he was.</p><p>"You met with Morvant," the Inquisitor said.</p><p>"I meet a lot of people."</p><p>"Three days ago. The Ashen Market. You exchanged objects."</p><p>Sev kept his face still. "I sold a man a fish."</p>`,
  s7: `<p>INT. ARCHIVE CHAMBER - NIGHT</p><p>Rows of sealed vaults stretch into shadow. KAEL (30s, worn coat, haunted eyes) moves between them with a stolen key. He stops at VAULT 7-C. Tries the key. Wrong fit. Tries again.</p><p>VOICE (O.S.): That one's been empty for six years.</p><p>He freezes. Turns slowly.</p><p>MIRA (30s, sharp, amused) leans in the doorway. She holds up a different key — ornate, old, clearly the right one.</p><p>MIRA (CONT'D): Were you going to ask, or were you just going to fail quietly?</p>`,
  s8: `<p>INT. HARBOR WAREHOUSE - NIGHT</p><p>Crates stacked to the ceiling. A single work lamp hangs over a table covered in maps and coded notes. KAEL and MIRA spread the final route across the table. She traces a line with her finger.</p><p>MIRA: We move on the tide. Two hours.</p><p>KAEL: And if Vel has the docks covered?</p><p>MIRA: Then we improvise.</p><p>KAEL: That's not a plan.</p><p>MIRA (smiling): All the best plans start that way.</p><p>She rolls up the map. He watches her. Something passes between them — exhaustion, yes, but also the particular intimacy of people who have saved each other's lives enough times to stop counting.</p>`,
  s9: `<p>EXT. VELDRATH ROOFTOPS - NIGHT</p><p>KAEL and MIRA move fast and low across the slanted tiles. Below, a PATROL crosses the lane. They press flat. Wait. The patrol passes.</p><p>MIRA (whispering): North tower. Thirty seconds.</p><p>KAEL (whispering): The signal?</p><p>MIRA: Three flashes if it's clear. One if it isn't.</p><p>She moves. He follows. The city spreads below them, lit by a thousand lanterns, oblivious to the two figures passing across its face like shadows over a map.</p>`,
};

export function seedBetaData(store: WorkspaceState): void {
  // Guard — don't seed twice
  if (store.worlds.some(w => w.name === 'The Shattered Realm')) return;

  const worldId = uuid();
  const proj1Id = uuid(); // novel
  const proj2Id = uuid(); // screenplay
  const proj3Id = uuid(); // markdown/lore

  // ── WORLD ──────────────────────────────────────────────────
  store.addWorld({
    id: worldId,
    name: 'The Shattered Realm',
    genre: 'fantasy',
    tone: { darkness: 'dark', scale: 'balanced', humor: 'serious' },
    logline: 'A dying empire clings to power through the shards of a broken god — and one archivist who knows too much.',
    magicExists: true,
    techLevel: 'medieval',
    timePeriod: 'Timeless medieval',
    coverColor: COVER_COLORS[1],
    createdAt: new Date('2024-01-15'),
  });

  // ── PROJECT 1: NOVEL ───────────────────────────────────────
  store.addProject({
    id: proj1Id,
    name: 'The Shard Archivist',
    writingMode: 'novel',
    coverColor: COVER_COLORS[1],
    worldId,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-02-20'),
  });

  // Chapter 1 + scenes
  const ch1Id = uuid();
  store.addDocument({ id: ch1Id, projectId: proj1Id, title: 'Chapter 1 — The Lower Markets', content: '', createdAt: new Date('2024-01-16') });
  const sc1 = uuid(); store.addScene({ id: sc1, documentId: ch1Id, projectId: proj1Id, title: 'The Hood', content: SCENE_CONTENT.s1, order: 0, wordCount: 94, createdAt: new Date('2024-01-16') });
  const sc2 = uuid(); store.addScene({ id: sc2, documentId: ch1Id, projectId: proj1Id, title: 'The Map', content: SCENE_CONTENT.s2, order: 1, wordCount: 88, createdAt: new Date('2024-01-17') });
  const sc3 = uuid(); store.addScene({ id: sc3, documentId: ch1Id, projectId: proj1Id, title: 'Mira', content: SCENE_CONTENT.s3, order: 2, wordCount: 152, createdAt: new Date('2024-01-18') });

  // Chapter 2 + scenes
  const ch2Id = uuid();
  store.addDocument({ id: ch2Id, projectId: proj1Id, title: 'Chapter 2 — The Eastern Gate', content: '', createdAt: new Date('2024-01-22') });
  const sc4 = uuid(); store.addScene({ id: sc4, documentId: ch2Id, projectId: proj1Id, title: 'The Gate', content: SCENE_CONTENT.s4, order: 0, wordCount: 108, createdAt: new Date('2024-01-22') });
  const sc5 = uuid(); store.addScene({ id: sc5, documentId: ch2Id, projectId: proj1Id, title: "Vel's Office", content: SCENE_CONTENT.s5, order: 1, wordCount: 132, createdAt: new Date('2024-01-23') });
  const sc6 = uuid(); store.addScene({ id: sc6, documentId: ch2Id, projectId: proj1Id, title: 'Interrogation', content: SCENE_CONTENT.s6, order: 2, wordCount: 118, createdAt: new Date('2024-01-24') });

  // Chapter 3 + scenes (same scenes as chapter1 — varied enough for testing)
  const ch3Id = uuid();
  store.addDocument({ id: ch3Id, projectId: proj1Id, title: 'Chapter 3 — The Conclave', content: '', createdAt: new Date('2024-02-01') });
  const sc7 = uuid(); store.addScene({ id: sc7, documentId: ch3Id, projectId: proj1Id, title: 'The Vote', content: SCENE_CONTENT.s2, order: 0, wordCount: 88, createdAt: new Date('2024-02-01') });
  const sc8 = uuid(); store.addScene({ id: sc8, documentId: ch3Id, projectId: proj1Id, title: 'The Vault', content: SCENE_CONTENT.s1, order: 1, wordCount: 94, createdAt: new Date('2024-02-02') });
  const sc9 = uuid(); store.addScene({ id: sc9, documentId: ch3Id, projectId: proj1Id, title: 'The Reckoning', content: SCENE_CONTENT.s5, order: 2, wordCount: 132, createdAt: new Date('2024-02-03') });

  // ── PROJECT 2: SCREENPLAY ──────────────────────────────────
  store.addProject({
    id: proj2Id,
    name: 'The Shard Archivist — Screenplay',
    writingMode: 'screenplay',
    coverColor: COVER_COLORS[3],
    worldId,
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date('2024-02-18'),
  });

  const ch4Id = uuid();
  store.addDocument({ id: ch4Id, projectId: proj2Id, title: 'Act One', content: '', createdAt: new Date('2024-02-10') });
  const sc10 = uuid(); store.addScene({ id: sc10, documentId: ch4Id, projectId: proj2Id, title: 'The Archive', content: SCENE_CONTENT.s7, order: 0, wordCount: 98, createdAt: new Date('2024-02-10') });
  const sc11 = uuid(); store.addScene({ id: sc11, documentId: ch4Id, projectId: proj2Id, title: 'The Warehouse', content: SCENE_CONTENT.s8, order: 1, wordCount: 112, createdAt: new Date('2024-02-11') });
  const sc12 = uuid(); store.addScene({ id: sc12, documentId: ch4Id, projectId: proj2Id, title: 'The Rooftops', content: SCENE_CONTENT.s9, order: 2, wordCount: 106, createdAt: new Date('2024-02-12') });

  const ch5Id = uuid();
  store.addDocument({ id: ch5Id, projectId: proj2Id, title: 'Act Two', content: '', createdAt: new Date('2024-02-14') });
  const sc13 = uuid(); store.addScene({ id: sc13, documentId: ch5Id, projectId: proj2Id, title: 'The Confrontation', content: SCENE_CONTENT.s4, order: 0, wordCount: 108, createdAt: new Date('2024-02-14') });
  const sc14 = uuid(); store.addScene({ id: sc14, documentId: ch5Id, projectId: proj2Id, title: 'The Revelation', content: SCENE_CONTENT.s5, order: 1, wordCount: 132, createdAt: new Date('2024-02-15') });
  const sc15 = uuid(); store.addScene({ id: sc15, documentId: ch5Id, projectId: proj2Id, title: 'The Escape', content: SCENE_CONTENT.s6, order: 2, wordCount: 118, createdAt: new Date('2024-02-16') });

  const ch6Id = uuid();
  store.addDocument({ id: ch6Id, projectId: proj2Id, title: 'Act Three', content: '', createdAt: new Date('2024-02-17') });
  const sc16 = uuid(); store.addScene({ id: sc16, documentId: ch6Id, projectId: proj2Id, title: 'The Choice', content: SCENE_CONTENT.s3, order: 0, wordCount: 152, createdAt: new Date('2024-02-17') });
  const sc17 = uuid(); store.addScene({ id: sc17, documentId: ch6Id, projectId: proj2Id, title: 'The Shard', content: SCENE_CONTENT.s7, order: 1, wordCount: 98, createdAt: new Date('2024-02-18') });
  const sc18 = uuid(); store.addScene({ id: sc18, documentId: ch6Id, projectId: proj2Id, title: 'Aftermath', content: SCENE_CONTENT.s8, order: 2, wordCount: 112, createdAt: new Date('2024-02-18') });

  // ── PROJECT 3: LORE / MARKDOWN ─────────────────────────────
  store.addProject({
    id: proj3Id,
    name: 'World Lore & Notes',
    writingMode: 'markdown',
    coverColor: COVER_COLORS[6],
    worldId,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-02-05'),
  });

  const ch7Id = uuid();
  store.addDocument({ id: ch7Id, projectId: proj3Id, title: 'Magic System Notes', content: '', createdAt: new Date('2024-01-10') });
  const sc19 = uuid(); store.addScene({ id: sc19, documentId: ch7Id, projectId: proj3Id, title: 'The Shards', content: '<p>Shards are fragments of the god Vel-Arath, shattered in the Sundering. Each carries a resonance — a specific type of magical force. They are rare, dangerous, and coveted by the Conclave.</p>', order: 0, wordCount: 34, createdAt: new Date('2024-01-10') });
  const sc20 = uuid(); store.addScene({ id: sc20, documentId: ch7Id, projectId: proj3Id, title: 'Resonance Users', content: '<p>Individuals who survive prolonged Shard exposure develop resonance sensitivity. The Conclave tracks and recruits (or eliminates) these individuals. Not all are willing.</p>', order: 1, wordCount: 30, createdAt: new Date('2024-01-11') });
  const sc21 = uuid(); store.addScene({ id: sc21, documentId: ch7Id, projectId: proj3Id, title: 'The Sundering', content: '<p>Three hundred years ago, the god Vel-Arath was destroyed by a coalition of mortals who feared divine rule. The destruction scattered divine essence across the realm as Shards. The Conclave was formed in the aftermath to control them.</p>', order: 2, wordCount: 42, createdAt: new Date('2024-01-12') });

  const ch8Id = uuid();
  store.addDocument({ id: ch8Id, projectId: proj3Id, title: 'Political Factions', content: '', createdAt: new Date('2024-01-15') });
  const sc22 = uuid(); store.addScene({ id: sc22, documentId: ch8Id, projectId: proj3Id, title: 'The Conclave', content: '<p>The governing body of the Shattered Realm. Founded to contain Shard power. Has since become the primary political force, using Shard-powered enforcers to maintain order.</p>', order: 0, wordCount: 31, createdAt: new Date('2024-01-15') });
  const sc23 = uuid(); store.addScene({ id: sc23, documentId: ch8Id, projectId: proj3Id, title: 'The Unshackled', content: '<p>A resistance network of rogue resonance users and dissident scholars. No central leadership — operates in cells. Kael becomes entangled with them after his defection.</p>', order: 1, wordCount: 29, createdAt: new Date('2024-01-16') });
  const sc24 = uuid(); store.addScene({ id: sc24, documentId: ch8Id, projectId: proj3Id, title: 'The Merchant Guilds', content: '<p>Nominally neutral, but heavily invested in Shard-powered trade goods. Play both sides. The harbor district is their territory and serves as a grey zone between Conclave and Unshackled operations.</p>', order: 2, wordCount: 33, createdAt: new Date('2024-01-17') });

  const ch9Id = uuid();
  store.addDocument({ id: ch9Id, projectId: proj3Id, title: 'City of Veldrath', content: '', createdAt: new Date('2024-01-20') });
  const sc25 = uuid(); store.addScene({ id: sc25, documentId: ch9Id, projectId: proj3Id, title: 'Districts Overview', content: '<p>Veldrath is divided into seven districts: the Conclave Quarter (administrative), the Upper City (nobility), the Merchant Ring (commerce), the Ashen Quarter (poor, dense, largely ungoverned), the Harbor (trade), the Archive District (scholars), and the Undercroft (subterranean, mostly forgotten).</p>', order: 0, wordCount: 48, createdAt: new Date('2024-01-20') });
  const sc26 = uuid(); store.addScene({ id: sc26, documentId: ch9Id, projectId: proj3Id, title: 'The Archive District', content: '<p>Home to the Grand Archive and dozens of smaller collections. Kael worked here for eight years. The district has its own rhythms — quiet mornings, frantic evenings, and a black market in copied documents that everyone knows about and no one discusses.</p>', order: 1, wordCount: 43, createdAt: new Date('2024-01-21') });
  const sc27 = uuid(); store.addScene({ id: sc27, documentId: ch9Id, projectId: proj3Id, title: 'The Ashen Quarter', content: '<p>The densest and most dangerous district. The Conclave maintains minimal presence here — not worth the cost of controlling it. The Unshackled have several safe houses in the Quarter. So does everyone else.</p>', order: 2, wordCount: 36, createdAt: new Date('2024-01-22') });

  // ── ENTITIES ───────────────────────────────────────────────
  // 3 Characters
  const char1Id = uuid();
  store.addEntity({
    id: char1Id,
    projectId: proj1Id,
    name: 'Kael Morvant',
    type: 'character',
    description: 'Former Conclave archivist, now a fugitive. Youngest field archivist in four decades. Exposed to Shard resonance during a classified retrieval mission. The exposure changed him in ways the Conclave found inconvenient.',
    isFavorite: true,
    subcategory: 'Protagonist',
    customFields: [
      { label: 'Age', value: '31' },
      { label: 'Former Title', value: 'Senior Field Archivist, Rank 4' },
      { label: 'Shard Affinity', value: 'Memory resonance — can recall perfect sensory detail from any past experience' },
    ],
    createdAt: new Date('2024-01-15'),
    articleDoc: makeArticleDoc([
      mainTab([
        heading('Kael Morvant', 2, 40, 40),
        textBlock('<p>Former Senior Field Archivist for the Conclave. Kael spent eight years cataloguing and retrieving Shard fragments across the Realm. He was methodical, brilliant, and — by all accounts — loyal. Then he retrieved Shard 7-C from the Undercroft, and everything changed.</p><p>His memory resonance developed over three months following the exposure. He reported the symptoms. The Conclave\'s response was immediate and not what he expected.</p>', 40, 140),
        divider(40, 340),
        quote('I don\'t run. I relocate strategically.', 'Kael Morvant', 40, 400),
      ]),
      tab('Abilities', [
        heading('Resonance Abilities', 2, 40, 40),
        statblock([
          { label: 'Resonance Type', value: 'Memory (Tier 2)' },
          { label: 'Range', value: 'Personal — affects self only' },
          { label: 'Duration', value: 'Permanent retention' },
          { label: 'Limitation', value: 'Cannot alter memories, only recall them' },
        ], 40, 140),
        textBlock('<p>Kael can recall any sensory experience from his past with perfect fidelity — not just visual, but sound, smell, touch, temperature, emotional state. He uses this primarily to reconstruct documents he has read and maps he has seen. The Conclave considered this extraordinarily valuable. They also considered it extraordinarily dangerous in the wrong hands.</p>', 40, 380),
      ]),
      tab('History', [
        heading('Timeline', 2, 40, 40),
        tableWidget(
          ['Year', 'Event'],
          [
            ['Year 0', 'Born in the Merchant Ring, Veldrath'],
            ['Year 19', 'Recruited by the Conclave Archive program'],
            ['Year 23', 'Achieved Rank 3 Archivist — youngest on record'],
            ['Year 26', 'Elevated to field rank — classified retrieval missions begin'],
            ['Year 29', 'The Undercroft incident — Shard 7-C exposure'],
            ['Year 31', 'Conclave declares him rogue. Story begins.'],
          ],
          40, 120
        ),
      ]),
    ]),
  });

  const char2Id = uuid();
  store.addEntity({
    id: char2Id,
    projectId: proj1Id,
    name: 'Mira Solenne',
    type: 'character',
    description: 'Intelligence operative and Kael\'s most unreliable reliable contact. Her loyalties have always been her own business. She works with the Unshackled not out of ideology but because they are the most interesting client.',
    isFavorite: false,
    subcategory: 'Deuteragonist',
    customFields: [
      { label: 'Age', value: '33' },
      { label: 'Faction', value: 'Independent (aligned with Unshackled)' },
      { label: 'Specialty', value: 'Intelligence gathering, social engineering' },
    ],
    createdAt: new Date('2024-01-16'),
    articleDoc: makeArticleDoc([
      mainTab([
        heading('Mira Solenne', 2, 40, 40),
        textBlock('<p>Mira operates in the grey spaces between factions. She has been a merchant\'s translator, a Conclave informant, an Unshackled courier, and at least one thing she has never told anyone about. She is extraordinarily good at reading people and extraordinarily bad at letting them know she likes them.</p>', 40, 140),
        divider(40, 340),
        quote('The best lies are the ones that are technically true.', 'Mira Solenne', 40, 400),
      ]),
      tab('Relationships', [
        heading('Key Relationships', 2, 40, 40),
        statblock([
          { label: 'Kael Morvant', value: 'Complicated. Trusts him as much as she trusts anyone.' },
          { label: 'The Unshackled', value: 'Professional — useful alliance, not ideology' },
          { label: 'Commander Vel', value: 'Former handler. Now hunter.' },
          { label: 'The Guilds', value: 'Business contacts. Several owe her favors.' },
        ], 40, 120),
      ]),
    ]),
  });

  const char3Id = uuid();
  store.addEntity({
    id: char3Id,
    projectId: proj1Id,
    name: 'Commander Adra Vel',
    type: 'character',
    description: 'Senior Conclave Warden Commander. Vel is not a villain — she is a person who believes in the system she serves, and the system is doing something monstrous. She is the primary antagonistic force in the story and one of its most sympathetic characters.',
    isFavorite: false,
    subcategory: 'Antagonist',
    customFields: [
      { label: 'Age', value: '47' },
      { label: 'Title', value: 'Warden Commander, Third District' },
      { label: 'Years of Service', value: '24' },
    ],
    createdAt: new Date('2024-01-17'),
    articleDoc: makeArticleDoc([
      mainTab([
        heading('Commander Adra Vel', 2, 40, 40),
        textBlock('<p>Adra Vel joined the Wardens at twenty-three, believing in their mission: contain the Shards, protect the realm, prevent another Sundering. Twenty-four years later, she has achieved more than she dreamed and understands more than she wishes she did.</p><p>She knows the Conclave suppresses resonance users who develop abilities outside their approved categories. She tells herself it\'s necessary. She\'s not entirely sure she believes it anymore.</p>', 40, 140),
        divider(40, 380),
        quote('The system is imperfect. The alternative is worse. I have to believe that.', 'Adra Vel', 40, 440),
      ]),
      tab('Methods', [
        heading('Investigative Approach', 2, 40, 40),
        textBlock('<p>Vel is methodical and thorough. She does not make arrests until she is certain, which means by the time she moves, her evidence is overwhelming. She is also not cruel — she does not use interrogation methods she cannot justify in writing. This makes her both more effective and more dangerous than her counterparts who favor brutality.</p>', 40, 140),
      ]),
    ]),
  });

  // 3 Locations
  const loc1Id = uuid();
  store.addEntity({
    id: loc1Id,
    projectId: proj1Id,
    name: 'The Grand Archive',
    type: 'location',
    description: 'The largest repository of Shard research and historical records in the Realm. Kael worked here for eight years. It is also one of the most heavily surveilled buildings in Veldrath.',
    isFavorite: false,
    subcategory: 'Institution',
    customFields: [
      { label: 'District', value: 'Archive District, Veldrath' },
      { label: 'Security Level', value: 'High — Warden checkpoint at every entrance' },
      { label: 'Status', value: 'Active — Conclave controlled' },
    ],
    createdAt: new Date('2024-01-18'),
    articleDoc: makeArticleDoc([
      mainTab([
        heading('The Grand Archive', 2, 40, 40),
        textBlock('<p>Six floors of catalogued knowledge, restricted vaults, and the particular silence that accumulates in rooms where people have been thinking carefully for centuries. The Archive was founded eighty years after the Sundering, originally to understand what had happened. It has since become a tool of the Conclave\'s control — knowledge as power, literally.</p>', 40, 140),
        divider(40, 340),
        statblock([
          { label: 'Founded', value: '~230 years ago' },
          { label: 'Floors', value: '6 above ground, 3 subterranean vault levels' },
          { label: 'Staff', value: 'Approximately 300 archivists and support staff' },
          { label: 'Access', value: 'Public floors 1-2; Restricted floors 3-6; Vault levels by Conclave authorization only' },
        ], 40, 380),
      ]),
      tab('Key Locations', [
        heading('Notable Areas', 2, 40, 40),
        tableWidget(
          ['Area', 'Floor', 'Description'],
          [
            ['The Reading Hall', '1', 'Public access. Catalogues, reference texts, approved histories.'],
            ['The Map Room', '3', 'Restricted. Cartographic records including pre-Sundering geography.'],
            ['The Resonance Laboratory', '5', 'Restricted. Shard testing and documentation. Heavily guarded.'],
            ['Vault 7', 'Sub-3', 'Deep vault. Contents classified even from most senior archivists.'],
          ],
          40, 120
        ),
      ]),
    ]),
  });

  const loc2Id = uuid();
  store.addEntity({
    id: loc2Id,
    projectId: proj1Id,
    name: 'The Ashen Quarter',
    type: 'location',
    description: 'The densest district in Veldrath. The Conclave maintains minimal presence here. The Unshackled have several safe houses, as does everyone else who prefers to operate without oversight.',
    isFavorite: false,
    subcategory: 'District',
    customFields: [
      { label: 'District', value: 'Southwest Veldrath' },
      { label: 'Population', value: 'Approx. 40,000 — highest density in the city' },
      { label: 'Conclave Presence', value: 'Minimal — single checkpoint at main entrance' },
    ],
    createdAt: new Date('2024-01-19'),
    articleDoc: makeArticleDoc([
      mainTab([
        heading('The Ashen Quarter', 2, 40, 40),
        textBlock('<p>The Quarter got its name from the fires of the Sundering that burned through this part of the city and were never fully extinguished — the ruins were simply built over. There is a layer of ash beneath every foundation here. The people who live in the Quarter are aware of this in the way people are aware of all the things they cannot change.</p>', 40, 140),
      ]),
      tab('Safe Houses', [
        heading('Known Unshackled Locations', 2, 40, 40),
        textBlock('<p>At least four confirmed safe house locations in the Quarter, used on rotation. The cooper\'s workshop on Fenn Street is a primary transit point. The laundry on the Crooked Way is used for document exchanges. The others are not documented for security reasons.</p>', 40, 100),
      ]),
    ]),
  });

  const loc3Id = uuid();
  store.addEntity({
    id: loc3Id,
    projectId: proj1Id,
    name: "Veldrath Harbor",
    type: 'location',
    description: 'The commercial lifeline of the city. The Merchant Guilds control the harbor, making it a rare neutral zone where Conclave jurisdiction is genuinely contested. Mira has deep contacts here.',
    isFavorite: false,
    subcategory: 'District',
    customFields: [
      { label: 'District', value: 'Eastern Veldrath' },
      { label: 'Control', value: 'Merchant Guild territory — Conclave presence by treaty only' },
      { label: 'Key Feature', value: 'Resonance-powered lifting cranes — visible from across the city' },
    ],
    createdAt: new Date('2024-01-20'),
    articleDoc: makeArticleDoc([
      mainTab([
        heading('Veldrath Harbor', 2, 40, 40),
        textBlock('<p>The harbor runs on Shard-powered machinery — lifting cranes, cooling vaults for perishables, the great light at the harbor mouth. The Guilds pay the Conclave handsomely for access to the Shards that power them, which means the Conclave is careful not to antagonize Guild interests. This makes the harbor the closest thing Veldrath has to a genuinely neutral zone.</p>', 40, 140),
      ]),
    ]),
  });

  // 3 Factions
  const fac1Id = uuid();
  store.addEntity({
    id: fac1Id,
    projectId: proj1Id,
    name: 'The Conclave',
    type: 'faction',
    description: 'The governing body of the Shattered Realm. Founded to contain Shard power following the Sundering. Has since become the primary political and military force in the realm, using Shard-powered enforcers to maintain control.',
    isFavorite: false,
    subcategory: 'Government',
    customFields: [
      { label: 'Founded', value: 'Approx. 300 years ago' },
      { label: 'Headquarters', value: 'The Conclave Tower, Veldrath' },
      { label: 'Military Arm', value: 'The Wardens — approximately 3,000 active in Veldrath' },
    ],
    createdAt: new Date('2024-01-21'),
    articleDoc: makeArticleDoc([
      mainTab([
        heading('The Conclave', 2, 40, 40),
        textBlock('<p>The Conclave began as a necessary institution — in the immediate aftermath of the Sundering, someone had to organize the retrieval and containment of Shard fragments before they caused further catastrophe. Three centuries later, that emergency mandate has become permanent governance.</p><p>The Conclave\'s public mandate is stability. Its actual practice involves significant suppression of information, people, and events that might destabilize their control.</p>', 40, 140),
        divider(40, 380),
        statblock([
          { label: 'Current High Arbiter', value: 'Soren Cract (age 71)' },
          { label: 'Number of Arbiters', value: '9' },
          { label: 'Annual Budget', value: 'Classified' },
          { label: 'Motto', value: '"Order from Fracture"' },
        ], 40, 440),
      ]),
      tab('Internal Structure', [
        heading('Hierarchy', 2, 40, 40),
        tableWidget(
          ['Rank', 'Role'],
          [
            ['High Arbiter', 'Supreme governing authority. One per generation.'],
            ['Arbiter', 'Policy council. 9 members. Elected by senior Wardens and Archivists.'],
            ['Warden Commander', 'Military/enforcement leadership. Regional command structure.'],
            ['Senior Archivist', 'Knowledge and research branch. Ranks 1-5.'],
            ['Field Archivist', 'Retrieval operations. Kael held Rank 4.'],
            ['Warden', 'Enforcement rank and file. Approximately 3,000 in Veldrath.'],
          ],
          40, 120
        ),
      ]),
    ]),
  });

  const fac2Id = uuid();
  store.addEntity({
    id: fac2Id,
    projectId: proj1Id,
    name: 'The Unshackled',
    type: 'faction',
    description: 'A resistance network of rogue resonance users and dissident scholars. No central leadership — operates in cells. Dedicated to preventing Conclave suppression of resonance users.',
    isFavorite: false,
    subcategory: 'Resistance',
    customFields: [
      { label: 'Founded', value: 'Unknown — estimated 40-50 years ago' },
      { label: 'Structure', value: 'Decentralized cell network — no known central leadership' },
      { label: 'Membership', value: 'Unknown — deliberately obscured' },
    ],
    createdAt: new Date('2024-01-22'),
    articleDoc: makeArticleDoc([
      mainTab([
        heading('The Unshackled', 2, 40, 40),
        textBlock('<p>No one founded the Unshackled in a single moment. The network grew from a series of small decisions made by people who had been forced into impossible positions by Conclave policy. A resonance user who helped a neighbor escape a warden sweep. A scholar who copied classified documents about Shard suppression and distributed them. A cell of three people who decided three was enough to start.</p>', 40, 140),
        quote('We don\'t fight the Conclave. We make space for people to exist without needing permission.', 'Unshackled Founding Principle', 40, 360),
      ]),
    ]),
  });

  const fac3Id = uuid();
  store.addEntity({
    id: fac3Id,
    projectId: proj1Id,
    name: 'The Merchant Guilds',
    type: 'faction',
    description: 'The commercial federation that controls Veldrath\'s harbor and trade networks. Nominally neutral. Heavily invested in Shard-powered trade goods. They play both sides and profit from the tension.',
    isFavorite: false,
    subcategory: 'Economic',
    customFields: [
      { label: 'Founded', value: 'Pre-Sundering — one of the oldest institutions in the city' },
      { label: 'Primary Territory', value: 'The Harbor and Merchant Ring' },
      { label: 'Current Guild Primus', value: 'Enna Vass (age 58)' },
    ],
    createdAt: new Date('2024-01-23'),
    articleDoc: makeArticleDoc([
      mainTab([
        heading('The Merchant Guilds', 2, 40, 40),
        textBlock('<p>The Guilds predate the Conclave by at least a century. When the Conclave rose to power, the Guilds were pragmatic — they negotiated rather than resisted, trading political legitimacy for commercial autonomy. The arrangement has held for three centuries.</p><p>The Guilds are not neutral in the sense of having no interests. They are neutral in the sense of having no loyalties except to commerce, which is a different thing entirely.</p>', 40, 140),
      ]),
    ]),
  });

  // 3 Artifacts
  const art1Id = uuid();
  store.addEntity({
    id: art1Id,
    projectId: proj1Id,
    name: 'Shard 7-C',
    type: 'artifact',
    description: 'The specific fragment of divine essence that triggered Kael\'s resonance development. Classified as Tier-Unknown by the Conclave. Its precise properties are not fully documented even in restricted files.',
    isFavorite: true,
    subcategory: 'Shard Fragment',
    customFields: [
      { label: 'Classification', value: 'Tier-Unknown (formerly Tier 3)' },
      { label: 'Current Location', value: 'Unknown — Kael\'s possession, unconfirmed' },
      { label: 'Exposure Effect', value: 'Memory resonance development in host' },
    ],
    createdAt: new Date('2024-01-24'),
    articleDoc: makeArticleDoc([
      mainTab([
        heading('Shard 7-C', 2, 40, 40),
        textBlock('<p>Recovered from Vault 7 in the Undercroft during Kael\'s final authorized retrieval mission. The Conclave\'s records describe it as a "low-resonance fragment, memory-adjacent, containment priority Tier 3." This classification was updated to Tier-Unknown within six hours of Kael\'s first resonance episode.</p><p>The Shard is approximately the size of a thumb joint. It is warm to the touch. It has never been successfully placed in stasis containment for more than 72 hours before the containment fails.</p>', 40, 140),
        divider(40, 380),
        quote('The Shard didn\'t give me something new. It gave me access to something I already had.', 'Kael Morvant', 40, 440),
      ]),
      tab('Properties', [
        heading('Documented Properties', 2, 40, 40),
        statblock([
          { label: 'Physical Form', value: 'Irregular crystalline fragment, dark blue-black' },
          { label: 'Temperature', value: 'Approximately 4°C above ambient, constant' },
          { label: 'Resonance Type', value: 'Memory (confirmed); possibly additional types unconfirmed' },
          { label: 'Containment', value: 'Standard stasis fails after ~72 hours' },
          { label: 'Danger Level', value: 'Unknown — Conclave classification withheld' },
        ], 40, 120),
      ]),
    ]),
  });

  const art2Id = uuid();
  store.addEntity({
    id: art2Id,
    projectId: proj1Id,
    name: "The Conclave Cipher Key",
    type: 'artifact',
    description: 'A master decryption tool for Conclave communication codes. Mira obtained one through means she has not specified. It is worth more than most small buildings.',
    isFavorite: false,
    subcategory: 'Document / Tool',
    customFields: [
      { label: 'Type', value: 'Mechanical cipher device — Shard-powered' },
      { label: 'Provenance', value: 'Unknown — Mira\'s sources' },
      { label: 'Value', value: 'Extremely high — capital offense to possess without authorization' },
    ],
    createdAt: new Date('2024-01-25'),
    articleDoc: makeArticleDoc([
      mainTab([
        heading('The Conclave Cipher Key', 2, 40, 40),
        textBlock('<p>The Conclave issues cipher keys to senior Wardens and Arbiters for secure communications. The device is roughly the size of a pocket watch, brass-cased, with a small Shard embedded in the mechanism. When held by an authorized user — or apparently by Mira — it decrypts encoded documents on contact.</p>', 40, 140),
      ]),
    ]),
  });

  const art3Id = uuid();
  store.addEntity({
    id: art3Id,
    projectId: proj1Id,
    name: 'The Resonance Atlas',
    type: 'artifact',
    description: 'A pre-Sundering cartographic document showing the locations of divine essence concentrations across the realm — what would become the Shard sites. If accurate, it would completely overturn the Conclave\'s account of Shard distribution.',
    isFavorite: false,
    subcategory: 'Document',
    customFields: [
      { label: 'Age', value: 'Approx. 320 years — pre-Sundering' },
      { label: 'Location', value: 'Vault 7, Grand Archive (restricted)' },
      { label: 'Classification', value: 'Concealed — not in the official catalogue' },
    ],
    createdAt: new Date('2024-01-26'),
    articleDoc: makeArticleDoc([
      mainTab([
        heading('The Resonance Atlas', 2, 40, 40),
        textBlock('<p>Kael found the Atlas during his time as a field archivist — or rather, he found a reference to it in a classified index and spent two years arranging access to the document itself. What he found rewrote his understanding of the Sundering.</p><p>The Atlas predates the official Conclave account by forty years. It suggests the Shard distribution was not random — that the Sundering was, in some meaningful sense, planned.</p>', 40, 140),
        divider(40, 380),
        quote('Someone knew where every fragment would fall. Either the Atlas is a forgery, or everything the Conclave has told us is.', 'Kael Morvant', 40, 440),
      ]),
    ]),
  });

  // 3 Lore entries
  const lore1Id = uuid();
  store.addEntity({
    id: lore1Id,
    projectId: proj1Id,
    name: 'The Sundering',
    type: 'lore',
    description: 'The defining event of the current era. Three hundred years ago, the god Vel-Arath was destroyed by a mortal coalition. The destruction scattered divine essence across the realm as Shard fragments. The Conclave was founded in the aftermath.',
    isFavorite: false,
    subcategory: 'Historical Event',
    customFields: [
      { label: 'Date', value: 'Approx. 300 years before story present' },
      { label: 'Location', value: 'The Altar Plain, now the Conclave Quarter' },
      { label: 'Official Account', value: 'Mortals rose against tyrannical divine rule. Succeeded at great cost. The Conclave formed to manage the aftermath.' },
    ],
    createdAt: new Date('2024-01-27'),
    articleDoc: makeArticleDoc([
      mainTab([
        heading('The Sundering', 2, 40, 40),
        textBlock('<p>The official account of the Sundering is taught to every child in the Realm: a coalition of mortal heroes, unable to endure divine tyranny, rose against the god Vel-Arath and destroyed it at the Altar Plain. The destruction scattered divine essence as Shard fragments. The Conclave formed to contain these fragments and prevent another divine entity from consolidating power.</p><p>This is the official account. Kael\'s research suggests it is, at minimum, incomplete.</p>', 40, 140),
        divider(40, 380),
        quote('The winners write the history. The Conclave has been winning for three hundred years.', 'Unshackled pamphlet, author unknown', 40, 440),
      ]),
      tab('Disputed Facts', [
        heading('What the Official Record Omits', 2, 40, 40),
        tableWidget(
          ['Claim', 'Evidence', 'Implication'],
          [
            ['The Sundering was accidental', 'Official account', 'The coalition did not fully control the destruction'],
            ['The Sundering was planned', 'The Resonance Atlas', 'Someone knew exactly where each fragment would fall'],
            ['Vel-Arath was tyrannical', 'Official account only', 'No surviving primary sources — all pre-Sundering records are restricted'],
            ['The Conclave formed in response', 'Official account', 'Conclave administrative structures predate the Sundering by 12 years per some restricted documents'],
          ],
          40, 120
        ),
      ]),
    ]),
  });

  const lore2Id = uuid();
  store.addEntity({
    id: lore2Id,
    projectId: proj1Id,
    name: 'The Resonance Classification System',
    type: 'lore',
    description: 'The Conclave\'s formal framework for categorizing Shard-derived abilities in resonance users. Determines how individuals are treated — integrated, monitored, or suppressed.',
    isFavorite: false,
    subcategory: 'System / Mechanic',
    customFields: [
      { label: 'Established By', value: 'The Conclave, approx. 250 years ago' },
      { label: 'Current Tiers', value: 'Tier 1 (minor) through Tier 5 (existential threat)' },
      { label: 'Classification Authority', value: 'Senior Resonance Arbiters — 7 currently active' },
    ],
    createdAt: new Date('2024-01-28'),
    articleDoc: makeArticleDoc([
      mainTab([
        heading('Resonance Classification System', 2, 40, 40),
        textBlock('<p>When the Conclave recognized that Shard exposure could produce lasting abilities in survivors, they needed a framework to manage the resulting population. The Classification System was that framework. In theory, it identifies individuals with resonance abilities and determines appropriate support and oversight. In practice, it determines whether someone is useful, controllable, or threatening.</p>', 40, 140),
        divider(40, 340),
        statblock([
          { label: 'Tier 1', value: 'Minor sensitivity — heightened perception, mild intuition' },
          { label: 'Tier 2', value: 'Moderate ability — documentable, controllable effect' },
          { label: 'Tier 3', value: 'Significant ability — requires monitoring and reporting' },
          { label: 'Tier 4', value: 'Major ability — restricted movement, Conclave supervision' },
          { label: 'Tier 5', value: 'Classified — outcomes not publicly documented' },
        ], 40, 380),
      ]),
    ]),
  });

  const lore3Id = uuid();
  store.addEntity({
    id: lore3Id,
    projectId: proj1Id,
    name: 'The Night of Corrections',
    type: 'lore',
    description: 'An event from forty years ago, rarely discussed openly. The Conclave conducted a systematic operation to "reclassify" a large number of Tier 3 and Tier 4 resonance users. Most were never heard from again.',
    isFavorite: false,
    subcategory: 'Historical Event',
    customFields: [
      { label: 'Date', value: 'Approx. 40 years before story present' },
      { label: 'Official Account', value: 'A necessary security measure during a period of unrest' },
      { label: 'Actual Outcome', value: 'Classified — estimates suggest 200-400 individuals affected' },
    ],
    createdAt: new Date('2024-01-29'),
    articleDoc: makeArticleDoc([
      mainTab([
        heading('The Night of Corrections', 2, 40, 40),
        textBlock('<p>Every institution has moments it does not discuss in public. For the Conclave, the Night of Corrections is that moment. The official record describes it as a "security reclassification event" during a period of instability. The restricted records — which Kael accessed in the months before his defection — describe it differently.</p><p>The Conclave identified approximately three hundred resonance users whose abilities had developed outside approved parameters. In a single coordinated operation spanning Veldrath and four other cities, these individuals were detained. Fewer than twenty were subsequently released.</p>', 40, 140),
        divider(40, 420),
        quote('They called it corrections. They meant deletions.', 'Unshackled internal document, circa 30 years ago', 40, 480),
      ]),
      tab('Survivors', [
        heading('Known Survivor Accounts', 2, 40, 40),
        textBlock('<p>Fewer than twenty individuals were released following the Night of Corrections. Most relocated outside Veldrath. None gave public statements. Two of them are now senior figures in the Unshackled network. They do not discuss what happened to them. They do not need to.</p>', 40, 100),
      ]),
    ]),
  });
}
