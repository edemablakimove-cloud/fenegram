const ROOM_NAME = "main";
const EVENT_TEXT = 1;
const EVENT_DELETE_MESSAGE = 2;
const EVENT_DIRECT_MESSAGE = 3;
const EVENT_PROFILE = 4;
const APP_VERSION = "0.2.0";
const DEFAULT_APP_ID = "b6089b21-fad4-43a9-93e0-7b12f683313e";
const LIVEKIT_SANDBOX_ID = "fenegram-2i209g";
const NAME_CHANGE_INTERVAL = 24 * 60 * 60 * 1000;
const CHAT_HISTORY_KEY = "pm.chatHistory";
const CHAT_HISTORY_LIMIT = 100;
const HANDLE_PATTERN = /^[a-z0-9_]{3,24}$/;

const state = {
  client: null,
  joined: false,
  members: new Map(),
  volumes: new Map(),
  livekitRoom: null,
  voiceEnabled: false,
  voiceConnecting: false,
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
  profiles: new Map(),
  directChats: new Map(),
  selectedDirectActor: null,
  authClient: null,
  authUser: null,
  currentProfile: null,
  directProfiles: new Map(),
  directMessagesStore: [],
  selectedDirectUserId: null,
  blockedUsers: new Set(),
  directChannel: null,
};

const el = {
  appId: document.querySelector("#appIdInput"),
  unlockAppId: document.querySelector("#unlockAppIdInput"),
  name: document.querySelector("#nameInput"),
  region: document.querySelector("#regionInput"),
  saveSettings: document.querySelector("#saveSettingsBtn"),
  nameChangeHint: document.querySelector("#nameChangeHint"),
  channelTab: document.querySelector("#channelTabBtn"),
  directTab: document.querySelector("#directTabBtn"),
  systemTab: document.querySelector("#systemTabBtn"),
  settingsTab: document.querySelector("#settingsTabBtn"),
  channelView: document.querySelector("#channelView"),
  directView: document.querySelector("#directView"),
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
  directMessages: document.querySelector("#directMessages"),
  directStatus: document.querySelector("#directStatus"),
  directUsers: document.querySelector("#directUsersList"),
  directForm: document.querySelector("#directMessageForm"),
  directMessage: document.querySelector("#directMessageInput"),
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
  connectionCheck: document.querySelector("#connectionCheckBtn"),
  connectionCheckStatus: document.querySelector("#connectionCheckStatus"),
  accountStatus: document.querySelector("#accountStatus"),
  googleLogin: document.querySelector("#googleLoginBtn"),
  vkLogin: document.querySelector("#vkLoginBtn"),
  logout: document.querySelector("#logoutBtn"),
  supabaseUrl: document.querySelector("#supabaseUrlInput"),
  supabaseAnonKey: document.querySelector("#supabaseAnonKeyInput"),
  vkProvider: document.querySelector("#vkProviderInput"),
  saveAuthSettings: document.querySelector("#saveAuthSettingsBtn"),
  authSettingsStatus: document.querySelector("#authSettingsStatus"),
  authGate: document.querySelector("#authGate"),
  authGateStatus: document.querySelector("#authGateStatus"),
  gateGoogleLogin: document.querySelector("#gateGoogleLoginBtn"),
  gateVkLogin: document.querySelector("#gateVkLoginBtn"),
  gateLogout: document.querySelector("#gateLogoutBtn"),
  openAuthSettings: document.querySelector("#openAuthSettingsBtn"),
  handleForm: document.querySelector("#handleForm"),
  handleInput: document.querySelector("#handleInput"),
  saveHandle: document.querySelector("#saveHandleBtn"),
  handleStatus: document.querySelector("#handleStatus"),
  settingsHandle: document.querySelector("#settingsHandleInput"),
  saveSettingsHandle: document.querySelector("#saveSettingsHandleBtn"),
  directSearchForm: document.querySelector("#directSearchForm"),
  directSearch: document.querySelector("#directSearchInput"),
  directSearchResults: document.querySelector("#directSearchResults"),
  directChatList: document.querySelector("#directChatList"),
  blockDirect: document.querySelector("#blockDirectBtn"),
  userMenu: document.querySelector("#userMenu"),
  userMenuAvatar: document.querySelector("#userMenuAvatar"),
  userMenuName: document.querySelector("#userMenuName"),
  userMenuHandle: document.querySelector("#userMenuHandle"),
  userMenuMessage: document.querySelector("#userMenuMessageBtn"),
  userMenuBlock: document.querySelector("#userMenuBlockBtn"),
};

loadSettings();
loadChatHistory();
refreshDevices();
setConnectedUi(false);
updateNameChangeUi();
startApp();

