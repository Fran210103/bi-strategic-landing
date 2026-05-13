const API_BASE_URL = "http://localhost:3333";

const state = {
  business: {},
  sessionId: createSessionId(),
  requests: [],
  demoMode: shouldUseStandaloneDemo(),
  bookingStep: null,
  draft: {},
};

const chatWindow = document.querySelector("#chatWindow");
const chatForm = document.querySelector("#chatForm");
const messageInput = document.querySelector("#messageInput");
const requestList = document.querySelector("#requestList");
const totalRequests = document.querySelector("#totalRequests");
const pendingRequests = document.querySelector("#pendingRequests");
const apiStatus = document.querySelector("#apiStatus");

const fields = {
  name: document.querySelector("#businessName"),
  hours: document.querySelector("#businessHours"),
  address: document.querySelector("#businessAddress"),
  services: document.querySelector("#businessServices"),
  policy: document.querySelector("#bookingPolicy"),
};

function createSessionId() {
  const storedId = window.localStorage.getItem("whatsappReservasSessionId");
  if (storedId) return storedId;

  const newId = `demo-web-${Date.now()}`;
  window.localStorage.setItem("whatsappReservasSessionId", newId);
  return newId;
}

function rotateSessionId() {
  const newId = `demo-web-${Date.now()}`;
  window.localStorage.setItem("whatsappReservasSessionId", newId);
  state.sessionId = newId;
}

function shouldUseStandaloneDemo() {
  const host = window.location.hostname;
  const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "";
  return !isLocalHost && window.location.protocol !== "file:";
}

function setApiStatus(status, label) {
  apiStatus.dataset.status = status;
  apiStatus.textContent = label;
}

function readBusinessConfig() {
  state.business = {
    name: fields.name.value.trim() || "la peluqueria",
    hours: fields.hours.value.trim(),
    address: fields.address.value.trim(),
    services: fields.services.value.trim(),
    policy: fields.policy.value.trim(),
  };
}

function addMessage(sender, text) {
  const message = document.createElement("div");
  message.className = `message ${sender}`;

  const label = document.createElement("small");
  label.textContent = sender === "bot" ? "Recepcion" : "Clienta";

  const body = document.createElement("div");
  body.textContent = text;

  message.append(label, body);
  chatWindow.append(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "No se pudo completar la solicitud");
  }

  return data;
}

async function checkBackend() {
  if (state.demoMode) {
    setApiStatus("online", "Demo lista");
    return true;
  }

  try {
    await apiRequest("/health");
    setApiStatus("online", "Sistema listo");
    return true;
  } catch (error) {
    state.demoMode = true;
    setApiStatus("online", "Modo demo");
    addMessage(
      "bot",
      "Voy a mostrar la conversacion en modo demo. Para una prueba real con backend, se activa el sistema local."
    );
    return false;
  }
}

async function sendToAssistant(text) {
  return apiRequest("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      sessionId: state.sessionId,
      from: state.sessionId,
      message: text,
      business: state.business,
    }),
  });
}

async function handleUserMessage(text) {
  if (!text.trim()) return;

  addMessage("user", text);
  messageInput.disabled = true;

  try {
    if (state.demoMode) {
      const result = handleDemoMessage(text);
      result.replies.forEach((reply) => addMessage("bot", reply));
      renderRequests();
      return;
    }

    const result = await sendToAssistant(text);
    result.replies.forEach((reply) => addMessage("bot", reply));

    if (result.reservation) {
      await loadReservations();
    }
  } catch (error) {
    addMessage("bot", `Se corto la atencion por un momento: ${error.message}`);
    setApiStatus("offline", "Revisar conexion");
  } finally {
    messageInput.disabled = false;
    messageInput.focus();
  }
}

async function loadReservations() {
  if (state.demoMode) {
    renderRequests();
    return;
  }

  try {
    const data = await apiRequest("/api/reservations");
    state.requests = (data.reservations || []).filter((request) => request.sessionId === state.sessionId);
    renderRequests();
  } catch (error) {
    addMessage("bot", `No pude actualizar la lista de reservas: ${error.message}`);
  }
}

