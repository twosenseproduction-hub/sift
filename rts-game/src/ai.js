/* ============================================================================
 * EXOFRONT — ai.js
 * Enemy faction brain. Harvests, produces a growing army, and launches waves
 * at the player. Not a genius — but it builds a real, escalating match.
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var TEAM = RTS.TEAM;

  RTS.AI = {
    update: function (s, dt) {
      if (!s.ai) s.ai = { think: 0, harvestTick: 0, composition: 0 };
      var cfg = RTS.Config.ai;

      // Abstracted passive economy (keeps the AI funded without micromanaging)
      s.res.enemy.halcite += cfg.income * dt;

      // Keep enemy workers harvesting
      s.ai.harvestTick -= dt;
      if (s.ai.harvestTick <= 0) {
        s.ai.harvestTick = 1.5;
        assignWorkers(s);
      }

      // Production thinking
      s.ai.think -= dt;
      if (s.ai.think <= 0) {
        s.ai.think = 1.4;
        buildStructures(s);
        produce(s);
      }

      // Attack waves
      if (s.timers.gameTime >= s.timers.nextWave) {
        launchWave(s);
        s.timers.waveNumber++;
        s.timers.nextWave = s.timers.gameTime + cfg.waveInterval;
      }
    },
  };

  function enemyUnits(s, role) {
    return s.entities.units.filter(function (u) {
      return u.team === TEAM.ENEMY && !u.dead && (!role || u.role === role);
    });
  }
  function enemyBuilding(s, type) {
    return s.entities.buildings.find(function (b) {
      return b.team === TEAM.ENEMY && !b.dead && b.built && b.type === type;
    });
  }
  function enemyBuildingAny(s, type) {
    return s.entities.buildings.find(function (b) {
      return b.team === TEAM.ENEMY && !b.dead && b.type === type;
    });
  }

  function aiCanPlace(s, type, x, y) {
    var spec = RTS.Buildings[type];
    var hw = spec.w / 2, hh = spec.h / 2;
    var W = RTS.Config.world.w, H = RTS.Config.world.h;
    if (x - hw < 20 || x + hw > W - 20 || y - hh < 20 || y + hh > H - 20) return false;

    var ok = true;
    s.entities.buildings.forEach(function (b) {
      if (b.dead) return;
      var ox = Math.abs(b.x - x), oy = Math.abs(b.y - y);
      if (ox < (b.w / 2 + hw + 14) && oy < (b.h / 2 + hh + 14)) ok = false;
    });
    if (!ok) return false;

    for (var j = 0; j < s.entities.resources.length; j++) {
      var node = s.entities.resources[j];
      if (RTS.dist(x, y, node.x, node.y) < node.r + Math.max(hw, hh) + 10) return false;
    }

    var core = RTS.enemyCore(s);
    if (!core || RTS.dist(x, y, core.x, core.y) > 360) return false;
    return true;
  }

  function aiPlaceBuilding(s, type, x, y) {
    if (!aiCanPlace(s, type, x, y)) return false;
    var cost = RTS.Buildings[type].cost;
    if (!RTS.canAfford(s, TEAM.ENEMY, cost)) return false;
    s.res.enemy.halcite -= cost;
    var b = RTS.makeBuilding(s, type, TEAM.ENEMY, x, y, s.enemyFaction, false);
    if (RTS.Pathfind) RTS.Pathfind.markDirty(s);
    var workers = enemyUnits(s, 'worker').filter(function (w) {
      return !w.harvest && !w.buildTask && !w.moveTo && !w.target;
    });
    if (workers.length) {
      workers.sort(function (a, c) { return RTS.dist(a.x, a.y, x, y) - RTS.dist(c.x, c.y, x, y); });
      var w = workers[0];
      w.harvest = null; w.target = null; w.moveTo = null;
      w.buildTask = { buildingId: b.id };
      w._workPhase = 0;
      if (RTS.Pathfind) RTS.Pathfind.clearNav(w);
    }
    return true;
  }

  function tryAiBuild(s, type) {
    if (enemyBuildingAny(s, type)) return false;
    var core = RTS.enemyCore(s);
    if (!core) return false;
    var pcore = RTS.playerCore(s);
    var toward = pcore
      ? Math.atan2(pcore.y - core.y, pcore.x - core.x)
      : Math.PI;
    var perp = toward + Math.PI / 2;
    var dist = 115;
    var offsets = [
      { x: Math.cos(perp) * dist, y: Math.sin(perp) * dist + 40 },
      { x: -Math.cos(perp) * dist, y: Math.sin(perp) * dist + 40 },
      { x: Math.cos(toward + Math.PI) * dist * 0.85, y: Math.sin(toward + Math.PI) * dist * 0.85 + 50 },
      { x: Math.cos(perp) * dist * 0.7, y: -Math.sin(perp) * dist * 0.7 + 70 },
      { x: -Math.cos(perp) * dist * 0.7, y: -Math.sin(perp) * dist * 0.7 + 70 },
    ];
    for (var i = 0; i < offsets.length; i++) {
      var ox = offsets[i];
      if (aiPlaceBuilding(s, type, core.x + ox.x, core.y + ox.y)) return true;
    }
    return false;
  }

  function buildStructures(s) {
    var workers = enemyUnits(s, 'worker').length;
    var core = RTS.enemyCore(s);
    if (!core) return;

    if (!enemyBuildingAny(s, 'conduit') && workers >= 2 &&
        s.res.enemy.supplyUsed + 1 > s.res.enemy.supplyCap - 2 &&
        RTS.canAfford(s, TEAM.ENEMY, RTS.Buildings.conduit.cost)) {
      tryAiBuild(s, 'conduit');
    }

    if (!enemyBuildingAny(s, 'foundry') && workers >= 2 &&
        RTS.canAfford(s, TEAM.ENEMY, RTS.Buildings.foundry.cost)) {
      tryAiBuild(s, 'foundry');
    }

    if (enemyBuilding(s, 'foundry') && !enemyBuildingAny(s, 'forge') &&
        s.timers.gameTime > 45 &&
        RTS.canAfford(s, TEAM.ENEMY, RTS.Buildings.forge.cost)) {
      tryAiBuild(s, 'forge');
    }
  }

  function assignWorkers(s) {
    enemyUnits(s, 'worker').forEach(function (w) {
      if (!w.harvest && !w.buildTask) {
        var node = RTS.nearestNode(s, w.x, w.y);
        if (node) w.harvest = { nodeId: node.id, phase: 'toNode', carry: 0 };
      }
    });
  }

  function produce(s) {
    var cfg = RTS.Config.ai;
    var core = RTS.enemyCore(s);
    if (!core) return;

    // maintain worker count
    if (enemyUnits(s, 'worker').length < cfg.workerCount && core.queue.length === 0) {
      RTS.train(s, core, 'worker');
    }

    var army = enemyUnits(s).filter(function (u) { return u.role !== 'worker'; }).length;
    var queued = 0;
    s.entities.buildings.forEach(function (b) {
      if (b.team === TEAM.ENEMY) queued += b.queue.length;
    });

    // target army grows over time
    var target = Math.min(cfg.maxArmy, 4 + Math.floor(s.timers.gameTime / 22));
    if (army + queued >= target) return;

    // Choose a unit by a rotating composition for variety
    var foundry = enemyBuilding(s, 'foundry');
    var forge = enemyBuilding(s, 'forge');
    var pick = s.ai.composition++ % 6;
    var role, bldg;
    if (pick === 0 || pick === 3) { role = 'light'; bldg = foundry; }
    else if (pick === 1) { role = 'scout'; bldg = foundry; }
    else if (pick === 4) { role = 'support'; bldg = foundry; }
    else if (pick === 2) { role = 'heavy'; bldg = forge; }
    else { role = 'siege'; bldg = forge; }

    if (!bldg) return;
    if (bldg.queue.length < 2) RTS.train(s, bldg, role);
  }

  function launchWave(s) {
    var pcore = RTS.playerCore(s);
    if (!pcore) return;
    var army = enemyUnits(s).filter(function (u) { return u.role !== 'worker'; });

    // Only commit if there's a meaningful force; otherwise harass with what we have.
    var commit = army.filter(function (u) { return !u.attackMove; });
    if (!commit.length) return;

    // stage near player base then attack-move (auto-acquires on the way)
    var jitter = 60;
    commit.forEach(function (u) {
      u.attackMove = true;
      u.target = null;
      u.moveTo = {
        x: pcore.x + (Math.random() - 0.5) * jitter,
        y: pcore.y + (Math.random() - 0.5) * jitter,
      };
    });

    if (s.timers.waveNumber === 0) {
      RTS.log(s, 'Enemy scouts probing your front', 'warn');
    } else {
      RTS.log(s, 'Cinder assault wave inbound!', 'bad');
      RTS.toast(s, 'Wave incoming — defend the Castle');
    }
  }

})(window.RTS = window.RTS || {});
