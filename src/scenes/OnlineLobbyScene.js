import Phaser from "phaser";
import { CHARACTERS, ARENAS } from "../config/gameData.js";
import { networkManager } from "../systems/NetworkManager.js";
import {
  GameSession,
  drawArcadeBackground,
  createArcadeButton,
} from "../utils/helpers.js";

export default class OnlineLobbyScene extends Phaser.Scene {
  constructor() {
    super("OnlineLobbyScene");
  }

  create() {
    const { width, height } = this.scale;
    drawArcadeBackground(this, 0x0a84ff);

    this.enteredCode = "";
    this.isReady = false;

    this.add
      .text(width / 2, 34, "ONLINE MULTIPLAYER LOBBY", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "38px",
        color: "#ffffff",
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    this.statusBanner = this.add
      .text(width / 2, 80, "CONNECTING TO FACE FIGHTER REAL-TIME SERVER...", {
        fontSize: "14px",
        fontStyle: "bold",
        color: "#ffd60a",
        backgroundColor: "#161624",
        padding: { x: 16, y: 5 },
      })
      .setOrigin(0.5);

    this.viewContainer = this.add.container(0, 0);

    this.setupSocketListeners();
    this.showEntryChoiceView();
  }

  setupSocketListeners() {
    const socket = networkManager.connect();

    this.onConnect = () => {
      this.statusBanner.setText(
        "ONLINE SERVER CONNECTED — CREATE OR JOIN A ROOM",
      );
      this.statusBanner.setColor("#30d158");
    };

    this.onConnectError = () => {
      this.statusBanner.setText(
        'SERVER UNREACHABLE! RUN "npm run server" ON PORT 3001',
      );
      this.statusBanner.setColor("#ff453a");
    };

    this.onLobbyUpdate = (lobby) => {
      networkManager.lobbyState = lobby;
      if (networkManager.roomCode) {
        this.showRoomWaitingView(lobby);
      }
    };

    this.onMatchStart = (matchPayload) => {
      const p1Id =
        matchPayload?.p1CharacterId ||
        networkManager.lobbyState?.players?.[1]?.characterId;
      const p2Id =
        matchPayload?.p2CharacterId ||
        networkManager.lobbyState?.players?.[2]?.characterId;

      GameSession.mode = "ONLINE";
      GameSession.p1Character =
        CHARACTERS.find((c) => c.id === p1Id) || CHARACTERS[0];
      GameSession.p2Character =
        CHARACTERS.find((c) => c.id === p2Id) || CHARACTERS[1];
      GameSession.arena = ARENAS[0];
      this.cleanupListeners();
      this.scene.start("BattleScene");
    };

    socket.on("connect", this.onConnect);
    socket.on("connect_error", this.onConnectError);
    socket.on("lobby:update", this.onLobbyUpdate);
    socket.on("online:match_start", this.onMatchStart);

    if (socket.connected) {
      this.onConnect();
    }

    this.input.keyboard.on("keydown", this.handleKeyboardCodeInput, this);

    this.events.once("shutdown", () => this.cleanupListeners());
    this.events.once("destroy", () => this.cleanupListeners());
  }

  cleanupListeners() {
    const socket = networkManager.socket;
    if (socket) {
      socket.off("connect", this.onConnect);
      socket.off("connect_error", this.onConnectError);
      socket.off("lobby:update", this.onLobbyUpdate);
      socket.off("online:match_start", this.onMatchStart);
    }
    if (this.input && this.input.keyboard) {
      this.input.keyboard.off("keydown", this.handleKeyboardCodeInput, this);
    }
  }

  handleKeyboardCodeInput(event) {
    if (!this.codeDisplayText || !this.codeDisplayText.active) return;
    const key = event.key.toUpperCase();
    if (key === "BACKSPACE") {
      this.enteredCode = this.enteredCode.slice(0, -1);
      this.updateCodeDisplay();
    } else if (key === "ENTER" && this.enteredCode.length === 6) {
      this.triggerJoinByCode();
    } else if (/^[A-Z0-9]$/.test(key) && this.enteredCode.length < 6) {
      this.enteredCode += key;
      this.updateCodeDisplay();
    }
  }

  updateCodeDisplay() {
    if (!this.codeDisplayText || !this.codeDisplayText.active) return;
    const padded = this.enteredCode.padEnd(6, "_").split("").join(" ");
    this.codeDisplayText.setText(padded);
  }

  showEntryChoiceView() {
    this.viewContainer.removeAll(true);
    this.codeDisplayText = null;
    const { width, height } = this.scale;

    const leftBox = this.add.graphics();
    leftBox.fillStyle(0x141422, 0.96);
    leftBox.lineStyle(3, 0xff3b30, 1);
    leftBox.fillRect(110, 130, 480, 440);
    leftBox.strokeRect(110, 130, 480, 440);

    const createTitle = this.add
      .text(350, 185, "CREATE ROOM (HOST)", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const createDesc = this.add
      .text(
        350,
        255,
        "Create a new battle room as Player 1 (RAMA).\nShare the 6-digit Room Code with your friend on Phone or Laptop.",
        {
          fontSize: "15px",
          color: "#c8c8d4",
          align: "center",
          wordWrap: { width: 410 },
        },
      )
      .setOrigin(0.5);

    const p1Sprite = this.add
      .sprite(350, 385, CHARACTERS[0].textureKey, 0)
      .setScale(0.58);
    p1Sprite.play(`${CHARACTERS[0].id}_idle`);

    const btnCreate = createArcadeButton(
      this,
      350,
      510,
      "CREATE NEW ROOM",
      () => {
        this.statusBanner.setText("CREATING ROOM...");
        networkManager.createRoom((res) => {
          if (!res || !res.ok) {
            this.statusBanner.setText(res?.error || "FAILED TO CREATE ROOM.");
            this.statusBanner.setColor("#ff453a");
            return;
          }
          this.isReady = false;
          this.showRoomWaitingView(res.lobby);
        });
      },
      { width: 290, height: 48, accentColor: 0xff3b30, fontSize: "19px" },
    );

    const rightBox = this.add.graphics();
    rightBox.fillStyle(0x141422, 0.96);
    rightBox.lineStyle(3, 0x0a84ff, 1);
    rightBox.fillRect(width - 590, 130, 480, 440);
    rightBox.strokeRect(width - 590, 130, 480, 440);

    const joinTitle = this.add
      .text(width - 350, 172, "JOIN ROOM BY CODE", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.codeDisplayText = this.add
      .text(width - 350, 228, "_ _ _ _ _ _", {
        fontFamily: "monospace",
        fontSize: "34px",
        fontStyle: "bold",
        color: "#ffd60a",
        backgroundColor: "#090910",
        padding: { x: 24, y: 8 },
      })
      .setOrigin(0.5);

    this.updateCodeDisplay();

    const keypadChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const cols = 8;
    const keyW = 48;
    const keyH = 34;
    const startKX = width - 350 - ((cols - 1) * 52) / 2;
    const startKY = 290;

    const keypadItems = [];
    for (let i = 0; i < keypadChars.length; i++) {
      const ch = keypadChars[i];
      const r = Math.floor(i / cols);
      const c = i % cols;
      const kx = startKX + c * 52;
      const ky = startKY + r * 40;

      const keyBg = this.add
        .rectangle(kx, ky, keyW, keyH, 0x242436)
        .setStrokeStyle(1.5, 0x0a84ff)
        .setInteractive({ useHandCursor: true });
      const keyTxt = this.add
        .text(kx, ky, ch, {
          fontFamily: "monospace",
          fontSize: "16px",
          fontStyle: "bold",
          color: "#ffffff",
        })
        .setOrigin(0.5);

      keyBg.on("pointerdown", () => {
        if (this.enteredCode.length < 6) {
          this.enteredCode += ch;
          this.updateCodeDisplay();
        }
      });

      keypadItems.push(keyBg, keyTxt);
    }

    const btnClear = createArcadeButton(
      this,
      width - 445,
      462,
      "BACKSPACE",
      () => {
        this.enteredCode = this.enteredCode.slice(0, -1);
        this.updateCodeDisplay();
      },
      { width: 170, height: 38, accentColor: 0x8e8e93, fontSize: "14px" },
    );

    const btnJoin = createArcadeButton(
      this,
      width - 255,
      462,
      "JOIN ROOM",
      () => this.triggerJoinByCode(),
      { width: 190, height: 42, accentColor: 0x0a84ff, fontSize: "17px" },
    );

    const joinHint = this.add
      .text(width - 350, 518, "Tap letters above or type on your keyboard", {
        fontSize: "13px",
        color: "#8e8e98",
      })
      .setOrigin(0.5);

    const btnBack = createArcadeButton(
      this,
      width / 2,
      height - 46,
      "BACK TO MAIN MENU",
      () => {
        networkManager.leaveRoom();
        this.scene.start("MenuScene");
      },
      { width: 260, height: 42, accentColor: 0x8e8e93, fontSize: "16px" },
    );

    this.viewContainer.add([
      leftBox,
      createTitle,
      createDesc,
      p1Sprite,
      btnCreate,
      rightBox,
      joinTitle,
      this.codeDisplayText,
      ...keypadItems,
      btnClear,
      btnJoin,
      joinHint,
      btnBack,
    ]);
  }

  triggerJoinByCode() {
    if (this.enteredCode.length !== 6) {
      this.statusBanner.setText("PLEASE ENTER A 6-CHARACTER ROOM CODE.");
      this.statusBanner.setColor("#ff9f0a");
      return;
    }

    this.statusBanner.setText(`JOINING ROOM ${this.enteredCode}...`);
    networkManager.joinRoom(this.enteredCode, (res) => {
      if (!res || !res.ok) {
        this.statusBanner.setText(res?.error || "FAILED TO JOIN ROOM.");
        this.statusBanner.setColor("#ff453a");
        return;
      }

      if (res.status === "fighting") {
        GameSession.mode = "ONLINE";
        GameSession.p1Character = CHARACTERS[0];
        GameSession.p2Character = CHARACTERS[1];
        GameSession.arena = ARENAS[0];
        this.cleanupListeners();
        this.scene.start("BattleScene");
        return;
      }

      this.isReady = false;
      this.showRoomWaitingView(res.lobby);
    });
  }

  showRoomWaitingView(lobby) {
    this.viewContainer.removeAll(true);
    this.codeDisplayText = null;
    const { width, height } = this.scale;

    const mySlot = networkManager.playerSlot;
    const myPlayerObj = lobby.players[mySlot];
    const myChar =
      CHARACTERS.find((c) => c.id === myPlayerObj?.characterId) ||
      CHARACTERS[mySlot - 1];

    this.statusBanner.setText(
      `ROOM CODE: ${lobby.code}  •  YOU ARE PLAYER ${mySlot} (SELECTED: ${myChar.name})`,
    );
    this.statusBanner.setColor("#30d158");

    const codeBadge = this.add
      .text(width / 2, 130, `ROOM CODE:  ${lobby.code}`, {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "40px",
        color: "#ffd60a",
        backgroundColor: "#141422",
        padding: { x: 26, y: 6 },
      })
      .setOrigin(0.5);

    const shareHint = this.add
      .text(
        width / 2,
        176,
        "Choose your fighter (RAMA or JUN) below, then press READY TO FIGHT!",
        { fontSize: "14px", color: "#c8c8d4" },
      )
      .setOrigin(0.5);

    const p1SelectedChar =
      CHARACTERS.find((c) => c.id === lobby.players[1]?.characterId) ||
      CHARACTERS[0];
    const p2SelectedChar =
      CHARACTERS.find((c) => c.id === lobby.players[2]?.characterId) ||
      CHARACTERS[1];

    const p1Card = this.createLobbyFighterSlot(
      310,
      368,
      1,
      p1SelectedChar,
      lobby.players[1],
      mySlot === 1,
    );

    const p2Card = this.createLobbyFighterSlot(
      width - 310,
      368,
      2,
      p2SelectedChar,
      lobby.players[2],
      mySlot === 2,
    );

    const vsText = this.add
      .text(width / 2, 355, "VS", {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "64px",
        color: "#ff3b30",
        stroke: "#ffd60a",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.isReady = Boolean(myPlayerObj?.ready);

    const btnReady = createArcadeButton(
      this,
      width / 2 - 150,
      height - 56,
      this.isReady ? "CANCEL READY" : "READY TO FIGHT!",
      () => {
        this.isReady = !this.isReady;
        networkManager.setReady(this.isReady);
      },
      {
        width: 260,
        height: 46,
        accentColor: this.isReady ? 0xff9f0a : 0x30d158,
        fontSize: "19px",
      },
    );

    const btnLeave = createArcadeButton(
      this,
      width / 2 + 150,
      height - 56,
      "LEAVE ROOM",
      () => {
        networkManager.leaveRoom();
        this.showEntryChoiceView();
      },
      { width: 240, height: 46, accentColor: 0xff3b30, fontSize: "18px" },
    );

    this.viewContainer.add([
      codeBadge,
      shareHint,
      p1Card,
      p2Card,
      vsText,
      btnReady,
      btnLeave,
    ]);
  }

  createLobbyFighterSlot(x, y, slotNum, char, playerState, isMe) {
    const w = 400;
    const h = 305;
    const container = this.add.container(x, y);

    const connected = Boolean(playerState && playerState.connected);
    const ready = Boolean(playerState && playerState.ready);
    const borderCol = ready ? 0x30d158 : connected ? char.color : 0x555562;

    const bg = this.add.graphics();
    bg.fillStyle(0x141422, 0.96);
    bg.lineStyle(3, borderCol, 1);
    bg.fillRect(-w / 2, -h / 2, w, h);
    bg.strokeRect(-w / 2, -h / 2, w, h);

    const headerTag = isMe ? `PLAYER ${slotNum} (YOU)` : `PLAYER ${slotNum}`;
    const header = this.add
      .text(0, -h / 2 + 22, headerTag, {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: "22px",
        color: isMe ? "#ffd60a" : "#ffffff",
      })
      .setOrigin(0.5);

    if (connected) {
      const sprite = this.add
        .sprite(0, -14, char.textureKey, 0)
        .setScale(0.52)
        .setFlipX(slotNum === 2);
      sprite.play(`${char.id}_${ready ? "victory" : "idle"}`);

      const charName = this.add
        .text(0, h / 2 - 84, char.fullTitle, {
          fontFamily: 'Impact, "Arial Black", sans-serif',
          fontSize: "20px",
          color: "#ffffff",
        })
        .setOrigin(0.5);

      const statusText = this.add
        .text(
          0,
          h / 2 - 54,
          ready ? "STATUS: READY!" : "STATUS: SELECTING FIGHTER",
          {
            fontSize: "12px",
            fontStyle: "bold",
            color: ready ? "#111111" : "#ffd60a",
            backgroundColor: ready ? "#30d158" : "#262638",
            padding: { x: 12, y: 3 },
          },
        )
        .setOrigin(0.5);

      container.add([bg, header, sprite, charName, statusText]);

      if (isMe && !ready) {
        CHARACTERS.forEach((candidate, idx) => {
          const bx = idx === 0 ? -92 : 92;
          const by = h / 2 - 22;
          const isSelectedChar = candidate.id === char.id;
          const btnPick = createArcadeButton(
            this,
            bx,
            by,
            isSelectedChar
              ? `[ ${candidate.name} ✓ ]`
              : `PICK ${candidate.name}`,
            () => {
              if (!isSelectedChar) {
                networkManager.selectCharacter(candidate.id);
              }
            },
            {
              width: 168,
              height: 30,
              accentColor: isSelectedChar ? 0xffd60a : candidate.color,
              selected: isSelectedChar,
              fontSize: "13px",
            },
          );
          container.add(btnPick);
        });
      } else if (isMe && ready) {
        const lockNote = this.add
          .text(0, h / 2 - 22, "Fighter locked (Cancel Ready to change)", {
            fontSize: "12px",
            color: "#8e8e98",
          })
          .setOrigin(0.5);
        container.add(lockNote);
      }
    } else {
      const waitText = this.add
        .text(0, 0, "WAITING FOR OPPONENT\nTO JOIN ROOM...", {
          fontSize: "18px",
          fontStyle: "bold",
          color: "#8e8e98",
          align: "center",
          lineSpacing: 8,
        })
        .setOrigin(0.5);

      container.add([bg, header, waitText]);
    }

    return container;
  }
}
