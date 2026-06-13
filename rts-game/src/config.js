/* ============================================================================
 * EXOFRONT — config.js
 * Central balance + tuning constants. Tweak values here to rebalance the game.
 * All game systems read from RTS.Config / RTS.Units / RTS.Buildings.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  // ---- Core balance knobs (edit these first) -------------------------------
  var isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  var isPhone = typeof window !== 'undefined' && window.innerWidth < 520;

  RTS.Config = {
    isMobile: isMobile,
    isPhone: isPhone,
    world: { w: 3072, h: 1920 },
    camera: {
      minZoom: 0.55, maxZoom: 2.0,
      default: isPhone ? 1.08 : (isMobile ? 1.02 : 0.92),
      panInertia: 0.86,
    },
    touch: {
      slopPx: isMobile ? 42 : 18,
      dragPx: isMobile ? 20 : 12,
      uiBlockMs: 420,
      longPressMs: isMobile ? 400 : 460,
      doubleTapMs: 320,
      menuHoldMs: 280,
      twoFingerTapMs: 280,
    },

    // Economy
    startResources: 250,        // starting Halcite for the player
    startSupplyCap: 12,         // supply provided by the Core
    supplyPerPylon: 8,          // supply added per Conduit
    maxSupplyCap: 80,
    passiveTrickle: 0.0,        // passive income/sec (0 = pure harvesting)

    harvest: {
      rate: 13,                 // ore/sec at the node only — does not affect walk speed
      capacity: 12,             // ore per trip — must return to Castle/Outpost to bank
      reach: 42,                // distance to begin mining
      depositReach: 165,        // ring around Castle/Outpost where ore is banked
      depositStop: 22,          // how close worker walks to the approach point
      depositStuckSec: 1.2,     // force-bank if carrying and in zone this long without moving
    },

    // AI difficulty / pacing
    ai: {
      startResources: 250,        // match player — equal start
      income: 0,                  // no passive cheat; mine like the player
      firstWaveAt: 70,          // seconds before first real attack wave
      waveInterval: 52,         // seconds between waves
      waveGrowth: 1.18,         // wave size multiplier each wave
      maxArmy: 26,              // soft cap on simultaneous enemy combat units
      workerCount: 3,           // match typical player open
      retaliate: true,
    },

    // Combat feel
    separation: 150,            // unit push-apart strength
    projectileSpeed: 520,
    hitFlash: 0.13,
    muzzleFlash: 0.09,
    corpseFade: 1.2,
    maxEffects: 60,

    // Match
    matchSoftCapMin: 14,        // event log nudge if running long

    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };

  // ---- Teams ---------------------------------------------------------------
  RTS.TEAM = { PLAYER: 'player', ENEMY: 'enemy', NEUTRAL: 'neutral' };

  // ---- Roles (shared archetypes used by both factions) ---------------------
  // costs in Halcite, times in seconds, ranges/speeds in world units.
  RTS.Units = {
    worker: {
      role: 'worker', label: 'Pawn', glyph: 'circle',
      hp: 55, speed: 100, dmg: 5, range: 22, rof: 1.0,
      cost: 50, supply: 1, build: 0, canHarvest: true, canBuild: true,
      desc: 'Harvests Halcite and raises structures.',
    },
    light: {
      role: 'light', label: 'Archer', glyph: 'tri',
      hp: 64, speed: 124, dmg: 9, range: 132, rof: 0.62,
      cost: 75, supply: 1, build: 0, ranged: true,
      desc: 'Cheap mobile ranged trooper. Strong in numbers.',
    },
    scout: {
      role: 'scout', label: 'Lancer', glyph: 'diamond',
      hp: 46, speed: 188, dmg: 7, range: 72, rof: 0.5,
      cost: 60, supply: 1, build: 0,
      desc: 'Fast pike raider. Thrusts at stragglers and workers.',
    },
    heavy: {
      role: 'heavy', label: 'Warrior', glyph: 'hex',
      hp: 230, speed: 62, dmg: 30, range: 46, rof: 0.85,
      cost: 150, supply: 3, build: 0,
      desc: 'Slow armored bruiser. Soaks damage at the front.',
    },
    siege: {
      role: 'siege', label: 'Siege', glyph: 'pent',
      hp: 120, speed: 56, dmg: 46, range: 236, rof: 2.0,
      cost: 200, supply: 3, build: 0, ranged: true, splash: 46,
      desc: 'Long-range bomb thrower. Devastating vs clusters and bases.',
    },
    support: {
      role: 'support', label: 'Monk', glyph: 'cross',
      hp: 80, speed: 108, dmg: 0, range: 110, rof: 0.7, heal: 12,
      cost: 120, supply: 2, build: 0, healer: true,
      desc: 'Heals nearby allied units. Keep it behind the line.',
    },
  };

  // ---- Buildings -----------------------------------------------------------
  RTS.Buildings = {
    core: {
      type: 'core', label: 'Castle', w: 96, h: 96,
      hp: 1600, cost: 0, build: 0, deposit: true,
      trains: ['worker'], desc: 'Main base. Trains Pawns and banks Halcite.',
    },
    outpost: {
      type: 'outpost', label: 'Outpost', w: 88, h: 88,
      hp: 1400, cost: 400, build: 42, deposit: true, expansion: true,
      trains: ['worker'],
      desc: 'Expansion base — build next to a Halcite field. Trains Pawns and banks ore.',
    },
    conduit: {
      type: 'conduit', label: 'House', w: 60, h: 60,
      hp: 420, cost: 80, build: 10, supply: 8,
      trains: [], desc: 'Raises your supply cap.',
    },
    foundry: {
      type: 'foundry', label: 'Barracks', w: 78, h: 70,
      hp: 760, cost: 150, build: 18,
      trains: ['light', 'scout', 'support'],
      desc: 'Produces Archers, Lancers, and Monks.',
    },
    forge: {
      type: 'forge', label: 'War Forge', w: 86, h: 78,
      hp: 980, cost: 220, build: 26,
      trains: ['heavy', 'siege'],
      desc: 'Produces Warriors and Siege bombers.',
    },
    turret: {
      type: 'turret', label: 'Tower', w: 54, h: 54,
      hp: 520, cost: 120, build: 14,
      defense: true, dmg: 20, range: 178, rof: 0.7, ranged: true,
      desc: 'Automated defense tower. Fires on nearby foes.',
    },
  };

  // Player buildable menu order
  RTS.BuildMenu = ['conduit', 'foundry', 'forge', 'turret', 'outpost'];

  // ---- Factions (visual identity + naming) ---------------------------------
  RTS.Factions = {
    aurex: {
      id: 'aurex',
      name: 'Aurex Kingdom',
      tagline: 'Steel. Banners. Order.',
      blurb: 'A disciplined medieval kingdom — pawns, archers, and knights marching ' +
             'under blue banners. Fast to tech, brutal in formation.',
      primary: '#26c6da',   // bright cartoon cyan
      secondary: '#80deea',
      dark: '#00838f',
      accent: '#fff176',
      shapeStyle: 'angular',
      names: {
        core: 'Castle', conduit: 'House', foundry: 'Barracks',
        forge: 'War Forge', turret: 'Tower', outpost: 'Outpost',
        worker: 'Pawn', light: 'Archer', scout: 'Lancer',
        heavy: 'Warrior', siege: 'Siege', support: 'Monk',
      },
    },
    cinder: {
      id: 'cinder',
      name: 'Crimson Kingdom',
      tagline: 'Iron. Banners. Conquest.',
      blurb: 'Red-banner knights — the same ranks as the blue kingdom, sworn to a ' +
             'rival crown. Slow to muster, relentless once the line advances.',
      primary: '#ff7043',
      secondary: '#ffab91',
      dark: '#d84315',
      accent: '#ffee58',
      shapeStyle: 'angular',
      names: {
        core: 'Castle', conduit: 'House', foundry: 'Barracks',
        forge: 'Slag Forge', turret: 'Tower', outpost: 'Outpost',
        worker: 'Pawn', light: 'Archer', scout: 'Lancer',
        heavy: 'Warrior', siege: 'Siege', support: 'Monk',
      },
    },
  };

  // Helper: get the display name for a role/building under a faction.
  RTS.nameFor = function (factionId, key) {
    var f = RTS.Factions[factionId];
    if (f && f.names[key]) return f.names[key];
    return (RTS.Units[key] && RTS.Units[key].label) ||
           (RTS.Buildings[key] && RTS.Buildings[key].label) || key;
  };

})(window.RTS = window.RTS || {});
