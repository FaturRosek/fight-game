import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import {
  CHARACTERS,
  ARENAS,
  FIGHTER_STATES,
  COMBAT_CONFIG,
  ATTACK_SPECS,
  MATCH_CONFIG,
} from "../src/config/gameData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "../dist");

const PORT = Number(process.env.PORT) || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const TICK_RATE = 30;
const TICK_MS = 1000 / TICK_RATE;
const RECONNECT_GRACE_MS = 30000;
const STALE_ROOM_TTL_MS = 15 * 60 * 1000;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const httpServer = http.createServer((req, res) => {
  const cleanUrl = (req.url || "/").split("?")[0];

  if (cleanUrl === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", rooms: rooms.size }));
    return;
  }

  if (fs.existsSync(distPath)) {
    const requestedPath = cleanUrl === "/" ? "/index.html" : cleanUrl;
    const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
    const fullPath = path.join(distPath, safePath);

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      });
      fs.createReadStream(fullPath).pipe(res);
      return;
    }

    const indexHtml = path.join(distPath, "index.html");
    if (fs.existsSync(indexHtml)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      fs.createReadStream(indexHtml).pipe(res);
      return;
    }
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Face Fighter Authoritative Multiplayer Server Running");
});

const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
  },
  pingInterval: 10000,
  pingTimeout: 8000,
});

const rooms = new Map();
const socketToRoom = new Map();

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms.has(code));
  return code;
}

function createEmptyInput() {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    jumpPressed: false,
    punchPressed: false,
    kickPressed: false,
    specialPressed: false,
    blockHeld: false,
  };
}

function createServerFighter(playerNumber, x, facing) {
  const charData = playerNumber === 1 ? CHARACTERS[0] : CHARACTERS[1];
  return {
    playerNumber,
    characterId: charData.id,
    name: charData.name,
    startX: x,
    defaultFacing: facing,
    x,
    y: 604.8,
    groundY: 604.8,
    velocityX: 0,
    velocityY: 0,
    knockbackVelocity: 0,
    facing,
    health: COMBAT_CONFIG.maxHealth,
    maxHealth: COMBAT_CONFIG.maxHealth,
    state: FIGHTER_STATES.IDLE,
    isGrounded: true,
    isRunning: false,
    lastMoveDir: 0,
    lastMoveTapTime: 0,
    wasLeftHeld: false,
    wasRightHeld: false,
    activeAttackSpec: null,
    attackElapsedMs: 0,
    hasHitCurrentAttack: false,
    isHitboxActive: false,
    stunTimerMs: 0,
    hitStopMs: 0,
    cooldowns: { punch: 0, kick: 0, special: 0 },
    hurtbox: { x: 0, y: 0, width: 74, height: 215 },
    hitbox: { x: 0, y: 0, width: 0, height: 0 },
    input: createEmptyInput(),
    queuedActions: { jump: false, punch: false, kick: false, special: false },
  };
}

function resetServerFighter(f) {
  f.x = f.startX;
  f.y = f.groundY;
  f.velocityX = 0;
  f.velocityY = 0;
  f.knockbackVelocity = 0;
  f.facing = f.defaultFacing;
  f.health = f.maxHealth;
  f.state = FIGHTER_STATES.IDLE;
  f.isGrounded = true;
  f.isRunning = false;
  f.activeAttackSpec = null;
  f.attackElapsedMs = 0;
  f.hasHitCurrentAttack = false;
  f.isHitboxActive = false;
  f.stunTimerMs = 0;
  f.hitStopMs = 0;
  f.cooldowns.punch = 0;
  f.cooldowns.kick = 0;
  f.cooldowns.special = 0;
  f.input = createEmptyInput();
  f.queuedActions = { jump: false, punch: false, kick: false, special: false };
  updateServerFighterBounds(f);
}

function updateServerFighterBounds(f) {
  const isCrouching = f.state === FIGHTER_STATES.CROUCH;
  const hurtW = 74;
  const hurtH = isCrouching ? 145 : 215;
  f.hurtbox.x = f.x - hurtW / 2;
  f.hurtbox.y = f.y - hurtH - 12;
  f.hurtbox.width = hurtW;
  f.hurtbox.height = hurtH;

  if (f.isHitboxActive && f.activeAttackSpec) {
    const spec = f.activeAttackSpec;
    const forwardCenterX = f.x + f.facing * spec.reachX;
    f.hitbox.x = forwardCenterX - spec.width / 2;
    f.hitbox.y = f.y + spec.offsetY - spec.height / 2;
    f.hitbox.width = spec.width;
    f.hitbox.height = spec.height;
  } else {
    f.hitbox.x = 0;
    f.hitbox.y = 0;
    f.hitbox.width = 0;
    f.hitbox.height = 0;
  }
}

