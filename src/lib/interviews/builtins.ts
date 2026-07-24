/**
 * The shipped interviews. Each is a fixed ten-question skill. The order within
 * each is deliberate: lead with the identity/premise root, sweep the coverage
 * backbone, close with the live tension so the subject isn't inert.
 *
 * These are read-only at runtime — the editor duplicates one to make an
 * editable copy rather than mutating the seed set.
 */

import type { Interview } from './types';

const WORLD: Interview = {
    id: 'build-a-world',
    title: 'World',
    icon: '🌍',
    tagline: 'From a blank world to a seeded World Bible.',
    builtIn: true,
    questions: [
        { label: 'Premise', prompt: "In a sentence or two — what's the big idea of your world, and what makes it the one place this story could happen?", seeds: 'the core concept' },
        { label: 'Central conflict', prompt: 'What tension is pulling this world apart — and who or what are the opposing sides?', seeds: 'faction' },
        { label: 'Physical world', prompt: 'Where and when are we? The land, the climate, the scale of it, and the era of technology.', seeds: 'location' },
        { label: 'Peoples & cultures', prompt: 'Who lives here? The main peoples, cultures, or species — and how they see each other.', seeds: 'species, character' },
        { label: 'Power', prompt: 'Who holds power, and who wants it? How is the world ruled, and where is that contested?', seeds: 'faction' },
        { label: 'Belief', prompt: "What do people here believe — religions, myths, or the values they'd fight to defend?", seeds: 'religion, lore' },
        { label: 'The special system', prompt: "Is there magic or technology beyond ours? If so — where does it come from, what does it cost, and what can't it do?", seeds: 'magic, artifact' },
        { label: 'Daily life', prompt: "How do ordinary people get by? What's scarce, what's abundant, and what's a normal day for someone at the bottom?", seeds: 'lore, location' },
        { label: 'The turning point', prompt: 'What one event in the past made the present what it is?', seeds: 'lore' },
        { label: "What's breaking now", prompt: 'What fragile balance is about to break as the story opens?', seeds: 'lore' },
    ],
};

const CHARACTER: Interview = {
    id: 'build-a-character',
    title: 'Character',
    icon: '👤',
    tagline: 'Build a character from want to breaking point.',
    targetType: 'character',
    builtIn: true,
    questions: [
        { label: 'Core want', prompt: 'Who is this character in a line — and what do they want more than anything?', seeds: 'the character' },
        { label: 'The wound', prompt: 'What happened in their past that still shapes how they act today?', seeds: 'lore' },
        { label: 'Blind spot', prompt: "What do they believe about themselves that isn't quite true?", seeds: 'the character' },
        { label: 'Want vs. fear', prompt: 'What are they chasing on the surface, and what are they most afraid of underneath?', seeds: 'the character' },
        { label: 'Place in the world', prompt: 'Where do they stand — their work, station, reputation, and who they answer to?', seeds: 'faction, location' },
        { label: 'Relationships', prompt: 'Who matters most to them, and who stands in their way?', seeds: 'character, faction' },
        { label: 'Voice & presence', prompt: "How do they talk, move, and carry themselves? What would you notice first?", seeds: 'the character' },
        { label: 'Competence & limits', prompt: "What are they genuinely good at, and where are they out of their depth?", seeds: 'the character' },
        { label: 'Arc', prompt: 'How might they change over the story — or dig in and refuse to?', seeds: 'the character' },
        { label: 'The test', prompt: 'What situation would force them to choose between what they want and what they believe?', seeds: 'lore' },
    ],
};

