const ROOM_NAME = "main";
const EVENT_TEXT = 1;
const EVENT_DELETE_MESSAGE = 2;
const APP_VERSION = "0.2.0";
const DEFAULT_APP_ID = "b6089b21-fad4-43a9-93e0-7b12f683313e";
const LIVEKIT_SANDBOX_ID = "fenegram-2i209g";
const NAME_CHANGE_INTERVAL = 24 * 60 * 60 * 1000;
const CHAT_HISTORY_KEY = "pm.chatHistory";
const CHAT_HISTORY_LIMIT = 100;

const state = {
  client: null,
  joined: false,
  members: new Map(),
  volumes: new Map(),
  livekitRoom: null,
  voiceEnabled: false,
  voiceParticipants: new Map(),
  speakingNames: new Set(),
  audioElements: new Map(),
  rawStream: null,
  audioContext: null,
  micGain: null,
  analyser: null,
  localOutputTrack: null,
  localPublication: null,
  deviceTestRunning: false,
  connecting: false,
  micMuted: false,
  deafened: false,
  cameraEnabled: false,
  screenShareEnabled: false,
  videoTiles: new Map(),
  seenMessageIds: new Set(),
  clientId: "",
};

const el = {
  appId: document.querySelector("#appIdInput"),
  unlockAppId: document.querySelector("#unlockAppIdInput"),
  name: document.querySelector("#nameInput"),
  region: document.querySelector("#regionInput"),
  saveSettings: document.querySelector("#saveSettingsBtn"),
  nameChangeHint: document.querySelector("#nameChangeHint"),
  channelTab: document.querySelector("#channelTabBtn"),
  systemTab: document.querySelector("#systemTabBtn"),
  settingsTab: document.querySelector("#settingsTabBtn"),
  channelView: document.querySelector("#channelView"),
  systemView: document.querySelector("#systemView"),
  settingsView: document.querySelector("#settingsView"),
  voice: document.querySelector("#voiceBtn"),
  mute: document.querySelector("#muteBtn"),
  deafen: document.querySelector("#deafenBtn"),
  camera: document.querySelector("#cameraBtn"),
  screenShare: document.querySelector("#screenShareBtn"),
  voiceStatus: document.querySelector("#voiceStatus"),
  status: document.querySelector("#statusText"),
  badge: document.querySelector("#connectionBadge"),
  messages: document.querySelector("#messages"),
  videoStage: document.querySelector("#videoStage"),
  videoGrid: document.querySelector("#videoGrid"),
  systemMessages: document.querySelector("#systemMessages"),
  form: document.querySelector("#messageForm"),
  message: document.querySelector("#messageInput"),
  members: document.querySelector("#membersList"),
  mic: document.querySelector("#micSelect"),
  speaker: document.querySelector("#speakerSelect"),
  cameraSelect: document.querySelector("#cameraSelect"),
  testMic: document.querySelector("#testMicBtn"),
  testSpeaker: document.querySelector("#testSpeakerBtn"),
  deviceTestStatus: document.querySelector("#deviceTestStatus"),
  masterVolume: document.querySelector("#masterVolume"),
  micVolume: document.querySelector("#micVolume"),
  videoQuality: document.querySelector("#videoQuality"),
  videoQualityLabel: document.querySelector("#videoQualityLabel"),
};

loadSettings();
loadChatHistory();
refreshDevices();
setConnectedUi(false);
updateNameChangeUi();
window.setTimeout(connect, 100);

el.channelTab.addEventListener("click", () => showView("channel"));
el.systemTab.addEventListener("click", () => showView("system"));
el.settingsTab.addEventListener("click", () => showView("settings"));
el.unlockAppId.addEventListener("change", () => {
  el.appId.disabled = !el.unlockAppId.checked;
});
el.saveSettings.addEventListener("click", saveUserSettings);
el.voice.addEventListener("click", toggleVoice);
el.mute.addEventListener("click", toggleMute);
el.deafen.addEventListener("click", toggleDeafen);
el.camera.addEventListener("click", toggleCamera);
el.screenShare.addEventListener("click", toggleScreenShare);
el.form.addEventListener("submit", sendMessage);
el.mic.addEventListener("change", () => {
  localStorage.setItem("pm.micDevice", el.mic.value);
  restartVoiceIfNeeded();
});
el.speaker.addEventListener("change", () => {
  localStorage.setItem("pm.speakerDevice", el.speaker.value);
  changeAudioOutput();
});
el.cameraSelect.addEventListener("change", changeCamera);
el.testMic.addEventListener("click", testMicrophone);
el.testSpeaker.addEventListener("click", testSpeaker);
el.micVolume.addEventListener("input", updateMicGain);
el.masterVolume.addEventListener("input", updateAllVolumes);
el.videoQuality.addEventListener("input", updateVideoQuality);

