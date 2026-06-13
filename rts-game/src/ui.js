/* ============================================================================
 * EXOFRONT — ui.js
 * Tiny Swords UI: pre-baked buttons/banners + unit/building portrait icons.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var TS = 'assets/tiny-swords/';
  var UI = 'UI Elements/UI Elements/';
  var FLAT = 'assets/ui/';

  function enc(base, rel) {
    return base + rel.split('/').map(encodeURIComponent).join('/');
  }

  var FLAT_PATHS = {
    btnBlue: FLAT + 'btn-blue-420.png',
    btnBluePressed: FLAT + 'btn-blue-420-pressed.png',
    btnRed: FLAT + 'btn-red-420.png',
    btnRedPressed: FLAT + 'btn-red-420-pressed.png',
    banner: FLAT + 'banner-400.png',
    btnSqBlue: FLAT + 'btn-sq-blue.png',
    btnSqBluePressed: FLAT + 'btn-sq-blue-pressed.png',
    btnSqRed: FLAT + 'btn-sq-red.png',
    btnSqRedPressed: FLAT + 'btn-sq-red-pressed.png',
    btnRoundBlue: FLAT + 'btn-round-blue.png',
    btnRoundBluePressed: FLAT + 'btn-round-blue-pressed.png',
    btnRoundRed: FLAT + 'btn-round-red.png',
    btnRoundRedPressed: FLAT + 'btn-round-red-pressed.png',
    woodTable: FLAT + 'wood-table-320.png',
    paper: FLAT + 'paper-panel-360.png',
    paperScreen: FLAT + 'paper-panel-512.png',
    paperCard: FLAT + 'paper-panel-360.png',
    paperTile: FLAT + 'paper-tile-128.png',
    barBase: FLAT + 'bar-base-200.png',
    barFill: FLAT + 'bar-fill-200.png',
    swordWin: FLAT + 'sword-icon-win.png',
    swordLose: FLAT + 'sword-icon-lose.png',
  };

  /* Pack icon sheet — Icon_01 hammer … Icon_12 music */
  var ICONS = {
    hammer: UI + 'Icons/Icon_01.png',
    wood: UI + 'Icons/Icon_02.png',
    gold: UI + 'Icons/Icon_03.png',
    meat: UI + 'Icons/Icon_04.png',
    sword: UI + 'Icons/Icon_05.png',
    shield: UI + 'Icons/Icon_06.png',
    bow: UI + 'Icons/Icon_07.png',
    arrow: UI + 'Icons/Icon_08.png',
    cancel: UI + 'Icons/Icon_09.png',
    gear: UI + 'Icons/Icon_10.png',
    info: UI + 'Icons/Icon_11.png',
    music: UI + 'Icons/Icon_12.png',
  };

  var UNIT_STRIP = {
    worker: { unit: 'Pawn', file: 'Pawn_Idle Pickaxe.png', frames: 8, fw: 192, fh: 192 },
    light: { unit: 'Archer', file: 'Archer_Idle.png', frames: 6, fw: 192, fh: 192 },
    scout: { unit: 'Lancer', file: 'Lancer_Idle.png', frames: 12, fw: 320, fh: 320, posX: 'center', posY: 'bottom', trayZoom: 1.38 },
    heavy: { unit: 'Warrior', file: 'Warrior_Idle.png', frames: 8, fw: 192, fh: 192 },
    siege: { unit: 'Siege', file: 'Siege_Idle.png', frames: 6, fw: 192, fh: 192, siegePack: true },
    support: { unit: 'Monk', file: 'Idle.png', frames: 6, fw: 192, fh: 192 },
  };

  var BUILDING_FILE = {
    core: 'Castle.png',
    conduit: 'House1.png',
    foundry: 'Barracks.png',
    forge: 'Archery.png',
    turret: 'Tower.png',
    outpost: 'House1.png',
  };

  /* Human Avatars sheet — 5 cols × 5 faction-color rows (Warrior, Archer, Lancer, Monk, Pawn) */
  var AVATARS = UI + 'Human Avatars/';
  var UNIT_AVATAR_COL = {
    heavy: 0, light: 1, scout: 2, support: 3, worker: 4, siege: 1,
  };
  var FACTION_AVATAR_ROW = { aurex: 0, cinder: 1 };

  function unitStripUrl(factionId, role) {
    var def = UNIT_STRIP[role];
    if (!def) return '';
    if (def.siegePack) {
      var siegeColor = RTS.Assets && RTS.Assets.factionColor(factionId) === 'Red' ? 'red' : 'blue';
      return enc('assets/siege/' + siegeColor + '/', def.file);
    }
    var color = RTS.Assets ? RTS.Assets.factionColor(factionId) : 'Blue';
    return enc(TS, 'Units/' + color + ' Units/' + def.unit + '/' + def.file);
  }

  function buildingUrl(factionId, type) {
    var file = BUILDING_FILE[type] || BUILDING_FILE.foundry;
    var color = RTS.Assets ? RTS.Assets.factionColor(factionId) : 'Blue';
    return enc(TS, 'Buildings/' + color + ' Buildings/' + file);
  }

  function flatUrl(key) {
    return FLAT_PATHS[key] || '';
  }

  function iconUrl(name) {
    return enc(TS, ICONS[name] || ICONS.sword);
  }

  function unitAvatarUrl(factionId, role) {
    var col = UNIT_AVATAR_COL[role];
    if (col == null) return '';
    var row = FACTION_AVATAR_ROW[factionId];
    if (row == null) row = 0;
    var idx = row * 5 + col + 1;
    var file = 'Avatars_' + (idx < 10 ? '0' : '') + idx + '.png';
    return enc(TS, AVATARS + file);
  }

  function avatarPortraitHtml(factionId, role, px) {
    var url = unitAvatarUrl(factionId, role);
    if (!url) return '';
    px = px || 36;
    return '<img class="ts-avatar-portrait" src="' + url +
      '" width="' + px + '" height="' + px + '" alt="" />';
  }

  function stripPortraitHtml(factionId, role, px) {
    var def = UNIT_STRIP[role];
    if (!def) return '';
    px = px || 36;
    if (RTS.SizeRef) px = Math.round(px * RTS.SizeRef.trayScale(role));
    var zoom = def.trayZoom || (role === 'scout' && RTS.SizeRef ? RTS.SizeRef.SCOUT_TRAY_ZOOM : 1);
    var url = unitStripUrl(factionId, role);
    var aspect = (def.fw || 192) / (def.fh || 192);
    var w = Math.round(px * aspect);
    var posX = def.posX ? '--pos-x:' + def.posX + ';' : '';
    var posY = def.posY ? '--pos-y:' + def.posY + ';' : '';
    var zoomStyle = zoom !== 1
      ? 'transform:scale(' + zoom + ');transform-origin:bottom center;'
      : '';
    return '<span class="ts-strip-portrait" style="--frames:' + def.frames + ';' + posX + posY + zoomStyle +
      'width:' + w + 'px;height:' + px + 'px;background-image:url(\'' + url + '\')"></span>';
  }

  function buildingPortraitHtml(factionId, type, px) {
    px = px || 36;
    return '<img class="ts-building-portrait" src="' + buildingUrl(factionId, type) +
      '" width="' + px + '" height="' + px + '" alt="" />';
  }

  function iconHtml(name, px) {
    px = px || 24;
    return '<img class="ts-icon" src="' + iconUrl(name) + '" width="' + px +
      '" height="' + px + '" alt="" />';
  }

  function roleTrayIcon(factionId, role, px) {
    return avatarPortraitHtml(factionId, role, px || 30);
  }

  function buildTrayIcon(factionId, type, px) {
    return buildingPortraitHtml(factionId, type, px || 30);
  }

  RTS.UI = {
    flat: FLAT_PATHS,
    flatUrl: flatUrl,
    iconUrl: iconUrl,
    stripPortraitHtml: stripPortraitHtml,
    avatarPortraitHtml: avatarPortraitHtml,
    buildingPortraitHtml: buildingPortraitHtml,
    iconHtml: iconHtml,
    roleTrayIcon: roleTrayIcon,
    buildTrayIcon: buildTrayIcon,
    unitStripUrl: unitStripUrl,
    unitAvatarUrl: unitAvatarUrl,
    buildingUrl: buildingUrl,
  };

})(window.RTS = window.RTS || {});