const SPECIES: Interview = {
    id: 'build-a-species',
    title: 'Species',
    icon: '🧬',
    tagline: 'Design a people from body to belief.',
    targetType: 'species',
    builtIn: true,
    questions: [
        { label: 'Essence', prompt: 'What is this species in a line — and what makes them unmistakably not human?', seeds: 'the species' },
        { label: 'Body & senses', prompt: 'How are they built — size, senses, lifespan, and how they move and perceive the world?', seeds: 'the species' },
        { label: 'Origin', prompt: 'Where did they come from — evolved, created, or arrived from elsewhere?', seeds: 'lore' },
        { label: 'Habitat', prompt: 'Where do they thrive, and what environment shaped them into what they are?', seeds: 'location' },
        { label: 'Social structure', prompt: 'How do they organize — solitary, hive, tribal, hierarchical?', seeds: 'faction' },
        { label: 'Lifecycle', prompt: 'How do they come into being and grow? Walk me through their stages of life.', seeds: 'the species' },
        { label: 'Culture & taboos', prompt: 'What do they hold sacred, and what is unthinkable to them?', seeds: 'religion, lore' },
        { label: 'Relations with others', prompt: 'How do they regard other peoples — as allies, rivals, prey, or beneath notice?', seeds: 'faction, species' },
        { label: 'Strengths & weakness', prompt: "What can they do that others can't — and what's their fatal limit?", seeds: 'the species' },
        { label: 'The tension they carry', prompt: 'What conflict or misunderstanding seems to follow this species wherever they go?', seeds: 'lore' },
    ],
};

const CITY: Interview = {
    id: 'build-a-city',
    title: 'City',
    icon: '🏙️',
    tagline: 'Build a city from its streets to its secrets.',
    targetType: 'location',
    builtIn: true,
    questions: [
        { label: 'First impression', prompt: "What is this city in a line — and what's the first thing you'd notice arriving?", seeds: 'the city' },
        { label: 'Place & why-here', prompt: 'Where does it sit — the geography and climate — and why was it built here?', seeds: 'location' },
        { label: 'Founding', prompt: 'Why was the city founded, and by whom?', seeds: 'lore, faction' },
        { label: 'Livelihood', prompt: 'What does the city live on — trade, industry, a resource, faith?', seeds: 'faction' },
        { label: 'Who rules', prompt: 'Who governs it on paper — and who really runs it?', seeds: 'faction, character' },
        { label: 'Districts', prompt: 'What are its distinct quarters, and how does life differ between them?', seeds: 'location' },
        { label: 'People & divisions', prompt: 'Who lives here, and how are they divided — by class, race, guild, or faith?', seeds: 'faction, species' },
        { label: 'Landmarks', prompt: 'What are its defining places — the ones locals name without thinking?', seeds: 'location, artifact' },
        { label: "What's simmering", prompt: "What's building under the surface — crime, unrest, rivalry, decay?", seeds: 'faction, lore' },
        { label: 'The secret', prompt: 'What does the city hide that outsiders never see?', seeds: 'lore' },
    ],
};

const COUNTRY: Interview = {
    id: 'build-a-country',
    title: 'Country',
    icon: '🏴',
    tagline: 'Shape a nation from its land to its crisis.',
    targetType: 'faction',
    builtIn: true,
    questions: [
        { label: 'Identity', prompt: 'What is this nation in a line — and how do its people describe themselves?', seeds: 'the nation' },
        { label: 'Land & borders', prompt: 'What are its geography, borders, and climate — and how do those shape it?', seeds: 'location' },
        { label: 'Origin', prompt: 'How did it come to be — founded, conquered, splintered, or slowly grown?', seeds: 'lore' },
        { label: 'Government', prompt: 'How is it ruled, and where does power actually sit?', seeds: 'faction, character' },
        { label: 'Economy', prompt: 'What sustains it — resources, trade, labor, tribute?', seeds: 'faction' },
        { label: 'Peoples & culture', prompt: 'Who lives here — the peoples, languages, faiths, and customs?', seeds: 'species, religion' },
        { label: 'Neighbors', prompt: 'Who are its allies and its enemies, and why?', seeds: 'faction' },
        { label: 'Military & strength', prompt: 'How does it defend itself and project power?', seeds: 'faction' },
        { label: 'Fault lines', prompt: 'What internal tensions could tear it apart — class, region, succession, faith?', seeds: 'faction, lore' },
        { label: 'Present crisis', prompt: 'What pressure is the nation facing right now, as the story opens?', seeds: 'lore' },
    ],
};

/** The shipped interviews, in menu order. */
export const BUILTIN_INTERVIEWS: Interview[] = [WORLD, CHARACTER, SPECIES, CITY, COUNTRY];
