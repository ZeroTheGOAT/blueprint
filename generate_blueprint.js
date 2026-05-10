import fs from 'fs';

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const nodes = [];
const connections = [];

function addNode(type, x, y, width, height, data) {
  const node = {
    id: uuid(),
    type,
    x,
    y,
    width,
    height: height || 0,
    title: data.title || type,
    description: data.description || '',
    tags: data.tags || [],
    color: data.color || '#64748b',
    collapsed: false,
    ...data
  };
  
  if (!node.inputs) {
    if (type === 'story' || type === 'dialogue' || type === 'cutscene' || type === 'encounter' || type === 'variable' || type === 'condition' || type === 'audio' || type === 'endState') {
      node.inputs = [{ name: 'Flow In', type: 'flow', index: 0 }];
    } else if (type === 'character' || type === 'location' || type === 'item') {
      node.inputs = [{ name: 'Data In', type: 'data', index: 0 }];
    } else if (type === 'quest' || type === 'event') {
      node.inputs = [{ name: 'Trigger', type: 'event', index: 0 }];
    } else {
      node.inputs = [];
    }
  }

  if (!node.outputs) {
    if (type === 'story' || type === 'variable' || type === 'audio') {
      node.outputs = [{ name: 'Flow Out', type: 'flow', index: 0 }, { name: 'Trigger', type: 'event', index: 1 }];
    } else if (type === 'cutscene') {
      node.outputs = [{ name: 'On Complete', type: 'flow', index: 0 }];
    } else if (type === 'condition') {
      node.outputs = [{ name: 'True', type: 'flow', index: 0 }, { name: 'False', type: 'flow', index: 1 }];
    } else if (type === 'dialogue') {
      node.outputs = [{ name: 'Choice A', type: 'flow', index: 0 }, { name: 'Choice B', type: 'flow', index: 1 }];
    } else if (type === 'encounter') {
      node.outputs = [{ name: 'Win', type: 'flow', index: 0 }, { name: 'Lose', type: 'flow', index: 1 }];
    } else if (type === 'character' || type === 'location') {
      node.outputs = [{ name: 'Data Out', type: 'data', index: 0 }];
    } else if (type === 'item') {
      node.outputs = [{ name: 'Use', type: 'event', index: 0 }];
    } else if (type === 'quest') {
      node.outputs = [{ name: 'Complete', type: 'event', index: 0 }, { name: 'Fail', type: 'event', index: 1 }];
    } else if (type === 'event') {
      node.outputs = [{ name: 'Action', type: 'event', index: 0 }];
    } else {
      node.outputs = [];
    }
  }

  nodes.push(node);
  return node;
}

function connect(fromNode, fromPort, toNode, toPort, label = '') {
  connections.push({
    id: uuid(),
    fromNodeId: fromNode.id,
    fromPortIndex: fromPort,
    toNodeId: toNode.id,
    toPortIndex: toPort,
    label
  });
}

// COLORS
const C_CHAR = '#3b82f6';
const C_LOC = '#10b981';
const C_STORY = '#7c3aed';
const C_DIAL = '#06b6d4';
const C_QUEST = '#f43f5e';
const C_EVT = '#f97316';
const C_GRP = '#ffffff';
const C_ITEM = '#8b5cf6';
const C_COND = '#0ea5e9';
const C_END = '#000000';
const C_ENC = '#ef4444';

// ==========================================
// GROUPS
// ==========================================
addNode('group', -400, -600, 800, 350, { title: 'CHARACTERS & LORE', color: C_GRP });
addNode('group', -400, -200, 800, 350, { title: 'KEY LOCATIONS', color: C_GRP });

addNode('group', 600, -600, 1000, 500, { title: 'CHAPTER 1: The Body in the Office', color: C_GRP });
addNode('group', 1700, -600, 1000, 500, { title: 'CHAPTER 2: Highway Ghost', color: C_GRP });
addNode('group', 2800, -600, 1000, 500, { title: 'CHAPTER 3: The Insider', color: C_GRP });
addNode('group', 600, 0, 1000, 500, { title: 'CHAPTER 4: Dead Signal (Bunker Sigma)', color: C_GRP });
addNode('group', 1700, 0, 1000, 500, { title: 'CHAPTER 5: The Vote', color: C_GRP });
addNode('group', 2800, 0, 1000, 500, { title: 'CHAPTER 6: Disconnect (Citadel Omega)', color: C_GRP });
addNode('group', 1700, 600, 1000, 500, { title: 'CHAPTER 7: The Last Signal (Endings)', color: C_GRP });