function renderRequests() {
  requestList.innerHTML = "";

  totalRequests.textContent = state.requests.length;
  pendingRequests.textContent = state.requests.filter((request) => request.status === "Pendiente").length;

  if (!state.requests.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Aun no hay reservas por confirmar. Prueba con una clienta que pide hora.";
    requestList.append(empty);
    return;
  }

  state.requests.forEach((request) => {
    const card = document.createElement("article");
    card.className = "request-card";

    const statusClass = request.status === "Confirmada"
      ? "status-confirmed"
      : request.status === "Cerrada" || request.status === "Cancelada"
        ? "status-closed"
        : "status-pending";

    card.innerHTML = `
      <span class="status-tag ${statusClass}">${request.status}</span>
      <h3>${request.customerName || "Sin nombre"}</h3>
      <dl>
        <dt>Servicio</dt>
        <dd>${request.service || "-"}</dd>
        <dt>Dia</dt>
        <dd>${request.preferredDay || "-"}</dd>
        <dt>Horario</dt>
        <dd>${request.preferredTime || "-"}</dd>
        <dt>Telefono</dt>
        <dd>${request.phone || "-"}</dd>
        <dt>Registro</dt>
        <dd>${formatDate(request.createdAt)}</dd>
      </dl>
    `;

    const actions = document.createElement("div");
    actions.className = "request-actions";

    const confirmButton = document.createElement("button");
    confirmButton.className = "confirm-button";
    confirmButton.type = "button";
    confirmButton.textContent = "Confirmar";
    confirmButton.addEventListener("click", () => updateRequestStatus(request.id, "Confirmada"));

    const closeButton = document.createElement("button");
    closeButton.className = "close-button";
    closeButton.type = "button";
    closeButton.textContent = "Cerrar";
    closeButton.addEventListener("click", () => updateRequestStatus(request.id, "Cerrada"));

    actions.append(confirmButton, closeButton);
    card.append(actions);
    requestList.append(card);
  });
}

