const ROOM_NAME = "main";
const EVENT_TEXT = 1;
const EVENT_SIGNAL = 2;
const EVENT_VOICE = 3;
const APP_VERSION = "0.1.0";
const DEFAULT_APP_ID = "b6089b21-fad4-43a9-93e0-7b12f683313e";

const state = {
  client: null,
  joined: false,
  voiceEnabled: false,
  rawStream: null,
  localStream: null,
  audioContext: null,
  micGain: null,
  analyser: null,
  vadTimer: null,
  speaking: false,
  peers: new Map(),
  voiceMembers: new Set(),
  speakingMembers: new Set(),
  members: new Map(),
  volumes: new Map(),
};

const el = {
  appId: document.querySelector("#appIdInput"),
  name: document.querySelector("#nameInput"),
  region: document.querySelector("#regionInput"),
  connect: document.querySelector("#connectBtn"),
  disconnect: document.querySelector("#disconnectBtn"),
  voice: document.querySelector("#voiceBtn"),
  enableSound: document.querySelector("#enableSoundBtn"),
  status: document.querySelector("#statusText"),
  badge: document.querySelector("#connectionBadge"),
  messages: document.querySelector("#messages"),
  form: document.querySelector("#messageForm"),
  message: document.querySelector("#messageInput"),
  members: document.querySelector("#membersList"),
  mic: document.querySelector("#micSelect"),
  speaker: document.querySelector("#speakerSelect"),
  masterVolume: document.querySelector("#masterVolume"),
  micVolume: document.querySelector("#micVolume"),
};

loadSettings();
refreshDevices();
setConnectedUi(false);

el.connect.addEventListener("click", connect);
el.disconnect.addEventListener("click", disconnect);
el.voice.addEventListener("click", toggleVoice);
el.enableSound.addEventListener("click", enableRemoteSound);
el.form.addEventListener("submit", sendMessage);
el.mic.addEventListener("change", restartVoiceIfNeeded);
el.micVolume.addEventListener("input", updateMicGain);
el.masterVolume.addEventListener("input", updateAllVolumes);

function loadSettings() {
  el.appId.value = localStorage.getItem("pm.appId") || DEFAULT_APP_ID;
  el.name.value = localStorage.getItem("pm.name") || `User${Math.floor(Math.random() * 1000)}`;
  el.region.value = localStorage.getItem("pm.region") || "EU";
}

function saveSettings() {
  localStorage.setItem("pm.appId", el.appId.value.trim());
  localStorage.setItem("pm.name", el.name.value.trim());
  localStorage.setItem("pm.region", el.region.value);
}

async function refreshDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return;
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  fillDeviceSelect(el.mic, devices.filter((device) => device.kind === "audioinput"), "Системный микрофон");
  fillDeviceSelect(el.speaker, devices.filter((device) => device.kind === "audiooutput"), "Системные наушники/динамики");
}

function fillDeviceSelect(select, devices, fallback) {
  const previous = select.value;
  select.innerHTML = `<option value="">${fallback}</option>`;
  for (const device of devices) {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.textContent = device.label || `${fallback} ${select.length}`;
    select.appendChild(option);
  }
  select.value = previous;
}