el.channelTab.addEventListener("click", () => showView("channel"));
el.directTab.addEventListener("click", () => showView("direct"));
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
el.directForm.addEventListener("submit", sendDirectMessage);
el.connectionCheck.addEventListener("click", runConnectionCheck);
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
el.googleLogin.addEventListener("click", () => signInWithProvider("google"));
el.vkLogin.addEventListener("click", () => signInWithProvider(el.vkProvider.value.trim() || "custom:vk"));
el.gateGoogleLogin.addEventListener("click", () => signInWithProvider("google"));
el.gateVkLogin.addEventListener("click", () => signInWithProvider(el.vkProvider.value.trim() || "custom:vk"));
el.gateLogout.addEventListener("click", signOut);
el.logout.addEventListener("click", signOut);
el.saveAuthSettings.addEventListener("click", saveAuthSettings);
el.openAuthSettings.addEventListener("click", openAuthSettings);
el.handleForm.addEventListener("submit", saveHandle);
el.saveSettingsHandle.addEventListener("click", saveHandle);
el.directSearchForm.addEventListener("submit", searchDirectUser);
el.blockDirect.addEventListener("click", toggleDirectBlock);
el.userMenuMessage.addEventListener("click", () => {
  const profile = state.directProfiles.get(el.userMenu.dataset.userId);
  if (profile) openDirectChat(profile);
  hideUserMenu();
});
el.userMenuBlock.addEventListener("click", async () => {
  const profile = state.directProfiles.get(el.userMenu.dataset.userId);
  if (profile) await setDirectBlock(profile.id, !state.blockedUsers.has(profile.id));
  hideUserMenu();
});
document.addEventListener("click", (event) => {
  if (el.userMenu.hidden) return;
  if (el.userMenu.contains(event.target) || event.target.closest(".avatar")) return;
  hideUserMenu();
});

async function startApp() {
  await initAuth();
  refreshAppAccess();
  if (canUseApp()) window.setTimeout(connect, 100);
}

function loadSettings() {
  state.clientId = localStorage.getItem("pm.anonClientId") || crypto.randomUUID();
  localStorage.setItem("pm.anonClientId", state.clientId);
  el.appId.value = localStorage.getItem("pm.appId") || DEFAULT_APP_ID;
  el.supabaseUrl.value = localStorage.getItem("pm.supabaseUrl") || "";
  el.supabaseAnonKey.value = localStorage.getItem("pm.supabaseAnonKey") || "";
  el.vkProvider.value = localStorage.getItem("pm.vkProvider") || "custom:vk";
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

function saveAuthSettings() {
  localStorage.setItem("pm.supabaseUrl", el.supabaseUrl.value.trim());
  localStorage.setItem("pm.supabaseAnonKey", el.supabaseAnonKey.value.trim());
  localStorage.setItem("pm.vkProvider", el.vkProvider.value.trim() || "custom:vk");
  el.authSettingsStatus.textContent = "Настройки входа сохранены. Сейчас обновлю подключение аккаунтов.";
  initAuth().then(() => {
    if (state.joined || state.connecting) reconnectTextChatIfAllowed();
  });
}

async function initAuth() {
  const url = el.supabaseUrl.value.trim();
  const anonKey = el.supabaseAnonKey.value.trim();
  if (!url || !anonKey) {
    state.authClient = null;
    state.authUser = null;
    state.currentProfile = null;
    renderAccount();
    return;
  }
  if (!window.supabase?.createClient) {
    el.authSettingsStatus.textContent = "Библиотека Supabase не загрузилась.";
    renderAccount();
    return;
  }
  try {
    state.authClient = window.supabase.createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    const { data, error } = await state.authClient.auth.getSession();
    if (error) throw error;
    await applySession(data.session);
    state.authClient.auth.onAuthStateChange(async (_event, session) => {
      const previousUserId = state.authUser?.id || "";
      await applySession(session);
      if ((state.authUser?.id || "") !== previousUserId && (state.joined || state.connecting)) {
        reconnectTextChatIfAllowed();
      }
    });
  } catch (error) {
    state.authClient = null;
    state.authUser = null;
    state.currentProfile = null;
    el.authSettingsStatus.textContent = `Не удалось подключить Supabase: ${error.message}`;
    renderAccount();
  }
}

async function applySession(session) {
  cleanupDirectSubscription();
  state.authUser = session?.user || null;
  if (state.authUser) {
    const accountName = authDisplayName(state.authUser);
    state.clientId = `auth-${state.authUser.id}`;
    localStorage.setItem("pm.clientId", state.clientId);
    if (accountName && accountName !== el.name.value.trim()) {
      el.name.value = accountName;
      localStorage.setItem("pm.name", accountName);
    }
  } else {
    state.clientId = localStorage.getItem("pm.anonClientId") || crypto.randomUUID();
    localStorage.setItem("pm.anonClientId", state.clientId);
    localStorage.setItem("pm.clientId", state.clientId);
  }
  state.currentProfile = state.authUser ? await loadMyProfile() : null;
  if (state.currentProfile) {
    await loadDirectData();
    subscribeDirectMessages();
  } else {
    clearDirectData();
  }
  renderAccount();
  updateNameChangeUi();
  refreshAppAccess();
}

function authDisplayName(user) {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.preferred_username ||
    user?.email?.split("@")[0] ||
    ""
  ).slice(0, 32);
}

