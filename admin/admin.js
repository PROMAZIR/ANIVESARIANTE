import {
  celebrantId,
  firestoreCelebrantToPerson,
  getFirebaseServices,
  hasFirebaseConfig,
  normalizeGender,
  normalizeSlug
} from "../firebase-client.js";

const statusPanel = document.querySelector("#statusPanel");
const loginPanel = document.querySelector("#loginPanel");
const loginForm = document.querySelector("#loginForm");
const dashboard = document.querySelector("#dashboard");
const signOutButton = document.querySelector("#signOutButton");
const celebrantList = document.querySelector("#celebrantList");
const celebrantForm = document.querySelector("#celebrantForm");
const newCelebrantButton = document.querySelector("#newCelebrantButton");
const publicLink = document.querySelector("#publicLink");
const formTitle = document.querySelector("#formTitle");
const formFeedback = document.querySelector("#formFeedback");
const adminMessages = document.querySelector("#adminMessages");
const refreshMessagesButton = document.querySelector("#refreshMessagesButton");

let services;
let currentUser;
let currentCelebrantId = "";
let cachedCelebrants = [];

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(message) {
  statusPanel.textContent = message || "";
}

function firebaseErrorMessage(error) {
  const code = error?.code || "";

  if (code === "app/timeout" || error?.name === "TimeoutError") {
    return "O Firebase demorou para responder. Confira internet, Firestore ativo e regras publicadas.";
  }

  if (code.includes("permission-denied")) {
    return "Sem permissao no Firestore. Confira se as regras foram publicadas e se existe admins/{UID} para este usuario.";
  }

  if (code.includes("unauthenticated")) {
    return "Sessao expirada. Saia e entre novamente.";
  }

  if (code.includes("unavailable")) {
    return "Firebase indisponivel agora. Tente novamente em alguns segundos.";
  }

  if (code.includes("not-found")) {
    return "Documento nao encontrado no Firestore.";
  }

  return error?.message || "Nao foi possivel concluir esta acao.";
}

function withTimeout(promise, message, timeoutMs = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => {
        const error = new Error(message);
        error.name = "TimeoutError";
        error.code = "app/timeout";
        reject(error);
      }, timeoutMs);
    })
  ]);
}

function field(id) {
  return document.querySelector(`#${id}`);
}

function publicUrl(person) {
  return `${window.location.origin}/aniversariantes/${person.genero}/${person.slug}`;
}

function emptyFormData() {
  return {
    genero: "feminino",
    slug: "",
    nome: "",
    apelido: "",
    idade: "",
    data: "",
    cidade: "",
    whatsapp: "",
    foto: "assets/aniversario-hero.png",
    destaque: "",
    recado: "",
    ativo: true,
    mensagem1: "",
    mensagem2: "",
    mensagem3: "",
    momento1Titulo: "Mensagem especial",
    momento1Texto: "O recado abre direto no WhatsApp.",
    momento2Titulo: "Presenca",
    momento2Texto: "Mesmo de longe, cada pessoa consegue mandar carinho.",
    momento3Titulo: "Novo ciclo",
    momento3Texto: "Mais um ano de boas historias pela frente.",
    temaPrimario: "",
    temaSecundario: "",
    temaDestaque: "",
    temaTexto: ""
  };
}

function fillForm(data) {
  const values = { ...emptyFormData(), ...data };
  const ids = [
    "genero",
    "slug",
    "nome",
    "apelido",
    "idade",
    "data",
    "cidade",
    "whatsapp",
    "foto",
    "destaque",
    "recado",
    "mensagem1",
    "mensagem2",
    "mensagem3",
    "momento1Titulo",
    "momento1Texto",
    "momento2Titulo",
    "momento2Texto",
    "momento3Titulo",
    "momento3Texto",
    "temaPrimario",
    "temaSecundario",
    "temaDestaque",
    "temaTexto"
  ];

  ids.forEach((id) => {
    field(id).value = values[id] || "";
  });

  field("ativo").checked = values.ativo !== false;
  formTitle.textContent = values.nome ? `Editando ${values.nome}` : "Novo aniversariante";

  if (values.slug) {
    publicLink.href = publicUrl(values);
    publicLink.hidden = false;
  } else {
    publicLink.hidden = true;
  }
}