function connect() {
  const appId = el.appId.value.trim();
  const nickname = el.name.value.trim();
  if (!appId) {
    addSystem("Вставь Photon App ID.");
    return;
  }
  if (!nickname) {
    addSystem("Введи имя.");
    return;
  }
  saveSettings();

  const Photon = window.Photon;
  const LBC = Photon.LoadBalancing.LoadBalancingClient;
  const client = new LBC(Photon.ConnectionProtocol.Wss, appId, APP_VERSION);
  state.client = client;
  client.myActor().setName(nickname);

  client.onStateChange = function (clientState) {
    const name = LBC.StateToName(clientState);
    setStatus(name);
    if (clientState === LBC.State.JoinedLobby) {
      this.joinRoom(ROOM_NAME, { createIfNotExists: true }, { maxPlayers: 32, isVisible: true, isOpen: true });
    }
    if (clientState === LBC.State.Joined) {
      state.joined = true;
      setConnectedUi(true);
      syncMembers();
      addSystem("Подключено к главному каналу.");
    }
    if (clientState === LBC.State.Disconnected) {
      cleanupConnection();
      addSystem("Отключено.");
    }
  };

  client.onError = function (code, message) {
    addSystem(`Ошибка Photon: ${code} ${message}`);
  };

  client.onOperationResponse = function (errorCode, errorMessage) {
    if (errorCode) {
      addSystem(`Операция не выполнена: ${errorCode} ${errorMessage || ""}`);
    }
  };

  client.onActorJoin = function (actor) {
    state.members.set(actor.actorNr, actor.name || `User ${actor.actorNr}`);
    renderMembers();
    if (state.voiceEnabled && actor.actorNr !== myActorNr()) {
      state.client.raiseEvent(EVENT_VOICE, { type: "ready", name: el.name.value.trim() }, { receivers: Photon.LoadBalancing.Constants.ReceiverGroup.All });
      ensurePeer(actor.actorNr, myActorNr() > actor.actorNr);
    }
  };

  client.onActorLeave = function (actor) {
    closePeer(actor.actorNr);
    state.members.delete(actor.actorNr);
    renderMembers();
  };

  client.onEvent = function (code, data, actorNr) {
    if (code === EVENT_TEXT) {
      addMessage(data.name || memberName(actorNr), data.text || "");
    }
    if (code === EVENT_SIGNAL) {
      handleSignal(actorNr, data).catch((error) => {
        addSystem(`Ошибка голосового соединения с ${memberName(actorNr)}: ${error.message}`);
      });
    }
    if (code === EVENT_VOICE) {
      handleVoiceEvent(actorNr, data);
    }
  };

  setStatus("Подключение к Photon...");
  client.connectToRegionMaster(el.region.value);
}

function disconnect() {
  stopVoice();
  if (state.client) {
    state.client.disconnect();
  }
  cleanupConnection();
}

function cleanupConnection() {
  state.joined = false;
  state.members.clear();
  state.voiceMembers.clear();
  state.speakingMembers.clear();
  for (const actorNr of state.peers.keys()) {
    closePeer(actorNr);
  }
  setConnectedUi(false);
  renderMembers();
}

function sendMessage(event) {
  event.preventDefault();
  const text = el.message.value.trim();
  if (!text) return;
  if (!state.joined) {
    addSystem("Сначала подключись к Photon.");
    return;
  }
  state.client.raiseEvent(
    EVENT_TEXT,
    { name: el.name.value.trim(), text },
    { receivers: Photon.LoadBalancing.Constants.ReceiverGroup.All }
  );
  el.message.value = "";
}

async function toggleVoice() {
  if (state.voiceEnabled) {
    stopVoice();
    return;
  }
  if (!state.joined) {
    addSystem("Сначала подключись к главному каналу.");
    return;
  }
  try {
    await startVoice();
  } catch (error) {
    addSystem(`Не удалось включить голос: ${error.message}`);
  }
}

async function startVoice() {
  const constraints = {
    audio: el.mic.value ? { deviceId: { exact: el.mic.value } } : true,
    video: false,
  };
  const rawStream = await navigator.mediaDevices.getUserMedia(constraints);
  state.rawStream = rawStream;
  await refreshDevices();

  state.audioContext = new AudioContext();
  const source = state.audioContext.createMediaStreamSource(rawStream);
  state.micGain = state.audioContext.createGain();
  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = 1024;
  const destination = state.audioContext.createMediaStreamDestination();
  source.connect(state.analyser);
  source.connect(state.micGain);
  state.micGain.connect(destination);
  state.localStream = destination.stream;
  updateMicGain();

  state.voiceEnabled = true;
  el.voice.textContent = "Выйти из голоса";
  state.voiceMembers.add(myActorNr());
  addSystem(`Голос включен. Микрофон: ${rawStream.getAudioTracks()[0]?.label || "выбранное устройство"}.`);
  state.client.raiseEvent(EVENT_VOICE, { type: "ready", name: el.name.value.trim() }, { receivers: Photon.LoadBalancing.Constants.ReceiverGroup.All });
  startSpeakingDetector();
  for (const actor of state.client.myRoomActorsArray()) {
    if (actor.actorNr !== myActorNr() && state.voiceMembers.has(actor.actorNr)) {
      ensurePeer(actor.actorNr, myActorNr() > actor.actorNr);
    }
  }
  renderMembers();
}