function rectsIntersect(r1, r2) {
  if (r1.width <= 0 || r1.height <= 0 || r2.width <= 0 || r2.height <= 0)
    return false;
  return !(
    r2.x > r1.x + r1.width ||
    r2.x + r2.width < r1.x ||
    r2.y > r1.y + r1.height ||
    r2.y + r2.height < r1.y
  );
}

function findCharacterById(charId) {
  return CHARACTERS.find((c) => c.id === charId) || CHARACTERS[0];
}

function serializeRoomLobby(room) {
  const p1 = room.players[1];
  const p2 = room.players[2];
  const p1Char = p1 ? findCharacterById(p1.characterId) : CHARACTERS[0];
  const p2Char = p2 ? findCharacterById(p2.characterId) : CHARACTERS[1];

  return {
    code: room.code,
    status: room.status,
    arenaId: room.arena.id,
    players: {
      1: p1
        ? {
            connected: p1.connected,
            ready: p1.ready,
            characterId: p1Char.id,
            name: p1Char.name,
          }
        : null,
      2: p2
        ? {
            connected: p2.connected,
            ready: p2.ready,
            characterId: p2Char.id,
            name: p2Char.name,
          }
        : null,
    },
  };
}

function startRoomMatch(room) {
  const p1Char = findCharacterById(
    room.players[1]?.characterId || CHARACTERS[0].id,
  );
  const p2Char = findCharacterById(
    room.players[2]?.characterId || CHARACTERS[1].id,
  );

  room.fighters[1].characterId = p1Char.id;
  room.fighters[1].name = p1Char.name;
  room.fighters[2].characterId = p2Char.id;
  room.fighters[2].name = p2Char.name;

  room.status = "fighting";
  room.currentRound = 1;
  room.p1Wins = 0;
  room.p2Wins = 0;
  room.rematchVotes.clear();
  startRoomRound(room);
}

function startRoomRound(room) {
  clearRoomTimers(room);
  room.roundPhase = "INTRO";
  room.remainingTimeMs = MATCH_CONFIG.roundDurationSeconds * 1000;

  resetServerFighter(room.fighters[1]);
  resetServerFighter(room.fighters[2]);

  io.to(room.code).emit("online:round_reset", {
    round: room.currentRound,
    p1Wins: room.p1Wins,
    p2Wins: room.p2Wins,
  });

  io.to(room.code).emit("online:banner", {
    title: `ROUND ${room.currentRound}`,
    sub: "GET READY",
    color: "#ffd60a",
    visible: true,
  });

  room.introTimer = setTimeout(() => {
    if (!rooms.has(room.code) || room.roundPhase !== "INTRO") return;
    io.to(room.code).emit("online:banner", {
      title: "FIGHT!",
      sub: `FIRST TO ${MATCH_CONFIG.roundsToWin} WINS`,
      color: "#30d158",
      visible: true,
    });
  }, 950);

  room.phaseTimer = setTimeout(() => {
    if (!rooms.has(room.code) || room.roundPhase !== "INTRO") return;
    room.roundPhase = "FIGHTING";
    io.to(room.code).emit("online:banner", {
      title: "",
      sub: "",
      color: "#ffffff",
      visible: false,
    });
  }, MATCH_CONFIG.introDelayMs);
}

function stepServerFighter(f, oppX, dtMs, canControl) {
  Object.keys(f.cooldowns).forEach((k) => {
    if (f.cooldowns[k] > 0) {
      f.cooldowns[k] = Math.max(0, f.cooldowns[k] - dtMs);
    }
  });

  if (f.hitStopMs > 0) {
    f.hitStopMs = Math.max(0, f.hitStopMs - dtMs);
    updateServerFighterBounds(f);
    return;
  }

  const dt = dtMs / 1000;

  if (f.state === FIGHTER_STATES.VICTORY || f.state === FIGHTER_STATES.DEFEAT) {
    f.velocityX = 0;
    applyServerPhysics(f, dt);
    updateServerFighterBounds(f);
    return;
  }

  if (f.stunTimerMs > 0) {
    f.stunTimerMs = Math.max(0, f.stunTimerMs - dtMs);
  }

  if (f.state === FIGHTER_STATES.HIT && f.stunTimerMs <= 0) {
    f.activeAttackSpec = null;
    f.isHitboxActive = false;
    f.hasHitCurrentAttack = false;
    if (Math.abs(oppX - f.x) > 2) f.facing = oppX >= f.x ? 1 : -1;
    f.state = f.isGrounded ? FIGHTER_STATES.IDLE : FIGHTER_STATES.JUMP;
  }

  if (f.activeAttackSpec) {
    f.attackElapsedMs += dtMs;
    const spec = f.activeAttackSpec;
    const activeStart = spec.startupMs;
    const activeEnd = spec.startupMs + spec.activeMs;
    const totalDuration = activeEnd + spec.recoveryMs;

    f.isHitboxActive =
      !f.hasHitCurrentAttack &&
      f.attackElapsedMs >= activeStart &&
      f.attackElapsedMs <= activeEnd;

    if (f.attackElapsedMs >= totalDuration) {
      f.activeAttackSpec = null;
      f.isHitboxActive = false;
      f.hasHitCurrentAttack = false;
      f.attackElapsedMs = 0;
      if (Math.abs(oppX - f.x) > 2) f.facing = oppX >= f.x ? 1 : -1;
      f.state = f.isGrounded ? FIGHTER_STATES.IDLE : FIGHTER_STATES.JUMP;
    }
  }

  if (f.state !== FIGHTER_STATES.HIT && !f.activeAttackSpec) {
    if (Math.abs(oppX - f.x) > 2) {
      f.facing = oppX >= f.x ? 1 : -1;
    }
    if (canControl) {
      processFighterInput(f);
    } else {
      f.velocityX = 0;
      if (f.isGrounded) f.state = FIGHTER_STATES.IDLE;
    }
  }

  applyServerPhysics(f, dt);
  updateServerFighterBounds(f);
}