function getFormData() {
  return {
    genero: normalizeGender(field("genero").value),
    slug: normalizeSlug(field("slug").value),
    nome: field("nome").value.trim(),
    apelido: field("apelido").value.trim(),
    idade: field("idade").value.trim(),
    data: field("data").value.trim(),
    cidade: field("cidade").value.trim(),
    whatsapp: field("whatsapp").value.replace(/\D/g, ""),
    foto: field("foto").value.trim() || "assets/aniversario-hero.png",
    destaque: field("destaque").value.trim(),
    recado: field("recado").value.trim(),
    ativo: field("ativo").checked,
    mensagem1: field("mensagem1").value.trim(),
    mensagem2: field("mensagem2").value.trim(),
    mensagem3: field("mensagem3").value.trim(),
    momento1Titulo: field("momento1Titulo").value.trim(),
    momento1Texto: field("momento1Texto").value.trim(),
    momento2Titulo: field("momento2Titulo").value.trim(),
    momento2Texto: field("momento2Texto").value.trim(),
    momento3Titulo: field("momento3Titulo").value.trim(),
    momento3Texto: field("momento3Texto").value.trim(),
    temaPrimario: field("temaPrimario").value.trim(),
    temaSecundario: field("temaSecundario").value.trim(),
    temaDestaque: field("temaDestaque").value.trim(),
    temaTexto: field("temaTexto").value.trim()
  };
}

function personToFormData(person) {
  const moments = person.momentos || [];

  return {
    genero: person.genero,
    slug: person.slug,
    nome: person.nome,
    apelido: person.apelido,
    idade: person.idade,
    data: person.data,
    cidade: person.cidade,
    whatsapp: person.whatsapp,
    foto: person.foto,
    destaque: person.destaque,
    recado: person.recado,
    ativo: person.ativo,
    mensagem1: person.mensagens?.[0] || "",
    mensagem2: person.mensagens?.[1] || "",
    mensagem3: person.mensagens?.[2] || "",
    momento1Titulo: moments[0]?.titulo || "",
    momento1Texto: moments[0]?.texto || "",
    momento2Titulo: moments[1]?.titulo || "",
    momento2Texto: moments[1]?.texto || "",
    momento3Titulo: moments[2]?.titulo || "",
    momento3Texto: moments[2]?.texto || "",
    temaPrimario: person.tema?.primario || "",
    temaSecundario: person.tema?.secundario || "",
    temaDestaque: person.tema?.destaque || "",
    temaTexto: person.tema?.texto || ""
  };
}

function validateFormData(data) {
  if (!data.genero || !data.slug || !data.nome || !data.apelido) {
    return "Preencha genero, slug, nome e apelido.";
  }

  if (!data.whatsapp || data.whatsapp.length < 10) {
    return "Informe o WhatsApp com DDI e DDD.";
  }

  if (!data.destaque || !data.recado || !data.mensagem1) {
    return "Preencha destaque, recado e pelo menos a primeira mensagem.";
  }

  return "";
}

function buildFirestoreData(data, createdAt, updatedAt) {
  return {
    id: celebrantId(data.genero, data.slug),
    genero: data.genero,
    slug: data.slug,
    nome: data.nome,
    apelido: data.apelido,
    idade: data.idade,
    data: data.data,
    cidade: data.cidade,
    whatsapp: data.whatsapp,
    foto: data.foto,
    destaque: data.destaque,
    recado: data.recado,
    ativo: data.ativo,
    mensagem1: data.mensagem1,
    mensagem2: data.mensagem2,
    mensagem3: data.mensagem3,
    momento1Titulo: data.momento1Titulo,
    momento1Texto: data.momento1Texto,
    momento2Titulo: data.momento2Titulo,
    momento2Texto: data.momento2Texto,
    momento3Titulo: data.momento3Titulo,
    momento3Texto: data.momento3Texto,
    temaPrimario: data.temaPrimario,
    temaSecundario: data.temaSecundario,
    temaDestaque: data.temaDestaque,
    temaTexto: data.temaTexto,
    createdAt,
    updatedAt
  };
}