function stopVoice() {
  if (state.voiceEnabled && state.client?.isJoinedToRoom?.()) {
    state.client.raiseEvent(EVENT_VOICE, { type: "left" }, { receivers: Photon.LoadBalancing.Constants.ReceiverGroup.All });
  }
  state.voiceEnabled = false;
  el.voice.textContent = "Войти в голос";
  stopSpeakingDetector();
  for (const actorNr of state.peers.keys()) {
    closePeer(actorNr);
  }
  if (state.localStream) {
    state.localStream.getTracks().forEach((track) => track.stop());
    state.localStream = null;
  }
  if (state.rawStream) {
    state.rawStream.getTracks().forEach((track) => track.stop());
    state.rawStream = null;
  }
  if (state.audioContext) {
    state.audioContext.close();
    state.audioContext = null;
  }
  state.micGain = null;
  state.analyser = null;
  state.voiceMembers.delete(myActorNr());
  state.speakingMembers.delete(myActorNr());
  renderMembers();
}

async function restartVoiceIfNeeded() {
  if (!state.voiceEnabled) return;
  stopVoice();
  await startVoice();
}

function updateMicGain() {
  if (state.micGain) {
    state.micGain.gain.value = Number(el.micVolume.value) / 100;
  }
}

function ensurePeer(actorNr, politeInitiator) {
  if (state.peers.has(actorNr) || !state.voiceEnabled) {
    return state.peers.get(actorNr);
  }
  const peer = createPeer(actorNr);
  state.peers.set(actorNr, peer);
  for (const track of state.localStream.getTracks()) {
    peer.connection.addTrack(track, state.localStream);
  }
  if (politeInitiator) {
    makeOffer(actorNr);
  }
  return peer;
}

function createPeer(actorNr) {
  const connection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
  const audio = new Audio();
  audio.autoplay = true;
  audio.playsInline = true;
  audio.muted = false;
  audio.dataset.actor = String(actorNr);
  document.body.appendChild(audio);

  connection.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal(actorNr, { type: "candidate", candidate: event.candidate });
    }
  };
  connection.ontrack = (event) => {
    addSystem(`Получен голосовой поток от ${memberName(actorNr)}.`);
    audio.srcObject = event.streams[0];
    applyAudioOutput(audio);
    updateOneVolume(actorNr, audio);
    audio.play().catch(() => addSystem("Браузер заблокировал воспроизведение. Нажми кнопку «Включить звук»."));
    renderMembers();
  };
  connection.onconnectionstatechange = () => {
    addSystem(`Голос ${memberName(actorNr)}: ${connection.connectionState}.`);
    renderMembers();
    if (["failed", "closed", "disconnected"].includes(connection.connectionState)) {
      closePeer(actorNr);
    }
  };

  return { connection, audio, pendingCandidates: [] };
}

async function makeOffer(actorNr) {
  const peer = state.peers.get(actorNr);
  if (!peer) return;
  if (peer.connection.signalingState !== "stable") return;
  const offer = await peer.connection.createOffer();
  await peer.connection.setLocalDescription(offer);
  addSystem(`Отправлен запрос голоса для ${memberName(actorNr)}.`);
  sendSignal(actorNr, { type: "offer", sdp: offer });
}