function processFighterInput(f) {
  const inp = f.input;
  const now = Date.now();
  const leftJust = inp.left && !f.wasLeftHeld;
  const rightJust = inp.right && !f.wasRightHeld;
  f.wasLeftHeld = Boolean(inp.left);
  f.wasRightHeld = Boolean(inp.right);

  if (leftJust) {
    if (
      f.lastMoveDir === -1 &&
      now - f.lastMoveTapTime <= COMBAT_CONFIG.doubleTapWindowMs
    ) {
      f.isRunning = true;
    }
    f.lastMoveDir = -1;
    f.lastMoveTapTime = now;
  } else if (rightJust) {
    if (
      f.lastMoveDir === 1 &&
      now - f.lastMoveTapTime <= COMBAT_CONFIG.doubleTapWindowMs
    ) {
      f.isRunning = true;
    }
    f.lastMoveDir = 1;
    f.lastMoveTapTime = now;
  }
  if (!inp.left && !inp.right) {
    f.isRunning = false;
  }

  const moveDir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);

  if (
    (inp.specialPressed || f.queuedActions.special) &&
    canServerAttack(f, "special")
  ) {
    f.queuedActions.special = false;
    inp.specialPressed = false;
    startServerAttack(f, "special");
    return;
  }
  if (
    (inp.punchPressed || f.queuedActions.punch) &&
    canServerAttack(f, "punch")
  ) {
    f.queuedActions.punch = false;
    inp.punchPressed = false;
    startServerAttack(f, "punch");
    return;
  }
  if ((inp.kickPressed || f.queuedActions.kick) && canServerAttack(f, "kick")) {
    f.queuedActions.kick = false;
    inp.kickPressed = false;
    startServerAttack(f, "kick");
    return;
  }

  if (inp.blockHeld && f.isGrounded) {
    f.velocityX = 0;
    f.isRunning = false;
    f.state = FIGHTER_STATES.BLOCK;
    return;
  }

  const activeSpeed = f.isRunning
    ? COMBAT_CONFIG.runSpeed
    : COMBAT_CONFIG.walkSpeed;

  if ((inp.jumpPressed || f.queuedActions.jump) && f.isGrounded) {
    f.queuedActions.jump = false;
    inp.jumpPressed = false;
    f.isGrounded = false;
    f.velocityY = COMBAT_CONFIG.jumpVelocity;
    f.velocityX = moveDir * activeSpeed * 0.9;
    f.state = FIGHTER_STATES.JUMP;
    return;
  }

  if (!f.isGrounded) {
    f.velocityX = moveDir * activeSpeed * 0.85;
    return;
  }

  if (inp.down && moveDir === 0) {
    f.velocityX = 0;
    f.isRunning = false;
    f.state = FIGHTER_STATES.CROUCH;
    return;
  }

  if (moveDir !== 0) {
    f.velocityX = moveDir * activeSpeed;
    f.state = f.isRunning ? FIGHTER_STATES.RUN : FIGHTER_STATES.WALK;
  } else {
    f.velocityX = 0;
    f.state = FIGHTER_STATES.IDLE;
  }
}

function canServerAttack(f, key) {
  if (f.cooldowns[key] > 0) return false;
  if (f.state === FIGHTER_STATES.HIT || f.state === FIGHTER_STATES.BLOCK)
    return false;
  if (f.activeAttackSpec) return false;
  return true;
}