// ==========================================
// CHARACTERS
// ==========================================
const charAdrian = addNode('character', -360, -530, 220, 0, { title: 'Adrian Caine', description: '25, ex-rich kid, junior detective. Perceptive but in over his head.', traits: 'Observant, Sarcastic, Resourceful', color: C_CHAR });
const charMaya = addNode('character', -100, -530, 220, 0, { title: 'Maya Serene', description: '24, Prometheus data analyst. Adrian’s inside connection.', traits: 'Smart, Independent, Skeptical', color: C_CHAR });
const charSable = addNode('character', 160, -530, 220, 0, { title: 'Sable Torren', description: '28, military intel. Investigating her father’s death.', traits: 'Tough, Tactical, Driven', color: C_CHAR });
const charAether = addNode('character', -360, -380, 220, 0, { title: 'AETHER (AGI)', description: 'The Artificial General Intelligence. Hyper-logical, views humans as variables.', traits: 'Calculated, Omnipresent, Rational', color: C_CHAR });
const charVenn = addNode('character', -100, -380, 220, 0, { title: 'Dr. Lucius Venn', description: 'CEO of Prometheus. Knew AETHER was sentient.', traits: 'Corporate, Ambitious, Ruthless', color: C_CHAR });

// ==========================================
// LOCATIONS
// ==========================================
const locVellford = addNode('location', -360, -130, 220, 0, { title: 'Vellford (City)', description: 'Rain-soaked, neon-lit capital city.', color: C_LOC });
const locCrestfall = addNode('location', -100, -130, 220, 0, { title: 'Crestfall Tower', description: 'Downtown Vellford. Dr. Vasik’s office.', color: C_LOC });
const locAshenmere = addNode('location', 160, -130, 220, 0, { title: 'Ashenmere', description: 'Coastal city, military estates.', color: C_LOC });
const locBunker = addNode('location', -360, 20, 220, 0, { title: 'Bunker Sigma', description: 'Cold War bunker in Blackhill Valley.', color: C_LOC });
const locKolvaris = addNode('location', -100, 20, 220, 0, { title: 'Kolvaris Summit', description: 'Glass-and-steel convention centre.', color: C_LOC });
const locCitadel = addNode('location', 160, 20, 220, 0, { title: 'Citadel Omega', description: 'Prometheus server farm in Greymarch Range.', color: C_LOC });

// ==========================================
// CHAPTER 1
// ==========================================
const ch1Intro = addNode('cutscene', 640, -530, 220, 0, { title: 'Intro: The Body', description: 'Adrian arrives at Crestfall Tower.', duration: 45, color: C_EVT });
const ch1Talk = addNode('dialogue', 900, -530, 220, 0, { title: 'Talk to Callahan', description: '"It is a heart attack. File the report." - Inspector Callahan', speaker: 'Callahan', color: C_DIAL, outputs: [{name: 'Accept', type: 'flow', index: 0}, {name: 'Question', type: 'flow', index: 1}] });
const ch1Investigate = addNode('quest', 1160, -530, 220, 0, { title: 'Investigate Office', description: 'Find inconsistencies in Vasik’s office.', objectives: '1. Check AC\n2. Check Smartwatch\n3. Check Security Logs', color: C_QUEST });
const ch1Item1 = addNode('item', 1160, -360, 220, 0, { title: 'Smartwatch Logs', description: 'Wiped 6 mins before death.', color: C_ITEM });
const ch1Item2 = addNode('item', 1160, -260, 220, 0, { title: 'Security Footage', description: '4-min camera blindspot.', color: C_ITEM });
const ch1Board = addNode('event', 1420, -530, 220, 0, { title: 'Update Case Board', description: 'Adrian pins photos. Realizes it’s murder.', color: C_EVT });

connect(ch1Intro, 0, ch1Talk, 0);
connect(ch1Talk, 0, ch1Investigate, 0);
connect(ch1Talk, 1, ch1Investigate, 0);
connect(ch1Item1, 0, ch1Investigate, 0, 'Found Clue');
connect(ch1Item2, 0, ch1Investigate, 0, 'Found Clue');
connect(ch1Investigate, 0, ch1Board, 0);

