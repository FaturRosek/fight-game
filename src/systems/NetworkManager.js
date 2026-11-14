import { io } from "socket.io-client";

const TOKEN_STORAGE_KEY = "face_fighter_player_token_v1";
const ROOM_STORAGE_KEY = "face_fighter_last_room_v1";

class NetworkManager {
  constructor() {
    this.socket = null;
    this.roomCode = null;
    this.playerSlot = 1;
    this.lobbyState = null;
    this.lastSentHash = "";
    this.lastSendTime = 0;
    this.playerToken = this.getOrCreateToken();
  }

  getOrCreateToken() {
    try {
      let token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) {
        token = `ff_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
        sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      }
      return token;
    } catch {
      return `ff_${Math.random().toString(36).substring(2, 12)}`;
    }
  }

  saveLastRoom(code) {
    try {
      if (code) sessionStorage.setItem(ROOM_STORAGE_KEY, code);
      else sessionStorage.removeItem(ROOM_STORAGE_KEY);
    } catch {
      return;
    }
  }

  getSavedRoom() {
    try {
      return sessionStorage.getItem(ROOM_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  }

  connect() {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }
    if (this.socket) {
      this.socket.connect();
      return this.socket;
    }

    const envUrl = import.meta.env.VITE_SOCKET_URL;
    const targetUrl =
      envUrl && String(envUrl).trim() !== ""
        ? String(envUrl).trim()
        : undefined;

    this.socket = io(targetUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
    });

    this.socket.on("connect", () => {
      if (this.roomCode) {
        this.joinRoom(this.roomCode, () => {});
      }
    });

    return this.socket;
  }

  createRoom(callback) {
    const s = this.connect();
    s.emit("room:create", { playerToken: this.playerToken }, (res) => {
      if (res && res.ok) {
        this.roomCode = res.code;
        this.playerSlot = res.slot;
        this.lobbyState = res.lobby;
        this.saveLastRoom(res.code);
      }
      if (callback)
        callback(res || { ok: false, error: "NO RESPONSE FROM SERVER." });
    });
  }

  joinRoom(code, callback) {
    const cleanCode = String(code || "")
      .trim()
      .toUpperCase();
    const s = this.connect();
    s.emit(
      "room:join",
      { code: cleanCode, playerToken: this.playerToken },
      (res) => {
        if (res && res.ok) {
          this.roomCode = res.code;
          this.playerSlot = res.slot;
          this.lobbyState = res.lobby;
          this.saveLastRoom(res.code);
        }
        if (callback)
          callback(res || { ok: false, error: "NO RESPONSE FROM SERVER." });
      },
    );
  }

  selectCharacter(characterId) {
    if (!this.socket || !this.roomCode || !characterId) return;
    this.socket.emit("lobby:select_character", { characterId });
  }

  setReady(isReady) {
    if (!this.socket || !this.roomCode) return;
    this.socket.emit("lobby:ready", { ready: Boolean(isReady) });
  }

  sendInput(inputState) {
    if (!this.socket || !this.socket.connected || !this.roomCode || !inputState)
      return;

    const payload = {
      left: Boolean(inputState.left),
      right: Boolean(inputState.right),
      up: Boolean(inputState.up),
      down: Boolean(inputState.down),
      blockHeld: Boolean(inputState.blockHeld),
      jumpPressed: Boolean(inputState.jumpPressed),
      punchPressed: Boolean(inputState.punchPressed),
      kickPressed: Boolean(inputState.kickPressed),
      specialPressed: Boolean(inputState.specialPressed),
    };

    const hasEdgeAction =
      payload.jumpPressed ||
      payload.punchPressed ||
      payload.kickPressed ||
      payload.specialPressed;

    const hash = `${payload.left ? 1 : 0}${payload.right ? 1 : 0}${payload.up ? 1 : 0}${payload.down ? 1 : 0}${payload.blockHeld ? 1 : 0}`;
    const now = performance.now();

    if (
      hasEdgeAction ||
      hash !== this.lastSentHash ||
      now - this.lastSendTime > 95
    ) {
      this.lastSentHash = hash;
      this.lastSendTime = now;
      this.socket.emit("online:input", payload);

      if (hasEdgeAction && typeof inputState.consumeAction === "function") {
        if (payload.jumpPressed) inputState.consumeAction("jump");
        if (payload.punchPressed) inputState.consumeAction("punch");
        if (payload.kickPressed) inputState.consumeAction("kick");
        if (payload.specialPressed) inputState.consumeAction("special");
      }
    }
  }

  requestRoomSync() {
    if (!this.socket || !this.roomCode) return;
    this.socket.emit("online:sync_request");
  }

  requestRematch() {
    if (!this.socket || !this.roomCode) return;
    this.socket.emit("online:rematch");
  }

  leaveRoom() {
    if (this.socket && this.roomCode) {
      this.socket.emit("room:leave");
    }
    this.roomCode = null;
    this.lobbyState = null;
    this.saveLastRoom("");
  }
}

export const networkManager = new NetworkManager();