function startServerAttack(f, key) {
  const spec = ATTACK_SPECS[key];
  if (!spec) return;
  f.activeAttackSpec = spec;
  f.attackElapsedMs = 0;
  f.hasHitCurrentAttack = false;
  f.isHitboxActive = false;
  f.cooldowns[key] = spec.cooldownMs;
  if (f.isGrounded) f.velocityX = 0;
  f.state = FIGHTER_STATES[spec.state];
}

function applyServerPhysics(f, dt) {
  if (Math.abs(f.knockbackVelocity) > 5) {
    f.x += f.knockbackVelocity * dt;
    f.knockbackVelocity *= Math.pow(0.035, dt);
  } else {
    f.knockbackVelocity = 0;
  }

  if (f.state !== FIGHTER_STATES.HIT && !f.activeAttackSpec) {
    f.x += f.velocityX * dt;
  } else if (
    f.activeAttackSpec &&
    f.attackElapsedMs < f.activeAttackSpec.startupMs
  ) {
    f.x += f.facing * 48 * dt;
  }

  if (!f.isGrounded) {
    f.velocityY += COMBAT_CONFIG.gravity * dt;
    f.y += f.velocityY * dt;
    if (f.y >= f.groundY) {
      f.y = f.groundY;
      f.velocityY = 0;
      f.isGrounded = true;
      if (!f.activeAttackSpec && f.state !== FIGHTER_STATES.HIT) {
        f.state = FIGHTER_STATES.IDLE;
      }
    }
  } else {
    f.y = f.groundY;
  }

  if (f.x < COMBAT_CONFIG.stageLeftBound) f.x = COMBAT_CONFIG.stageLeftBound;
  if (f.x > COMBAT_CONFIG.stageRightBound) f.x = COMBAT_CONFIG.stageRightBound;
}

function resolveServerPositioning(f1, f2) {
  if (Math.abs(f1.y - f2.y) > 120) return;
  const dx = f2.x - f1.x;
  const dist = Math.abs(dx);
  const minDist = COMBAT_CONFIG.minBodyDistance;
  if (dist < minDist) {
    const overlap = (minDist - dist) / 2;
    const pushDir = dx >= 0 ? 1 : -1;
    f1.x -= pushDir * overlap;
    f2.x += pushDir * overlap;
    f1.x = Math.max(
      COMBAT_CONFIG.stageLeftBound,
      Math.min(COMBAT_CONFIG.stageRightBound, f1.x),
    );
    f2.x = Math.max(
      COMBAT_CONFIG.stageLeftBound,
      Math.min(COMBAT_CONFIG.stageRightBound, f2.x),
    );
    updateServerFighterBounds(f1);
    updateServerFighterBounds(f2);
  }
}

function applyDamageToServerFighter(defender, spec, attackerDir) {
  const incomingDir = attackerDir >= 0 ? 1 : -1;
  defender.facing = -incomingDir;
  const isBlocking =
    defender.state === FIGHTER_STATES.BLOCK &&
    defender.isGrounded &&
    !defender.activeAttackSpec;

  const finalDamage = isBlocking
    ? Math.max(1, Math.round(spec.damage * COMBAT_CONFIG.blockDamageMultiplier))
    : spec.damage;

  defender.health = Math.max(0, defender.health - finalDamage);
  const pushback = isBlocking ? spec.knockback * 0.42 : spec.knockback;
  defender.knockbackVelocity = incomingDir * pushback;

  defender.activeAttackSpec = null;
  defender.isHitboxActive = false;
  defender.hasHitCurrentAttack = false;
  defender.attackElapsedMs = 0;

  if (isBlocking) {
    defender.stunTimerMs = spec.blockStunMs;
    return { blocked: true, damage: finalDamage };
  }

  defender.stunTimerMs = spec.hitStunMs;
  defender.state = FIGHTER_STATES.HIT;
  return { blocked: false, damage: finalDamage };
}

