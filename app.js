import {
  celebrantId,
  firestoreCelebrantToPerson,
  getFirebaseServices,
  normalizeGender,
  normalizeSlug
} from "./firebase-client.js";

(async function () {
  const app = document.querySelector("#app");
  const themePresets = {
    feminino: {
      primario: "#7b2f6f",
      secundario: "#e85d75",
      destaque: "#f6b73c",
      texto: "#211827",
      papel: "#fff7fb",
      superficie: "#ffffff"
    },
    masculino: {
      primario: "#245c4f",
      secundario: "#2f6f9f",
      destaque: "#f2b705",
      texto: "#16212b",
      papel: "#f4fbf8",
      superficie: "#ffffff"
    }
  };

  function getCurrentRoute() {
    const params = new URLSearchParams(window.location.search);
    const querySlug = params.get("slug") || params.get("pessoa");
    const queryGender = params.get("genero") || params.get("tema");

    if (querySlug) {
      return {
        genero: normalizeGender(queryGender),
        slug: normalizeSlug(querySlug)
      };
    }

    const parts = window.location.pathname
      .split("/")
      .map((part) => normalizeSlug(part))
      .filter(Boolean);

    if (!parts.length || parts[0] === "indexhtml") {
      return { genero: "", slug: "" };
    }

    if (parts[0] === "aniversariante" || parts[0] === "aniversariantes") {
      return {
        genero: normalizeGender(parts[1]),
        slug: normalizeGender(parts[1]) ? parts[2] || "" : parts[1] || ""
      };
    }

    return {
      genero: normalizeGender(parts[0]),
      slug: normalizeGender(parts[0]) ? parts[1] || "" : parts[0]
    };
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function phoneDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function isSystemErrorText(value) {
    return /sem permissao|firestore|admins\/|uid logado/i.test(String(value || ""));
  }

  function debugEnabled() {
    return new URLSearchParams(window.location.search).has("debug");
  }

  function debugLog(message, error) {
    if (debugEnabled()) {
      console.error(message, error);
    }
  }

  function publicMessages(person) {
    return (person.mensagens || [])
      .map((message) => String(message || "").trim())
      .filter((message) => message && !isSystemErrorText(message));
  }

  function appBase() {
    return window.APP_ASSET_BASE || (window.location.protocol === "file:" ? "" : "/");
  }

  function assetUrl(value) {
    const raw = String(value || "assets/aniversario-hero.png");

    if (/^(https?:|data:|blob:|\/)/i.test(raw)) {
      return raw;
    }

    const localPath = raw.replace(/^\.?\//, "");
    const shouldUseAssetsFolder =
      !localPath.includes("/") &&
      /\.(png|jpe?g|webp|gif|mp3|wav|ogg|m4a)$/i.test(localPath);

    return `${appBase()}${shouldUseAssetsFolder ? `assets/${localPath}` : localPath}`;
  }

  function optionalAssetUrl(value) {
    const raw = String(value || "").trim();

    return raw ? assetUrl(raw) : "";
  }

  function youtubeVideoId(value) {
    const raw = String(value || "").trim();

    if (!raw) {
      return "";
    }

    try {
      const url = new URL(raw);
      const host = url.hostname.replace(/^www\./, "");
      let videoId = "";

      if (host === "youtu.be") {
        videoId = url.pathname.split("/").filter(Boolean)[0] || "";
      } else if (host === "youtube.com" || host === "m.youtube.com") {
        if (url.pathname === "/watch") {
          videoId = url.searchParams.get("v") || "";
        } else {
          const parts = url.pathname.split("/").filter(Boolean);

          if (["embed", "shorts", "live"].includes(parts[0])) {
            videoId = parts[1] || "";
          }
        }
      }

      return /^[a-zA-Z0-9_-]{6,20}$/.test(videoId) ? videoId : "";
    } catch (error) {
      return "";
    }
  }

  function splitMusicLines(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function musicTrackFromUrl(rawUrl, title, index) {
    const youtubeId = youtubeVideoId(rawUrl);
    const url = youtubeId ? String(rawUrl).trim() : optionalAssetUrl(rawUrl);

    if (!url) {
      return null;
    }

    return {
      index,
      kind: youtubeId ? "youtube" : "audio",
      title: title || `Musica ${index + 1}`,
      url,
      youtubeSrc: youtubeId
        ? `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&playsinline=1`
        : ""
    };
  }

  function musicTracks(person) {
    const list = Array.isArray(person.musicas) ? person.musicas : [];

    if (list.length) {
      return list
        .map((track, index) =>
          musicTrackFromUrl(track.url, track.titulo || track.title, index)
        )
        .filter(Boolean);
    }

    const music = person.musica || {};
    const urls = splitMusicLines(music.url || person.musicaUrl);
    const titles = splitMusicLines(music.titulo || person.musicaTitulo);

    return urls
      .map((url, index) => musicTrackFromUrl(url, titles[index], index))
      .filter(Boolean);
  }

  function dataUrl(path) {
    return `${appBase()}${path.replace(/^\.?\//, "")}`;
  }

  function createWhatsAppUrl(person, message) {
    const phone = phoneDigits(person.whatsapp);
    const text = encodeURIComponent(message || person.mensagens?.[0] || "");
    return `https://wa.me/${phone}?text=${text}`;
  }

  function routeTo(person) {
    const slug = normalizeSlug(person.slug);
    const gender = normalizeGender(person.genero);

    if (window.location.protocol === "file:") {
      return `index.html?genero=${gender}&slug=${slug}`;
    }

    return `/aniversariantes/${gender}/${slug}`;
  }

  function shareUrlFor(person) {
    if (window.location.protocol === "file:") {
      return new URL(routeTo(person), window.location.href).href;
    }

    return new URL(routeTo(person), window.location.origin).href;
  }

  function storageKey(person) {
    return `mural-aniversario:v3:${normalizeGender(person.genero)}:${normalizeSlug(
      person.slug
    )}`;
  }

  function loadSavedMessages(person) {
    try {
      return JSON.parse(localStorage.getItem(storageKey(person)) || "[]");
    } catch (error) {
      return [];
    }
  }

  function saveMessage(person, message) {
    const saved = loadSavedMessages(person);
    saved.unshift(message);
    localStorage.setItem(storageKey(person), JSON.stringify(saved.slice(0, 30)));
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        reject(new Error(`Nao foi possivel carregar ${src}`));
      };
      document.head.appendChild(script);
    });
  }

  async function loadStaticPersonData(route) {
    const slug = normalizeSlug(route.slug);
    const gender = normalizeGender(route.genero);
    const genders = gender ? [gender] : ["feminino", "masculino"];

    for (const candidateGender of genders) {
      window.ANIVERSARIANTE = null;

      try {
        await loadScript(dataUrl(`data/${candidateGender}/${slug}.js`));
      } catch (error) {
        continue;
      }

      const person = window.ANIVERSARIANTE;

      if (person && normalizeSlug(person.slug) === slug) {
        const genero = normalizeGender(person.genero) || candidateGender;

        return {
          ...person,
          id: celebrantId(genero, slug),
          genero,
          slug
        };
      }
    }

    return null;
  }

  async function loadFirestorePersonData(services, route) {
    if (!services) {
      return null;
    }

    const slug = normalizeSlug(route.slug);
    const gender = normalizeGender(route.genero);
    const genders = gender ? [gender] : ["feminino", "masculino"];
    const { db, firestoreSdk } = services;
    const { doc, getDoc } = firestoreSdk;

    for (const candidateGender of genders) {
      const id = celebrantId(candidateGender, slug);

      try {
        const snapshot = await getDoc(doc(db, "celebrants", id));

        if (snapshot.exists()) {
          return firestoreCelebrantToPerson(snapshot.id, snapshot.data());
        }
      } catch (error) {
        debugLog("Firestore indisponivel, usando fallback local.", error);
        return null;
      }
    }

    return null;
  }

  function setTheme(person) {
    const preset = themePresets[normalizeGender(person.genero)] || themePresets.feminino;
    const theme = { ...preset, ...(person.tema || {}) };

    document.documentElement.style.setProperty("--color-primary", theme.primario);
    document.documentElement.style.setProperty("--color-secondary", theme.secundario);
    document.documentElement.style.setProperty("--color-accent", theme.destaque);
    document.documentElement.style.setProperty("--color-text", theme.texto);
    document.documentElement.style.setProperty("--color-paper", theme.papel);
    document.documentElement.style.setProperty("--color-surface", theme.superficie);
  }

  function renderStart() {
    app.innerHTML = `
      <section class="empty-state">
        <p class="eyebrow">Link individual</p>
        <h1>Abra a pagina pelo link do aniversariante.</h1>
        <p>O admin cadastra cada pessoa em /admin/. A pagina publica nao lista outros aniversariantes.</p>
      </section>
    `;
  }

  function renderNotFound() {
    app.innerHTML = `
      <section class="empty-state">
        <p class="eyebrow">Pagina nao encontrada</p>
        <h1>Esse aniversariante nao foi localizado.</h1>
        <p>Confira se o link enviado pelo admin esta correto.</p>
      </section>
    `;
  }

  function wallMessages(person) {
    const firebaseMessages = person.firebaseMessages || [];
    const localMessages = person.usesFirestore ? [] : loadSavedMessages(person);

    return [...firebaseMessages, ...localMessages, ...(person.mural || [])].slice(0, 30);
  }

  function wallMarkup(person) {
    const messages = wallMessages(person);

    if (!messages.length) {
      return `
        <div class="wall-empty">
          <p>As mensagens que forem guardadas nesta pagina aparecem aqui.</p>
        </div>
      `;
    }

    return messages
      .map(
        (message) => `
          <article class="wall-message">
            <p>${escapeHtml(message.texto)}</p>
            <footer>
              <strong>${escapeHtml(message.nome || "Mensagem")}</strong>
              <span>${escapeHtml(message.data || "")}</span>
            </footer>
          </article>
        `
      )
      .join("");
  }

  function musicMarkup(person) {
    const tracks = musicTracks(person);

    if (!tracks.length) {
      return "";
    }

    const firstTrack = tracks[0];

    return `
      <div class="music-player mini-system" id="musicPlayer">
        <div class="speaker-stack" aria-hidden="true">
          <span class="speaker speaker-large"></span>
          <span class="speaker speaker-small"></span>
        </div>
        <div class="system-main">
          <div class="system-display">
            <span class="system-kicker" id="musicStatus">Pronta</span>
            <strong id="musicTitle">${escapeHtml(firstTrack.title)}</strong>
            <span id="musicCounter">1/${tracks.length} ${
      firstTrack.kind === "youtube" ? "YouTube" : "MP3"
    }</span>
          </div>
          <div class="system-controls" aria-label="Controles de musica">
            <button class="system-button" id="musicPrev" type="button" aria-label="Musica anterior">
              &#8249;
            </button>
            <button
              class="system-button system-play"
              id="musicToggle"
              type="button"
              aria-label="Tocar ou pausar musica"
              aria-pressed="false"
            >
              &#9654;
            </button>
            <button class="system-button" id="musicNext" type="button" aria-label="Proxima musica">
              &#8250;
            </button>
          </div>
          <div class="system-eq" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div class="music-playlist" aria-label="Lista de musicas">
            ${tracks
              .map(
                (track, index) => `
                  <button
                    class="music-track"
                    type="button"
                    data-index="${index}"
                    data-kind="${escapeHtml(track.kind)}"
                    data-title="${escapeHtml(track.title)}"
                    data-url="${escapeHtml(track.url)}"
                    data-youtube-src="${escapeHtml(track.youtubeSrc)}"
                    aria-current="${index === 0 ? "true" : "false"}"
                  >
                    <span>${index + 1}</span>
                    <strong>${escapeHtml(track.title)}</strong>
                    <small>${track.kind === "youtube" ? "YouTube" : "MP3"}</small>
                  </button>
                `
              )
              .join("")}
          </div>
          <div class="youtube-music-embed" id="youtubeMusicEmbed" hidden></div>
          <audio
            id="birthdayAudio"
            src="${firstTrack.kind === "audio" ? escapeHtml(firstTrack.url) : ""}"
            preload="metadata"
          ></audio>
        </div>
        <div class="speaker-stack speaker-stack-right" aria-hidden="true">
          <span class="speaker speaker-large"></span>
          <span class="speaker speaker-small"></span>
        </div>
      </div>
    `;
  }

  function renderWall(person) {
    const wallList = document.querySelector("#wallList");

    if (wallList) {
      wallList.innerHTML = wallMarkup(person);
    }
  }

  function formatFirestoreDate(value) {
    if (!value) {
      return "Agora";
    }

    if (typeof value.toDate === "function") {
      return value.toDate().toLocaleDateString("pt-BR");
    }

    return String(value);
  }

  function subscribeFirebaseMessages(person, services) {
    if (!services || !person.usesFirestore) {
      return;
    }

    const { db, firestoreSdk } = services;
    const { collection, limit, onSnapshot, orderBy, query } = firestoreSdk;
    const messageQuery = query(
      collection(db, "celebrants", person.id, "messages"),
      orderBy("createdAt", "desc"),
      limit(30)
    );

    person.unsubscribeMessages = onSnapshot(
      messageQuery,
      (snapshot) => {
        person.firebaseMessages = snapshot.docs.map((documentSnapshot) => {
          const data = documentSnapshot.data();

          return {
            id: documentSnapshot.id,
            nome: data.nome || "Visitante",
            texto: data.texto || "",
            data: formatFirestoreDate(data.createdAt)
          };
        });
        renderWall(person);
      },
      (error) => {
        const feedback = document.querySelector("#copyFeedback");

        if (feedback) {
          feedback.textContent =
            "Nao consegui carregar o mural online. Confira as regras do Firestore.";
        }

        debugLog("Nao foi possivel carregar o mural online.", error);
      }
    );
  }

  function renderPerson(person, services) {
    setTheme(person);
    document.title = `${person.nome} | Aniversario`;

    const photoUrl = assetUrl(person.foto);
    const moments = person.momentos || [];
    const firstName = person.apelido || person.nome;
    const brandInitial = (firstName || person.nome || "+").trim().charAt(0).toUpperCase() || "+";
    const fallbackMessage = `Feliz Aniversario, ${firstName}! Muitas felicidades.`;
    const configuredMessages = publicMessages(person);
    const messages = configuredMessages.length ? configuredMessages : [fallbackMessage];
    const initialMessage = messages[0];

    app.innerHTML = `
      <section class="hero" style="--hero-image: url('${escapeHtml(photoUrl)}')">
        <nav class="topbar" aria-label="Pagina do aniversariante">
          <a class="brand" href="${escapeHtml(routeTo(person))}">
            <span class="brand-mark" aria-hidden="true">${escapeHtml(brandInitial)}</span>
            <span class="brand-text">${escapeHtml(firstName)}</span>
          </a>
          <button class="topbar-action" id="copyPage" type="button">Copiar link</button>
        </nav>

        <div class="hero-content">
          <div class="hero-copy">
            <p class="eyebrow">${escapeHtml(person.data)} - ${escapeHtml(
      person.cidade
    )}</p>
            <h1>Feliz Aniversario, ${escapeHtml(firstName)}</h1>
            <p class="hero-lead">${escapeHtml(person.destaque)}</p>
            <div class="hero-meta" aria-label="Dados do aniversariante">
              <span>${escapeHtml(person.idade)} anos</span>
              <span>${escapeHtml(person.nome)}</span>
            </div>
            ${musicMarkup(person)}
          </div>
        </div>
      </section>

      <section class="message-section" aria-label="Enviar mensagem">
        <div class="section-inner">
          <aside class="message-panel" aria-label="Escrever mensagem para o aniversariante">
            <p class="panel-label">Escreva sua mensagem</p>
            <input id="senderName" class="message-input" type="text" placeholder="Seu nome">
            <textarea id="messageText" rows="6" placeholder="Digite sua mensagem aqui">${escapeHtml(
              initialMessage
            )}</textarea>
            <p class="message-help">Use "Guardar no mural" para deixar a mensagem na pagina, ou envie tambem pelo WhatsApp.</p>
            <div class="quick-messages" aria-label="Frases prontas">
              ${messages
                .map(
                  (message, index) => `
                    <button class="quick-message" type="button" data-message="${escapeHtml(
                      message
                    )}">
                      <span>${index + 1}</span>
                      <strong>${escapeHtml(message)}</strong>
                    </button>
                  `
                )
                .join("")}
            </div>
            <div class="panel-actions">
              <button class="primary-button" id="sendWhatsapp" type="button">
                <span class="whatsapp-dot" aria-hidden="true"></span>
                Enviar no WhatsApp
              </button>
              <button class="secondary-button" id="saveOnWall" type="button">
                Guardar no mural
              </button>
            </div>
            <p class="copy-feedback" id="copyFeedback" role="status"></p>
          </aside>
        </div>
      </section>

      <section class="letter-section">
        <div class="section-inner split">
          <div>
            <p class="eyebrow">Recado especial</p>
            <h2>${escapeHtml(person.recado)}</h2>
          </div>
          <div class="celebrant-photo">
            <img
              src="${escapeHtml(photoUrl)}"
              alt="${escapeHtml(person.nome)}"
              loading="lazy"
              decoding="async"
              onerror="this.closest('.celebrant-photo').classList.add('is-missing-image')"
            >
            <span class="photo-fallback">Imagem nao encontrada</span>
          </div>
        </div>
      </section>

      <section class="wall-section">
        <div class="section-inner">
          <div class="section-heading">
            <p class="eyebrow">Mural</p>
            <h2>Mensagens que ficam na tela</h2>
          </div>
          <div class="wall-list" id="wallList">
            ${wallMarkup(person)}
          </div>
        </div>
      </section>

      <section class="moments-section">
        <div class="section-inner">
          <div class="section-heading">
            <p class="eyebrow">Hoje</p>
            <h2>Carinho em poucos toques</h2>
          </div>
          <div class="moment-grid">
            ${moments
              .map(
                (moment) => `
                  <article class="moment-card">
                    <span class="moment-icon" aria-hidden="true"></span>
                    <h3>${escapeHtml(moment.titulo)}</h3>
                    <p>${escapeHtml(moment.texto)}</p>
                  </article>
                `
              )
              .join("")}
          </div>
        </div>
      </section>
    `;

    bindPersonEvents(person, services);
    subscribeFirebaseMessages(person, services);
  }

  function messageFromForm() {
    const textarea = document.querySelector("#messageText");
    const senderName = document.querySelector("#senderName");

    return {
      nome: senderName.value.trim() || "Visitante",
      texto: textarea.value.trim(),
      data: new Date().toLocaleDateString("pt-BR")
    };
  }

  async function addCurrentMessageToWall(person, services) {
    const message = messageFromForm();
    const feedback = document.querySelector("#copyFeedback");

    if (!message.texto) {
      feedback.textContent = "Escreva uma mensagem primeiro.";
      return null;
    }

    if (services && person.usesFirestore) {
      const { db, firestoreSdk } = services;
      const { addDoc, collection, serverTimestamp } = firestoreSdk;

      await addDoc(collection(db, "celebrants", person.id, "messages"), {
        nome: message.nome,
        texto: message.texto,
        origem: "site",
        createdAt: serverTimestamp()
      });
      feedback.textContent = "Mensagem guardada no mural.";
      return message;
    }

    saveMessage(person, message);
    renderWall(person);
    feedback.textContent = "Mensagem guardada no mural deste navegador.";
    return message;
  }

  function bindPersonEvents(person, services) {
    const textarea = document.querySelector("#messageText");
    const sendButton = document.querySelector("#sendWhatsapp");
    const saveButton = document.querySelector("#saveOnWall");
    const copyButton = document.querySelector("#copyPage");
    const copyFeedback = document.querySelector("#copyFeedback");
    const quickButtons = Array.from(document.querySelectorAll(".quick-message"));
    const musicPlayer = document.querySelector("#musicPlayer");
    const musicButton = document.querySelector("#musicToggle");
    const musicStatus = document.querySelector("#musicStatus");
    const musicTitle = document.querySelector("#musicTitle");
    const musicCounter = document.querySelector("#musicCounter");
    const musicPrev = document.querySelector("#musicPrev");
    const musicNext = document.querySelector("#musicNext");
    const musicEmbed = document.querySelector("#youtubeMusicEmbed");
    const trackButtons = Array.from(document.querySelectorAll(".music-track"));
    const audio = document.querySelector("#birthdayAudio");

    quickButtons.forEach((button) => {
      button.addEventListener("click", () => {
        textarea.value = button.dataset.message || "";
        textarea.focus();
      });
    });

    saveButton.addEventListener("click", async () => {
      try {
        await addCurrentMessageToWall(person, services);
      } catch (error) {
        copyFeedback.textContent =
          "Nao consegui salvar no Firebase. Confira a config e as regras.";
        debugLog("Nao foi possivel salvar a mensagem no mural.", error);
      }
    });

    sendButton.addEventListener("click", async () => {
      const phone = phoneDigits(person.whatsapp);
      const message = messageFromForm();

      if (!phone) {
        copyFeedback.textContent = "Cadastre o WhatsApp desta pessoa.";
        return;
      }

      if (!message.texto) {
        copyFeedback.textContent = "Escreva uma mensagem primeiro.";
        return;
      }

      window.open(createWhatsAppUrl(person, message.texto), "_blank", "noopener");

      try {
        await addCurrentMessageToWall(person, services);
      } catch (error) {
        copyFeedback.textContent =
          "WhatsApp aberto. O mural online nao foi atualizado.";
        debugLog("Nao foi possivel atualizar o mural online apos abrir o WhatsApp.", error);
      }
    });

    copyButton.addEventListener("click", async () => {
      const url = shareUrlFor(person);

      try {
        await navigator.clipboard.writeText(url);
        copyFeedback.textContent = "Link copiado.";
      } catch (error) {
        copyFeedback.textContent = url;
      }
    });

    if (
      musicPlayer &&
      musicButton &&
      musicPrev &&
      musicNext &&
      audio &&
      trackButtons.length
    ) {
      let currentTrackIndex = 0;

      const tracks = trackButtons.map((button) => ({
        kind: button.dataset.kind || "audio",
        title: button.dataset.title || "Musica",
        url: button.dataset.url || "",
        youtubeSrc: button.dataset.youtubeSrc || ""
      }));

      const mediaArtwork = () => {
        try {
          return new URL(assetUrl(person.foto), window.location.href).href;
        } catch (error) {
          return "";
        }
      };

      const updateMediaSession = (track) => {
        if (
          typeof navigator === "undefined" ||
          typeof window.MediaMetadata === "undefined" ||
          !navigator.mediaSession ||
          !track
        ) {
          return;
        }

        const artwork = mediaArtwork();
        const artworkList = artwork
          ? [
              { src: artwork, sizes: "96x96" },
              { src: artwork, sizes: "192x192" },
              { src: artwork, sizes: "512x512" }
            ]
          : [];

        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: person.nome || "Aniversariante",
          album: "Pagina de aniversario",
          artwork: artworkList
        });
      };

      const setMediaPlaybackState = (state) => {
        if (typeof navigator !== "undefined" && navigator.mediaSession) {
          navigator.mediaSession.playbackState = state;
        }
      };

      const setMusicButtonPlaying = (isPlaying) => {
        musicPlayer.classList.toggle("is-playing", isPlaying);
        musicButton.setAttribute("aria-pressed", String(isPlaying));
        musicButton.innerHTML = isPlaying ? "&#10074;&#10074;" : "&#9654;";
        setMediaPlaybackState(isPlaying ? "playing" : "paused");
      };

      const hideYoutubeEmbed = () => {
        if (musicEmbed) {
          musicEmbed.hidden = true;
          musicEmbed.innerHTML = "";
        }
      };

      const showYoutubeEmbed = (track) => {
        if (!musicEmbed || !track.youtubeSrc) {
          return;
        }

        musicEmbed.hidden = false;
        musicEmbed.innerHTML = `
          <iframe
            src="${escapeHtml(track.youtubeSrc)}"
            title="${escapeHtml(track.title)}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
          ></iframe>
        `;
      };

      const setCurrentTrack = (index, shouldPlay) => {
        currentTrackIndex = (index + tracks.length) % tracks.length;
        const track = tracks[currentTrackIndex];

        trackButtons.forEach((button, buttonIndex) => {
          button.setAttribute("aria-current", String(buttonIndex === currentTrackIndex));
        });

        if (musicTitle) {
          musicTitle.textContent = track.title;
        }

        if (musicCounter) {
          musicCounter.textContent = `${currentTrackIndex + 1}/${tracks.length} ${
            track.kind === "youtube" ? "YouTube" : "MP3"
          }`;
        }

        updateMediaSession(track);
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        hideYoutubeEmbed();
        setMusicButtonPlaying(false);

        if (track.kind === "audio") {
          audio.src = track.url;

          if (musicStatus) {
            musicStatus.textContent = "Pausada";
          }

          if (shouldPlay) {
            playCurrentTrack();
          }
        } else {
          if (musicStatus) {
            musicStatus.textContent = "YouTube";
          }

          if (shouldPlay) {
            showYoutubeEmbed(track);
            setMusicButtonPlaying(true);

            if (musicStatus) {
              musicStatus.textContent = "YouTube aberto";
            }
          }
        }
      };

      const pauseCurrentTrack = () => {
        const track = tracks[currentTrackIndex];

        if (track?.kind === "youtube") {
          hideYoutubeEmbed();
          setMusicButtonPlaying(false);

          if (musicStatus) {
            musicStatus.textContent = "YouTube";
          }

          return;
        }

        audio.pause();
      };

      const playCurrentTrack = async () => {
        const track = tracks[currentTrackIndex];

        updateMediaSession(track);

        if (track.kind === "youtube") {
          if (musicEmbed && !musicEmbed.hidden) {
            pauseCurrentTrack();
            return;
          }

          showYoutubeEmbed(track);
          setMusicButtonPlaying(true);

          if (musicStatus) {
            musicStatus.textContent = "YouTube aberto";
          }

          return;
        }

        try {
          if (!audio.src) {
            audio.src = track.url;
          }

          if (audio.paused || audio.ended) {
            await audio.play();
          } else {
            audio.pause();
          }
        } catch (error) {
          if (musicStatus) {
            musicStatus.textContent = "Audio indisponivel";
          }

          setMusicButtonPlaying(false);
          debugLog("Nao foi possivel tocar o audio.", error);
        }
      };

      const setMediaHandlers = () => {
        if (typeof navigator === "undefined" || !navigator.mediaSession) {
          return;
        }

        const safeHandler = (action, handler) => {
          try {
            navigator.mediaSession.setActionHandler(action, handler);
          } catch (error) {
            debugLog(`Controle de midia indisponivel: ${action}`, error);
          }
        };

        safeHandler("play", playCurrentTrack);
        safeHandler("pause", pauseCurrentTrack);
        safeHandler("previoustrack", () => setCurrentTrack(currentTrackIndex - 1, true));
        safeHandler("nexttrack", () => setCurrentTrack(currentTrackIndex + 1, true));
        safeHandler("stop", pauseCurrentTrack);
      };

      const syncMusicState = () => {
        const isPlaying = !audio.paused && !audio.ended;

        setMusicButtonPlaying(isPlaying);

        if (musicStatus) {
          musicStatus.textContent = isPlaying ? "Tocando" : "Pausada";
        }
      };

      setMediaHandlers();
      musicButton.addEventListener("click", playCurrentTrack);
      musicPrev.addEventListener("click", () => setCurrentTrack(currentTrackIndex - 1, true));
      musicNext.addEventListener("click", () => setCurrentTrack(currentTrackIndex + 1, true));

      trackButtons.forEach((button) => {
        button.addEventListener("click", () => {
          setCurrentTrack(Number(button.dataset.index || 0), true);
        });
      });

      audio.addEventListener("playing", syncMusicState);
      audio.addEventListener("pause", syncMusicState);
      audio.addEventListener("ended", () => setCurrentTrack(currentTrackIndex + 1, true));
      setCurrentTrack(0, false);
    }
  }

  const route = getCurrentRoute();

  if (!route.slug) {
    renderStart();
    return;
  }

  const services = await getFirebaseServices().catch((error) => {
    debugLog("Firebase nao inicializado.", error);
    return null;
  });
  const firestorePerson = await loadFirestorePersonData(services, route);
  const staticPerson = firestorePerson ? null : await loadStaticPersonData(route);
  const person = firestorePerson || staticPerson;

  if (!person) {
    renderNotFound();
    return;
  }

  person.usesFirestore = Boolean(firestorePerson && services);
  renderPerson(person, services);
})();