async function handleSignal(actorNr, data) {
  if (!data || Number(data.to) !== Number(myActorNr())) return;
  if (!state.voiceEnabled) return;
  const peer = ensurePeer(actorNr, false);
  const connection = peer.connection;
  if (data.type === "offer") {
    addSystem(`Получен запрос голоса от ${memberName(actorNr)}.`);
    await connection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    await flushPendingCandidates(peer);
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    sendSignal(actorNr, { type: "answer", sdp: answer });
  }
  if (data.type === "answer") {
    addSystem(`Получен ответ голоса от ${memberName(actorNr)}.`);
    await connection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    await flushPendingCandidates(peer);
  }
  if (data.type === "candidate") {
    const candidate = new RTCIceCandidate(data.candidate);
    if (connection.remoteDescription) {
      await connection.addIceCandidate(candidate);
    } else {
      peer.pendingCandidates.push(candidate);
    }
  }
}

async function flushPendingCandidates(peer) {
  while (peer.pendingCandidates.length) {
    await peer.connection.addIceCandidate(peer.pendingCandidates.shift());
  }
}

function sendSignal(to, payload) {
  state.client.raiseEvent(EVENT_SIGNAL, { ...payload, to }, { receivers: Photon.LoadBalancing.Constants.ReceiverGroup.All });
}

function handleVoiceEvent(actorNr, data) {
  if (actorNr === myActorNr()) return;
  if (!data) return;
  if (data.type === "ready") {
    state.voiceMembers.add(actorNr);
    addSystem(`${memberName(actorNr)} вошел в голос.`);
    renderMembers();
    if (state.voiceEnabled) {
      ensurePeer(actorNr, myActorNr() > actorNr);
    }
  }
  if (data.type === "speaking") {
    if (data.value) {
      state.speakingMembers.add(actorNr);
    } else {
      state.speakingMembers.delete(actorNr);
    }
    renderMembers();
  }
  if (data.type === "left") {
    state.voiceMembers.delete(actorNr);
    state.speakingMembers.delete(actorNr);
    closePeer(actorNr);
    addSystem(`${memberName(actorNr)} вышел из голоса.`);
    renderMembers();
  }
}

function closePeer(actorNr) {
  const peer = state.peers.get(actorNr);
  if (!peer) return;
  peer.connection.close();
  peer.audio.remove();
  state.peers.delete(actorNr);
  renderMembers();
}

async function enableRemoteSound() {
  let started = 0;
  for (const peer of state.peers.values()) {
    try {
      peer.audio.muted = false;
      await peer.audio.play();
      started += 1;
    } catch (error) {
      addSystem(`Не удалось включить воспроизведение: ${error.message}`);
    }
  }
  if (started) {
    addSystem(`Воспроизведение включено для потоков: ${started}.`);
  } else {
    addSystem("Удаленных голосовых потоков пока нет. Проверь, что второй пользователь вошел в голос.");
  }
}

function updateAllVolumes() {
  for (const [actorNr, peer] of state.peers) {
    updateOneVolume(actorNr, peer.audio);
  }
}

function updateOneVolume(actorNr, audio) {
  const master = Number(el.masterVolume.value) / 100;
  const participant = state.volumes.get(actorNr) ?? 1;
  audio.volume = Math.max(0, Math.min(1, master * participant));
}

function applyAudioOutput(audio) {
  if (typeof audio.setSinkId === "function" && el.speaker.value) {
    audio.setSinkId(el.speaker.value).catch(() => {});
  }
}

function syncMembers() {
  state.members.clear();
  for (const actor of state.client.myRoomActorsArray()) {
    state.members.set(actor.actorNr, actor.name || `User ${actor.actorNr}`);
  }
  renderMembers();
}