function evaluateServerCombat(room, f1, f2) {
  const f1HitsF2 =
    f1.isHitboxActive &&
    !f1.hasHitCurrentAttack &&
    f1.activeAttackSpec &&
    rectsIntersect(f1.hitbox, f2.hurtbox);

  const f2HitsF1 =
    f2.isHitboxActive &&
    !f2.hasHitCurrentAttack &&
    f2.activeAttackSpec &&
    rectsIntersect(f2.hitbox, f1.hurtbox);

  if (f1HitsF2 && f2HitsF1) {
    const spec1 = { ...f1.activeAttackSpec };
    const spec2 = { ...f2.activeAttackSpec };
    const dir1 = f1.facing;
    const dir2 = f2.facing;
    const hitY1 = f1.hitbox.y + f1.hitbox.height / 2;
    const hitY2 = f2.hitbox.y + f2.hitbox.height / 2;

    f1.hasHitCurrentAttack = true;
    f1.isHitboxActive = false;
    f2.hasHitCurrentAttack = true;
    f2.isHitboxActive = false;

    const res2 = applyDamageToServerFighter(f2, spec1, dir1);
    const res1 = applyDamageToServerFighter(f1, spec2, dir2);

    f1.hitStopMs = 55;
    f2.hitStopMs = 55;

    io.to(room.code).emit("online:hit", {
      attackerNum: 1,
      defenderNum: 2,
      attackState: spec1.state,
      blocked: res2.blocked,
      damage: res2.damage,
      impactX: Math.round(f2.x - dir1 * 24),
      impactY: Math.round(hitY1),
    });
    io.to(room.code).emit("online:hit", {
      attackerNum: 2,
      defenderNum: 1,
      attackState: spec2.state,
      blocked: res1.blocked,
      damage: res1.damage,
      impactX: Math.round(f1.x - dir2 * 24),
      impactY: Math.round(hitY2),
    });
    return;
  }

  if (f1HitsF2) {
    const spec = { ...f1.activeAttackSpec };
    const dir = f1.facing;
    const hitY = f1.hitbox.y + f1.hitbox.height / 2;
    f1.hasHitCurrentAttack = true;
    f1.isHitboxActive = false;
    const res = applyDamageToServerFighter(f2, spec, dir);
    f1.hitStopMs = 50;
    f2.hitStopMs = 50;
    io.to(room.code).emit("online:hit", {
      attackerNum: 1,
      defenderNum: 2,
      attackState: spec.state,
      blocked: res.blocked,
      damage: res.damage,
      impactX: Math.round(f2.x - dir * 24),
      impactY: Math.round(hitY),
    });
  } else if (f2HitsF1) {
    const spec = { ...f2.activeAttackSpec };
    const dir = f2.facing;
    const hitY = f2.hitbox.y + f2.hitbox.height / 2;
    f2.hasHitCurrentAttack = true;
    f2.isHitboxActive = false;
    const res = applyDamageToServerFighter(f1, spec, dir);
    f1.hitStopMs = 50;
    f2.hitStopMs = 50;
    io.to(room.code).emit("online:hit", {
      attackerNum: 2,
      defenderNum: 1,
      attackState: spec.state,
      blocked: res.blocked,
      damage: res.damage,
      impactX: Math.round(f1.x - dir * 24),
      impactY: Math.round(hitY),
    });
  }
}

function resolveServerRound(room, winnerCode, reasonTitle) {
  if (room.roundPhase !== "FIGHTING") return;
  room.roundPhase = "ROUND_OVER";
  clearRoomTimers(room);

  const f1 = room.fighters[1];
  const f2 = room.fighters[2];
  let subMessage = "ROUND DRAW";
  let bannerColor = "#ffd60a";

  if (winnerCode === 'P1') {
    room.p1Wins += 1;
    subMessage = `${f1.name} (P1) WINS ROUND ${room.currentRound}`;
    bannerColor = '#ff3b30';
    f1.state = FIGHTER_STATES.VICTORY;
    f2.state = FIGHTER_STATES.DEFEAT;
  } else if (winnerCode === 'P2') {
    room.p2Wins += 1;
    subMessage = `${f2.name} (P2) WINS ROUND ${room.currentRound}`;
    bannerColor = '#0a84ff';
    f2.state = FIGHTER_STATES.VICTORY;
    f1.state = FIGHTER_STATES.DEFEAT;
  } else {
    f1.state = FIGHTER_STATES.IDLE;
    f2.state = FIGHTER_STATES.IDLE;
  }

  io.to(room.code).emit("online:banner", {
    title: reasonTitle,
    sub: subMessage,
    color: bannerColor,
    visible: true,
  });

  const p1WonMatch = room.p1Wins >= MATCH_CONFIG.roundsToWin;
  const p2WonMatch = room.p2Wins >= MATCH_CONFIG.roundsToWin;
  const reachedMaxCap = room.currentRound >= 5;

  room.phaseTimer = setTimeout(() => {
    if (!rooms.has(room.code)) return;
    if (p1WonMatch || p2WonMatch || reachedMaxCap) {
      room.roundPhase = "MATCH_OVER";
      room.status = "finished";
      let outcome = "DRAW";
      if (room.p1Wins > room.p2Wins) outcome = "P1";
      else if (room.p2Wins > room.p1Wins) outcome = "P2";

      io.to(room.code).emit("online:banner", {
        title: "",
        sub: "",
        color: "#ffffff",
        visible: false,
      });

      io.to(room.code).emit("online:match_end", {
        outcome,
        p1Wins: room.p1Wins,
        p2Wins: room.p2Wins,
        roundsPlayed: room.currentRound,
      });
    } else {
      room.currentRound += 1;
      startRoomRound(room);
    }
  }, MATCH_CONFIG.roundEndHoldMs);
}