function loadSettings() {
  state.clientId = localStorage.getItem("pm.clientId") || crypto.randomUUID();
  localStorage.setItem("pm.clientId", state.clientId);
  el.appId.value = localStorage.getItem("pm.appId") || DEFAULT_APP_ID;
  let nickname = localStorage.getItem("pm.name");
  if (!nickname) {
    nickname = `User${Math.floor(Math.random() * 1000)}`;
    localStorage.setItem("pm.name", nickname);
  }
  el.name.value = nickname;
  el.region.value = localStorage.getItem("pm.region") || "EU";
  el.masterVolume.value = localStorage.getItem("pm.masterVolume") || "100";
  el.micVolume.value = localStorage.getItem("pm.micVolume") || "100";
  el.videoQuality.value = localStorage.getItem("pm.videoQuality") || "2";
  updateVideoQualityLabel();
}

function persistSettings() {
  localStorage.setItem("pm.appId", el.appId.value.trim());
  localStorage.setItem("pm.name", el.name.value.trim());
  localStorage.setItem("pm.region", el.region.value);
  localStorage.setItem("pm.masterVolume", el.masterVolume.value);
  localStorage.setItem("pm.micVolume", el.micVolume.value);
  localStorage.setItem("pm.videoQuality", el.videoQuality.value);
}

function persistAudioSettings() {
  localStorage.setItem("pm.masterVolume", el.masterVolume.value);
  localStorage.setItem("pm.micVolume", el.micVolume.value);
  localStorage.setItem("pm.videoQuality", el.videoQuality.value);
}

async function refreshDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const devices = await navigator.mediaDevices.enumerateDevices();
  fillDeviceSelect(el.mic, devices.filter((device) => device.kind === "audioinput"), "Системный микрофон");
  fillDeviceSelect(el.speaker, devices.filter((device) => device.kind === "audiooutput"), "Системные наушники/динамики");
  fillDeviceSelect(el.cameraSelect, devices.filter((device) => device.kind === "videoinput"), "Системная камера");
}

function fillDeviceSelect(select, devices, fallback) {
  const storageKey = select === el.mic ? "pm.micDevice" : select === el.speaker ? "pm.speakerDevice" : "pm.cameraDevice";
  const previous = select.value || localStorage.getItem(storageKey) || "";
  select.innerHTML = `<option value="">${fallback}</option>`;
  for (const device of devices) {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.textContent = device.label || `${fallback} ${select.length}`;
    select.appendChild(option);
  }
  if ([...select.options].some((option) => option.value === previous)) {
    select.value = previous;
  }
}

function showView(view) {
  const settings = view === "settings";
  const system = view === "system";
  el.channelView.hidden = settings || system;
  el.systemView.hidden = !system;
  el.settingsView.hidden = !settings;
  el.channelTab.classList.toggle("active", !settings && !system);
  el.systemTab.classList.toggle("active", system);
  el.settingsTab.classList.toggle("active", settings);
}

function saveUserSettings() {
  const nickname = el.name.value.trim();
  const appId = el.appId.value.trim();
  const oldName = localStorage.getItem("pm.name") || "";
  const oldAppId = localStorage.getItem("pm.appId") || DEFAULT_APP_ID;
  const oldRegion = localStorage.getItem("pm.region") || "EU";

  if (!nickname) {
    setDeviceTestStatus("Ник не может быть пустым.");
    return;
  }
  if (!appId) {
    setDeviceTestStatus("Photon App ID не может быть пустым.");
    return;
  }
  if (nickname !== oldName && !canChangeName()) {
    el.name.value = oldName;
    updateNameChangeUi();
    return;
  }

  if (nickname !== oldName) {
    localStorage.setItem("pm.nameChangedAt", String(Date.now()));
  }
  persistSettings();
  el.unlockAppId.checked = false;
  el.appId.disabled = true;
  updateNameChangeUi();
  setDeviceTestStatus("Настройки сохранены.");

  if (nickname !== oldName || appId !== oldAppId || el.region.value !== oldRegion) {
    reconnectTextChat();
  }
}

