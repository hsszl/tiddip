// Demo values. Only the server applies these rules to a match.
export const RULES = {
  size: 8, maxPlayers: 6, maxHand: 5, turnSeconds: 30,
  terrainCounts: { mine: 8, toilet: 5, supply: 6, clinic: 4, tower: 3, brambles: 5, camp: 3, ruins: 3, armory: 3 },
};

export const WEAPONS = {
  sniper: {
    name: '狙击枪', hp: 5, ranges: [2, 3], rangeLabel: '直线 2 · 3',
    skill: 'closeShot', skillName: '近身射击',
    description: '直线第 2、3 格。技能可在同格攻击一次。',
  },
  rifle: {
    name: '步枪', hp: 4, ranges: [0, 1, 2], rangeLabel: '直线 0–2',
    skill: 'suppress', skillName: '压制', skillMode: 'attack',
    description: '压制：额外允许攻击斜向一格，每局一次。',
  },
  pistol: {
    name: '手枪', hp: 3, ranges: [0, 1], rangeLabel: '直线 0–1',
    skill: 'revive', skillName: '急救',
    skillMode: 'passive', description: '首次零血时回复 1 血。',
  },
  bow: {
    name: '长弓', hp: 3, ranges: [1, 2, 3, 4], rangeLabel: '直线 1–4',
    skill: 'scout', skillName: '鹰眼', skillMode: 'self',
    description: '鹰眼：翻开身边九格，每局一次。',
  },
  boomerang: {
    name: '回旋镖', hp: 4, ranges: [1, 2], pattern: 'diagonal', rangeLabel: '斜线 1 · 2',
    skill: 'loot', skillName: '回收', skillMode: 'passive',
    description: '首次命中抽一张道具；满手时保留机会。',
  },
  dagger: {
    name: '匕首', hp: 5, ranges: [0], rangeLabel: '仅同格',
    skill: 'dash', skillName: '突进', skillMode: 'move',
    description: '突进：直线移动最多两格，占本回合移动，每局一次。',
  },
  axe: {
    name: '战斧', hp: 3, ranges: [0, 1], pattern: 'adjacent', rangeLabel: '同格 · 周围八格',
    skill: 'guard', skillName: '招架', skillMode: 'self',
    description: '招架：获得一层护盾，每局一次。',
  },
  crossbow: {
    name: '十字弩', hp: 4, ranges: [2, 3, 4], rangeLabel: '直线 2–4',
    skill: 'pierce', skillName: '穿盾', skillMode: 'attack',
    description: '穿盾：击破护盾并造成 1 点伤害，每局一次。',
  },
  mortar: {
    name: '迫击炮', hp: 4, ranges: [3], pattern: 'manhattan', rangeLabel: '横竖合计 3 格',
    skill: 'closeShell', skillName: '近防弹', skillMode: 'attack',
    description: '近防弹：改打横竖合计 1、2 格，每局一次。',
  },
  revolver: {
    name: '左轮', hp: 4, ranges: [1], pattern: 'adjacent', rangeLabel: '周围八格',
    skill: 'sidestep', skillName: '侧步', skillMode: 'move',
    description: '侧步：斜向移动一格，占本回合移动，每局一次。',
  },
};

export const ITEMS = {
  medkit: { name: '急救包', description: '回复 1 血', color: '#bc605c' },
  shield: { name: '护盾', description: '挡下一次伤害', color: '#738a9d' },
  teleport: { name: '传送', description: '传送到另一格', color: '#9379bc', target: 'cell' },
  radar: { name: '雷达', description: '翻开身边九格', color: '#4d988d' },
  sprint: { name: '疾跑', description: '本回合移动最多两格', color: '#b38448' },
  ammo: { name: '弹药', description: '恢复已用能力', detail: '狙击枪除外。', color: '#bb8b4d' },
  steal: { name: '巧手', description: '摸走身边对手一张牌', color: '#7f79a8', target: 'player' },
  defuse: { name: '拆弹钳', description: '拆除身边已翻开的地雷', color: '#a16c55', target: 'cell' },
};

export const TERRAIN = {
  ground: { name: '空地', description: '没有额外效果，可以多人同格。' },
  mine: { name: '地雷', description: '扣 1 血，自己选择其他已翻开的格子落地。' },
  toilet: { name: '厕所', description: '只能容纳一个人。' },
  supply: { name: '补给', description: '首次进入抽一张道具牌。' },
  clinic: { name: '医疗站', description: '回复 1 血，不超上限；满血时不消耗。用后失效。' },
  tower: { name: '瞭望塔', description: '首次进入翻开上下左右四格，不触发那些格子的效果。' },
  brambles: { name: '荆棘地', description: '每次进入扣 1 血，不会炸飞。护盾可以挡住。' },
  camp: { name: '营地', description: '获得一层护盾，用后失效；已有护盾时不消耗。' },
  ruins: { name: '遗迹', description: '摸两张道具牌，手牌不超过 5；满手时不消耗。用后失效。' },
  armory: { name: '军械库', description: '站在这里可手动换武器，每人每座一次；不回血，不恢复已用能力。' },
};