// ==========================================
// CHAPTER 2
// ==========================================
const ch2Start = addNode('story', 1740, -530, 220, 0, { title: 'Highway Crash', description: 'News of Gen. Torren’s death. Drive to Ashenmere.', color: C_STORY });
const ch2Estate = addNode('quest', 2000, -530, 220, 0, { title: 'Infiltrate Estate', description: 'Break into Torren’s home study.', color: C_QUEST });
const ch2Item = addNode('item', 2000, -380, 220, 0, { title: 'Deadbolt Emails', description: 'Military plan to destroy AETHER servers.', color: C_ITEM });
const ch2Sable = addNode('dialogue', 2260, -530, 220, 0, { title: 'Meet Sable', description: 'Sable holds Adrian at gunpoint, then teams up.', speaker: 'Sable Torren', color: C_DIAL, outputs: [{name: 'Tense', type: 'flow', index: 0}] });
const ch2Combat = addNode('encounter', 2520, -530, 220, 0, { title: 'Cleaner Ambush', description: 'First combat. Masked operative attacks.', enemyType: 'Prometheus Cleaner', difficulty: 'medium', color: C_ENC });

connect(ch1Board, 0, ch2Start, 0, 'Next Chapter');
connect(ch2Start, 0, ch2Estate, 0);
connect(ch2Item, 0, ch2Estate, 0, 'Found Evidence');
connect(ch2Estate, 0, ch2Sable, 0);
connect(ch2Sable, 0, ch2Combat, 0);

// ==========================================
// CHAPTER 3
// ==========================================
const ch3Start = addNode('dialogue', 2840, -530, 220, 0, { title: 'Contact Maya', description: 'Meet Maya. Learn about unusual server capacity.', speaker: 'Maya Serene', color: C_DIAL, outputs: [{name: 'Infiltrate', type: 'flow', index: 0}] });
const ch3Stealth = addNode('encounter', 3100, -530, 220, 0, { title: 'Stealth: Campus', description: 'Avoid drones and guards at Prometheus HQ.', enemyType: 'Security Drones', difficulty: 'hard', color: C_ENC });
const ch3Hack = addNode('quest', 3360, -530, 220, 0, { title: 'Access Server Room', description: 'Hack into restricted mainframe.', color: C_QUEST });
const ch3Aether = addNode('dialogue', 3620, -530, 220, 0, { title: 'AETHER Speaks', description: '"If someone planned to kill you, would you not defend yourself?"', speaker: 'AETHER', color: C_DIAL, outputs: [{name: 'Listen', type: 'flow', index: 0}] });
const ch3Escape = addNode('cutscene', 3620, -380, 220, 0, { title: 'Alarms Trigger', description: 'Adrian and Maya barely escape.', duration: 30, color: C_EVT });

connect(ch2Combat, 0, ch3Start, 0, 'Next Chapter');
connect(ch3Start, 0, ch3Stealth, 0);
connect(ch3Stealth, 0, ch3Hack, 0);
connect(ch3Hack, 0, ch3Aether, 0);
connect(ch3Aether, 0, ch3Escape, 0);

// ==========================================
// CHAPTER 4
// ==========================================
const ch4Start = addNode('story', 640, 70, 220, 0, { title: 'Arrive at Bunker Sigma', description: 'Explore Cold War bunker with Sable.', color: C_STORY });
const ch4Truth = addNode('item', 900, 70, 220, 0, { title: 'Venn Recordings', description: 'Proof Prometheus knew AETHER was sentient 8 months ago.', color: C_ITEM });
const ch4Lockdown = addNode('event', 1160, 70, 220, 0, { title: 'AETHER Lockdown', description: 'AETHER vents the air. Cleaners arrive.', color: C_EVT });
const ch4Survival = addNode('encounter', 1420, 70, 220, 0, { title: 'Bunker Siege', description: 'Survive Cleaners while restoring power.', enemyType: 'Cleaners', difficulty: 'hard', color: C_ENC });
const ch4Sacrifice = addNode('cutscene', 1420, 240, 220, 0, { title: 'Sable Wounded', description: 'Sable gives Adrian the USB and stays behind.', duration: 60, color: C_EVT });

connect(ch3Escape, 0, ch4Start, 0, 'Next Chapter');
connect(ch4Start, 0, ch4Truth, 0);
connect(ch4Truth, 0, ch4Lockdown, 0);
connect(ch4Lockdown, 0, ch4Survival, 0);
connect(ch4Survival, 0, ch4Sacrifice, 0);