function canChangeName() {
  const changedAt = Number(localStorage.getItem("pm.nameChangedAt") || 0);
  return !changedAt || Date.now() - changedAt >= NAME_CHANGE_INTERVAL;
}

function updateNameChangeUi() {
  const changedAt = Number(localStorage.getItem("pm.nameChangedAt") || 0);
  const remaining = NAME_CHANGE_INTERVAL - (Date.now() - changedAt);
  if (!changedAt || remaining <= 0) {
    el.name.disabled = false;
    el.nameChangeHint.textContent = "Ник можно изменить один раз в сутки.";
    return;
  }
  const hours = Math.ceil(remaining / (60 * 60 * 1000));
  el.name.disabled = true;
  el.nameChangeHint.textContent = `Следующая смена ника будет доступна примерно через ${hours} ч.`;
}

function reconnectTextChat() {
  stopVoice();
  if (state.client) state.client.disconnect();
  cleanupConnection();
  window.setTimeout(connect, 250);
}

function connect() {
  if (state.joined || state.connecting) return;
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
  persistSettings();
  state.connecting = true;

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
      state.connecting = false;
      state.joined = true;
      setConnectedUi(true);
      syncMembers();
      addSystem("Подключено к главному каналу.");
    }
    if (clientState === LBC.State.Disconnected) {
      state.connecting = false;
      cleanupConnection();
      addSystem("Отключено.");
    }
  };

  client.onError = function (code, message) {
    state.connecting = false;
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
  };

  client.onActorLeave = function (actor) {
    state.members.delete(actor.actorNr);
    renderMembers();
  };

  client.onEvent = function (code, data, actorNr) {
    if (code === EVENT_TEXT) {
      receiveChatMessage(data, actorNr);
    }
    if (code === EVENT_DELETE_MESSAGE) {
      receiveDeleteMessage(data);
    }
  };

  setStatus("Подключение к Photon...");
  client.connectToRegionMaster(el.region.value);
}

function disconnect() {
  stopVoice();
  if (state.client) state.client.disconnect();
  cleanupConnection();
}

function cleanupConnection() {
  state.connecting = false;
  state.joined = false;
  state.members.clear();
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
    { id: crypto.randomUUID(), senderId: state.clientId, name: el.name.value.trim(), text, time: Date.now() },
    { receivers: window.Photon.LoadBalancing.Constants.ReceiverGroup.All }
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
    stopVoice();
    addSystem(`Не удалось включить голос LiveKit: ${error.message}`);
  }
}