function renderAccount() {
  const configured = Boolean(state.authClient);
  const signedIn = Boolean(state.authUser);
  el.googleLogin.disabled = !configured;
  el.vkLogin.disabled = !configured;
  el.gateGoogleLogin.disabled = !configured;
  el.gateVkLogin.disabled = !configured;
  el.logout.hidden = !state.authUser;
  el.gateLogout.hidden = !state.authUser;
  el.handleInput.disabled = !signedIn;
  el.saveHandle.disabled = !signedIn;
  el.settingsHandle.disabled = !signedIn;
  el.saveSettingsHandle.disabled = !signedIn;
  if (!configured) {
    el.accountStatus.textContent = "Вход не настроен";
    el.authSettingsStatus.textContent = "Для Google/VK входа вставь URL и anon key из Supabase.";
    el.authGateStatus.textContent = "Сначала нажми «Настроить вход» и вставь Supabase URL + anon key.";
    el.handleStatus.textContent = "Ник можно выбрать только после настройки входа и авторизации.";
    return;
  }
  if (!state.authUser) {
    el.accountStatus.textContent = "Можно войти через Google или VK";
    el.authSettingsStatus.textContent = "Supabase подключен. Не забудь разрешить redirect URL в Supabase Dashboard.";
    el.authGateStatus.textContent = "Войди через Google или VK, чтобы пользоваться Fenegram.";
    el.handleStatus.textContent = "Сначала войди в аккаунт.";
    return;
  }
  const name = authDisplayName(state.authUser) || "Аккаунт";
  const email = state.authUser.email || state.authUser.user_metadata?.email || "";
  const handle = state.currentProfile?.handle ? `@${state.currentProfile.handle}` : "нужен @ник";
  el.accountStatus.innerHTML = `<strong>${escapeHtml(name)}</strong><span>${escapeHtml(handle)}</span>${email ? `<span>${escapeHtml(email)}</span>` : ""}`;
  el.authSettingsStatus.textContent = state.currentProfile
    ? "Ты вошел в аккаунт. Личные сообщения сохраняются между аккаунтами."
    : "Ты вошел в аккаунт. Теперь выбери обязательный @ник.";
  el.authGateStatus.textContent = state.currentProfile ? "Готово." : "Выбери обязательный @ник, чтобы открыть Fenegram.";
  el.handleInput.value = state.currentProfile?.handle ? `@${state.currentProfile.handle}` : "";
  el.settingsHandle.value = state.currentProfile?.handle ? `@${state.currentProfile.handle}` : "";
  el.handleStatus.textContent = state.currentProfile
    ? `@${state.currentProfile.handle} выбран.`
    : "Теперь можно выбрать @ник: латиница, цифры и нижнее подчеркивание.";
}

async function signInWithProvider(provider) {
  if (!state.authClient) {
    showView("settings");
    el.authSettingsStatus.textContent = "Сначала вставь Supabase URL и anon key.";
    return;
  }
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await state.authClient.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
    },
  });
  if (error) addSystem(`Не удалось начать вход: ${error.message}`);
}

async function signOut() {
  if (!state.authClient) return;
  const { error } = await state.authClient.auth.signOut();
  if (error) {
    addSystem(`Не удалось выйти из аккаунта: ${error.message}`);
    return;
  }
  state.authUser = null;
  state.currentProfile = null;
  clearDirectData();
  renderAccount();
  disconnect();
  refreshAppAccess();
}

function canUseApp() {
  return Boolean(state.authClient && state.authUser && state.currentProfile?.handle);
}

function refreshAppAccess() {
  const allowed = canUseApp();
  document.body.classList.toggle("locked", !allowed);
  el.authGate.hidden = allowed;
  el.channelTab.disabled = !allowed;
  el.directTab.disabled = !allowed;
  el.systemTab.disabled = !allowed;
  el.voice.disabled = !allowed || state.voiceConnecting;
  el.form.querySelector("button").disabled = !allowed || !state.joined;
  el.message.disabled = !allowed || !state.joined;
  renderAccount();
  renderDirectChatList();
  renderDirectChat();
}

function reconnectTextChatIfAllowed() {
  if (!canUseApp()) {
    disconnect();
    return;
  }
  reconnectTextChat();
}

function openAuthSettings() {
  showView("settings");
  el.authGate.hidden = true;
  document.body.classList.remove("locked");
}

async function loadMyProfile() {
  if (!state.authClient || !state.authUser) return null;
  const { data, error } = await state.authClient
    .from("profiles")
    .select("id, handle, display_name, created_at, updated_at")
    .eq("id", state.authUser.id)
    .maybeSingle();
  if (error) {
    el.handleStatus.textContent = `Не удалось загрузить профиль: ${error.message}`;
    return null;
  }
  if (data?.display_name && data.display_name !== el.name.value.trim()) {
    el.name.value = data.display_name;
    localStorage.setItem("pm.name", data.display_name);
  }
  return data;
}

