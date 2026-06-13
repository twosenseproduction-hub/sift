/* ============================================================================
 * EXOFRONT — sprites.js
 * Tiny Swords kingdom humans — Blue vs Red. Animations follow each unit type.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var FACTIONS = ['aurex', 'cinder'];
  var ROLES = ['worker', 'light', 'scout', 'heavy', 'siege', 'support'];

  var SIEGE_BASE = 'assets/siege/';

  var ROLE_DEF = {
    worker: {
      unit: 'Pawn', frameH: 192, scale: 1,
      clips: {
        idle: { file: 'Pawn_Idle Pickaxe.png', count: 8, speed: 2.2 },
        walk: { file: 'Pawn_Run Pickaxe.png', count: 6, speed: 9 },
        walk_carry: { file: 'Pawn_Run Gold.png', count: 6, speed: 9 },
        work: { file: 'Pawn_Interact Pickaxe.png', count: 6, speed: 10 },
      },
    },
    light: {
      unit: 'Archer', frameH: 192, scale: 1.0,
      clips: {
        idle: { file: 'Archer_Idle.png', count: 6, speed: 2.2 },
        walk: { file: 'Archer_Run.png', count: 4, speed: 9 },
        attack: { file: 'Archer_Shoot.png', count: 8, speed: 12 },
      },
    },
    scout: {
      unit: 'Lancer', frameH: 320, scale: 1,
      clips: {
        idle: { file: 'Lancer_Idle.png', count: 12, speed: 2.2 },
        walk: { file: 'Lancer_Run.png', count: 6, speed: 10 },
        attack: { file: 'Lancer_Right_Attack.png', count: 3, speed: 10 },
      },
    },
    heavy: {
      unit: 'Warrior', frameH: 192, scale: 1,
      clips: {
        idle: { file: 'Warrior_Idle.png', count: 8, speed: 2.0 },
        walk: { file: 'Warrior_Run.png', count: 6, speed: 8 },
        attack: { file: 'Warrior_Attack1.png', count: 4, speed: 12 },
      },
    },
    siege: {
      unit: 'Siege', frameH: 192, scale: 1,
      siegePack: true,
      clips: {
        idle: { file: 'Siege_Idle.png', count: 6, speed: 1.8 },
        walk: { file: 'Siege_Walk.png', count: 6, speed: 7 },
        attack: { file: 'Siege_Attack.png', count: 8, speed: 8 },
      },
    },
    support: {
      unit: 'Monk', frameH: 192, scale: 1.0,
      clips: {
        idle: { file: 'Idle.png', count: 6, speed: 2.2 },
        walk: { file: 'Run.png', count: 4, speed: 9 },
        attack: { file: 'Heal.png', count: 11, speed: 10 },
      },
    },
  };

  var sheets = {};

  function phaseOf(id) {
    var h = typeof id === 'number' ? ((id * 2654435761) >>> 0) : 0;
    return (h % 997) / 997 * 6.2832;
  }

  function unitPath(factionId, role, file) {
    var def = ROLE_DEF[role];
    if (def && def.siegePack) {
      var color = RTS.Assets.factionColor(factionId) === 'Red' ? 'red' : 'blue';
      return { base: SIEGE_BASE + color + '/', file: file };
    }
    var color = RTS.Assets.factionColor(factionId);
    return {
      base: 'assets/tiny-swords/',
      file: 'Units/' + color + ' Units/' + def.unit + '/' + file,
    };
  }

  function loadRoleSheet(factionId, role) {
    var def = ROLE_DEF[role];
    if (!def) return Promise.resolve(null);
    var key = factionId + '_' + role;
    var clipKeys = Object.keys(def.clips);
    var promises = clipKeys.map(function (ck) {
      var clip = def.clips[ck];
      var path = unitPath(factionId, role, clip.file);
      return RTS.Assets.loadImgBase(path.file, path.base).then(function (img) {
        return { key: ck, img: img, meta: clip };
      });
    });
    return Promise.all(promises).then(function (parts) {
      var entry = {
        frameH: def.frameH,
        frameW: def.frameH,
        scale: def.scale,
        clips: {},
      };
      parts.forEach(function (p) {
        var fw = Math.round(p.img.width / p.meta.count);
        entry.clips[p.key] = {
          img: p.img,
          count: p.meta.count,
          speed: p.meta.speed,
          frameW: fw,
        };
        entry.frameW = fw;
      });
      sheets[key] = entry;
      return entry;
    });
  }

  function sizeRef() {
    return RTS.SizeRef;
  }

  function unitDrawRadius(u) {
    var sr = sizeRef();
    var flash = 1 + (u.spawnFlash || 0) * 0.28;
    return sr.pxRadius(sr.unitLol(u.role)) * flash;
  }

  function unitVisualMul(u, sheet) {
    if (u.role === 'scout' && sheet && sheet.frameH >= 300) {
      return sizeRef().SCOUT_VISUAL_MUL;
    }
    return 1;
  }

  function unitDrawHeight(r, u, sheet) {
    return r * sizeRef().HEIGHT_MUL * unitVisualMul(u, sheet);
  }

  RTS.Sprites = {
    ready: false,
    sheets: sheets,
    roles: ROLE_DEF,

    load: function (cb) {
      var self = this;
      if (!RTS.Assets || !RTS.Assets.ready) {
        if (cb) cb(new Error('assets not ready'));
        return;
      }
      var jobs = [];
      FACTIONS.forEach(function (fid) {
        ROLES.forEach(function (role) {
          jobs.push(loadRoleSheet(fid, role));
        });
      });
      Promise.all(jobs).then(function () {
        self.ready = Object.keys(sheets).length > 0;
        if (cb) cb();
      }).catch(function (err) {
        console.error('EXOFRONT unit sprites failed', err);
        self.ready = false;
        if (cb) cb(err);
      });
    },

    sheetKey: function (u) {
      return u.faction + '_' + u.role;
    },

    pickAnim: function (u, walking) {
      if (u.role === 'worker' && u.buildTask && !walking) return 'work';
      if (u.role === 'worker' && u.harvest) {
        if (u.harvest.phase === 'mining') return 'work';
        if (u.harvest.carry > 0 && walking) return 'walk_carry';
      }
      if (u.inAttackRange) return 'attack';
      if (walking) return 'walk';
      return 'idle';
    },

    frameIndex: function (u, clip, animName) {
      if (animName === 'attack' && u.cooldown > 0 && u.rof > 0) {
        var progress = 1 - u.cooldown / u.rof;
        return Math.min(clip.count - 1, Math.floor(progress * clip.count));
      }
      if (animName === 'work') {
        var workPhase = u._workPhase || 0;
        return Math.floor(workPhase * clip.speed) % clip.count;
      }
      var phase = u._walkPhase || 0;
      return Math.floor(phase * clip.speed) % clip.count;
    },

    unitFootY: function (u, s) {
      var grid = s && s.map && s.map.terrainGrid;
      return grid && RTS.Terrain ? RTS.Terrain.groundY(grid, u.x, u.y) : u.y + 10;
    },

    unitVisualBounds: function (u, s) {
      var sheet = sheets[this.sheetKey(u)];
      if (!sheet) return null;
      var r = unitDrawRadius(u);
      var footY = this.unitFootY(u, s);
      var drawH = unitDrawHeight(r, u, sheet);
      var clip = sheet.clips.idle || sheet.clips.walk;
      var fw = clip ? (clip.frameW || sheet.frameW) : sheet.frameW;
      var fh = sheet.frameH;
      var drawW = (fw / fh) * drawH;
      var footRatio = fh >= 300 ? 0.91 : 0.94;
      var drawY = footY - drawH * footRatio;
      return {
        x: u.x,
        footY: footY,
        drawW: drawW,
        drawH: drawH,
        drawY: drawY,
        groundRx: Math.max(r * 0.95, drawW * 0.24),
        groundRy: Math.max(r * 0.36, 8),
        bodyCy: drawY + drawH * 0.55,
      };
    },

    drawUnit: function (ctx, u, f, s) {
      var Art = RTS.Art;
      if (u.dead) {
        Art.deathBurst(ctx, u, f);
        return;
      }

      var sheet = sheets[this.sheetKey(u)];
      if (!sheet) return;

      var rm = RTS.Config.reducedMotion;
      var r = unitDrawRadius(u);

      var dx = u.x - (u._ax != null ? u._ax : u.x);
      var dy = u.y - (u._ay != null ? u._ay : u.y);
      var dist = Math.hypot(dx, dy);
      if (dist > 0.8) {
        u._walkPhase = (u._walkPhase || 0) + dist * 0.022;
        u._moveHold = 4;
      } else if (u._moveHold > 0) {
        u._moveHold--;
      }
      u._ax = u.x;
      u._ay = u.y;

      var mining = u.role === 'worker' && u.harvest && u.harvest.phase === 'mining';
      var onBuildSite = u.role === 'worker' && u.buildTask && !(u._moveHold > 0);
      var walking = !mining && !onBuildSite && u._moveHold > 0;
      var ph = phaseOf(u.id);
      var animName = this.pickAnim(u, walking);
      var clip = sheet.clips[animName] || sheet.clips.idle || sheet.clips.walk;
      if (!clip || !clip.img) return;

      var fi = rm ? 0 : this.frameIndex(u, clip, animName);
      var fw = clip.frameW || sheet.frameW;
      var fh = sheet.frameH;
      var sx = fi * fw;
      var flip = Math.cos(u.facing) < -0.12 ? -1 : 1;
      var vb = this.unitVisualBounds(u, s);
      if (!vb) return;
      var footY = vb.footY;
      var drawH = vb.drawH;
      var drawW = vb.drawW;
      var drawY = vb.drawY;

      ctx.save();
      if (u.hitFlash > 0) {
        var q = u.hitFlash / RTS.Config.hitFlash;
        ctx.translate(u.x, footY);
        ctx.scale(1 + q * 0.06 * flip, 1 - q * 0.05);
        ctx.translate(-u.x, -footY);
      }
      if (flip < 0) {
        ctx.translate(u.x, 0);
        ctx.scale(-1, 1);
        ctx.translate(-u.x, 0);
      }
      ctx.drawImage(clip.img, sx, 0, fw, fh, u.x - drawW / 2, drawY, drawW, drawH);
      ctx.restore();

      Art.drawUnitOverlays(ctx, u, f, s, r, Art.minionPalette(f, u.team));
    },
  };

})(window.RTS = window.RTS || {});
