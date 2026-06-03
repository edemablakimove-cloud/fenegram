const ROOM_NAME = "main";
const EVENT_TEXT = 1;
const APP_VERSION = "0.2.0";
const DEFAULT_APP_ID = "b6089b21-fad4-43a9-93e0-7b12f683313e";
const LIVEKIT_SANDBOX_ID = "fenegram-2i209g";

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
  deviceTestRunning: false,
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
  testMic: document.querySelector("#testMicBtn"),
  testSpeaker: document.querySelector("#testSpeakerBtn"),
  deviceTestStatus: document.querySelector("#deviceTestStatus"),
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
el.speaker.addEventListener("change", changeAudioOutput);
el.testMic.addEventListener("click", testMicrophone);
el.testSpeaker.addEventListener("click", testSpeaker);
el.micVolume.addEventListener("input", updateMicGain);
el.masterVolume.addEventListener("input", updateAllVolumes);

function loadSettings() {
  el.appId.value = localStorage.getItem("pm.appId") || DEFAULT_APP_ID;
  el.name.value = localStorage.getItem("pm.name") || `User${Math.floor(Math.random() * 1000)}`;
  el.region.value = localStorage.getItem("pm.region") || "EU";
  el.masterVolume.value = localStorage.getItem("pm.masterVolume") || "100";
  el.micVolume.value = localStorage.getItem("pm.micVolume") || "100";
}

function saveSettings() {
  localStorage.setItem("pm.appId", el.appId.value.trim());
  localStorage.setItem("pm.name", el.name.value.trim());
  localStorage.setItem("pm.region", el.region.value);
  localStorage.setItem("pm.masterVolume", el.masterVolume.value);
  localStorage.setItem("pm.micVolume", el.micVolume.value);
}

async function refreshDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
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
  if ([...select.options].some((option) => option.value === previous)) {
    select.value = previous;
  }
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
  };

  client.onActorLeave = function (actor) {
    state.members.delete(actor.actorNr);
    renderMembers();
  };

  client.onEvent = function (code, data, actorNr) {
    if (code === EVENT_TEXT) {
      addMessage(data.name || memberName(actorNr), data.text || "");
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
    { name: el.name.value.trim(), text },
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

  addSystem("Подключение к голосовому серверу LiveKit...");
  await room.connect(credentials.serverUrl, credentials.participantToken);
  await publishMicrophone(room);

  state.voiceEnabled = true;
  el.voice.textContent = "Выйти из голоса";
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
    if (track.kind !== window.LivekitClient.Track.Kind.Audio) return;
    attachAudioTrack(track, publication, participant);
  });

  room.on(events.TrackUnsubscribed, (track, publication) => {
    removeAudioTrack(publication.trackSid || track.sid);
    track.detach().forEach((audio) => audio.remove());
  });

  room.on(events.ActiveSpeakersChanged, (speakers) => {
    state.speakingNames = new Set(speakers.map(participantName));
    renderMembers();
  });

  room.on(events.AudioPlaybackStatusChanged, () => {
    if (!room.canPlaybackAudio) {
      addSystem("Браузер заблокировал звук. Нажми кнопку «Включить звук».");
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
  await room.localParticipant.publishTrack(state.localOutputTrack, {
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
  el.voice.textContent = "Войти в голос";
  state.voiceParticipants.clear();
  state.speakingNames.clear();
  for (const audio of state.audioElements.values()) audio.remove();
  state.audioElements.clear();
  if (state.rawStream) state.rawStream.getTracks().forEach((track) => track.stop());
  if (state.localOutputTrack) state.localOutputTrack.stop();
  if (state.audioContext) state.audioContext.close().catch(() => {});
  state.rawStream = null;
  state.localOutputTrack = null;
  state.audioContext = null;
  state.micGain = null;
  state.analyser = null;
  state.livekitRoom = null;
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
  saveSettings();
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
  document.body.appendChild(audio);
  state.audioElements.set(key, audio);
  applyAudioOutput(audio);
  updateOneVolume(participantName(participant), audio);
  audio.play().catch(() => addSystem("Нажми «Включить звук», чтобы слышать участников."));
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

async function enableRemoteSound() {
  const room = state.livekitRoom;
  if (!room) {
    addSystem("Сначала войди в голос.");
    return;
  }
  try {
    await room.startAudio();
    for (const audio of state.audioElements.values()) await audio.play();
    addSystem("Воспроизведение голоса включено.");
  } catch (error) {
    addSystem(`Не удалось включить звук: ${error.message}`);
  }
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
  saveSettings();
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