function renderMembers() {
  el.members.innerHTML = "";
  for (const [actorNr, name] of state.members) {
    const row = document.createElement("div");
    row.className = "member";
    row.innerHTML = `
      <div class="member-name">
        <span>${escapeHtml(name)}${actorNr === myActorNr() ? " (ты)" : ""}</span>
        <span class="speaking-dot ${state.speakingMembers.has(actorNr) ? "active" : ""}" title="говорит"></span>
      </div>
      <small>${voiceLabel(actorNr)}</small>
    `;
    if (actorNr !== myActorNr()) {
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "0";
      slider.max = "200";
      slider.value = String((state.volumes.get(actorNr) ?? 1) * 100);
      slider.addEventListener("input", () => {
        state.volumes.set(actorNr, Number(slider.value) / 100);
        const peer = state.peers.get(actorNr);
        if (peer) updateOneVolume(actorNr, peer.audio);
      });
      row.appendChild(slider);
    }
    el.members.appendChild(row);
  }
}

function voiceLabel(actorNr) {
  if (actorNr === myActorNr()) {
    return state.voiceEnabled ? (state.speakingMembers.has(actorNr) ? "ты говоришь" : "ты в голосе") : "локальный пользователь";
  }
  if (!state.voiceMembers.has(actorNr)) {
    return "не в голосе";
  }
  const peer = state.peers.get(actorNr);
  const connection = peer?.connection.connectionState;
  if (state.speakingMembers.has(actorNr)) {
    return `говорит${connection ? `, связь: ${connection}` : ""}`;
  }
  return `в голосе${connection ? `, связь: ${connection}` : ""}`;
}

function startSpeakingDetector() {
  stopSpeakingDetector();
  if (!state.analyser) return;
  const data = new Uint8Array(state.analyser.fftSize);
  let lastSent = false;
  let lastChangeAt = 0;
  state.vadTimer = window.setInterval(() => {
    state.analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const value of data) {
      const centered = value - 128;
      sum += centered * centered;
    }
    const rms = Math.sqrt(sum / data.length) / 128;
    const now = Date.now();
    const isSpeaking = rms > 0.035;
    if (isSpeaking !== state.speaking && now - lastChangeAt > 120) {
      state.speaking = isSpeaking;
      lastChangeAt = now;
      if (isSpeaking) {
        state.speakingMembers.add(myActorNr());
      } else {
        state.speakingMembers.delete(myActorNr());
      }
      renderMembers();
    }
    if (state.speaking !== lastSent && state.client?.isJoinedToRoom?.()) {
      lastSent = state.speaking;
      state.client.raiseEvent(
        EVENT_VOICE,
        { type: "speaking", value: state.speaking },
        { receivers: Photon.LoadBalancing.Constants.ReceiverGroup.All }
      );
    }
  }, 80);
}

function stopSpeakingDetector() {
  if (state.vadTimer) {
    window.clearInterval(state.vadTimer);
    state.vadTimer = null;
  }
  if (state.speaking && state.client?.isJoinedToRoom?.()) {
    state.client.raiseEvent(EVENT_VOICE, { type: "speaking", value: false }, { receivers: Photon.LoadBalancing.Constants.ReceiverGroup.All });
  }
  state.speaking = false;
}

function memberName(actorNr) {
  return state.members.get(actorNr) || `User ${actorNr}`;
}

function myActorNr() {
  return state.client?.myActor()?.actorNr;
}

function setConnectedUi(connected) {
  el.connect.disabled = connected;
  el.disconnect.disabled = !connected;
  el.voice.disabled = !connected;
  el.enableSound.disabled = !connected;
  el.message.disabled = !connected;
  el.badge.textContent = connected ? "online" : "offline";
  el.badge.classList.toggle("online", connected);
}

function setStatus(text) {
  el.status.textContent = text;
}

function addSystem(text) {
  addMessage("Система", text, true);
}

function addMessage(author, text, system = false) {
  const item = document.createElement("div");
  item.className = `message${system ? " system" : ""}`;
  item.innerHTML = `<div class="author">${escapeHtml(author)}</div><div>${escapeHtml(text)}</div>`;
  el.messages.appendChild(item);
  el.messages.scrollTop = el.messages.scrollHeight;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}