function formatDate(value) {
  if (!value) return "-";

  return new Date(value).toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

async function updateRequestStatus(id, status) {
  if (state.demoMode) {
    state.requests = state.requests.map((request) => {
      if (request.id !== id) return request;
      return { ...request, status };
    });
    renderRequests();
    return;
  }

  try {
    await apiRequest(`/api/reservations/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await loadReservations();
  } catch (error) {
    addMessage("bot", `No pude cambiar el estado de la reserva: ${error.message}`);
  }
}

function requestsToText() {
  if (!state.requests.length) return "No hay solicitudes registradas.";

  return state.requests
    .map((request, index) => {
      return `${index + 1}. ${request.customerName} | ${request.service} | ${request.preferredDay} ${request.preferredTime} | ${request.phone} | ${request.status}`;
    })
    .join("\n");
}

function requestsToCsv() {
  const headers = ["Nombre", "Servicio", "Dia", "Horario", "Telefono", "Estado", "Registro"];
  const rows = state.requests.map((request) => [
    request.customerName,
    request.service,
    request.preferredDay,
    request.preferredTime,
    request.phone,
    request.status,
    request.createdAt,
  ]);

  return [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value || "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

async function copySummary() {
  const text = requestsToText();

  try {
    await navigator.clipboard.writeText(text);
    addMessage("bot", "Lista copiada. Puedes pegarla donde el equipo lleve sus reservas.");
  } catch (error) {
    addMessage("bot", `No pude copiar automaticamente. Aqui esta la lista:\n\n${text}`);
  }
}

function downloadCsv() {
  const blob = new Blob([requestsToCsv()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "solicitudes-reserva.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function resetDemo() {
  if (!state.demoMode) {
    try {
      await apiRequest(`/api/sessions/${state.sessionId}/reset`, { method: "POST" });
    } catch (error) {
      addMessage("bot", `No pude limpiar la conversacion anterior: ${error.message}`);
    }
  }

  rotateSessionId();
  state.requests = [];
  state.bookingStep = null;
  state.draft = {};
  chatWindow.innerHTML = "";
  renderRequests();
  addWelcomeMessage();
}

function addWelcomeMessage() {
  addMessage(
    "bot",
    `Hola, gracias por escribir a ${state.business.name}. Te puedo ayudar con valores, horarios, ubicacion o dejar una solicitud de hora para que el equipo la confirme.`
  );
}

document.querySelector("#saveConfigButton").addEventListener("click", () => {
  readBusinessConfig();
  addMessage("bot", "Listo, ya tengo actualizados los datos del salon para las proximas respuestas.");
});

document.querySelector("#resetDemoButton").addEventListener("click", resetDemo);
document.querySelector("#copySummaryButton").addEventListener("click", copySummary);
document.querySelector("#downloadCsvButton").addEventListener("click", downloadCsv);

document.querySelectorAll("[data-message]").forEach((button) => {
  button.addEventListener("click", () => handleUserMessage(button.dataset.message));
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleUserMessage(messageInput.value);
  messageInput.value = "";
});

readBusinessConfig();
renderRequests();
checkBackend().then(() => {
  loadReservations();
  addWelcomeMessage();
});

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

function handleDemoMessage(text) {
  if (state.bookingStep) {
    return continueDemoBooking(text);
  }

  return answerDemoFaq(text);
}

function answerDemoFaq(message) {
  const text = normalize(message);

  if (includesAny(text, ["precio", "precios", "valor", "valores", "cuanto", "sale", "cuesta"])) {
    return {
      replies: [
        `Te dejo los valores de referencia de ${state.business.name}:\n\n${state.business.services}\n\nAlgunos servicios pueden variar segun largo, tecnica o evaluacion en el salon.`
      ]
    };
  }

  if (includesAny(text, ["ubicacion", "direccion", "donde", "estan", "queda"])) {
    return { replies: [`Estamos en ${state.business.address}.`] };
  }

  if (includesAny(text, ["horario", "hora atienden", "atienden", "sabado", "sabados", "abren", "cierran"])) {
    return { replies: [`Atendemos ${state.business.hours}.`] };
  }

  if (includesAny(text, ["reserva", "reservar", "agenda", "agendar", "hora", "cita", "turno"])) {
    state.bookingStep = "name";
    state.draft = {};
    return { replies: ["Dale, te ayudo a dejar una solicitud de hora. Me dices tu nombre?"] };
  }

  if (includesAny(text, ["cancelar", "cambiar", "cambio", "politica"])) {
    return { replies: [state.business.policy] };
  }

  return {
    replies: [
      `Hola, gracias por escribir a ${state.business.name}. Te puedo ayudar con valores, horarios, ubicacion o dejar una solicitud de hora para que el equipo la confirme. Que necesitas?`
    ]
  };
}

function continueDemoBooking(message) {
  const value = message.trim();

  if (state.bookingStep === "name") {
    state.draft.customerName = value;
    state.bookingStep = "service";
    return { replies: ["Gracias. Que servicio quieres hacerte? Por ejemplo: corte, coloracion, brushing o manicure."] };
  }

  if (state.bookingStep === "service") {
    state.draft.service = value;
    state.bookingStep = "day";
    return { replies: ["Que dia te acomoda venir?"] };
  }

  if (state.bookingStep === "day") {
    state.draft.preferredDay = value;
    state.bookingStep = "time";
    return { replies: ["Te sirve mas manana, tarde o tienes algun horario en mente?"] };
  }

  if (state.bookingStep === "time") {
    state.draft.preferredTime = value;
    state.bookingStep = "phone";
    return { replies: ["Perfecto. Me dejas un telefono de contacto para que el equipo pueda confirmarte?"] };
  }

  state.draft.phone = value;

  const reservation = {
    id: `demo_${Date.now()}`,
    createdAt: new Date().toISOString(),
    sessionId: state.sessionId,
    businessName: state.business.name,
    status: "Pendiente",
    ...state.draft,
  };

  state.requests.unshift(reservation);
  state.bookingStep = null;
  state.draft = {};

  return {
    replies: [
      `Listo, ${reservation.customerName}. Deje tu solicitud anotada:\n\nServicio: ${reservation.service}\nDia: ${reservation.preferredDay}\nHorario: ${reservation.preferredTime}\n\nEl equipo revisa disponibilidad y te confirma la hora.`,
      state.business.policy
    ],
    reservation,
  };
}