async function saveHandle(event) {
  event?.preventDefault?.();
  if (!state.authClient || !state.authUser) {
    el.handleStatus.textContent = "Сначала войди в аккаунт.";
    return;
  }
  const handle = normalizeHandle(el.handleInput.value || el.settingsHandle.value);
  if (!HANDLE_PATTERN.test(handle)) {
    el.handleStatus.textContent = "Ник должен быть 3-24 символа: латиница, цифры и нижнее подчеркивание.";
    return;
  }
  const displayName = el.name.value.trim() || authDisplayName(state.authUser) || handle;
  const { data, error } = await state.authClient
    .from("profiles")
    .upsert(
      {
        id: state.authUser.id,
        handle,
        display_name: displayName.slice(0, 32),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select("id, handle, display_name, created_at, updated_at")
    .single();
  if (error) {
    el.handleStatus.textContent = error.code === "23505" ? "Этот @ник уже занят." : `Не удалось сохранить @ник: ${error.message}`;
    return;
  }
  state.currentProfile = data;
  el.handleInput.value = `@${data.handle}`;
  el.settingsHandle.value = `@${data.handle}`;
  el.handleStatus.textContent = `@${data.handle} сохранен.`;
  renderAccount();
  refreshAppAccess();
  await loadDirectData();
  subscribeDirectMessages();
  if (!state.joined && !state.connecting) connect();
}

function normalizeHandle(value) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
}

function displayProfile(profile) {
  if (!profile) return "Неизвестный";
  return profile.display_name ? `${profile.display_name} (@${profile.handle})` : `@${profile.handle}`;
}

function profileInitials(profile) {
  const source = profile?.display_name || profile?.handle || "?";
  return source
    .replace(/^@/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function createAvatar(profile, className = "") {
  const avatar = document.createElement("button");
  avatar.type = "button";
  avatar.className = `avatar ${className}`.trim();
  avatar.textContent = profileInitials(profile);
  avatar.title = `Меню ${displayProfile(profile)}`;
  avatar.addEventListener("click", (event) => {
    event.stopPropagation();
    showUserMenu(profile, avatar);
  });
  return avatar;
}

function showUserMenu(profile, anchor) {
  if (!profile || profile.id === state.currentProfile?.id) return;
  state.directProfiles.set(profile.id, profile);
  el.userMenu.dataset.userId = profile.id;
  el.userMenuAvatar.textContent = profileInitials(profile);
  el.userMenuName.textContent = profile.display_name || "Пользователь";
  el.userMenuHandle.textContent = `@${profile.handle}`;
  el.userMenuBlock.textContent = state.blockedUsers.has(profile.id) ? "Разблокировать" : "Заблокировать";
  const rect = anchor.getBoundingClientRect();
  const left = Math.min(rect.left, window.innerWidth - 252);
  const top = Math.min(rect.bottom + 8, window.innerHeight - 180);
  el.userMenu.style.left = `${Math.max(8, left)}px`;
  el.userMenu.style.top = `${Math.max(8, top)}px`;
  el.userMenu.hidden = false;
}

function hideUserMenu() {
  el.userMenu.hidden = true;
  delete el.userMenu.dataset.userId;
}

function openDirectChat(profile) {
  if (!profile) return;
  state.selectedDirectUserId = profile.id;
  state.directProfiles.set(profile.id, profile);
  showView("direct");
  renderDirectChatList();
  renderDirectChat();
}

function clearDirectData() {
  cleanupDirectSubscription();
  state.directProfiles.clear();
  state.directMessagesStore = [];
  state.selectedDirectUserId = null;
  state.blockedUsers.clear();
  renderDirectChatList();
  renderDirectChat();
}

async function loadDirectData() {
  if (!state.authClient || !state.currentProfile) return;
  await loadBlockedUsers();
  await loadStoredDirectMessages();
  renderDirectChatList();
  renderDirectChat();
}

async function loadBlockedUsers() {
  const { data, error } = await state.authClient
    .from("blocked_users")
    .select("blocked_id")
    .eq("blocker_id", state.currentProfile.id);
  if (error) {
    addSystem(`Не удалось загрузить блокировки: ${error.message}`);
    return;
  }
  state.blockedUsers = new Set((data || []).map((row) => row.blocked_id));
}

async function loadStoredDirectMessages() {
  const myId = state.currentProfile.id;
  const { data, error } = await state.authClient
    .from("direct_messages")
    .select("id, sender_id, recipient_id, content, created_at")
    .or(`sender_id.eq.${myId},recipient_id.eq.${myId}`)
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) {
    addSystem(`Не удалось загрузить личные сообщения: ${error.message}`);
    return;
  }
  state.directMessagesStore = data || [];
  await loadDirectProfilesFromMessages();
}

async function loadDirectProfilesFromMessages() {
  const myId = state.currentProfile?.id;
  const ids = new Set();
  for (const message of state.directMessagesStore) {
    ids.add(message.sender_id);
    ids.add(message.recipient_id);
  }
  ids.delete(myId);
  if (!ids.size) return;
  await loadProfilesByIds([...ids]);
}

async function loadProfilesByIds(ids) {
  const missing = ids.filter((id) => id && !state.directProfiles.has(id) && id !== state.currentProfile?.id);
  if (!missing.length) return;
  const { data, error } = await state.authClient.from("profiles").select("id, handle, display_name").in("id", missing);
  if (error) {
    addSystem(`Не удалось загрузить профили: ${error.message}`);
    return;
  }
  for (const profile of data || []) state.directProfiles.set(profile.id, profile);
}

function subscribeDirectMessages() {
  cleanupDirectSubscription();
  if (!state.authClient || !state.currentProfile) return;
  const myId = state.currentProfile.id;
  state.directChannel = state.authClient
    .channel(`direct-${myId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages", filter: `sender_id=eq.${myId}` }, handleRealtimeDirectMessage)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${myId}` }, handleRealtimeDirectMessage)
    .subscribe();
}

function cleanupDirectSubscription() {
  if (state.directChannel && state.authClient) {
    state.authClient.removeChannel(state.directChannel).catch(() => {});
  }
  state.directChannel = null;
}

async function handleRealtimeDirectMessage(payload) {
  const message = payload.new;
  if (!message || state.directMessagesStore.some((item) => item.id === message.id)) return;
  state.directMessagesStore.push(message);
  const otherId = otherDirectUserId(message);
  await loadProfilesByIds([otherId]);
  renderDirectChatList();
  if (state.selectedDirectUserId === otherId) renderDirectChat();
}

function otherDirectUserId(message) {
  return message.sender_id === state.currentProfile?.id ? message.recipient_id : message.sender_id;
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
  const direct = view === "direct";
  el.channelView.hidden = settings || system || direct;
  el.directView.hidden = !direct;
  el.systemView.hidden = !system;
  el.settingsView.hidden = !settings;
  el.channelTab.classList.toggle("active", !settings && !system && !direct);
  el.directTab.classList.toggle("active", direct);
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
  if (state.client) state.client.disconnect();
  cleanupConnection();
  window.setTimeout(connect, 250);
}

function connect() {
  if (!canUseApp()) {
    setStatus("нужен вход и @ник");
    return;
  }
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
      this.myActor().setCustomProperty("fenegramClientId", state.clientId);
      setConnectedUi(true);
      syncMembers();
      broadcastProfile();
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
    profileFromActor(actor);
    broadcastProfile();
    renderMembers();
    renderDirectUsers();
  };

  client.onActorLeave = function (actor) {
    state.members.delete(actor.actorNr);
    state.profiles.delete(actor.actorNr);
    if (state.selectedDirectActor === actor.actorNr) {
      state.selectedDirectActor = null;
      renderDirectChat();
    }
    renderMembers();
    renderDirectUsers();
  };

  client.onActorPropertiesChange = function (actor) {
    profileFromActor(actor);
    renderDirectUsers();
  };

  client.onEvent = function (code, data, actorNr) {
    if (code === EVENT_TEXT) {
      receiveChatMessage(data, actorNr);
    }
    if (code === EVENT_DELETE_MESSAGE) {
      receiveDeleteMessage(data);
    }
    if (code === EVENT_DIRECT_MESSAGE) {
      receiveDirectMessage(data, actorNr);
    }
    if (code === EVENT_PROFILE) {
      receiveProfile(data, actorNr);
    }
  };

  setStatus("Подключение к Photon...");
  client.connectToRegionMaster(el.region.value);
}