function clearRoomTimers(room) {
  if (room.introTimer) {
    clearTimeout(room.introTimer);
    room.introTimer = null;
  }
  if (room.phaseTimer) {
    clearTimeout(room.phaseTimer);
    room.phaseTimer = null;
  }
}

function destroyRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  clearRoomTimers(room);
  [1, 2].forEach((slot) => {
    const p = room.players[slot];
    if (p && p.disconnectTimeout) {
      clearTimeout(p.disconnectTimeout);
    }
  });
  rooms.delete(code);
}

setInterval(() => {
  rooms.forEach((room) => {
    if (room.status !== "fighting" && room.status !== "finished") return;
    if (room.pausedForReconnect) return;

    const f1 = room.fighters[1];
    const f2 = room.fighters[2];
    const canFight = room.roundPhase === "FIGHTING";

    stepServerFighter(f1, f2.x, TICK_MS, canFight);
    stepServerFighter(f2, f1.x, TICK_MS, canFight);

    if (canFight) {
      resolveServerPositioning(f1, f2);
      evaluateServerCombat(room, f1, f2);

      const f1Dead = f1.health <= 0;
      const f2Dead = f2.health <= 0;
      if (f1Dead || f2Dead) {
        if (f1Dead && f2Dead) resolveServerRound(room, "DRAW", "DOUBLE K.O.!");
        else if (f2Dead) resolveServerRound(room, "P1", "K.O.!");
        else resolveServerRound(room, "P2", "K.O.!");
      } else {
        room.remainingTimeMs = Math.max(0, room.remainingTimeMs - TICK_MS);
        if (room.remainingTimeMs <= 0) {
          if (f1.health > f2.health)
            resolveServerRound(room, "P1", "TIME OVER");
          else if (f2.health > f1.health)
            resolveServerRound(room, "P2", "TIME OVER");
          else resolveServerRound(room, "DRAW", "TIME OVER — DRAW");
        }
      }
    }

    io.to(room.code).emit("online:state", {
      round: room.currentRound,
      phase: room.roundPhase,
      timer: Math.ceil(room.remainingTimeMs / 1000),
      p1Wins: room.p1Wins,
      p2Wins: room.p2Wins,
      f1: {
        x: Math.round(f1.x * 10) / 10,
        y: Math.round(f1.y * 10) / 10,
        facing: f1.facing,
        state: f1.state,
        hp: f1.health,
        spCd: Math.round(f1.cooldowns.special),
        hb: f1.isHitboxActive ? f1.hitbox : null,
      },
      f2: {
        x: Math.round(f2.x * 10) / 10,
        y: Math.round(f2.y * 10) / 10,
        facing: f2.facing,
        state: f2.state,
        hp: f2.health,
        spCd: Math.round(f2.cooldowns.special),
        hb: f2.isHitboxActive ? f2.hitbox : null,
      },
    });
  });
}, TICK_MS);