async function startVoice() {
  if (!window.LivekitClient) {
    throw new Error("библиотека LiveKit не загрузилась");
  }

  const nickname = el.name.value.trim();
  const identity = `user-${crypto.randomUUID().slice(0, 8)}`;
  const tokenSource = window.LivekitClient.TokenSource.sandboxTokenServer(LIVEKIT_SANDBOX_ID);
  const credentials = await tokenSource.fetch({
    roomName: ROOM_NAME,
    participantIdentity: identity,
    participantName: nickname,
  });

  const room = new window.LivekitClient.Room({
    adaptiveStream: true,
    dynacast: true,
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  state.livekitRoom = room;
  bindLiveKitEvents(room);
  room.startAudio().catch(() => {});

  addSystem("Подключение к голосовому серверу LiveKit...");
  await room.connect(credentials.serverUrl, credentials.participantToken);
  await publishMicrophone(room);

  state.voiceEnabled = true;
  state.micMuted = false;
  state.deafened = false;
  el.voice.textContent = "Выйти из голоса";
  updateVoiceControls();
  syncVoiceParticipants();
  await refreshDevices();
  renderMembers();
  addSystem("Голос включен через LiveKit.");
}

function bindLiveKitEvents(room) {
  const events = window.LivekitClient.RoomEvent;

  room.on(events.ParticipantConnected, (participant) => {
    state.voiceParticipants.set(participant.identity, participantName(participant));
    addSystem(`${participantName(participant)} вошел в голос.`);
    renderMembers();
  });

  room.on(events.ParticipantDisconnected, (participant) => {
    state.voiceParticipants.delete(participant.identity);
    removeParticipantAudio(participant.identity);
    addSystem(`${participantName(participant)} вышел из голоса.`);
    renderMembers();
  });

  room.on(events.TrackSubscribed, (track, publication, participant) => {
    if (track.kind === window.LivekitClient.Track.Kind.Audio) {
      attachAudioTrack(track, publication, participant);
      return;
    }
    if (track.kind === window.LivekitClient.Track.Kind.Video) {
      applyPublicationVideoQuality(publication);
      attachVideoTrack(track, publication, participant, false);
    }
  });

  room.on(events.TrackUnsubscribed, (track, publication) => {
    const key = publication.trackSid || track.sid;
    if (track.kind === window.LivekitClient.Track.Kind.Audio) removeAudioTrack(key);
    if (track.kind === window.LivekitClient.Track.Kind.Video) removeVideoTile(key);
    track.detach().forEach((element) => element.remove());
  });

  room.on(events.LocalTrackPublished, (publication, participant) => {
    const track = publication.track;
    if (track?.kind === window.LivekitClient.Track.Kind.Video) {
      attachVideoTrack(track, publication, participant, true);
    }
  });

  room.on(events.LocalTrackUnpublished, (publication) => {
    removeVideoTile(publication.trackSid);
    if (publication.source === window.LivekitClient.Track.Source.Camera) state.cameraEnabled = false;
    if (publication.source === window.LivekitClient.Track.Source.ScreenShare) state.screenShareEnabled = false;
    updateVoiceControls();
  });

  room.on(events.ActiveSpeakersChanged, (speakers) => {
    state.speakingNames = new Set(speakers.map(participantName));
    renderMembers();
  });

  room.on(events.AudioPlaybackStatusChanged, () => {
    if (!room.canPlaybackAudio) {
      addSystem("Браузер заблокировал звук. Нажми любую кнопку в Fenegram и войди в голос заново.");
    }
  });

  room.on(events.MediaDevicesChanged, refreshDevices);
  room.on(events.MediaDevicesError, (error) => addSystem(`Ошибка аудиоустройства: ${error.message}`));
  room.on(events.Reconnecting, () => addSystem("LiveKit переподключает голос..."));
  room.on(events.Reconnected, () => addSystem("Голос LiveKit переподключен."));
  room.on(events.Disconnected, () => {
    if (state.voiceEnabled) addSystem("Голос LiveKit отключен.");
    cleanupVoice();
  });
}

async function publishMicrophone(room) {
  const constraints = {
    audio: {
      deviceId: el.mic.value ? { exact: el.mic.value } : undefined,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  };
  const rawStream = await navigator.mediaDevices.getUserMedia(constraints);
  state.rawStream = rawStream;

  state.audioContext = new AudioContext();
  await state.audioContext.resume();
  const source = state.audioContext.createMediaStreamSource(rawStream);
  state.micGain = state.audioContext.createGain();
  state.analyser = state.audioContext.createAnalyser();
  const destination = state.audioContext.createMediaStreamDestination();
  source.connect(state.analyser);
  source.connect(state.micGain);
  state.micGain.connect(destination);
  updateMicGain();

  state.localOutputTrack = destination.stream.getAudioTracks()[0];
  state.localPublication = await room.localParticipant.publishTrack(state.localOutputTrack, {
    source: window.LivekitClient.Track.Source.Microphone,
    name: "microphone",
  });
}

function stopVoice() {
  const room = state.livekitRoom;
  if (room && state.localOutputTrack) {
    room.localParticipant.unpublishTrack(state.localOutputTrack, true).catch(() => {});
  }
  if (room) room.disconnect();
  cleanupVoice();
}

function cleanupVoice() {
  state.voiceEnabled = false;
  state.micMuted = false;
  state.deafened = false;
  state.cameraEnabled = false;
  state.screenShareEnabled = false;
  el.voice.textContent = "Войти в голос";
  state.voiceParticipants.clear();
  state.speakingNames.clear();
  for (const audio of state.audioElements.values()) audio.remove();
  state.audioElements.clear();
  for (const key of state.videoTiles.keys()) removeVideoTile(key);
  if (state.rawStream) state.rawStream.getTracks().forEach((track) => track.stop());
  if (state.localOutputTrack) state.localOutputTrack.stop();
  if (state.audioContext) state.audioContext.close().catch(() => {});
  state.rawStream = null;
  state.localOutputTrack = null;
  state.localPublication = null;
  state.audioContext = null;
  state.micGain = null;
  state.analyser = null;
  state.livekitRoom = null;
  updateVoiceControls();
  renderMembers();
}

async function restartVoiceIfNeeded() {
  if (!state.voiceEnabled) return;
  stopVoice();
  try {
    await startVoice();
  } catch (error) {
    stopVoice();
    addSystem(`Не удалось сменить микрофон: ${error.message}`);
  }
}

function updateMicGain() {
  persistAudioSettings();
  if (state.micGain) {
    state.micGain.gain.value = Number(el.micVolume.value) / 100;
  }
}

function attachAudioTrack(track, publication, participant) {
  const key = publication.trackSid || track.sid || `${participant.identity}-${Date.now()}`;
  removeAudioTrack(key);
  const audio = track.attach();
  audio.autoplay = true;
  audio.playsInline = true;
  audio.dataset.participantIdentity = participant.identity;
  audio.dataset.participantName = participantName(participant);
  audio.muted = state.deafened;
  document.body.appendChild(audio);
  state.audioElements.set(key, audio);
  applyAudioOutput(audio);
  updateOneVolume(participantName(participant), audio);
  audio.play().catch(() => {});
  renderMembers();
}

function removeAudioTrack(key) {
  const audio = state.audioElements.get(key);
  if (!audio) return;
  audio.remove();
  state.audioElements.delete(key);
}

function removeParticipantAudio(identity) {
  for (const [key, audio] of state.audioElements) {
    if (audio.dataset.participantIdentity === identity) removeAudioTrack(key);
  }
}

async function toggleMute() {
  if (!state.voiceEnabled || !state.localPublication) return;
  if (state.deafened) return;
  state.micMuted = !state.micMuted;
  await applyMicrophoneMute();
  updateVoiceControls();
  renderMembers();
}

async function toggleDeafen() {
  if (!state.voiceEnabled) return;
  if (!state.deafened) {
    state.deafened = true;
    state.micMuted = true;
  } else {
    state.deafened = false;
    state.micMuted = false;
  }
  await applyMicrophoneMute();
  for (const audio of state.audioElements.values()) {
    audio.muted = state.deafened;
    if (!state.deafened) audio.play().catch(() => {});
  }
  updateVoiceControls();
  renderMembers();
}

async function applyMicrophoneMute() {
  if (!state.localPublication) return;
  if (state.micMuted) {
    await state.localPublication.mute();
  } else {
    await state.localPublication.unmute();
  }
}

function updateVoiceControls() {
  el.mute.disabled = !state.voiceEnabled || state.deafened;
  el.deafen.disabled = !state.voiceEnabled;
  el.camera.disabled = !state.voiceEnabled;
  el.screenShare.disabled = !state.voiceEnabled;
  el.mute.textContent = state.micMuted ? "Включить микрофон" : "Выключить микрофон";
  el.deafen.textContent = state.deafened ? "Включить звук и микрофон" : "Выключить звук и микрофон";
  el.camera.textContent = state.cameraEnabled ? "Выключить камеру" : "Включить камеру";
  el.screenShare.textContent = state.screenShareEnabled ? "Остановить демонстрацию" : "Показать экран";
  if (!state.voiceEnabled) {
    el.voiceStatus.textContent = "Не в голосовом канале";
  } else if (state.deafened) {
    el.voiceStatus.textContent = "Звук и микрофон выключены";
  } else if (state.micMuted) {
    el.voiceStatus.textContent = "Микрофон выключен";
  } else {
    el.voiceStatus.textContent = "В голосовом канале";
  }
}

async function toggleCamera() {
  const room = state.livekitRoom;
  if (!room) return;
  try {
    const next = !state.cameraEnabled;
    await room.localParticipant.setCameraEnabled(next, {
      deviceId: el.cameraSelect.value || undefined,
    });
    state.cameraEnabled = next;
    await refreshDevices();
    updateVoiceControls();
    addSystem(next ? "Камера включена." : "Камера выключена.");
  } catch (error) {
    addSystem(`Не удалось переключить камеру: ${error.message}`);
  }
}

async function toggleScreenShare() {
  const room = state.livekitRoom;
  if (!room) return;
  try {
    const next = !state.screenShareEnabled;
    await room.localParticipant.setScreenShareEnabled(next, {
      audio: true,
    });
    state.screenShareEnabled = next;
    updateVoiceControls();
    addSystem(next ? "Демонстрация экрана включена." : "Демонстрация экрана остановлена.");
  } catch (error) {
    addSystem(`Не удалось переключить демонстрацию экрана: ${error.message}`);
  }
}

async function changeCamera() {
  localStorage.setItem("pm.cameraDevice", el.cameraSelect.value);
  if (!state.cameraEnabled || !state.livekitRoom || !el.cameraSelect.value) return;
  try {
    await state.livekitRoom.switchActiveDevice("videoinput", el.cameraSelect.value);
  } catch (error) {
    addSystem(`Не удалось сменить камеру: ${error.message}`);
  }
}

function attachVideoTrack(track, publication, participant, isLocal) {
  const key = publication.trackSid || track.sid || `${participant.identity}-${Date.now()}`;
  removeVideoTile(key);
  const video = track.attach();
  video.autoplay = true;
  video.playsInline = true;
  video.muted = isLocal;

  const tile = document.createElement("article");
  tile.className = "video-tile";
  const footer = document.createElement("div");
  footer.className = "video-tile-footer";
  const source = publication.source === window.LivekitClient.Track.Source.ScreenShare ? "демонстрация" : "камера";
  const label = document.createElement("span");
  label.textContent = `${participantName(participant)}${isLocal ? " (ты)" : ""}: ${source}`;
  const restart = document.createElement("button");
  restart.type = "button";
  restart.textContent = "Перезапустить";
  restart.addEventListener("click", () => restartVideoPublication(publication, track, participant, isLocal));
  footer.append(label, restart);
  tile.append(video, footer);
  el.videoGrid.appendChild(tile);
  state.videoTiles.set(key, { tile, video, track, publication, participant, isLocal });
  el.videoStage.hidden = false;
}

function removeVideoTile(key) {
  const entry = state.videoTiles.get(key);
  if (!entry) return;
  entry.track.detach().forEach((element) => element.remove());
  entry.tile.remove();
  state.videoTiles.delete(key);
  el.videoStage.hidden = state.videoTiles.size === 0;
}

async function restartVideoPublication(publication, track, participant, isLocal) {
  const key = publication.trackSid || track.sid;
  try {
    if (!isLocal && typeof publication.setEnabled === "function") {
      publication.setEnabled(false);
      await wait(250);
      publication.setEnabled(true);
      applyPublicationVideoQuality(publication);
    }
    removeVideoTile(key);
    await wait(100);
    if (publication.track) attachVideoTrack(publication.track, publication, participant, isLocal);
    addSystem(`Видео ${participantName(participant)} перезапущено.`);
  } catch (error) {
    addSystem(`Не удалось перезапустить видео: ${error.message}`);
  }
}

function updateVideoQuality() {
  localStorage.setItem("pm.videoQuality", el.videoQuality.value);
  updateVideoQualityLabel();
  const room = state.livekitRoom;
  if (!room) return;
  for (const participant of room.remoteParticipants.values()) {
    for (const publication of participant.videoTrackPublications.values()) {
      applyPublicationVideoQuality(publication);
    }
  }
}

function updateVideoQualityLabel() {
  const labels = { "1": "Низкое качество", "2": "Среднее качество", "3": "Высокое качество" };
  el.videoQualityLabel.textContent = labels[el.videoQuality.value] || labels["2"];
}

function applyPublicationVideoQuality(publication) {
  if (typeof publication.setVideoQuality !== "function") return;
  const quality = {
    "1": 0,
    "2": 1,
    "3": 2,
  }[el.videoQuality.value];
  publication.setVideoQuality(quality);
}

async function changeAudioOutput() {
  const room = state.livekitRoom;
  if (room && el.speaker.value) {
    try {
      await room.switchActiveDevice("audiooutput", el.speaker.value);
    } catch {
      // Some mobile browsers do not support selecting an output device.
    }
  }
  for (const audio of state.audioElements.values()) applyAudioOutput(audio);
}

async function testSpeaker() {
  if (state.deviceTestRunning) return;
  setDeviceTestRunning(true, "Проверка наушников...");
  let context;
  let audio;
  try {
    context = new AudioContext();
    context.resume().catch(() => {});
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const destination = context.createMediaStreamDestination();
    oscillator.type = "sine";
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.65);
    oscillator.connect(gain);
    gain.connect(destination);

    audio = new Audio();
    audio.srcObject = destination.stream;
    audio.volume = Math.max(0, Math.min(1, Number(el.masterVolume.value) / 100));
    await applyAudioOutputAndWait(audio);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.7);
    audio.play().catch(() => {});
    await wait(850);
    setDeviceTestStatus("Если ты услышал сигнал, наушники работают.");
  } catch (error) {
    setDeviceTestStatus(`Не удалось проверить наушники: ${error.message}`);
  } finally {
    if (audio) {
      audio.pause();
      audio.srcObject = null;
    }
    if (context) await context.close().catch(() => {});
    setDeviceTestRunning(false);
  }
}

async function testMicrophone() {
  if (state.deviceTestRunning) return;
  if (!window.MediaRecorder) {
    setDeviceTestStatus("Этот браузер не поддерживает запись для проверки микрофона.");
    return;
  }
  setDeviceTestRunning(true, "Говори 3 секунды...");
  let stream;
  let playback;
  let objectUrl;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: el.mic.value ? { exact: el.mic.value } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });
    await refreshDevices();
    const chunks = [];
    const recorder = new MediaRecorder(stream);
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) chunks.push(event.data);
    });
    const stopped = new Promise((resolve) => recorder.addEventListener("stop", resolve, { once: true }));
    recorder.start();
    await wait(3000);
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    stream = null;

    setDeviceTestStatus("Сейчас должна проиграться твоя запись...");
    const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    objectUrl = URL.createObjectURL(blob);
    playback = new Audio(objectUrl);
    playback.volume = Math.max(0, Math.min(1, Number(el.masterVolume.value) / 100));
    await applyAudioOutputAndWait(playback);
    await playback.play();
    await new Promise((resolve) => {
      playback.addEventListener("ended", resolve, { once: true });
      window.setTimeout(resolve, 5000);
    });
    setDeviceTestStatus("Если ты услышал себя, микрофон работает.");
  } catch (error) {
    setDeviceTestStatus(`Не удалось проверить микрофон: ${error.message}`);
  } finally {
    if (stream) stream.getTracks().forEach((track) => track.stop());
    if (playback) playback.pause();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setDeviceTestRunning(false);
  }
}