function disconnect() {
  if (state.client) state.client.disconnect();
  cleanupConnection();
}

function cleanupConnection() {
  state.connecting = false;
  state.joined = false;
  state.members.clear();
  state.profiles.clear();
  state.selectedDirectActor = null;
  setConnectedUi(false);
  setStatus("текстовый чат недоступен");
  renderMembers();
  renderDirectUsers();
  renderDirectChat();
  refreshAppAccess();
}

function sendMessage(event) {
  event.preventDefault();
  const text = el.message.value.trim();
  if (!text) return;
  if (!canUseApp()) {
    addSystem("Сначала войди в аккаунт и выбери @ник.");
    return;
  }
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

function broadcastProfile() {
  if (!state.client?.isJoinedToRoom?.()) return;
  state.client.raiseEvent(
    EVENT_PROFILE,
    { clientId: state.clientId, name: el.name.value.trim() },
    { receivers: window.Photon.LoadBalancing.Constants.ReceiverGroup.All }
  );
}

function receiveProfile(data, actorNr) {
  if (!data?.clientId || actorNr === myActorNr()) return;
  state.profiles.set(actorNr, {
    actorNr,
    clientId: data.clientId,
    name: data.name || memberName(actorNr),
  });
  renderDirectUsers();
}

function profileFromActor(actor) {
  if (!actor || actor.actorNr === myActorNr()) return;
  const clientId = actor.getCustomProperty?.("fenegramClientId");
  if (!clientId) return;
  state.profiles.set(actor.actorNr, {
    actorNr: actor.actorNr,
    clientId,
    name: actor.name || `User ${actor.actorNr}`,
  });
}

async function sendDirectMessage(event) {
  event.preventDefault();
  const text = el.directMessage.value.trim();
  const recipientId = state.selectedDirectUserId;
  if (!text || !recipientId || !state.authClient || !state.currentProfile) return;
  if (state.blockedUsers.has(recipientId)) {
    addSystem("Пользователь заблокирован. Разблокируй его, чтобы написать.");
    return;
  }
  const { data, error } = await awaitInsertDirectMessage(recipientId, text);
  if (error) {
    addSystem(`Не удалось отправить личное сообщение: ${error.message}`);
    return;
  }
  if (data && !state.directMessagesStore.some((item) => item.id === data.id)) {
    state.directMessagesStore.push(data);
  }
  el.directMessage.value = "";
  renderDirectChatList();
  renderDirectChat();
}

async function awaitInsertDirectMessage(recipientId, text) {
  return state.authClient
    .from("direct_messages")
    .insert({
      sender_id: state.currentProfile.id,
      recipient_id: recipientId,
      content: text.slice(0, 4000),
    })
    .select("id, sender_id, recipient_id, content, created_at")
    .single();
}

function receiveDirectMessage(data, actorNr) {
  if (!data?.senderId || !data?.text) return;
  if (!state.profiles.has(actorNr)) {
    state.profiles.set(actorNr, {
      actorNr,
      clientId: data.senderId,
      name: data.senderName || memberName(actorNr),
    });
  }
}

function renderDirectUsers() {
  renderDirectChatList();
}

async function searchDirectUser(event) {
  event.preventDefault();
  el.directSearchResults.innerHTML = "";
  if (!state.authClient || !state.currentProfile) return;
  const handle = normalizeHandle(el.directSearch.value);
  if (!HANDLE_PATTERN.test(handle)) {
    el.directSearchResults.textContent = "Введи @ник от 3 символов.";
    return;
  }
  const { data, error } = await state.authClient
    .from("profiles")
    .select("id, handle, display_name")
    .eq("handle", handle)
    .maybeSingle();
  if (error) {
    el.directSearchResults.textContent = `Ошибка поиска: ${error.message}`;
    return;
  }
  if (!data) {
    el.directSearchResults.textContent = "Такого @ника нет.";
    return;
  }
  if (data.id === state.currentProfile.id) {
    el.directSearchResults.textContent = "Это твой аккаунт.";
    return;
  }
  state.directProfiles.set(data.id, data);
  const button = createDirectProfileButton(data, "Начать чат");
  el.directSearchResults.appendChild(button);
}

function renderDirectChatList() {
  if (!el.directChatList) return;
  el.directChatList.innerHTML = "";
  if (!state.currentProfile) {
    el.directChatList.innerHTML = `<div class="empty-state">Войди и выбери @ник</div>`;
    return;
  }
  const conversations = buildDirectConversations();
  if (!conversations.length) {
    el.directChatList.innerHTML = `<div class="empty-state">Пока нет личных чатов</div>`;
    return;
  }
  for (const conversation of conversations) {
    const button = createDirectProfileButton(conversation.profile, conversation.last.content);
    el.directChatList.appendChild(button);
  }
}

function buildDirectConversations() {
  const latest = new Map();
  for (const message of state.directMessagesStore) {
    const otherId = otherDirectUserId(message);
    if (!otherId || state.blockedUsers.has(otherId)) continue;
    const previous = latest.get(otherId);
    if (!previous || new Date(message.created_at) > new Date(previous.created_at)) latest.set(otherId, message);
  }
  return [...latest.entries()]
    .map(([userId, last]) => ({ profile: state.directProfiles.get(userId) || { id: userId, handle: "unknown", display_name: "Неизвестный" }, last }))
    .sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));
}

