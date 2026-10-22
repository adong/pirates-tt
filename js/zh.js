/* 中文 for TT Pirates: the words on the page, the toasts, the treasure map's clues, the word bursts and the ? panel
   (Kit.lang, from kit/lang.js). The kids' names, Foxy and Froggy, and the game's name stay in English on purpose.
   N E S W are inline pairs in js/art.js (A.letter) and the stick's data-zh, never dictionary entries: single
   letters in the dictionary would turn the W A S D keycaps into 西 too. */
(function () {
  const L = Kit.lang;
  L.keep([
    'TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'FOXY', 'FROGGY', 'TEDDY & TOMMY', 'TEDDY + TOMMY', 'TEDDY · 1P', 'TOMMY · 2P',
    'Teddy (1P)', 'Tommy (2P)', 'TT PIRATES', 'TT Pirates', 'Claude Code', 'Esc',
  ]);
  const DIR = {
    NORTH: '北', SOUTH: '南', EAST: '东', WEST: '西',
    'NORTH-EAST': '东北', 'NORTH-WEST': '西北', 'SOUTH-EAST': '东南', 'SOUTH-WEST': '西南',
  };
  const NAME = { TEDDY: 'TEDDY', TOMMY: 'TOMMY', FOXY: 'FOXY', FROGGY: 'FROGGY' };
  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', JUICE: '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  const D = '(NORTH-EAST|NORTH-WEST|SOUTH-EAST|SOUTH-WEST|NORTH|SOUTH|EAST|WEST)';

  L.add({
    // title
    'Sail your toy pirate ship, follow the treasure map and splash your friends!': '开着你的玩具海盗船，跟着藏宝地图找宝藏，再用水炮把朋友们喷湿！',
    '1 player · key 1': '单人 · 按 1', '1 player · key 2': '单人 · 按 2', '2 players, one ship each · key 3': '双人 · 每人一艘船 · 按 3',
    '🐣 EASY': '🐣 简单', '🔥 NORMAL': '🔥 普通', Difficulty: '难度',
    'little sea · the X shows the way': '小海 · 地图上的 ❌ 就是宝藏', 'big sea · read the clue': '大海 · 自己看懂线索',
    sail: '开船', 'water cannon': '水炮', 'easy / normal': '简单 / 普通',
    "Thumb on the wheel to sail (N is north), the big 💦 button to splash, and tap your brother's face to call him. Two players can share an iPad: each gets a wheel and a 💦 button.":
      '拇指推方向盘开船（北在上面），按大 💦 按钮喷水，点兄弟的头像叫他来帮忙。两个人可以一起用一台 iPad：每人一个方向盘和一个 💦 按钮。',
    'built with': '制作工具', 'LOADING…': '加载中…',

    // pause and results
    '▶ RESUME': '▶ 继续', '↻ NEW VOYAGE': '↻ 重新出海', 'P · Esc · Space to resume · R new voyage · Q menu · M sound': 'P · Esc · 空格 继续 · R 重新出海 · Q 菜单 · M 声音',
    'ALL THE TREASURE!': '宝藏全找到啦！', 'TEAM TREASURE!': '一起找到全部宝藏！', '↻ PLAY AGAIN': '↻ 再玩一次',
    'Enter · Space play again · Esc menu': '回车 · 空格 再玩一次 · Esc 菜单', TOGETHER: '一共', 'NEW BEST!': '新纪录！', BEST: '最高分',

    // HUD
    '🗺️ TREASURE MAP': '🗺️ 藏宝地图', 'HIGH FIVE': '击掌', SPLASH: '喷水', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)',
    'ALL TREASURE FOUND!': '宝藏全找到啦！', 'YO HO HO!': '哟嗬嗬！', 'SET SAIL!': '出海啦！',
    'FOLLOW THE ARROW TO THE X': '跟着箭头找 ❌', 'READ THE TREASURE MAP': '看懂藏宝地图',

    // toasts
    'YOU GOT SOAKED!': '你被喷湿啦！', '💰 TREASURE! +10': '💰 宝藏！+10',
    'NO TREASURE HERE! FOLLOW THE ARROW': '这里没有宝藏！跟着箭头走', 'NOT HERE! NOW THE MAP SHOWS THE WAY': '不是这里！地图上画出路线啦',
    'NOT HERE! LOOK FOR THE ❌ ON THE MAP': '不是这里！看地图上的 ❌', 'WE ALREADY FOUND THIS ONE!': '这里的宝藏已经找到啦！',
    'HIGH FIVE! 🙌': '击掌！🙌', '🗺️ NEW TREASURE MAP!': '🗺️ 新的藏宝地图！',

    // word bursts (drawn on canvas through Kit.lang.t)
    'SPLASH!': '哗啦！', 'SPLOOSH!': '扑通！', 'SPLISH!': '啪嗒！', 'SOAKED!': '湿透啦！', 'BLOCKED!': '挡住啦！',
    'TREASURE!': '宝藏！', 'NOT HERE!': '不是这里！', 'HIGH FIVE!': '击掌！',

    // the ? panel
    'sail (up is NORTH)': '开船（上面是北）', 'water cannon (hold to keep splashing)': '水炮（按住一直喷）',
    'call your brother · 2 players: high five': '叫兄弟来帮忙 · 双人时：击掌', 'title: Teddy · Tommy · both · easy / normal': '标题页：Teddy · Tommy · 一起 · 简单 / 普通',
    'Playing alone, both sets of keys sail your ship. Sail up to the island with the treasure to dig it up.': '一个人玩时，两组按键都能开你的船。把船开到有宝藏的小岛边，就能挖出宝藏。',
    "The wheel (bottom left) sails the way you push it, the big 💦 button splashes, and your brother's face calls him.": '方向盘（左下角）往哪推船就往哪开，大 💦 按钮喷水，点兄弟的头像叫他来。',
  });

  // the clues and the compass
  L.rule(new RegExp(`^SAIL (\\S+) ${D}!$`), (m, a, d) => `向${DIR[d]} ${a} 开！`);
  L.rule(new RegExp(`^SAILING (\\S+) ${D}$`), (m, a, d) => `正在向${DIR[d]}开 ${a}`);
  L.rule(new RegExp(`^(\\S+) ${D}$`), (m, a, d) => `${a} ${DIR[d]}`);
  L.rule(/^FROM (\S+) SAIL (.+)$/, (m, e, parts) => `从 ${e} 出发：` + parts.split(', ').map((p) => {
    const q = p.match(new RegExp(`^(\\d+) (\\S+) ${D}$`));
    return q ? `向${DIR[q[3]]} ${q[2]} ${q[1]} 格` : p;
  }).join('，'));
  L.rule(/^(\S+) LAND HERE!$/, '$1 就是这里，靠岸！');

  // toasts with names and numbers
  L.rule(/^CALL (TEDDY|TOMMY)$/, '叫 $1');
  L.rule(/^(TEDDY|TOMMY) SOAKED (FOXY|FROGGY)! (.+)$/, '$1 把 $2 喷湿啦！$3');
  L.rule(/^(FOXY|FROGGY) IS SOAKED! (.+)$/, '$1 湿透啦！$2');
  L.rule(/^(TEDDY|TOMMY) GOT SOAKED!$/, '$1 被喷湿啦！');
  L.rule(/^(TEDDY|TOMMY) BLOCKED IT!$/, '$1 挡住啦！');
  L.rule(/^💰 TREASURE! \+10 · (\d+) MORE TO FIND$/, '💰 宝藏！+10 · 还有 $1 个');
  L.rule(/^(TEDDY|TOMMY) IS HERE! ⛵$/, '$1 来啦！⛵');
  L.rule(/^(TEDDY|TOMMY) SAYS: BIG SPLASH!$/, '$1 说：超级大水花！');
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE|COOKIE|WATERMELON|BANANA) FROM (TEDDY|TOMMY)!$/, (m, e, item, who) => `${e} ${NAME[who]} 送来的${TREAT[item]}！`);
  L.rule(/^BEST: (.+)$/, '最高分：$1');
  L.rule(/^NEW BEST! (.+)$/, '新纪录！$1');
})();