async function loadCelebrants() {
  const { db, firestoreSdk } = services;
  const { collection, getDocs, limit, orderBy, query } = firestoreSdk;
  const snapshot = await getDocs(
    query(collection(db, "celebrants"), orderBy("updatedAt", "desc"), limit(100))
  );

  cachedCelebrants = snapshot.docs.map((documentSnapshot) =>
    firestoreCelebrantToPerson(documentSnapshot.id, documentSnapshot.data())
  );

  renderCelebrantList();
}

function renderCelebrantList() {
  if (!cachedCelebrants.length) {
    celebrantList.innerHTML = `<p class="muted">Nenhuma pagina cadastrada ainda.</p>`;
    return;
  }

  celebrantList.innerHTML = cachedCelebrants
    .map(
      (person) => `
        <button
          class="celebrant-item"
          type="button"
          data-id="${person.id}"
          aria-current="${person.id === currentCelebrantId}"
        >
          <strong>${escapeHtml(person.nome)}</strong>
          <small>${escapeHtml(person.genero)}/${escapeHtml(person.slug)}</small>
        </button>
      `
    )
    .join("");
}

async function selectCelebrant(id) {
  currentCelebrantId = id;
  renderCelebrantList();
  const person = cachedCelebrants.find((item) => item.id === id);

  if (!person) {
    return;
  }

  fillForm(personToFormData(person));
  await loadMessages(id);
}

async function loadMessages(id = currentCelebrantId) {
  if (!id) {
    adminMessages.innerHTML = `<p class="muted">Salve ou selecione uma pagina para ver mensagens.</p>`;
    return;
  }

  const { db, firestoreSdk } = services;
  const { collection, getDocs, limit, orderBy, query } = firestoreSdk;
  const snapshot = await getDocs(
    query(collection(db, "celebrants", id, "messages"), orderBy("createdAt", "desc"), limit(50))
  );

  if (snapshot.empty) {
    adminMessages.innerHTML = `<p class="muted">Nenhuma mensagem no mural.</p>`;
    return;
  }

  adminMessages.innerHTML = snapshot.docs
    .map((documentSnapshot) => {
      const data = documentSnapshot.data();
      const date =
        data.createdAt && typeof data.createdAt.toDate === "function"
          ? data.createdAt.toDate().toLocaleString("pt-BR")
          : "";

      return `
        <article class="admin-message" data-id="${documentSnapshot.id}">
          <div>
            <p>${escapeHtml(data.texto || "")}</p>
            <small>${escapeHtml(data.nome || "Visitante")} ${
        date ? `- ${escapeHtml(date)}` : ""
      }</small>
          </div>
          <button class="danger-button" type="button" data-delete-message="${documentSnapshot.id}">
            Apagar
          </button>
        </article>
      `;
    })
    .join("");
}

async function saveCelebrant(event) {
  event.preventDefault();
  const submitButton = celebrantForm.querySelector('button[type="submit"]');
  formFeedback.textContent = "Salvando...";
  submitButton.disabled = true;

  try {
    const data = getFormData();
    const error = validateFormData(data);

    if (error) {
      formFeedback.textContent = error;
      return;
    }

    const { db, firestoreSdk } = services;
    const { doc, serverTimestamp, setDoc } = firestoreSdk;
    const id = celebrantId(data.genero, data.slug);
    const documentRef = doc(db, "celebrants", id);
    const payload = buildFirestoreData(data, serverTimestamp(), serverTimestamp());

    await withTimeout(
      setDoc(documentRef, payload),
      "Tempo limite ao salvar no Firestore."
    );
    currentCelebrantId = id;
    formFeedback.textContent = "Pagina salva.";
    await withTimeout(loadCelebrants(), "Tempo limite ao atualizar a lista.");
    await loadMessages(id);
  } catch (error) {
    formFeedback.textContent = firebaseErrorMessage(error);
    console.error(error);
  } finally {
    submitButton.disabled = false;
  }
}