function createDirectProfileButton(profile, preview) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `direct-user-button${state.selectedDirectUserId === profile.id ? " active" : ""}`;
  button.appendChild(createAvatar(profile));
  const textWrap = document.createElement("div");
  textWrap.className = "direct-user-text";
  const name = document.createElement("span");
  name.textContent = displayProfile(profile);
  const small = document.createElement("small");
  small.textContent = preview || `@${profile.handle}`;
  textWrap.append(name, small);
  button.appendChild(textWrap);
  button.addEventListener("click", () => openDirectChat(profile));
  return button;
}

function renderDirectChat() {
  el.directMessages.innerHTML = "";
  const profile = state.directProfiles.get(state.selectedDirectUserId);
  const blocked = state.selectedDirectUserId && state.blockedUsers.has(state.selectedDirectUserId);
  const enabled = Boolean(profile && state.currentProfile && !blocked);
  el.directMessage.disabled = !enabled;
  el.directForm.querySelector("button").disabled = !enabled;
  el.blockDirect.disabled = !profile;
  el.blockDirect.textContent = blocked ? "Разблокировать" : "Заблокировать";
  el.directStatus.textContent = profile
    ? `${displayProfile(profile)}${blocked ? " заблокирован" : ""}`
    : "Выбери чат слева или найди человека по @нику";
  if (!profile || !state.currentProfile) return;
  const messages = state.directMessagesStore.filter((message) => otherDirectUserId(message) === profile.id);
  for (const message of messages) {
    const own = message.sender_id === state.currentProfile.id;
    addMessage(own ? el.name.value.trim() : displayProfile(profile), message.content, false, el.directMessages, own ? null : profile);
  }
  el.directMessages.scrollTop = el.directMessages.scrollHeight;
}

async function toggleDirectBlock() {
  const userId = state.selectedDirectUserId;
  if (!userId || !state.currentProfile || !state.authClient) return;
  await setDirectBlock(userId, !state.blockedUsers.has(userId));
}