io.on("connection", (socket) => {
  socket.on("room:create", (payload, ack) => {
    const token = String(payload?.playerToken || socket.id);
    const code = generateRoomCode();
    const room = {
      code,
      status: "waiting",
      arena: ARENAS[0],
      players: {
        1: {
          slot: 1,
          token,
          socketId: socket.id,
          connected: true,
          ready: false,
          characterId: CHARACTERS[0].id,
          disconnectTimeout: null,
        },
        2: null,
      },
      fighters: {
        1: createServerFighter(1, 370, 1),
        2: createServerFighter(2, 910, -1),
      },
      currentRound: 1,
      p1Wins: 0,
      p2Wins: 0,
      roundPhase: "INTRO",
      remainingTimeMs: MATCH_CONFIG.roundDurationSeconds * 1000,
      pausedForReconnect: false,
      rematchVotes: new Set(),
      introTimer: null,
      phaseTimer: null,
    };

    rooms.set(code, room);
    socketToRoom.set(socket.id, { code, slot: 1 });
    socket.join(code);

    if (typeof ack === "function") {
      ack({ ok: true, code, slot: 1, lobby: serializeRoomLobby(room) });
    }
  });

  socket.on("room:join", (payload, ack) => {
    const rawCode = String(payload?.code || "")
      .trim()
      .toUpperCase();
    const token = String(payload?.playerToken || socket.id);

    if (!rawCode || rawCode.length !== 6) {
      if (typeof ack === "function")
        ack({ ok: false, error: "INVALID ROOM CODE FORMAT (6 CHARS)." });
      return;
    }

    const room = rooms.get(rawCode);
    if (!room) {
      if (typeof ack === "function")
        ack({ ok: false, error: "ROOM NOT FOUND OR EXPIRED." });
      return;
    }

    for (const slot of [1, 2]) {
      const existing = room.players[slot];
      if (existing && existing.token === token) {
        if (existing.disconnectTimeout) {
          clearTimeout(existing.disconnectTimeout);
          existing.disconnectTimeout = null;
        }
        existing.socketId = socket.id;
        existing.connected = true;
        socketToRoom.set(socket.id, { code: room.code, slot });
        socket.join(room.code);

        if (room.pausedForReconnect) {
          const otherSlot = slot === 1 ? 2 : 1;
          if (room.players[otherSlot]?.connected) {
            room.pausedForReconnect = false;
            io.to(room.code).emit("online:player_reconnected", { slot });
          }
        }

        io.to(room.code).emit("lobby:update", serializeRoomLobby(room));
        if (typeof ack === "function") {
          ack({
            ok: true,
            code: room.code,
            slot,
            reconnected: true,
            status: room.status,
            lobby: serializeRoomLobby(room),
          });
        }
        return;
      }
    }

    if (room.status === "fighting" || room.status === "finished") {
      if (typeof ack === "function")
        ack({ ok: false, error: "MATCH ALREADY IN PROGRESS." });
      return;
    }

    if (room.players[1] && room.players[2]) {
      if (typeof ack === "function")
        ack({ ok: false, error: "ROOM IS FULL (MAX 2 PLAYERS)." });
      return;
    }

    const targetSlot = !room.players[1] ? 1 : 2;
    room.players[targetSlot] = {
      slot: targetSlot,
      token,
      socketId: socket.id,
      connected: true,
      ready: false,
      characterId: CHARACTERS[targetSlot - 1].id,
      disconnectTimeout: null,
    };

    room.status = room.players[1] && room.players[2] ? "ready" : "waiting";
    socketToRoom.set(socket.id, { code: room.code, slot: targetSlot });
    socket.join(room.code);

    const lobbyData = serializeRoomLobby(room);
    io.to(room.code).emit("lobby:update", lobbyData);

    if (typeof ack === "function") {
      ack({ ok: true, code: room.code, slot: targetSlot, lobby: lobbyData });
    }
  });

  socket.on("lobby:select_character", (payload) => {
    const info = socketToRoom.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.code);
    if (!room || (room.status !== "waiting" && room.status !== "ready")) return;

    const player = room.players[info.slot];
    if (!player || player.ready) return;

    const validChar = CHARACTERS.find((c) => c.id === payload?.characterId);
    if (!validChar) return;

    player.characterId = validChar.id;
    io.to(room.code).emit("lobby:update", serializeRoomLobby(room));
  });

  socket.on("lobby:ready", (payload) => {
    const info = socketToRoom.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.code);
    if (!room || (room.status !== "waiting" && room.status !== "ready")) return;

    const player = room.players[info.slot];
    if (!player) return;

    player.ready = Boolean(payload?.ready);
    const p1 = room.players[1];
    const p2 = room.players[2];

    room.status = p1 && p2 ? "ready" : "waiting";
    const updatedLobby = serializeRoomLobby(room);
    io.to(room.code).emit("lobby:update", updatedLobby);

    if (p1 && p2 && p1.connected && p2.connected && p1.ready && p2.ready) {
      io.to(room.code).emit("online:match_start", {
        code: room.code,
        arenaId: room.arena.id,
        p1CharacterId: p1.characterId,
        p2CharacterId: p2.characterId,
      });
      startRoomMatch(room);
    }
  });

  socket.on('online:sync_request', () => {
    const info = socketToRoom.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.code);
    if (!room) return;
    room.lastActivityAt = Date.now();

    const f1 = room.fighters[1];
    const f2 = room.fighters[2];

    socket.emit('online:state', {
      round: room.currentRound,
      phase: room.roundPhase,
      timer: Math.ceil(room.remainingTimeMs / 1000),
      p1Wins: room.p1Wins,
      p2Wins: room.p2Wins,
      f1: {
        x: Math.round(f1.x * 10) / 10,
        y: Math.round(f1.y * 10) / 10,
        facing: f1.facing,
        state: f1.state,
        hp: f1.health,
        spCd: Math.round(f1.cooldowns.special),
        hb: f1.isHitboxActive ? f1.hitbox : null
      },
      f2: {
        x: Math.round(f2.x * 10) / 10,
        y: Math.round(f2.y * 10) / 10,
        facing: f2.facing,
        state: f2.state,
        hp: f2.health,
        spCd: Math.round(f2.cooldowns.special),
        hb: f2.isHitboxActive ? f2.hitbox : null
      }
    });

    if (room.roundPhase === 'INTRO') {
      socket.emit('online:banner', {
        title: `ROUND ${room.currentRound}`,
        sub: 'GET READY',
        color: '#ffd60a',
        visible: true
      });
    }
  });

  socket.on("online:input", (inputPayload) => {
    const info = socketToRoom.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.code);
    if (!room || room.status !== "fighting") return;

    const fighter = room.fighters[info.slot];
    if (!fighter || !inputPayload || typeof inputPayload !== "object") return;

    fighter.input.left = Boolean(inputPayload.left);
    fighter.input.right = Boolean(inputPayload.right);
    fighter.input.up = Boolean(inputPayload.up);
    fighter.input.down = Boolean(inputPayload.down);
    fighter.input.blockHeld = Boolean(inputPayload.blockHeld);

    if (inputPayload.jumpPressed) fighter.queuedActions.jump = true;
    if (inputPayload.punchPressed) fighter.queuedActions.punch = true;
    if (inputPayload.kickPressed) fighter.queuedActions.kick = true;
    if (inputPayload.specialPressed) fighter.queuedActions.special = true;
  });

  socket.on("online:rematch", () => {
    const info = socketToRoom.get(socket.id);
    if (!info) return;
    const room = rooms.get(info.code);
    if (!room || room.status !== "finished") return;

    room.rematchVotes.add(info.slot);
    io.to(room.code).emit("online:rematch_status", {
      votes: Array.from(room.rematchVotes),
      totalRequired: 2,
    });

    if (room.rematchVotes.has(1) && room.rematchVotes.has(2)) {
      io.to(room.code).emit("online:rematch_start");
      startRoomMatch(room);
    }
  });

  socket.on("room:leave", () => {
    handlePlayerLeave(socket.id, true);
  });

  socket.on("disconnect", () => {
    handlePlayerLeave(socket.id, false);
  });
});

