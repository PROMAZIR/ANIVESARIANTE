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

  function appBase() {
    return window.APP_ASSET_BASE || (window.location.protocol === "file:" ? "" : "/");
  }

  function assetUrl(value) {
    const raw = String(value || "assets/aniversario-hero.png");

    if (/^(https?:|data:|blob:|\/)/i.test(raw)) {
      return raw;
    }

    return `${appBase()}${raw.replace(/^\.?\//, "")}`;
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
        console.warn("Firestore indisponivel, usando fallback local.", error);
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

        console.error(error);
      }
    );
  }

  function renderPerson(person, services) {
    setTheme(person);
    document.title = `${person.nome} | Aniversario`;

    const photoUrl = assetUrl(person.foto);
    const messages = person.mensagens || [];
    const moments = person.momentos || [];
    const firstName = person.apelido || person.nome;
    const initialMessage =
      messages[0] || `Feliz aniversario, ${firstName}! Muitas felicidades.`;

    app.innerHTML = `
      <section class="hero" style="--hero-image: url('${escapeHtml(photoUrl)}')">
        <nav class="topbar" aria-label="Pagina do aniversariante">
          <a class="brand" href="${escapeHtml(routeTo(person))}">
            <span class="brand-mark" aria-hidden="true">+</span>
            <span>${escapeHtml(firstName)}</span>
          </a>
          <button class="topbar-action" id="copyPage" type="button">Copiar link</button>
        </nav>

        <div class="hero-content">
          <div class="hero-copy">
            <p class="eyebrow">${escapeHtml(person.data)} - ${escapeHtml(
      person.cidade
    )}</p>
            <h1>Feliz aniversario, ${escapeHtml(firstName)}</h1>
            <p class="hero-lead">${escapeHtml(person.destaque)}</p>
            <div class="hero-meta" aria-label="Dados do aniversariante">
              <span>${escapeHtml(person.idade)} anos</span>
              <span>${escapeHtml(person.nome)}</span>
            </div>
          </div>

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
                      ${index + 1}
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
            <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(person.nome)}">
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
        console.error(error);
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
        console.error(error);
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
  }

  const route = getCurrentRoute();

  if (!route.slug) {
    renderStart();
    return;
  }

  const services = await getFirebaseServices().catch((error) => {
    console.warn("Firebase nao inicializado.", error);
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