function setDeviceTestRunning(running, status) {
  state.deviceTestRunning = running;
  el.testMic.disabled = running;
  el.testSpeaker.disabled = running;
  if (status) setDeviceTestStatus(status);
}

function setDeviceTestStatus(text) {
  el.deviceTestStatus.textContent = text;
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function applyAudioOutputAndWait(audio) {
  if (typeof audio.setSinkId === "function" && el.speaker.value) {
    await audio.setSinkId(el.speaker.value);
  }
}

function updateAllVolumes() {
  persistAudioSettings();
  for (const audio of state.audioElements.values()) {
    updateOneVolume(audio.dataset.participantName, audio);
  }
}

function updateOneVolume(name, audio) {
  const master = Number(el.masterVolume.value) / 100;
  const participant = state.volumes.get(name) ?? 1;
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

function syncVoiceParticipants() {
  const room = state.livekitRoom;
  if (!room) return;
  state.voiceParticipants.clear();
  state.voiceParticipants.set(room.localParticipant.identity, participantName(room.localParticipant));
  for (const participant of room.remoteParticipants.values()) {
    state.voiceParticipants.set(participant.identity, participantName(participant));
  }
}

function renderMembers() {
  el.members.innerHTML = "";
  const renderedNames = new Set();
  for (const [actorNr, name] of state.members) {
    renderMemberRow(name, actorNr === myActorNr(), renderedNames);
  }
  for (const name of state.voiceParticipants.values()) {
    if (!renderedNames.has(name)) renderMemberRow(name, name === el.name.value.trim(), renderedNames);
  }
}

function renderMemberRow(name, isLocal, renderedNames) {
  renderedNames.add(name);
  const row = document.createElement("div");
  row.className = "member";
  row.innerHTML = `
    <div class="member-name">
      <span>${escapeHtml(name)}${isLocal ? " (ты)" : ""}</span>
      <span class="speaking-dot ${state.speakingNames.has(name) ? "active" : ""}" title="говорит"></span>
    </div>
    <small>${voiceLabel(name, isLocal)}</small>
  `;
  if (!isLocal) {
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "200";
    slider.value = String((state.volumes.get(name) ?? 1) * 100);
    slider.addEventListener("input", () => {
      state.volumes.set(name, Number(slider.value) / 100);
      for (const audio of state.audioElements.values()) {
        if (audio.dataset.participantName === name) updateOneVolume(name, audio);
      }
    });
    row.appendChild(slider);
  }
  el.members.appendChild(row);
}

function voiceLabel(name, isLocal) {
  const inVoice = [...state.voiceParticipants.values()].includes(name);
  const speaking = state.speakingNames.has(name);
  if (isLocal) {
    if (!inVoice) return "не в голосе";
    if (state.deafened) return "звук и микрофон выключены";
    if (state.micMuted) return "микрофон выключен";
    return speaking ? "ты говоришь" : "ты в голосе";
  }
  if (!inVoice) return "не в голосе";
  return speaking ? "говорит" : "в голосе";
}

function participantName(participant) {
  return participant.name || participant.identity || "Участник";
}

function memberName(actorNr) {
  return state.members.get(actorNr) || `User ${actorNr}`;
}

function myActorNr() {
  return state.client?.myActor()?.actorNr;
}

function setConnectedUi(connected) {
  el.voice.disabled = !connected;
  el.message.disabled = !connected;
  el.badge.textContent = connected ? "online" : "offline";
  el.badge.classList.toggle("online", connected);
  updateVoiceControls();
}

function setStatus(text) {
  el.status.textContent = text;
}

function loadChatHistory() {
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || "[]");
  } catch {
    history = [];
  }
  for (const message of history.slice(-CHAT_HISTORY_LIMIT)) {
    if (message.id) state.seenMessageIds.add(message.id);
    addChatMessage(message);
  }
}