function handlePlayerLeave(socketId, explicitLeave) {
  const info = socketToRoom.get(socketId);
  if (!info) return;
  socketToRoom.delete(socketId);

  const room = rooms.get(info.code);
  if (!room) return;

  const player = room.players[info.slot];
  if (!player) return;

  if (explicitLeave) {
    if (player.disconnectTimeout) clearTimeout(player.disconnectTimeout);
    room.players[info.slot] = null;

    const otherSlot = info.slot === 1 ? 2 : 1;
    const otherPlayer = room.players[otherSlot];

    if (!otherPlayer || !otherPlayer.connected) {
      destroyRoom(room.code);
      return;
    }

    if (room.status === "fighting" || room.status === "finished") {
      clearRoomTimers(room);
      room.status = "finished";
      io.to(room.code).emit("online:opponent_left", {
        message: "OPPONENT LEFT THE MATCH. YOU WIN BY FORFEIT!",
      });
    } else {
      room.status = "waiting";
      otherPlayer.ready = false;
      io.to(room.code).emit("lobby:update", serializeRoomLobby(room));
    }
    return;
  }

  player.connected = false;
  player.ready = false;

  const otherSlot = info.slot === 1 ? 2 : 1;
  const otherPlayer = room.players[otherSlot];

  if (!otherPlayer || !otherPlayer.connected) {
    player.disconnectTimeout = setTimeout(() => {
      destroyRoom(room.code);
    }, RECONNECT_GRACE_MS);
    return;
  }

  if (room.status === "fighting") {
    room.pausedForReconnect = true;
    room.fighters[info.slot].input = createEmptyInput();
    io.to(room.code).emit("online:player_disconnected", {
      slot: info.slot,
      graceSeconds: RECONNECT_GRACE_MS / 1000,
    });
  } else {
    io.to(room.code).emit("lobby:update", serializeRoomLobby(room));
  }

  player.disconnectTimeout = setTimeout(() => {
    if (!rooms.has(room.code)) return;
    const stillDisconnected = !room.players[info.slot]?.connected;
    if (!stillDisconnected) return;

    room.players[info.slot] = null;
    if (room.status === "fighting" || room.status === "finished") {
      clearRoomTimers(room);
      room.status = "finished";
      io.to(room.code).emit("online:opponent_left", {
        message: "OPPONENT DISCONNECTED (TIMEOUT). YOU WIN!",
      });
    } else {
      room.status = "waiting";
      io.to(room.code).emit("lobby:update", serializeRoomLobby(room));
    }
  }, RECONNECT_GRACE_MS);
}

setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, code) => {
    const lastActive = room.lastActivityAt || now;
    const p1Connected = Boolean(room.players[1]?.connected);
    const p2Connected = Boolean(room.players[2]?.connected);
    if ((!p1Connected && !p2Connected) || now - lastActive > STALE_ROOM_TTL_MS) {
      destroyRoom(code);
    }
  });
}, 60000);

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Face Fighter Online Server listening on port ${PORT}`);
});