async function deleteMessage(messageId) {
  if (!currentCelebrantId || !messageId) {
    return;
  }

  try {
    const { db, firestoreSdk } = services;
    const { deleteDoc, doc } = firestoreSdk;
    await deleteDoc(doc(db, "celebrants", currentCelebrantId, "messages", messageId));
    await loadMessages(currentCelebrantId);
  } catch (error) {
    setStatus(firebaseErrorMessage(error));
    console.error(error);
  }
}

async function checkAdmin(user) {
  const { db, firestoreSdk } = services;
  const { doc, getDoc } = firestoreSdk;
  const snapshot = await withTimeout(
    getDoc(doc(db, "admins", user.uid)),
    "Tempo limite ao verificar permissao do admin."
  );

  return snapshot.exists();
}

async function boot() {
  if (!hasFirebaseConfig()) {
    setStatus("Preencha firebase-config.js com a configuracao Web App do Firebase.");
    loginPanel.hidden = true;
    dashboard.hidden = true;
    return;
  }

  services = await withTimeout(
    getFirebaseServices(),
    "Tempo limite ao carregar Firebase."
  );
  const { auth, authSdk } = services;
  const { onAuthStateChanged, signOut } = authSdk;

  loginPanel.hidden = false;
  setStatus("Entre com o e-mail e senha do admin.");

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;

    if (!user) {
      loginPanel.hidden = false;
      dashboard.hidden = true;
      signOutButton.hidden = true;
      setStatus("Entre com o e-mail e senha do admin.");
      return;
    }

    signOutButton.hidden = false;
    setStatus("Verificando permissao do admin...");

    try {
      const allowed = await checkAdmin(user);

      if (!allowed) {
        loginPanel.hidden = true;
        dashboard.hidden = true;
        setStatus(`Usuario autenticado, mas sem permissao de admin. UID: ${user.uid}`);
        return;
      }

      loginPanel.hidden = true;
      dashboard.hidden = false;
      setStatus("");
      fillForm(emptyFormData());
      await loadCelebrants();
      await loadMessages("");
    } catch (error) {
      setStatus(`${firebaseErrorMessage(error)} UID: ${user.uid}`);
      console.error(error);
    }
  });

  signOutButton.addEventListener("click", () => signOut(auth));
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Entrando...");

  try {
    const { auth, authSdk } = services;
    const { signInWithEmailAndPassword } = authSdk;
    await withTimeout(
      signInWithEmailAndPassword(
        auth,
        field("loginEmail").value.trim(),
        field("loginPassword").value
      ),
      "Tempo limite ao entrar no Firebase."
    );
  } catch (error) {
    setStatus(firebaseErrorMessage(error));
    console.error(error);
  }
});

celebrantList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-id]");

  if (button) {
    await selectCelebrant(button.dataset.id);
  }
});

newCelebrantButton.addEventListener("click", () => {
  currentCelebrantId = "";
  renderCelebrantList();
  fillForm(emptyFormData());
  adminMessages.innerHTML = `<p class="muted">Salve a pagina para receber mensagens.</p>`;
  formFeedback.textContent = "";
});

celebrantForm.addEventListener("submit", saveCelebrant);
refreshMessagesButton.addEventListener("click", () => loadMessages());

adminMessages.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-message]");

  if (button) {
    await deleteMessage(button.dataset.deleteMessage);
  }
});

boot().catch((error) => {
  setStatus("Erro ao iniciar o admin. Confira firebase-config.js.");
  console.error(error);
});