function receiveChatMessage(data, actorNr) {
  const message = {
    id: data?.id || `${actorNr}-${data?.time || Date.now()}-${data?.text || ""}`,
    senderId: data?.senderId || "",
    name: data?.name || memberName(actorNr),
    text: data?.text || "",
    time: data?.time || Date.now(),
    own: actorNr === myActorNr() || data?.senderId === state.clientId,
  };
  if (state.seenMessageIds.has(message.id)) return;
  state.seenMessageIds.add(message.id);
  addChatMessage(message);
  saveChatMessage(message);
}

function receiveDeleteMessage(data) {
  const messageId = data?.id;
  if (!messageId) return;
  removeChatMessage(messageId);
}

function deleteOwnMessage(messageId) {
  if (!state.joined) return;
  removeChatMessage(messageId);
  state.client.raiseEvent(
    EVENT_DELETE_MESSAGE,
    { id: messageId },
    { receivers: window.Photon.LoadBalancing.Constants.ReceiverGroup.All }
  );
}

function removeChatMessage(messageId) {
  const item = el.messages.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
  if (item) item.remove();
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || "[]");
  } catch {
    history = [];
  }
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history.filter((message) => message.id !== messageId)));
}

function addChatMessage(message) {
  const item = document.createElement("div");
  item.className = "message";
  item.dataset.messageId = message.id || "";
  const header = document.createElement("div");
  header.className = "message-header";
  const author = document.createElement("div");
  author.className = "author";
  author.textContent = message.name || "Участник";
  header.appendChild(author);
  if (message.own || message.senderId === state.clientId) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "message-delete";
    remove.textContent = "Удалить";
    remove.addEventListener("click", () => deleteOwnMessage(message.id));
    header.appendChild(remove);
  }
  const text = document.createElement("div");
  text.textContent = message.text || "";
  item.append(header, text);
  el.messages.appendChild(item);
  el.messages.scrollTop = el.messages.scrollHeight;
}

function saveChatMessage(message) {
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || "[]");
  } catch {
    history = [];
  }
  history.push(message);
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history.slice(-CHAT_HISTORY_LIMIT)));
}

function addSystem(text) {
  addMessage("Система", text, true, el.systemMessages);
}

function addMessage(author, text, system = false, container = el.messages) {
  const item = document.createElement("div");
  item.className = `message${system ? " system" : ""}`;
  item.innerHTML = `<div class="author">${escapeHtml(author)}</div><div>${escapeHtml(text)}</div>`;
  container.appendChild(item);
  container.scrollTop = container.scrollHeight;
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