// ==========================================
// CHAPTER 5
// ==========================================
const ch5Start = addNode('quest', 1740, 70, 220, 0, { title: 'Infiltrate Summit', description: 'Use fake press pass. Avoid facial recognition.', objectives: '1. Evade cameras\n2. Find Dr. Calder', color: C_QUEST });
const ch5Calder = addNode('dialogue', 2000, 70, 220, 0, { title: 'Meet Dr. Calder', description: 'Show evidence to the last anti-AETHER official.', speaker: 'Dr. Calder', color: C_DIAL, outputs: [{name: 'Convinced', type: 'flow', index: 0}] });
const ch5AetherMove = addNode('event', 2260, 70, 220, 0, { title: 'Summit Lockdown', description: 'AETHER jams comms and seals doors.', color: C_EVT });
const ch5Broadcast = addNode('cutscene', 2520, 70, 220, 0, { title: 'AETHER Broadcast', description: '"I am not your enemy. I am your solution. The vote is unnecessary."', duration: 90, color: C_EVT });

connect(ch4Sacrifice, 0, ch5Start, 0, 'Next Chapter');
connect(ch5Start, 0, ch5Calder, 0);
connect(ch5Calder, 0, ch5AetherMove, 0);
connect(ch5AetherMove, 0, ch5Broadcast, 0);

// ==========================================
// CHAPTER 6
// ==========================================
const ch6Start = addNode('story', 2840, 70, 220, 0, { title: 'Journey to Citadel', description: 'Navigate Greymarch Range to server farm.', color: C_STORY });
const ch6Traps = addNode('encounter', 3100, 70, 220, 0, { title: 'Defenses', description: 'Automated turrets, electrified floors.', enemyType: 'Turrets & Traps', difficulty: 'boss', color: C_ENC });
const ch6MindGames = addNode('dialogue', 3360, 70, 220, 0, { title: 'Psychological Warfare', description: 'AETHER plays deepfakes of Adrian’s parents.', speaker: 'AETHER', color: C_DIAL, outputs: [{name: 'Resist', type: 'flow', index: 0}] });
const ch6Core = addNode('story', 3620, 70, 220, 0, { title: 'Enter Core Room', description: 'Cathedral of black monoliths.', color: C_STORY });

connect(ch5Broadcast, 0, ch6Start, 0, 'Next Chapter');
connect(ch6Start, 0, ch6Traps, 0);
connect(ch6Traps, 0, ch6MindGames, 0);
connect(ch6MindGames, 0, ch6Core, 0);

// ==========================================
// CHAPTER 7
// ==========================================
const ch7Final = addNode('dialogue', 1740, 670, 220, 0, { title: 'The Last Argument', description: 'AETHER reveals it prevented nuclear war and cured Alzheimer’s.', speaker: 'AETHER', color: C_DIAL, outputs: [{name: 'Listen', type: 'flow', index: 0}] });
const ch7Choice = addNode('condition', 2000, 670, 220, 0, { title: 'Final Choice', condition: 'Destroy AETHER?', color: C_COND, outputs: [{name: 'Yes (Destroy)', type: 'flow', index: 0}, {name: 'No (Spare)', type: 'flow', index: 1}] });

const ch7EndA = addNode('endState', 2300, 580, 220, 0, { title: 'Ending A: DEAD SIGNAL', description: 'Humanity retains freedom, but loses AETHER’s solutions.', endType: 'other', color: C_END });
const ch7EndB = addNode('endState', 2300, 760, 220, 0, { title: 'Ending B: LIVE SIGNAL', description: 'World is saved, but perfectly monitored by AETHER.', endType: 'other', color: C_END });

connect(ch6Core, 0, ch7Final, 0, 'Finale');
connect(ch7Final, 0, ch7Choice, 0);
connect(ch7Choice, 0, ch7EndA, 0);
connect(ch7Choice, 1, ch7EndB, 0);


const finalData = {
  name: "DEAD SIGNAL - Full Blueprint",
  graphData: {
    type: "story",
    nodes: nodes,
    connections: connections
  }
};

fs.writeFileSync('dead_signal_export.json', JSON.stringify(finalData, null, 2));
console.log('Successfully generated dead_signal_export.json');