async function setDirectBlock(userId, shouldBlock) {
  const blocked = state.blockedUsers.has(userId);
  if (shouldBlock === blocked) return;
  if (!shouldBlock) {
    const { error } = await state.authClient
      .from("blocked_users")
      .delete()
      .eq("blocker_id", state.currentProfile.id)
      .eq("blocked_id", userId);
    if (error) {
      addSystem(`Не удалось разблокировать пользователя: ${error.message}`);
      return;
    }
    state.blockedUsers.delete(userId);
  } else {
    const { error } = await state.authClient.from("blocked_users").insert({
      blocker_id: state.currentProfile.id,
      blocked_id: userId,
    });
    if (error) {
      addSystem(`Не удалось заблокировать пользователя: ${error.message}`);
      return;
    }
    state.blockedUsers.add(userId);
  }
  renderDirectChatList();
  renderDirectChat();
}

async function toggleVoice() {
  if (!canUseApp()) return;
  if (state.voiceConnecting) return;
  if (state.voiceEnabled) {
    stopVoice();
    return;
  }
  state.voiceConnecting = true;
  updateVoiceControls();
  try {
    await startVoice();
  } catch (error) {
    stopVoice();
    addSystem(`Не удалось включить голос LiveKit: ${friendlyLiveKitError(error)}`);
  } finally {
    state.voiceConnecting = false;
    updateVoiceControls();
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
  state.voiceConnecting = false;
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
    removeParticipantVideo(participant.identity);
    addSystem(`${participantName(participant)} вышел из голоса.`);
    renderMembers();
  });

  room.on(events.TrackSubscribed, (track, publication, participant) => {
    if (isLocalLiveKitParticipant(participant)) return;
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
    if (track.kind === window.LivekitClient.Track.Kind.Video) removeVideoTilesForPublication(publication);
    track.detach().forEach((element) => element.remove());
  });

  room.on(events.LocalTrackPublished, (publication, participant) => {
    const track = publication.track;
    if (track?.kind === window.LivekitClient.Track.Kind.Video) {
      attachVideoTrack(track, publication, participant, true);
    }
  });

  room.on(events.LocalTrackUnpublished, (publication) => {
    removeVideoTilesForPublication(publication);
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
  const result = await room.localParticipant.setMicrophoneEnabled(true, {
    deviceId: el.mic.value || undefined,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  });
  state.localPublication = result?.track ? result : getLocalMicrophonePublication(room);
  state.localOutputTrack = state.localPublication?.track?.mediaStreamTrack || null;
  state.localOutputTrack?.addEventListener(
    "ended",
    () => addSystem("Микрофонный трек остановился. Попробуй выбрать другой микрофон или перезайти в голос."),
    { once: true }
  );
  if (!state.localPublication) {
    throw new Error("microphone publication was not created");
  }
}

function getLocalMicrophonePublication(room) {
  const source = window.LivekitClient.Track.Source.Microphone;
  if (typeof room.localParticipant.getTrackPublication === "function") {
    const publication = room.localParticipant.getTrackPublication(source);
    if (publication) return publication;
  }
  const publications = room.localParticipant.audioTrackPublications;
  if (publications?.values) {
    for (const publication of publications.values()) {
      if (publication.source === source) return publication;
    }
  }
  return null;
}

function stopVoice() {
  const room = state.livekitRoom;
  if (room) {
    room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
    room.disconnect();
  }
  cleanupVoice();
}

function cleanupVoice() {
  state.voiceEnabled = false;
  state.voiceConnecting = false;
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
  if (state.voiceConnecting) return;
  state.voiceConnecting = true;
  updateVoiceControls();
  stopVoice();
  try {
    await startVoice();
  } catch (error) {
    stopVoice();
    addSystem(`Не удалось сменить микрофон: ${friendlyLiveKitError(error)}`);
  } finally {
    state.voiceConnecting = false;
    updateVoiceControls();
  }
}

function updateMicGain() {
  persistAudioSettings();
}

function attachAudioTrack(track, publication, participant) {
  if (isLocalLiveKitParticipant(participant)) return;
  const key = publication.trackSid || track.sid || `${participant.identity}-${Date.now()}`;
  removeAudioTrack(key);
  const audio = track.attach();
  audio.autoplay = true;
  audio.playsInline = true;
  audio.muted = false;
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

function isLocalLiveKitParticipant(participant) {
  return Boolean(participant?.isLocal || participant?.identity === state.livekitRoom?.localParticipant?.identity);
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
  const locked = !canUseApp();
  el.voice.disabled = locked || state.voiceConnecting;
  el.mute.disabled = locked || state.voiceConnecting || !state.voiceEnabled || state.deafened;
  el.deafen.disabled = locked || state.voiceConnecting || !state.voiceEnabled;
  el.camera.disabled = locked || state.voiceConnecting || !state.voiceEnabled;
  el.screenShare.disabled = locked || state.voiceConnecting || !state.voiceEnabled;
  el.voice.textContent = state.voiceConnecting ? "Подключение..." : state.voiceEnabled ? "Выйти из голоса" : "Войти в голос";
  el.mute.textContent = state.micMuted ? "Включить микрофон" : "Выключить микрофон";
  el.deafen.textContent = state.deafened ? "Включить звук и микрофон" : "Выключить звук и микрофон";
  el.camera.textContent = state.cameraEnabled ? "Выключить камеру" : "Включить камеру";
  el.screenShare.textContent = state.screenShareEnabled ? "Остановить демонстрацию" : "Показать экран";
  if (state.voiceConnecting) {
    el.voiceStatus.textContent = "Подключение к голосовому каналу...";
  } else if (!state.voiceEnabled) {
    el.voiceStatus.textContent = "Не в голосовом канале";
  } else if (state.deafened) {
    el.voiceStatus.textContent = "Звук и микрофон выключены";
  } else if (state.micMuted) {
    el.voiceStatus.textContent = "Микрофон выключен";
  } else {
    el.voiceStatus.textContent = "В голосовом канале";
  }
}

function friendlyLiveKitError(error) {
  const message = error?.message || String(error || "");
  if (message.includes("publication of local track timed out")) {
    return "LiveKit подключился, но сеть не дала отправить микрофон на сервер. Попробуй другой браузер, мобильный интернет или VPN.";
  }
  if (message.includes("Abort handler called")) {
    return "подключение было прервано. Подожди пару секунд и попробуй снова.";
  }
  if (message.includes("could not establish signal connection")) {
    return "не удалось связаться с LiveKit. Проверь интернет, VPN или блокировки провайдера.";
  }
  if (error?.name === "NotAllowedError") {
    return "браузер не дал доступ к микрофону.";
  }
  return message;
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
    if (!next) removeLocalVideoTiles(window.LivekitClient.Track.Source.Camera);
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
    if (!next) removeLocalVideoTiles(window.LivekitClient.Track.Source.ScreenShare);
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

function removeVideoTilesForPublication(publication) {
  for (const [key, entry] of state.videoTiles) {
    if (
      entry.publication === publication ||
      (publication.trackSid && entry.publication.trackSid === publication.trackSid)
    ) {
      removeVideoTile(key);
    }
  }
}

function removeLocalVideoTiles(source) {
  for (const [key, entry] of state.videoTiles) {
    if (entry.isLocal && entry.publication.source === source) {
      removeVideoTile(key);
    }
  }
}

function removeParticipantVideo(identity) {
  for (const [key, entry] of state.videoTiles) {
    if (entry.participant.identity === identity) {
      removeVideoTile(key);
    }
  }
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

async function runConnectionCheck() {
  if (!window.LivekitClient?.ConnectionCheck) {
    el.connectionCheckStatus.textContent = "Библиотека проверки LiveKit недоступна.";
    return;
  }
  el.connectionCheck.disabled = true;
  const photonStatus = state.joined ? "Photon: работает" : "Photon: нет подключения";
  el.connectionCheckStatus.textContent = `${photonStatus}. LiveKit: проверка...`;
  try {
    const tokenSource = window.LivekitClient.TokenSource.sandboxTokenServer(LIVEKIT_SANDBOX_ID);
    const credentials = await tokenSource.fetch({
      roomName: `connection-check-${crypto.randomUUID().slice(0, 8)}`,
      participantIdentity: `check-${crypto.randomUUID().slice(0, 8)}`,
      participantName: "Fenegram connection check",
    });
    const check = new window.LivekitClient.ConnectionCheck(credentials.serverUrl, credentials.participantToken);
    const results = [];
    results.push(await check.checkWebsocket());
    results.push(await check.checkWebRTC());
    results.push(await check.checkTURN());
    const successStatus = window.LivekitClient.CheckStatus?.SUCCESS ?? 3;
    const labels = ["WebSocket", "WebRTC", "TURN"];
    const summary = results.map((result, index) => `${labels[index]}: ${result.status === successStatus ? "работает" : "ошибка"}`);
    el.connectionCheckStatus.textContent = `${photonStatus}. ${summary.join(". ")}.`;
    addSystem(`Проверка соединения: ${summary.join(", ")}.`);
  } catch (error) {
    el.connectionCheckStatus.textContent = `${photonStatus}. LiveKit: ошибка ${error.message}`;
    addSystem(`Проверка соединения LiveKit не выполнена: ${error.message}`);
  } finally {
    el.connectionCheck.disabled = false;
  }
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
    profileFromActor(actor);
  }
  renderMembers();
  renderDirectUsers();
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
  for (const [identity, name] of state.voiceParticipants) {
    if (!renderedNames.has(name)) {
      const isLocal = identity === state.livekitRoom?.localParticipant?.identity || name === el.name.value.trim();
      renderMemberRow(name, isLocal, renderedNames);
    }
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
  el.message.disabled = !connected || !canUseApp();
  el.form.querySelector("button").disabled = !connected || !canUseApp();
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

function addMessage(author, text, system = false, container = el.messages, profile = null) {
  const item = document.createElement("div");
  item.className = `message${system ? " system" : ""}`;
  if (profile) {
    const header = document.createElement("div");
    header.className = "message-header";
    header.appendChild(createAvatar(profile, "message-avatar"));
    const authorEl = document.createElement("div");
    authorEl.className = "author";
    authorEl.textContent = author;
    header.appendChild(authorEl);
    const textEl = document.createElement("div");
    textEl.textContent = text;
    item.append(header, textEl);
  } else {
    item.innerHTML = `<div class="author">${escapeHtml(author)}</div><div>${escapeHtml(text)}</div>`;
  }
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
