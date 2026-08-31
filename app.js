const STORAGE_KEY = "prestamos-control-v1";
const BACKUP_STORAGE_KEY = "prestamos-control-backups-v1";
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_BACKUPS = 7;
const FREE_CLIENT_LIMIT = 10;
const PLAN_CATALOG = {
  free: {
    id: "free",
    label: "Gratis",
    price: "S/ 0",
    clientLimit: 10,
    description: "Para probar la plataforma y empezar con una cartera pequena.",
    features: ["Hasta 10 clientes", "Registro de prestamos", "Cobros mensuales", "Dashboard basico"],
  },
  basic: {
    id: "basic",
    label: "Basico",
    price: "S/ 29",
    clientLimit: 100,
    description: "Para prestamistas que ya trabajan con una cartera activa.",
    features: ["Hasta 100 clientes", "Historial de cobros", "Reportes de cartera", "Soporte por correo"],
  },
  pro: {
    id: "pro",
    label: "Pro",
    price: "S/ 59",
    clientLimit: null,
    description: "Para negocios que necesitan crecer sin limite de clientes.",
    features: ["Clientes ilimitados", "Reportes avanzados", "Prioridad de soporte", "Preparado para automatizaciones"],
  },
};

let state = createEmptyState();
let adminState = createEmptyAdminState();
let activeClientTab = "all";
let signupSuccessTimer = null;
const pendingCarousel = {
  today: 0,
  overdue: 0,
  soon: 0,
};
const saas = {
  client: null,
  session: null,
  mode: "local",
  loading: true,
  passwordRecovery: false,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const elements = {
  authScreen: $("#authScreen"),
  appShell: $("#appShell"),
  registerForm: $("#registerForm"),
  authEmail: $("#authEmail"),
  authPassword: $("#authPassword"),
  authMode: $("#authMode"),
  authNotice: $("#authNotice"),
  authPasswordLabelText: $("#authPasswordLabelText"),
  authSubmitText: $("#authSubmitText"),
  forgotPassword: $("#forgotPassword"),
  forgotPasswordDialog: $("#forgotPasswordDialog"),
  forgotPasswordForm: $("#forgotPasswordForm"),
  forgotPasswordEmail: $("#forgotPasswordEmail"),
  forgotPasswordNotice: $("#forgotPasswordNotice"),
  passwordSuccessDialog: $("#passwordSuccessDialog"),
  passwordSuccessClose: $("#passwordSuccessClose"),
  signupSuccessDialog: $("#signupSuccessDialog"),
  showSignup: $("#showSignup"),
  showLogin: $("#showLogin"),
  businessLabel: $("#businessLabel"),
  ownerLabel: $("#ownerLabel"),
  planLabel: $("#planLabel"),
  planUsage: $("#planUsage"),
  todayLabel: $("#todayLabel"),
  viewTitle: $("#viewTitle"),
  exportButton: $("#exportData"),
  exportExcelButton: $("#exportExcel"),
  restoreBackupButton: $("#restoreBackup"),
  importButton: $("#importData"),
  importFile: $("#importFile"),
  clientChoiceDialog: $("#clientChoiceDialog"),
  chooseNewClient: $("#chooseNewClient"),
  chooseLoanExtension: $("#chooseLoanExtension"),
  extensionHint: $("#extensionHint"),
  clientDialog: $("#clientDialog"),
  clientForm: $("#clientForm"),
  clientFormMode: $("#clientFormMode"),
  clientDialogEyebrow: $("#clientDialogEyebrow"),
  clientDialogTitle: $("#clientDialogTitle"),
  clientNameTextLabel: $("#clientNameTextLabel"),
  clientNameSelectLabel: $("#clientNameSelectLabel"),
  clientNameSelect: $("#clientNameSelect"),
  clientSubmitButton: $("#clientSubmitButton"),
  clientList: $("#clientList"),
  clientTabs: $$("[data-client-tab]"),
  filterName: $("#filterName"),
  filterPhone: $("#filterPhone"),
  filterAmount: $("#filterAmount"),
  filterStartDate: $("#filterStartDate"),
  filterDueDate: $("#filterDueDate"),
  editDialog: $("#editDialog"),
  editForm: $("#editForm"),
  paymentDialog: $("#paymentDialog"),
  paymentForm: $("#paymentForm"),
  paymentTitle: $("#paymentTitle"),
  paymentSummary: $("#paymentSummary"),
  historyDialog: $("#historyDialog"),
  historyTitle: $("#historyTitle"),
  historySummary: $("#historySummary"),
  historyList: $("#historyList"),
  plansGrid: $("#plansGrid"),
  planRequestDialog: $("#planRequestDialog"),
  planRequestForm: $("#planRequestForm"),
  planRequestTitle: $("#planRequestTitle"),
  requestedPlan: $("#requestedPlan"),
  planRequestSummary: $("#planRequestSummary"),
  planRequestMessage: $("#planRequestMessage"),
  metricCapital: $("#metricCapital"),
  metricInterest: $("#metricInterest"),
  metricOverdue: $("#metricOverdue"),
  metricRecovered: $("#metricRecovered"),
  statusDonut: $("#statusDonut"),
  statusLegend: $("#statusLegend"),
  monthlyBars: $("#monthlyBars"),
  riskBars: $("#riskBars"),
  metricActiveClients: $("#metricActiveClients"),
  metricDueThisMonth: $("#metricDueThisMonth"),
  metricAverageRate: $("#metricAverageRate"),
  metricInterestPaidMonth: $("#metricInterestPaidMonth"),
  pendingToday: $("#pendingToday"),
  pendingOverdue: $("#pendingOverdue"),
  pendingSoon: $("#pendingSoon"),
  adminNav: $("#adminNav"),
  adminRefresh: $("#adminRefresh"),
  adminTotalUsers: $("#adminTotalUsers"),
  adminTotalClients: $("#adminTotalClients"),
  adminPendingRequests: $("#adminPendingRequests"),
  adminMonthlyRevenue: $("#adminMonthlyRevenue"),
  adminRequestsList: $("#adminRequestsList"),
  adminUserList: $("#adminUserList"),
};

const icons = {
  edit:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>',
  coin:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v8"/><path d="M9.5 10.5c.5-1 1.3-1.5 2.5-1.5 1.5 0 2.5.8 2.5 2s-1 2-2.5 2-2.5.8-2.5 2 1 2 2.5 2c1.2 0 2-.5 2.5-1.5"/></svg>',
  history:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>',
};

init();

async function init() {
  setDefaultDates();
  bindEvents();
  setAuthMode("signup");
  await initSaaS();
  render();
}

function bindEvents() {
  elements.registerForm.addEventListener("submit", handleRegister);
  elements.clientForm.addEventListener("submit", handleClientSubmit);
  elements.editForm.addEventListener("submit", handleEditSubmit);
  elements.paymentForm.addEventListener("submit", handlePaymentSubmit);
  elements.planRequestForm.addEventListener("submit", handlePlanRequestSubmit);
  $$("[data-client-filter]").forEach((filter) => {
    filter.addEventListener("input", renderClients);
  });
  elements.clientTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activeClientTab = tab.dataset.clientTab || "all";
      renderClients();
    });
  });
  elements.exportButton.addEventListener("click", exportData);
  elements.exportExcelButton.addEventListener("click", exportClientsExcel);
  elements.restoreBackupButton.addEventListener("click", restoreLatestBackup);
  elements.importButton.addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", importData);
  elements.showSignup.addEventListener("click", () => {
    saas.passwordRecovery = false;
    setAuthMode("signup");
  });
  elements.showLogin.addEventListener("click", () => {
    saas.passwordRecovery = false;
    setAuthMode("login");
  });
  elements.forgotPassword.addEventListener("click", handleForgotPassword);
  elements.forgotPasswordForm.addEventListener("submit", handleForgotPasswordSubmit);
  elements.passwordSuccessClose.addEventListener("click", () => elements.passwordSuccessDialog.close());
  elements.adminRefresh.addEventListener("click", refreshAdminPanel);

  $("#openClientView").addEventListener("click", () => {
    openClientChoiceDialog();
  });
  elements.chooseNewClient.addEventListener("click", () => openClientDialog("new"));
  elements.chooseLoanExtension.addEventListener("click", () => openClientDialog("extension"));
  elements.clientNameSelect.addEventListener("change", fillExtensionClientFields);
  $("#resetDemo").addEventListener("click", handleSignOut);

  $$("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog").close());
  });

  $$(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });

  document.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-client]");
    const editLoanButton = event.target.closest("[data-edit-loan]");
    const paymentButton = event.target.closest("[data-pay-loan]");
    const historyButton = event.target.closest("[data-history-client]");
    const planButton = event.target.closest("[data-request-plan]");
    const adminPlanButton = event.target.closest("[data-admin-plan]");
    const pendingNavButton = event.target.closest("[data-pending-nav]");

    if (pendingNavButton) {
      movePendingCarousel(pendingNavButton.dataset.pendingNav, Number(pendingNavButton.dataset.direction));
      return;
    }

    if (editLoanButton) {
      openEditDialog(editLoanButton.dataset.editClient, editLoanButton.dataset.editLoan);
      return;
    }

    if (editButton) {
      openEditDialog(editButton.dataset.editClient);
    }

    if (paymentButton) {
      openPaymentDialog(paymentButton.dataset.payLoan);
    }

    if (historyButton) {
      openHistoryDialog(historyButton.dataset.historyClient);
    }

    if (planButton) {
      openPlanRequestDialog(planButton.dataset.requestPlan);
    }

    if (adminPlanButton) {
      updateAdminUserPlan(adminPlanButton.dataset.adminUser, adminPlanButton.dataset.adminPlan, adminPlanButton.dataset.adminRequest);
    }
  });
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return createEmptyState();
  }

  try {
    return normalizeState(JSON.parse(saved));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return createEmptyState();
  }
}

function createEmptyState() {
  return {
    user: null,
    subscription: null,
    clients: [],
    loans: [],
    payments: [],
  };
}

function createEmptyAdminState() {
  return {
    profiles: [],
    subscriptions: [],
    clients: [],
    loans: [],
    payments: [],
    planRequests: [],
    error: "",
  };
}

function normalizeState(raw) {
  return {
    user: raw.user || null,
    subscription: raw.subscription || createFreeSubscription(raw.user?.id || "local-user"),
    clients: Array.isArray(raw.clients) ? raw.clients : [],
    loans: Array.isArray(raw.loans) ? raw.loans : [],
    payments: Array.isArray(raw.payments) ? raw.payments : [],
  };
}

function saveState() {
  if (isCloudMode()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isCloudMode() {
  return saas.mode === "cloud" && saas.client && saas.session?.user;
}

function setAuthMode(mode) {
  elements.authMode.value = mode;
  const isLogin = mode === "login";
  const isRecovery = mode === "recovery";
  elements.showSignup.classList.toggle("active", mode === "signup");
  elements.showLogin.classList.toggle("active", isLogin || isRecovery);
  $("#businessName").closest("label").classList.toggle("is-hidden", isLogin || isRecovery);
  $("#ownerName").closest("label").classList.toggle("is-hidden", isLogin || isRecovery);
  $("#currency").closest("label").classList.toggle("is-hidden", isLogin || isRecovery);
  $("#businessName").required = !isLogin && !isRecovery;
  $("#ownerName").required = !isLogin && !isRecovery;
  elements.forgotPassword.classList.toggle("is-hidden", !isLogin);
  elements.authPasswordLabelText.textContent = isRecovery ? "Nueva contrasena" : "Contrasena";
  elements.authPassword.placeholder = isRecovery ? "Minimo 6 caracteres nuevos" : "Minimo 6 caracteres";
  elements.authSubmitText.textContent = isRecovery ? "Guardar nueva contrasena" : isLogin ? "Iniciar sesion" : "Crear mi plataforma";
  setAuthNotice(
    isRecovery
      ? "Escribe tu nueva contrasena para recuperar el acceso."
      : isLogin
      ? "Accede a tu cartera desde cualquier equipo."
      : "Crea una cuenta gratis para probar hasta 10 clientes."
  );
}

function setAuthNotice(message) {
  if (!elements.authNotice) return;
  elements.authNotice.textContent = message || "";
}

function showSignupSuccessThenLogin() {
  window.clearTimeout(signupSuccessTimer);
  if (elements.signupSuccessDialog && !elements.signupSuccessDialog.open) {
    elements.signupSuccessDialog.showModal();
  }
  signupSuccessTimer = window.setTimeout(() => {
    if (elements.signupSuccessDialog?.open) {
      elements.signupSuccessDialog.close();
    }
    setAuthMode("login");
    elements.authPassword.value = "";
    setAuthNotice("Ahora inicia sesion con tu correo y contrasena.");
    elements.authPassword.focus();
  }, 2600);
}

function createFreeSubscription(userId) {
  return {
    id: `subscription-${userId || "local"}`,
    userId,
    plan: PLAN_CATALOG.free.id,
    status: "active",
    clientLimit: PLAN_CATALOG.free.clientLimit,
    startedAt: new Date().toISOString(),
    expiresAt: null,
  };
}

function getClientLimit() {
  const plan = getCurrentPlan();
  return plan.clientLimit;
}

function getPlanLabel() {
  return getCurrentPlan().label;
}

function getCurrentPlan() {
  const planId = state.subscription?.plan || "free";
  return PLAN_CATALOG[planId] || PLAN_CATALOG.free;
}

function getClientLimitLabel(plan = getCurrentPlan()) {
  return plan.clientLimit === null ? "ilimitados" : String(plan.clientLimit);
}

function getPlanUsageText() {
  const limit = getClientLimit();
  if (limit === null) return `${state.clients.length} clientes`;
  return `${state.clients.length} de ${limit} clientes`;
}

async function ensureCloudAccount(userId, profile) {
  const profileRow = {
    id: userId,
    email: profile.email || null,
    business_name: profile.businessName || "Mi negocio",
    owner_name: profile.ownerName || "Prestamista",
    currency: profile.currency || "PEN",
  };
  const subscriptionRow = {
    user_id: userId,
      plan: "free",
      status: "active",
      client_limit: PLAN_CATALOG.free.clientLimit,
  };

  let { error: profileError } = await saas.client.from("profiles").upsert(profileRow);
  if (profileError && /email|schema cache/i.test(profileError.message || "")) {
    const { email, ...compatibleProfileRow } = profileRow;
    const retry = await saas.client.from("profiles").upsert(compatibleProfileRow);
    profileError = retry.error;
  }
  if (profileError) throw profileError;

  const { error: subscriptionError } = await saas.client.from("subscriptions").upsert(subscriptionRow, {
    onConflict: "user_id",
  });
  if (subscriptionError) throw subscriptionError;
}

async function loadCloudState() {
  const userId = saas.session?.user?.id;
  if (!userId) {
    state = createEmptyState();
    return;
  }

  const [profileResult, subscriptionResult, clientsResult, loansResult, paymentsResult] = await Promise.all([
    saas.client.from("profiles").select("*").eq("id", userId).maybeSingle(),
    saas.client.from("subscriptions").select("*").eq("user_id", userId).maybeSingle(),
    saas.client.from("clients").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    saas.client.from("loans").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    saas.client.from("payments").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
  ]);

  const firstError = [profileResult, subscriptionResult, clientsResult, loansResult, paymentsResult].find((result) => result.error);
  if (firstError?.error) throw firstError.error;

  if (!profileResult.data) {
    await ensureCloudAccount(userId, {
      email: saas.session.user.email,
      businessName: saas.session.user.email || "Mi negocio",
      ownerName: "Prestamista",
      currency: "PEN",
    });
    return loadCloudState();
  }

  state = {
    user: profileFromRow(profileResult.data, saas.session.user.email),
    subscription: subscriptionFromRow(subscriptionResult.data || createFreeSubscription(userId)),
    clients: (clientsResult.data || []).map(clientFromRow),
    loans: (loansResult.data || []).map(loanFromRow),
    payments: (paymentsResult.data || []).map(paymentFromRow),
  };

  if (state.user?.isAdmin) {
    await loadAdminState();
  } else {
    adminState = createEmptyAdminState();
  }

  await ensureAutomaticBackup();
}

async function loadAdminState() {
  if (!isCloudMode() || !state.user?.isAdmin) {
    adminState = createEmptyAdminState();
    return;
  }

  const [profilesResult, subscriptionsResult, clientsResult, loansResult, paymentsResult, requestsResult] = await Promise.all([
    saas.client.from("profiles").select("*").order("created_at", { ascending: false }),
    saas.client.from("subscriptions").select("*").order("started_at", { ascending: false }),
    saas.client.from("clients").select("*").order("created_at", { ascending: false }),
    saas.client.from("loans").select("*").order("created_at", { ascending: false }),
    saas.client.from("payments").select("*").order("created_at", { ascending: false }),
    saas.client.from("plan_requests").select("*").order("created_at", { ascending: false }),
  ]);

  const firstError = [profilesResult, subscriptionsResult, clientsResult, loansResult, paymentsResult, requestsResult].find(
    (result) => result.error
  );
  if (firstError?.error) {
    adminState = { ...createEmptyAdminState(), error: firstError.error.message || "No se pudo cargar el panel admin." };
    return;
  }

  adminState = {
    profiles: profilesResult.data || [],
    subscriptions: subscriptionsResult.data || [],
    clients: clientsResult.data || [],
    loans: loansResult.data || [],
    payments: paymentsResult.data || [],
    planRequests: requestsResult.data || [],
    error: "",
  };
}

async function createCloudClientAndLoan(client, loan) {
  if (!isCloudMode()) return;
  const userId = saas.session.user.id;
  const { error: clientError } = await saas.client.from("clients").insert(clientToRow(client, userId));
  if (clientError) throw clientError;
  const { error: loanError } = await saas.client.from("loans").insert(loanToRow(loan, userId));
  if (loanError) throw loanError;
}

async function createCloudLoan(loan) {
  if (!isCloudMode()) return;
  const userId = saas.session.user.id;
  const { error } = await saas.client.from("loans").insert(loanToRow(loan, userId));
  if (error) throw error;
}

async function updateCloudClientAndLoan(client, loan) {
  if (!isCloudMode()) return;
  const userId = saas.session.user.id;
  const { error: clientError } = await saas.client
    .from("clients")
    .update(clientToRow(client, userId))
    .eq("id", client.id)
    .eq("user_id", userId);
  if (clientError) throw clientError;
  if (!loan) return;
  const { error: loanError } = await saas.client
    .from("loans")
    .update(loanToRow(loan, userId))
    .eq("id", loan.id)
    .eq("user_id", userId);
  if (loanError) throw loanError;
}

async function createCloudPaymentAndUpdateLoan(payment, loan) {
  if (!isCloudMode()) return;
  const userId = saas.session.user.id;
  const { error: loanError } = await saas.client
    .from("loans")
    .update(loanToRow(loan, userId))
    .eq("id", loan.id)
    .eq("user_id", userId);
  if (loanError) throw loanError;
  const { error: paymentError } = await saas.client.from("payments").insert(paymentToRow(payment, userId));
  if (paymentError) throw paymentError;
}

async function createPlanRequest(requestedPlan, message) {
  if (!isCloudMode()) {
    return;
  }

  const { error } = await saas.client.from("plan_requests").insert({
    user_id: saas.session.user.id,
    requested_plan: requestedPlan,
    status: "pending",
    message,
  });
  if (error) throw error;
}

async function reloadAfterCloudError() {
  if (!isCloudMode()) return;
  await loadCloudState();
  render();
}

function profileFromRow(row, email) {
  return {
    id: row.id,
    email: row.email || email,
    businessName: row.business_name,
    ownerName: row.owner_name,
    currency: row.currency,
    isAdmin: Boolean(row.is_admin),
    createdAt: row.created_at,
  };
}

function subscriptionFromRow(row) {
  return {
    id: row.id,
    userId: row.user_id || row.userId,
    plan: row.plan || "free",
    status: row.status || "active",
    clientLimit: row.client_limit === null ? null : row.client_limit || row.clientLimit || FREE_CLIENT_LIMIT,
    startedAt: row.started_at || row.startedAt,
    expiresAt: row.expires_at || row.expiresAt || null,
  };
}

function clientFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || "",
    note: row.note || "",
    createdAt: row.created_at,
  };
}

function loanFromRow(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    amount: Number(row.amount),
    remainingCapital: Number(row.remaining_capital),
    monthlyRate: Number(row.monthly_rate),
    startDate: row.start_date,
    nextDueDate: row.next_due_date,
    dueDay: Number(row.due_day),
    note: row.note || "",
    status: row.status,
    createdAt: row.created_at,
    closedAt: row.closed_at,
  };
}

function paymentFromRow(row) {
  return {
    id: row.id,
    loanId: row.loan_id,
    clientId: row.client_id,
    date: row.date,
    scheduledDueDate: row.scheduled_due_date,
    interestPaid: Number(row.interest_paid),
    capitalPaid: Number(row.capital_paid),
    remainingCapitalAfter: Number(row.remaining_capital_after || 0),
    nextDueDateAfter: row.next_due_date_after,
    note: row.note || "",
    createdAt: row.created_at,
  };
}

function clientToRow(client, userId) {
  return {
    id: client.id,
    user_id: userId,
    name: client.name,
    phone: client.phone,
    note: client.note,
    created_at: client.createdAt,
  };
}

function loanToRow(loan, userId) {
  return {
    id: loan.id,
    user_id: userId,
    client_id: loan.clientId,
    amount: loan.amount,
    remaining_capital: loan.remainingCapital,
    monthly_rate: loan.monthlyRate,
    start_date: loan.startDate,
    next_due_date: loan.nextDueDate,
    due_day: loan.dueDay,
    note: loan.note,
    status: loan.status,
    created_at: loan.createdAt,
    closed_at: loan.closedAt,
  };
}

function paymentToRow(payment, userId) {
  return {
    id: payment.id,
    user_id: userId,
    loan_id: payment.loanId,
    client_id: payment.clientId,
    date: payment.date,
    scheduled_due_date: payment.scheduledDueDate,
    interest_paid: payment.interestPaid,
    capital_paid: payment.capitalPaid,
    remaining_capital_after: payment.remainingCapitalAfter,
    next_due_date_after: payment.nextDueDateAfter,
    note: payment.note,
    created_at: payment.createdAt,
  };
}

function createBackupSnapshot() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    clients: state.clients,
    loans: state.loans,
    payments: state.payments,
  };
}

function normalizeBackupSnapshot(snapshot) {
  const data = typeof snapshot === "string" ? JSON.parse(snapshot) : snapshot || {};
  return {
    clients: Array.isArray(data.clients) ? data.clients : [],
    loans: Array.isArray(data.loans) ? data.loans : [],
    payments: Array.isArray(data.payments) ? data.payments : [],
  };
}

async function ensureAutomaticBackup(force = false) {
  if (!state.user && !state.clients.length && !state.loans.length && !state.payments.length) return;

  try {
    if (isCloudMode()) {
      await createCloudBackup(force);
    } else {
      createLocalBackup(force);
    }
  } catch {
    // La app debe seguir funcionando aunque la tabla de backups aun no exista.
  }
}

async function createCloudBackup(force = false) {
  const userId = saas.session?.user?.id;
  if (!userId) return;

  const { data: backups, error: listError } = await saas.client
    .from("user_backups")
    .select("id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_BACKUPS + 1);

  if (listError) throw listError;

  const latest = backups?.[0];
  if (!force && latest && Date.now() - new Date(latest.created_at).getTime() < BACKUP_INTERVAL_MS) return;

  const { error: insertError } = await saas.client.from("user_backups").insert({
    user_id: userId,
    snapshot: createBackupSnapshot(),
  });
  if (insertError) throw insertError;

  const oldBackups = (backups || []).slice(MAX_BACKUPS - 1);
  if (oldBackups.length) {
    await saas.client
      .from("user_backups")
      .delete()
      .eq("user_id", userId)
      .in(
        "id",
        oldBackups.map((backup) => backup.id)
      );
  }
}

function createLocalBackup(force = false) {
  const backups = readLocalBackups();
  const latest = backups[0];
  if (!force && latest && Date.now() - new Date(latest.createdAt).getTime() < BACKUP_INTERVAL_MS) return;

  backups.unshift({
    id: createId("backup"),
    createdAt: new Date().toISOString(),
    snapshot: createBackupSnapshot(),
  });
  localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(backups.slice(0, MAX_BACKUPS)));
}

function readLocalBackups() {
  try {
    const backups = JSON.parse(localStorage.getItem(BACKUP_STORAGE_KEY) || "[]");
    return Array.isArray(backups) ? backups : [];
  } catch {
    return [];
  }
}

async function getLatestBackup() {
  if (!isCloudMode()) {
    const backup = readLocalBackups()[0];
    return backup ? { createdAt: backup.createdAt, snapshot: backup.snapshot } : null;
  }

  const userId = saas.session?.user?.id;
  const { data, error } = await saas.client
    .from("user_backups")
    .select("created_at, snapshot")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? { createdAt: data.created_at, snapshot: data.snapshot } : null;
}

async function restoreLatestBackup() {
  try {
    const backup = await getLatestBackup();
    if (!backup) {
      window.alert("Todavia no hay una copia automatica disponible para restaurar.");
      return;
    }

    const backupDate = new Intl.DateTimeFormat("es-PE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(backup.createdAt));
    const confirmed = window.confirm(
      `Se restaurara la copia automatica del ${backupDate}. Esto reemplazara clientes, prestamos, ampliaciones y pagos actuales. Deseas continuar?`
    );
    if (!confirmed) return;

    const snapshot = normalizeBackupSnapshot(backup.snapshot);
    if (isCloudMode()) {
      await restoreCloudSnapshot(snapshot);
    }

    state.clients = snapshot.clients;
    state.loans = snapshot.loans;
    state.payments = snapshot.payments;
    saveState();
    render();
    window.alert("Copia restaurada correctamente.");
  } catch (error) {
    const message = error.message || "";
    if (/user_backups|schema cache|relation/i.test(message)) {
      window.alert("Para restaurar copias automaticas en Supabase, primero ejecuta el SQL actualizado que crea la tabla user_backups.");
      return;
    }
    window.alert(message || "No se pudo restaurar la copia automatica.");
  }
}

async function restoreCloudSnapshot(snapshot) {
  const userId = saas.session?.user?.id;
  if (!userId) return;

  const paymentsDelete = await saas.client.from("payments").delete().eq("user_id", userId);
  if (paymentsDelete.error) throw paymentsDelete.error;
  const loansDelete = await saas.client.from("loans").delete().eq("user_id", userId);
  if (loansDelete.error) throw loansDelete.error;
  const clientsDelete = await saas.client.from("clients").delete().eq("user_id", userId);
  if (clientsDelete.error) throw clientsDelete.error;

  if (snapshot.clients.length) {
    const { error } = await saas.client.from("clients").insert(snapshot.clients.map((client) => clientToRow(client, userId)));
    if (error) throw error;
  }
  if (snapshot.loans.length) {
    const { error } = await saas.client.from("loans").insert(snapshot.loans.map((loan) => loanToRow(loan, userId)));
    if (error) throw error;
  }
  if (snapshot.payments.length) {
    const { error } = await saas.client.from("payments").insert(snapshot.payments.map((payment) => paymentToRow(payment, userId)));
    if (error) throw error;
  }
}

async function initSaaS() {
  const config = window.SUPABASE_CONFIG || {};
  const hasConfig = config.url && config.publishableKey && window.supabase;

  if (!hasConfig) {
    saas.mode = "local";
    saas.loading = false;
    state = loadState();
    await ensureAutomaticBackup();
    setAuthNotice("Modo demo local. Para vender suscripciones, pega tus claves de Supabase en supabase-config.js.");
    return;
  }

  saas.client = window.supabase.createClient(config.url, config.publishableKey);
  saas.mode = "cloud";

  try {
    const { data } = await saas.client.auth.getSession();
    saas.session = data.session;
  } catch (error) {
    setAuthNotice(error.message || "No se pudo conectar con Supabase.");
  }

  saas.client.auth.onAuthStateChange(async (event, session) => {
    saas.session = session;
    if (event === "PASSWORD_RECOVERY") {
      saas.passwordRecovery = true;
      setAuthMode("recovery");
      state = createEmptyState();
      render();
      return;
    }
    if (session) {
      try {
        await loadCloudState();
      } catch (error) {
        setAuthNotice(error.message || "No se pudieron cargar los datos.");
      }
    } else {
      state = createEmptyState();
    }
    render();
  });

  if (saas.session) {
    try {
      await loadCloudState();
    } catch (error) {
      setAuthNotice(error.message || "No se pudieron cargar los datos.");
    }
  }

  saas.loading = false;
  showAuthRedirectMessage();
}

async function handleRegister(event) {
  event.preventDefault();
  const mode = elements.authMode.value;
  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;
  const businessName = $("#businessName").value.trim();
  const ownerName = $("#ownerName").value.trim();
  const currency = $("#currency").value;

  if (mode === "recovery") {
    if (password.length < 6) {
      setAuthNotice("La nueva contrasena debe tener minimo 6 caracteres.");
      return;
    }
    try {
      setAuthNotice("Guardando nueva contrasena...");
      const { error } = await saas.client.auth.updateUser({ password });
      if (error) throw error;
      saas.passwordRecovery = false;
      await saas.client.auth.signOut();
      elements.authPassword.value = "";
      setAuthMode("login");
      setAuthNotice("Contrasena actualizada. Ahora inicia sesion con tu nueva clave.");
      elements.passwordSuccessDialog.showModal();
    } catch (error) {
      setAuthNotice(error.message || "No se pudo actualizar la contrasena.");
    }
    return;
  }

  if (saas.mode === "local") {
    state.user = {
      id: "local-user",
      email,
      businessName: businessName || "Demo Prestamos",
      ownerName: ownerName || "Usuario demo",
      currency,
      createdAt: new Date().toISOString(),
    };
    state.subscription = createFreeSubscription("local-user");
    saveState();
    render();
    return;
  }

  try {
    setAuthNotice("Procesando...");
    if (mode === "login") {
      const { data, error } = await saas.client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      saas.session = data.session;
      await loadCloudState();
    } else {
      const { data, error } = await saas.client.auth.signUp({ email, password });
      if (error) throw error;
      saas.session = data.session;
      if (!data.user) {
        showSignupSuccessThenLogin();
        return;
      }
      if (!data.session) {
        showSignupSuccessThenLogin();
        return;
      }
      await ensureCloudAccount(data.user.id, { businessName, ownerName, currency });
      await saas.client.auth.signOut();
      showSignupSuccessThenLogin();
      return;
    }
    render();
  } catch (error) {
    setAuthNotice(error.message || "No se pudo completar el acceso.");
  }
}

async function handleForgotPassword() {
  elements.forgotPasswordEmail.value = elements.authEmail.value.trim();
  setForgotPasswordNotice("Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva contrasena.");
  elements.forgotPasswordDialog.showModal();
  elements.forgotPasswordEmail.focus();
}

async function handleForgotPasswordSubmit(event) {
  event.preventDefault();
  const email = elements.forgotPasswordEmail.value.trim();
  if (!email) {
    setForgotPasswordNotice("Escribe tu correo electronico para enviarte el enlace.");
    elements.forgotPasswordEmail.focus();
    return;
  }

  if (saas.mode === "local") {
    setForgotPasswordNotice("La recuperacion por correo funciona cuando Supabase esta conectado.");
    return;
  }

  try {
    setForgotPasswordNotice("Enviando correo de recuperacion...");
    const redirectTo = getAuthRedirectUrl();
    const options = redirectTo ? { redirectTo } : undefined;
    const { error } = await saas.client.auth.resetPasswordForEmail(email, options);
    if (error) throw error;
    elements.authEmail.value = email;
    elements.forgotPasswordDialog.close();
    setAuthNotice("Listo. Revisa tu correo y abre el enlace para crear una nueva contrasena.");
  } catch (error) {
    setForgotPasswordNotice(error.message || "No se pudo enviar el correo de recuperacion.");
  }
}

function setForgotPasswordNotice(message) {
  if (!elements.forgotPasswordNotice) return;
  elements.forgotPasswordNotice.textContent = message || "";
}

function getAuthRedirectUrl() {
  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    return `${window.location.origin}${window.location.pathname}`;
  }
  return "http://localhost:3000/index.html";
}

function showAuthRedirectMessage() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const errorCode = hash.get("error_code") || query.get("error_code");

  if (errorCode === "otp_expired") {
    setAuthMode("login");
    setAuthNotice("Ese enlace vencio o ya fue usado. Escribe tu correo y solicita otro enlace de recuperacion.");
  }
}

async function handleClientSubmit(event) {
  event.preventDefault();
  const formMode = elements.clientFormMode.value;
  const isExtension = formMode === "extension";
  const selectedClient = isExtension ? getClient(elements.clientNameSelect.value) : null;
  const name = isExtension ? selectedClient?.name || "" : $("#clientName").value.trim();
  const phone = $("#clientPhone").value.trim();
  const amount = toNumber($("#clientLoanAmount").value);
  const startDate = $("#clientLoanStartDate").value;
  const dueDate = $("#clientLoanDueDate").value;
  const rateValue = $("#clientLoanRate").value.trim();
  if (!name || amount <= 0 || !startDate || !dueDate) return;
  if (isExtension && !selectedClient) {
    window.alert("Selecciona el cliente que solicita la ampliacion.");
    return;
  }
  if (!rateValue) {
    window.alert("Ingresa el interes mensual antes de guardar.");
    return;
  }
  if (startOfDay(dueDate) < startOfDay(startDate)) {
    window.alert("La fecha de cobro no puede ser antes de la fecha prestada.");
    return;
  }
  if (!isExtension && hasDuplicatePhone(phone)) {
    const confirmed = window.confirm("Ya existe un cliente con ese telefono. Deseas registrarlo de todos modos?");
    if (!confirmed) return;
  }
  const clientLimit = getClientLimit();
  if (!isExtension && clientLimit !== null && state.clients.length >= clientLimit) {
    window.alert(`Tu plan ${getPlanLabel()} permite hasta ${clientLimit} clientes. Actualiza tu plan para registrar mas.`);
    setView("plans");
    return;
  }

  const clientId = isExtension ? selectedClient.id : createId("client");
  const note = $("#clientNote").value.trim();

  const client = isExtension
    ? null
    : {
        id: clientId,
        name,
        phone,
        note,
        createdAt: new Date().toISOString(),
      };

  const loan = {
    id: createId("loan"),
    clientId,
    amount,
    remainingCapital: amount,
    monthlyRate: toNumber(rateValue),
    startDate,
    nextDueDate: dueDate,
    dueDay: getDayOfMonth(dueDate),
    note,
    status: "active",
    createdAt: new Date().toISOString(),
    closedAt: null,
  };

  await ensureAutomaticBackup();

  try {
    if (isExtension) {
      await createCloudLoan(loan);
    } else {
      await createCloudClientAndLoan(client, loan);
    }
  } catch (error) {
    window.alert(error.message || "No se pudo guardar la informacion en la nube.");
    return;
  }

  if (client) {
    state.clients.unshift(client);
  }
  state.loans.unshift(loan);

  event.target.reset();
  setDefaultDates();
  elements.clientDialog.close();
  saveState();
  setView("clients");
  render();
}

async function handleEditSubmit(event) {
  event.preventDefault();
  const client = getClient($("#editClientId").value);
  if (!client) return;

  const amount = toNumber($("#editLoanAmount").value);
  const startDate = $("#editLoanStartDate").value;
  const dueDate = $("#editLoanDueDate").value;
  const rateValue = $("#editLoanRate").value.trim();
  const note = $("#editClientNote").value.trim();
  const phone = $("#editClientPhone").value.trim();

  if (!rateValue) {
    window.alert("Ingresa el interes mensual antes de guardar.");
    return;
  }
  if (startOfDay(dueDate) < startOfDay(startDate)) {
    window.alert("La fecha de cobro no puede ser antes de la fecha prestada.");
    return;
  }
  if (hasDuplicatePhone(phone, client.id)) {
    const confirmed = window.confirm("Ya existe otro cliente con ese telefono. Deseas guardar de todos modos?");
    if (!confirmed) return;
  }

  client.name = $("#editClientName").value.trim();
  client.phone = phone;
  client.note = note;

  let loan = getLoan($("#editLoanId").value);
  if (!loan && amount > 0) {
    loan = {
      id: createId("loan"),
      clientId: client.id,
      amount,
      remainingCapital: amount,
      monthlyRate: toNumber(rateValue),
      startDate,
      nextDueDate: dueDate,
      dueDay: getDayOfMonth(dueDate),
      note,
      status: "active",
      createdAt: new Date().toISOString(),
      closedAt: null,
    };
    state.loans.push(loan);
  }

  if (loan) {
    const alreadyPaidCapital = Math.max(loan.amount - loan.remainingCapital, 0);
    if (amount < alreadyPaidCapital) {
      const confirmed = window.confirm(
        `Este prestamo ya tiene ${money(alreadyPaidCapital)} de capital pagado. Si bajas el capital a ${money(amount)}, el prestamo quedara cerrado o ajustado. Deseas continuar?`
      );
      if (!confirmed) return;
    }
    loan.amount = amount;
    loan.remainingCapital = Math.max(roundMoney(amount - alreadyPaidCapital), 0);
    loan.monthlyRate = toNumber(rateValue);
    loan.startDate = startDate;
    loan.nextDueDate = dueDate;
    loan.dueDay = getDayOfMonth(dueDate);
    loan.note = note;
    loan.status = loan.remainingCapital > 0 ? "active" : "closed";
    loan.closedAt = loan.status === "closed" ? loan.closedAt || new Date().toISOString() : null;
  }

  await ensureAutomaticBackup();

  try {
    await updateCloudClientAndLoan(client, loan);
  } catch (error) {
    window.alert(error.message || "No se pudieron guardar los cambios en la nube.");
    await reloadAfterCloudError();
    return;
  }

  elements.editDialog.close();
  saveState();
  render();
}

async function handlePaymentSubmit(event) {
  event.preventDefault();
  const loan = getLoan($("#paymentLoanId").value);
  if (!loan || loan.status !== "active") return;

  const paymentDate = $("#paymentDate").value;
  const scheduledDueDate = loan.nextDueDate;
  const interestPaid = toNumber($("#paymentInterest").value);
  const capitalPaid = Math.min(toNumber($("#paymentCapital").value), loan.remainingCapital);
  if (!$("#paymentInterest").value.trim()) {
    window.alert("Ingresa el interes pagado antes de registrar el cobro.");
    return;
  }

  loan.remainingCapital = roundMoney(loan.remainingCapital - capitalPaid);
  loan.nextDueDate = addOneMonthKeepingDay(loan.nextDueDate, loan.dueDay);

  if (loan.remainingCapital <= 0) {
    loan.remainingCapital = 0;
    loan.status = "closed";
    loan.closedAt = new Date().toISOString();
  }

  const payment = {
    id: createId("payment"),
    loanId: loan.id,
    clientId: loan.clientId,
    date: paymentDate,
    scheduledDueDate,
    interestPaid,
    capitalPaid,
    remainingCapitalAfter: loan.remainingCapital,
    nextDueDateAfter: loan.status === "active" ? loan.nextDueDate : null,
    note: $("#paymentNote").value.trim(),
    createdAt: new Date().toISOString(),
  };

  await ensureAutomaticBackup();

  try {
    await createCloudPaymentAndUpdateLoan(payment, loan);
  } catch (error) {
    window.alert(error.message || "No se pudo registrar el cobro en la nube.");
    await reloadAfterCloudError();
    return;
  }

  state.payments.push(payment);

  event.target.reset();
  elements.paymentDialog.close();
  saveState();
  render();
}

function render() {
  if (saas.loading) {
    elements.authScreen.classList.remove("is-hidden");
    elements.appShell.classList.add("is-hidden");
    setAuthNotice("Cargando plataforma...");
    return;
  }

  if (saas.passwordRecovery) {
    elements.authScreen.classList.remove("is-hidden");
    elements.appShell.classList.add("is-hidden");
    return;
  }

  if (!state.user) {
    elements.authScreen.classList.remove("is-hidden");
    elements.appShell.classList.add("is-hidden");
    return;
  }

  elements.authScreen.classList.add("is-hidden");
  elements.appShell.classList.remove("is-hidden");
  elements.adminNav.classList.toggle("is-hidden", !state.user.isAdmin);
  if (!state.user.isAdmin && $("#adminView").classList.contains("active-view")) {
    setView("dashboard");
  }
  elements.businessLabel.textContent = state.user.businessName;
  elements.ownerLabel.textContent = state.user.ownerName;
  elements.planLabel.textContent = getPlanLabel();
  elements.planUsage.textContent = getPlanUsageText();
  elements.todayLabel.textContent = formatDate(todayISO()).replace(/\s+/g, "\u00a0");

  renderDashboard();
  renderClients();
  renderPlans();
  renderAdmin();
}

function setView(view) {
  if (view === "admin" && !state.user?.isAdmin) return;
  const title = {
    dashboard: "Resumen",
    clients: "Clientes",
    plans: "Planes",
    admin: "Panel Admin",
  }[view];

  $$(".nav-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  $$(".view").forEach((section) => section.classList.remove("active-view"));
  $(`#${view}View`).classList.add("active-view");
  elements.viewTitle.textContent = title;
  if (view === "admin") refreshAdminPanel();
}

function renderDashboard() {
  const activeLoans = state.loans.filter((loan) => loan.status === "active");
  const totalCapital = activeLoans.reduce((sum, loan) => sum + loan.remainingCapital, 0);
  const monthlyInterest = activeLoans.reduce((sum, loan) => sum + expectedInterest(loan), 0);
  const overdueCount = activeLoans.filter(isOverdue).length;
  const recovered = state.payments.reduce((sum, payment) => sum + payment.capitalPaid, 0);
  const activeClientCount = new Set(activeLoans.map((loan) => loan.clientId)).size;
  const dueThisMonth = activeLoans.filter((loan) => isSameMonth(loan.nextDueDate, todayISO())).length;
  const averageRate = activeLoans.length
    ? activeLoans.reduce((sum, loan) => sum + loan.monthlyRate, 0) / activeLoans.length
    : 0;
  const interestPaidThisMonth = state.payments
    .filter((payment) => isSameMonth(payment.date, todayISO()))
    .reduce((sum, payment) => sum + payment.interestPaid, 0);

  elements.metricCapital.textContent = money(totalCapital);
  elements.metricInterest.textContent = money(monthlyInterest);
  elements.metricOverdue.textContent = overdueCount;
  elements.metricRecovered.textContent = money(recovered);
  elements.metricActiveClients.textContent = activeClientCount;
  elements.metricDueThisMonth.textContent = dueThisMonth;
  elements.metricAverageRate.textContent = `${roundMoney(averageRate)}%`;
  elements.metricInterestPaidMonth.textContent = money(interestPaidThisMonth);

  renderStatusChart(activeLoans);
  renderMonthlyBars();
  renderRiskBars(activeLoans);
  renderPendingCollections(activeLoans);
}

function renderStatusChart(activeLoans) {
  const segments = [
    {
      label: "Al dia",
      color: "#00a76f",
      value: activeLoans.filter((loan) => !isOverdue(loan) && daysBetween(todayISO(), loan.nextDueDate) > 5).length,
    },
    {
      label: "Por cobrar",
      color: "#ffb000",
      value: activeLoans.filter((loan) => !isOverdue(loan) && daysBetween(todayISO(), loan.nextDueDate) <= 5).length,
    },
    {
      label: "Vencidos",
      color: "#061826",
      value: activeLoans.filter(isOverdue).length,
    },
    {
      label: "Cerrados",
      color: "#ffb000",
      value: state.loans.filter((loan) => loan.status === "closed").length,
    },
  ];
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  elements.statusDonut.innerHTML = `<div class="donut-center"><strong>${total}</strong><span>prestamos</span></div>`;
  elements.statusDonut.style.background = total ? buildConicGradient(segments, total) : "rgba(0, 167, 111, 0.12)";
  elements.statusLegend.innerHTML = segments
    .map((segment) => {
      const percent = total ? Math.round((segment.value / total) * 100) : 0;
      return `
        <div class="legend-item">
          <i style="background:${segment.color}"></i>
          <span>${segment.label}</span>
          <strong>${segment.value} (${percent}%)</strong>
        </div>
      `;
    })
    .join("");
}

function renderMonthlyBars() {
  const months = getLastMonthKeys(6);
  const data = months.map((month) => {
    const payments = state.payments.filter((payment) => getMonthKey(payment.date) === month.key);
    return {
      ...month,
      interest: payments.reduce((sum, payment) => sum + payment.interestPaid, 0),
      capital: payments.reduce((sum, payment) => sum + payment.capitalPaid, 0),
    };
  });
  const max = Math.max(...data.map((item) => item.interest + item.capital), 1);

  elements.monthlyBars.innerHTML = data
    .map((item) => {
      const interestHeight = Math.max((item.interest / max) * 100, item.interest ? 6 : 0);
      const capitalHeight = Math.max((item.capital / max) * 100, item.capital ? 6 : 0);
      return `
        <div class="bar-item">
          <div class="bar-track" title="${money(item.interest + item.capital)}">
            <span class="bar-fill capital-fill" style="height:${capitalHeight}%"></span>
            <span class="bar-fill interest-fill" style="height:${interestHeight}%"></span>
          </div>
          <strong>${item.label}</strong>
          <span>${money(item.interest + item.capital)}</span>
        </div>
      `;
    })
    .join("");
}

function renderRiskBars(activeLoans) {
  const buckets = [
    {
      label: "Vencido",
      color: "#061826",
      value: activeLoans.filter(isOverdue).reduce((sum, loan) => sum + loan.remainingCapital, 0),
    },
    {
      label: "Prox. 7 dias",
      color: "#ffb000",
      value: activeLoans
        .filter((loan) => !isOverdue(loan) && daysBetween(todayISO(), loan.nextDueDate) <= 7)
        .reduce((sum, loan) => sum + loan.remainingCapital, 0),
    },
    {
      label: "Despues",
      color: "#00a76f",
      value: activeLoans
        .filter((loan) => !isOverdue(loan) && daysBetween(todayISO(), loan.nextDueDate) > 7)
        .reduce((sum, loan) => sum + loan.remainingCapital, 0),
    },
  ];
  const total = buckets.reduce((sum, bucket) => sum + bucket.value, 0) || 1;

  elements.riskBars.innerHTML = buckets
    .map((bucket) => {
      const width = Math.max((bucket.value / total) * 100, bucket.value ? 5 : 0);
      return `
        <div class="risk-row">
          <div>
            <strong>${bucket.label}</strong>
            <span>${money(bucket.value)}</span>
          </div>
          <div class="risk-track">
            <span style="width:${width}%; background:${bucket.color}"></span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderPendingCollections(activeLoans) {
  const today = todayISO();
  const overdue = activeLoans.filter(isOverdue).sort(sortLoansByDueDate);
  const todayLoans = activeLoans.filter((loan) => loan.nextDueDate === today).sort(sortLoansByDueDate);
  const soon = activeLoans
    .filter((loan) => !isOverdue(loan) && loan.nextDueDate !== today && daysBetween(today, loan.nextDueDate) <= 7)
    .sort(sortLoansByDueDate);

  renderPendingList(elements.pendingToday, todayLoans, "No hay cobros para hoy.", { carousel: "today", label: "de hoy" });
  renderPendingList(elements.pendingOverdue, overdue, "No hay cobros vencidos.", { carousel: "overdue", label: "vencidos" });
  renderPendingList(elements.pendingSoon, soon, "No hay cobros en los proximos 7 dias.", { carousel: "soon", label: "proximos" });
}

function renderPendingList(container, loans, emptyMessage, options = {}) {
  if (options.carousel && loans.length > 1) {
    const carouselKey = options.carousel;
    const currentIndex = normalizeCarouselIndex(carouselKey, loans.length);
    const counter = `<p class="pending-counter">${currentIndex + 1} de ${loans.length} ${escapeHTML(options.label || "cobros")}</p>`;
    container.innerHTML = `
      <div class="pending-carousel">
        <button class="pending-nav" type="button" data-pending-nav="${carouselKey}" data-direction="-1" aria-label="Ver cobro anterior">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div class="pending-carousel-body">
          ${renderPendingItem(loans[currentIndex], counter)}
        </div>
        <button class="pending-nav" type="button" data-pending-nav="${carouselKey}" data-direction="1" aria-label="Ver siguiente cobro">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
    `;
  } else {
    container.innerHTML = loans.map(renderPendingItem).join("");
  }

  renderEmpty(container, emptyMessage);
}

function renderPendingItem(loan, footer = "") {
  const client = getClient(loan.clientId);
  const status = getLoanStatus(loan);
  return `
    <article class="pending-item">
      <div>
        <strong>${escapeHTML(client?.name || "Cliente sin nombre")}</strong>
        <span>${escapeHTML(client?.phone || "Sin telefono")}</span>
      </div>
      <div>
        <span>Fecha: ${formatDate(loan.nextDueDate)}</span>
        <strong>${money(expectedInterest(loan))}</strong>
      </div>
      <span class="status-pill ${status.className}">${status.label}</span>
      <button class="primary-button small-button" type="button" data-pay-loan="${loan.id}">${icons.coin} Cobro</button>
      ${footer}
    </article>
  `;
}

function normalizeCarouselIndex(key, total) {
  if (!total) {
    pendingCarousel[key] = 0;
    return 0;
  }
  pendingCarousel[key] = ((pendingCarousel[key] || 0) % total + total) % total;
  return pendingCarousel[key];
}

function movePendingCarousel(key, direction) {
  pendingCarousel[key] = (pendingCarousel[key] || 0) + direction;
  const activeLoans = state.loans.filter((loan) => loan.status === "active");
  renderPendingCollections(activeLoans);
}

function renderClients() {
  renderClientTabs();
  const filters = getClientFilters();
  const clients = state.clients.filter((client) => {
    const loans = getLoansForClient(client.id);
    return matchesClientTab(client, loans) && matchesClientFilters(client, loans, filters);
  });
  const orderedClients = activeClientTab === "all" ? moveClosedClientBlocksToEnd(clients) : clients;

  elements.clientList.innerHTML = orderedClients
    .map((client) => {
      const clientLoans = getLoansForClient(client.id);
      const loan = clientLoans[0] || null;
      const activeLoan = loan?.status === "active" ? loan : null;
      const extensions = clientLoans.slice(1);
      const paymentCount = state.payments.filter((payment) => payment.clientId === client.id).length;
      const status = getLoanStatus(loan);
      const paymentButton = activeLoan
        ? `<button class="primary-button small-button" type="button" data-pay-loan="${activeLoan.id}">${icons.coin} Cobro</button>`
        : `<button class="ghost-button small-button" type="button" disabled>Sin cobro</button>`;

      return `
        <article class="client-table client-row">
          <span data-label="Nombre" class="client-name-cell">
            <strong>${escapeHTML(client.name)}</strong>
            <span class="status-pill ${status.className}">${status.label}</span>
          </span>
          <span data-label="Telefono">${escapeHTML(client.phone || "Sin telefono")}</span>
          <span data-label="Monto prestado">${renderLoanAmount(loan)}</span>
          <span data-label="Fecha prestada">${loan ? formatDate(loan.startDate) : "-"}</span>
          <span data-label="Fecha de cobro">${loan && loan.status === "active" ? formatDate(loan.nextDueDate) : "Cerrado"}</span>
          <span class="row-actions" data-label="Acciones">
            <button class="ghost-button small-button" type="button" data-edit-client="${client.id}">${icons.edit} Editar</button>
            ${paymentButton}
            <button class="icon-button square-action" title="Ver cobros" type="button" data-history-client="${client.id}">
              ${icons.history}
              <span>${paymentCount}</span>
            </button>
          </span>
          ${renderClientExtensions(client, extensions)}
        </article>
      `;
    })
    .join("");

  renderEmpty(elements.clientList, "No hay clientes con ese criterio.");
}

function renderClientTabs() {
  elements.clientTabs.forEach((tab) => {
    const isActive = tab.dataset.clientTab === activeClientTab;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
}

function matchesClientTab(client, loans = getLoansForClient(client.id)) {
  if (activeClientTab === "closed") return isClientCompletelyClosed(client.id);
  if (activeClientTab === "overdue") return loans.some((loan) => loan.status !== "closed" && isOverdue(loan));
  if (activeClientTab === "today") return loans.some((loan) => loan.status !== "closed" && loan.nextDueDate === todayISO());
  return true;
}

function renderClientExtensions(client, extensions) {
  if (!extensions.length) return "";

  return `
    <div class="client-extension-panel">
      <strong>Ampliaciones de ${escapeHTML(client.name)} (${extensions.length})</strong>
      <div class="client-extension-list">
        ${extensions
          .map((loan, index) => {
            const status = getLoanStatus(loan);
            const paymentCount = state.payments.filter((payment) => payment.clientId === client.id).length;
            const paymentButton =
              loan.status === "active"
                ? `<button class="primary-button small-button" type="button" data-pay-loan="${loan.id}">${icons.coin} Cobro</button>`
                : `<button class="ghost-button small-button" type="button" disabled>Sin cobro</button>`;
            return `
              <article class="client-extension-table client-extension-row">
                <span data-label="Nombre" class="client-name-cell">
                  <strong>Ampliacion ${index + 1}</strong>
                  <i class="status-pill ${status.className}">${status.label}</i>
                </span>
                <span data-label="Telefono">${escapeHTML(client.phone || "Sin telefono")}</span>
                <span data-label="Monto prestado">${renderLoanAmount(loan)}</span>
                <span data-label="Fecha prestada">${formatDate(loan.startDate)}</span>
                <span data-label="Fecha de cobro">${loan.status === "active" ? formatDate(loan.nextDueDate) : "Cerrado"}</span>
                <span class="row-actions" data-label="Acciones">
                  <button class="ghost-button small-button" type="button" data-edit-client="${client.id}" data-edit-loan="${loan.id}">${icons.edit} Editar</button>
                  ${paymentButton}
                  <button class="icon-button square-action" title="Ver cobros" type="button" data-history-client="${client.id}">
                    ${icons.history}
                    <span>${paymentCount}</span>
                  </button>
                </span>
              </article>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderLoanAmount(loan) {
  if (!loan) return "Sin prestamo";

  return `
    <span class="amount-stack">
      <strong>${money(loan.amount)}</strong>
      <small>Interes: ${roundMoney(loan.monthlyRate)}%</small>
    </span>
  `;
}

function renderPlans() {
  const currentPlan = getCurrentPlan();
  elements.plansGrid.innerHTML = Object.values(PLAN_CATALOG)
    .map((plan) => {
      const isCurrent = plan.id === currentPlan.id;
      const isUpgrade = plan.clientLimit === null || (currentPlan.clientLimit !== null && plan.clientLimit > currentPlan.clientLimit);
      const action = isCurrent
        ? `<button class="ghost-button small-button" type="button" disabled>Plan actual</button>`
        : `<button class="${isUpgrade ? "primary-button" : "ghost-button"} small-button" type="button" data-request-plan="${plan.id}">Solicitar plan</button>`;
      return `
        <article class="plan-option ${isCurrent ? "active-plan" : ""}">
          <div>
            <span class="eyebrow">${plan.label}</span>
            <h3>${plan.price}<small>/mes</small></h3>
            <p>${escapeHTML(plan.description)}</p>
          </div>
          <strong>${plan.clientLimit === null ? "Clientes ilimitados" : `${plan.clientLimit} clientes`}</strong>
          <ul>
            ${plan.features.map((feature) => `<li>${escapeHTML(feature)}</li>`).join("")}
          </ul>
          ${action}
        </article>
      `;
    })
    .join("");
}

function renderAdmin() {
  if (!state.user?.isAdmin || !elements.adminUserList) return;

  if (adminState.error) {
    elements.adminRequestsList.innerHTML = `
      <div class="empty-state">
        <strong>No se pudo cargar el panel admin</strong>
        <span>${escapeHTML(adminState.error)}</span>
      </div>
    `;
    elements.adminUserList.innerHTML = "";
    return;
  }

  const pendingRequests = adminState.planRequests.filter((request) => request.status === "pending");
  const activeSubscriptions = adminState.subscriptions.filter((subscription) => subscription.status === "active");
  const monthlyRevenue = activeSubscriptions.reduce((sum, subscription) => sum + getPlanMonthlyPrice(subscription.plan), 0);

  elements.adminTotalUsers.textContent = String(adminState.profiles.length);
  elements.adminTotalClients.textContent = String(adminState.clients.length);
  elements.adminPendingRequests.textContent = String(pendingRequests.length);
  elements.adminMonthlyRevenue.textContent = `S/ ${monthlyRevenue}`;

  elements.adminRequestsList.innerHTML = pendingRequests
    .map((request) => {
      const profile = getAdminProfile(request.user_id);
      const plan = PLAN_CATALOG[request.requested_plan] || PLAN_CATALOG.free;
      return `
        <article class="admin-row">
          <div>
            <strong>${escapeHTML(getAdminProfileName(profile))}</strong>
            <span>${escapeHTML(getAdminProfileEmail(profile))}</span>
            <small>${formatDate(request.created_at)} - ${escapeHTML(request.message || "Sin mensaje")}</small>
          </div>
          <div class="admin-plan-cell">
            <span class="status-pill warn">Solicita ${escapeHTML(plan.label)}</span>
            ${renderAdminPlanButtons(request.user_id, request.id)}
          </div>
        </article>
      `;
    })
    .join("");
  renderEmpty(elements.adminRequestsList, "No hay solicitudes pendientes.");

  elements.adminUserList.innerHTML = adminState.profiles
    .map((profile) => {
      const subscription = getAdminSubscription(profile.id);
      const plan = PLAN_CATALOG[subscription?.plan] || PLAN_CATALOG.free;
      const clientCount = adminState.clients.filter((client) => client.user_id === profile.id).length;
      const activeCapital = adminState.loans
        .filter((loan) => loan.user_id === profile.id && loan.status === "active")
        .reduce((sum, loan) => sum + Number(loan.remaining_capital || 0), 0);

      return `
        <article class="admin-row">
          <div>
            <strong>${escapeHTML(getAdminProfileName(profile))}</strong>
            <span>${escapeHTML(getAdminProfileEmail(profile))}</span>
            <small>${clientCount} cliente(s) - Capital activo: ${formatAdminMoney(activeCapital, profile.currency)}</small>
          </div>
          <div class="admin-plan-cell">
            <span class="status-pill ${profile.is_admin ? "ok" : "muted"}">${profile.is_admin ? "Admin" : "Usuario"}</span>
            <span class="status-pill ok">Plan ${escapeHTML(plan.label)}</span>
            ${renderAdminPlanButtons(profile.id)}
          </div>
        </article>
      `;
    })
    .join("");
  renderEmpty(elements.adminUserList, "No hay usuarios registrados.");
}

function renderAdminPlanButtons(userId, requestId = "") {
  return `
    <div class="admin-actions">
      <button class="ghost-button small-button" type="button" data-admin-user="${userId}" data-admin-plan="free" data-admin-request="${requestId}">Gratis</button>
      <button class="ghost-button small-button" type="button" data-admin-user="${userId}" data-admin-plan="basic" data-admin-request="${requestId}">Basico</button>
      <button class="primary-button small-button" type="button" data-admin-user="${userId}" data-admin-plan="pro" data-admin-request="${requestId}">Pro</button>
    </div>
  `;
}

async function refreshAdminPanel() {
  if (!state.user?.isAdmin) return;
  elements.adminRefresh.disabled = true;
  await loadAdminState();
  elements.adminRefresh.disabled = false;
  renderAdmin();
}

async function updateAdminUserPlan(userId, planId, requestId = "") {
  if (!state.user?.isAdmin || !userId) return;
  const plan = PLAN_CATALOG[planId];
  if (!plan) return;

  try {
    const { error: subscriptionError } = await saas.client
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          plan: plan.id,
          status: "active",
          client_limit: plan.clientLimit,
          started_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    if (subscriptionError) throw subscriptionError;

    if (requestId) {
      const { error: requestError } = await saas.client
        .from("plan_requests")
        .update({ status: "approved" })
        .eq("id", requestId);
      if (requestError) throw requestError;
    }

    await loadCloudState();
    render();
    window.alert(`Plan ${plan.label} activado correctamente.`);
  } catch (error) {
    window.alert(error.message || "No se pudo actualizar el plan.");
  }
}

function getAdminProfile(userId) {
  return adminState.profiles.find((profile) => profile.id === userId) || null;
}

function getAdminSubscription(userId) {
  return adminState.subscriptions.find((subscription) => subscription.user_id === userId) || null;
}

function getAdminProfileName(profile) {
  if (!profile) return "Usuario sin perfil";
  return profile.business_name || profile.owner_name || "Usuario sin nombre";
}

function getAdminProfileEmail(profile) {
  return profile?.email || "Correo no registrado en perfil";
}

function getPlanMonthlyPrice(planId) {
  return {
    free: 0,
    basic: 29,
    pro: 59,
  }[planId] || 0;
}

function formatAdminMoney(value, currency = "PEN") {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: currency || "PEN",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

function getClientFilters() {
  return {
    name: elements.filterName.value.trim().toLowerCase(),
    phone: elements.filterPhone.value.trim().toLowerCase(),
    amount: elements.filterAmount.value.trim(),
    startDate: elements.filterStartDate.value,
    dueDate: elements.filterDueDate.value,
  };
}

function matchesClientFilters(client, loans, filters) {
  const clientLoans = Array.isArray(loans) ? loans : loans ? [loans] : [];

  if (filters.name && !client.name.toLowerCase().includes(filters.name)) return false;
  if (filters.phone && !(client.phone || "").toLowerCase().includes(filters.phone)) return false;
  if (
    filters.amount &&
    !clientLoans.some((loan) => {
      const amount = String(loan.amount);
      const formattedAmount = money(loan.amount).toLowerCase();
      return amount.includes(filters.amount) || formattedAmount.includes(filters.amount.toLowerCase());
    })
  ) {
    return false;
  }
  if (filters.startDate && !clientLoans.some((loan) => loan.startDate === filters.startDate)) return false;
  if (filters.dueDate && !clientLoans.some((loan) => loan.nextDueDate === filters.dueDate)) return false;
  return true;
}

function openPlanRequestDialog(planId) {
  const plan = PLAN_CATALOG[planId];
  if (!plan) return;

  elements.requestedPlan.value = plan.id;
  elements.planRequestTitle.textContent = `Solicitar plan ${plan.label}`;
  elements.planRequestSummary.textContent = `${plan.label}: ${plan.price}/mes. Limite: ${getClientLimitLabel(plan)} clientes.`;
  elements.planRequestMessage.value = `Quiero activar el plan ${plan.label} para mi cuenta.`;
  elements.planRequestDialog.showModal();
}

async function handlePlanRequestSubmit(event) {
  event.preventDefault();
  const requestedPlan = elements.requestedPlan.value;
  const plan = PLAN_CATALOG[requestedPlan];
  if (!plan) return;

  try {
    await createPlanRequest(requestedPlan, elements.planRequestMessage.value.trim());
    elements.planRequestDialog.close();
    window.alert("Solicitud enviada. Luego podras conectar pagos para activar planes automaticamente.");
  } catch (error) {
    window.alert(error.message || "No se pudo enviar la solicitud del plan.");
  }
}

function openEditDialog(clientId, loanId = null) {
  const client = getClient(clientId);
  if (!client) return;

  const requestedLoan = loanId ? getLoan(loanId) : null;
  const loan = requestedLoan?.clientId === client.id ? requestedLoan : getPrimaryLoanForClient(client.id);
  $("#editClientId").value = client.id;
  $("#editLoanId").value = loan?.id || "";
  $("#editClientName").value = client.name || "";
  $("#editClientPhone").value = client.phone || "";
  $("#editClientNote").value = client.note || loan?.note || "";
  $("#editLoanAmount").value = loan ? loan.amount : "";
  $("#editLoanRate").value = loan ? loan.monthlyRate : 10;
  $("#editLoanStartDate").value = loan ? loan.startDate : todayISO();
  $("#editLoanDueDate").value = loan ? loan.nextDueDate : addOneMonthKeepingDay(todayISO(), getDayOfMonth(todayISO()));
  elements.editDialog.showModal();
}

function openClientChoiceDialog() {
  const hasClients = state.clients.length > 0;
  elements.chooseLoanExtension.disabled = !hasClients;
  elements.chooseLoanExtension.title = hasClients ? "" : "Primero registra un cliente.";
  elements.extensionHint.textContent = hasClients
    ? "La ampliacion se guardara dentro del perfil del cliente seleccionado."
    : "Primero registra un cliente para poder crear ampliaciones.";
  elements.clientChoiceDialog.showModal();
}

function openClientDialog(mode = "new") {
  if (elements.clientChoiceDialog.open) {
    elements.clientChoiceDialog.close();
  }
  const isExtension = mode === "extension";
  if (isExtension && !state.clients.length) {
    window.alert("Primero registra un cliente para poder crear una ampliacion.");
    return;
  }

  elements.clientForm.reset();
  setDefaultDates();
  elements.clientFormMode.value = isExtension ? "extension" : "new";
  elements.clientDialogEyebrow.textContent = isExtension ? "Ampliacion" : "Registro";
  elements.clientDialogTitle.textContent = isExtension ? "Ampliacion de prestamo" : "Nuevo cliente";
  elements.clientSubmitButton.textContent = isExtension ? "Guardar ampliacion" : "Guardar cliente";
  elements.clientNameTextLabel.classList.toggle("is-hidden", isExtension);
  elements.clientNameSelectLabel.classList.toggle("is-hidden", !isExtension);
  $("#clientName").required = !isExtension;
  elements.clientNameSelect.required = isExtension;
  $("#clientPhone").readOnly = isExtension;

  if (isExtension) {
    populateClientSelect();
    fillExtensionClientFields();
    $("#clientNote").placeholder = "Detalle o acuerdo de esta ampliacion";
  } else {
    elements.clientNameSelect.innerHTML = "";
    $("#clientPhone").value = "";
    $("#clientNote").placeholder = "Direccion, referencia o acuerdo especial";
  }

  elements.clientDialog.showModal();
  (isExtension ? elements.clientNameSelect : $("#clientName")).focus();
}

function populateClientSelect() {
  elements.clientNameSelect.innerHTML = state.clients
    .map((client) => `<option value="${escapeHTML(client.id)}">${escapeHTML(client.name)}</option>`)
    .join("");
}

function fillExtensionClientFields() {
  const client = getClient(elements.clientNameSelect.value);
  if (!client) return;
  $("#clientPhone").value = client.phone || "";
}

function openPaymentDialog(loanId) {
  const loan = getLoan(loanId);
  if (!loan || loan.status !== "active") return;

  const client = getClient(loan.clientId);
  const interest = expectedInterest(loan);

  $("#paymentLoanId").value = loan.id;
  $("#paymentDate").value = todayISO();
  $("#paymentInterest").value = interest.toFixed(2);
  $("#paymentCapital").value = "0";
  $("#paymentNote").value = "";
  elements.paymentTitle.textContent = client?.name || "Registrar pago";
  elements.paymentSummary.textContent = `Cobro programado: ${formatDate(loan.nextDueDate)}. Interes esperado: ${money(interest)}. Capital pendiente: ${money(loan.remainingCapital)}.`;
  elements.paymentDialog.showModal();
}

function openHistoryDialog(clientId) {
  const client = getClient(clientId);
  if (!client) return;

  const loans = getLoansForClient(clientId);
  const extensions = loans.slice(1);
  const payments = buildPaymentHistory(clientId);
  const totalInterest = payments.reduce((sum, payment) => sum + payment.interestPaid, 0);
  const totalCapital = payments.reduce((sum, payment) => sum + payment.capitalPaid, 0);

  elements.historyTitle.textContent = client.name;
  elements.historySummary.textContent = `${loans.length} prestamo(s). ${extensions.length} ampliacion(es). ${payments.length} cobro(s). Interes pagado: ${money(totalInterest)}. Capital abonado: ${money(totalCapital)}.`;
  elements.historyList.innerHTML = payments.length
    ? `
        <div class="history-section-title">Ampliaciones</div>
        ${renderLoanExtensions(extensions)}
        <div class="history-section-title">Cobros</div>
        ${payments
        .map((payment) => {
          const capitalText = payment.capitalPaid > 0 ? `Capital abonado: ${money(payment.capitalPaid)}` : "No pago capital";
          const capitalClass = payment.capitalPaid > 0 ? "ok" : "warn";
          return `
            <article class="history-item">
              <div>
                <strong>${formatDate(payment.date)}</strong>
                <span>Interes pagado: ${money(payment.interestPaid)}</span>
                <span>${capitalText}</span>
                <span>Capital pendiente despues: ${money(payment.remainingCapitalAfter)}</span>
                <span>Proximo cobro: ${payment.nextDueDateAfter ? formatDate(payment.nextDueDateAfter) : "Prestamo cerrado"}</span>
                ${payment.note ? `<small>${escapeHTML(payment.note)}</small>` : ""}
              </div>
              <span class="status-pill ${capitalClass}">${capitalText}</span>
            </article>
          `;
        })
        .join("")}
      `
    : `
      <div class="history-section-title">Ampliaciones</div>
      ${renderLoanExtensions(extensions)}
      <div class="history-section-title">Cobros</div>
      <div class="empty-state">
        <strong>Sin cobros registrados</strong>
        <span>Cuando registres un cobro, aparecera aqui.</span>
      </div>
    `;

  elements.historyDialog.showModal();
}

function renderLoanExtensions(extensions) {
  if (!extensions.length) {
    return `
      <div class="empty-state compact-empty">
        <strong>Sin ampliaciones</strong>
        <span>Cuando agregues un monto adicional, aparecera aqui.</span>
      </div>
    `;
  }

  return extensions
    .map((loan, index) => `
      <article class="history-item extension-item">
        <div>
          <strong>Ampliacion ${index + 1}: ${money(loan.amount)}</strong>
          <span>Fecha prestada: ${formatDate(loan.startDate)}</span>
          <span>Fecha de cobro: ${loan.status === "active" ? formatDate(loan.nextDueDate) : "Cerrado"}</span>
          <span>Capital pendiente: ${money(loan.remainingCapital)}</span>
          ${loan.note ? `<small>${escapeHTML(loan.note)}</small>` : ""}
        </div>
        <span class="status-pill ${getLoanStatus(loan).className}">${getLoanStatus(loan).label}</span>
      </article>
    `)
    .join("");
}

function buildPaymentHistory(clientId) {
  return state.loans
    .filter((loan) => loan.clientId === clientId)
    .flatMap((loan) => {
      let runningCapital = loan.amount;
      const payments = state.payments
        .filter((payment) => payment.loanId === loan.id)
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      return payments.map((payment, index) => {
        runningCapital = roundMoney(Math.max(runningCapital - payment.capitalPaid, 0));
        const nextDueDateAfter =
          payment.nextDueDateAfter !== undefined
            ? payment.nextDueDateAfter
            : loan.status === "active"
              ? addMonthsKeepingDay(loan.nextDueDate, loan.dueDay, -(payments.length - index - 1))
              : null;

        return {
          ...payment,
          remainingCapitalAfter:
            payment.remainingCapitalAfter !== undefined ? payment.remainingCapitalAfter : runningCapital,
          nextDueDateAfter,
        };
      });
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function getLoansForClient(clientId) {
  return state.loans
    .filter((loan) => loan.clientId === clientId)
    .slice()
    .sort((a, b) => new Date(a.createdAt || a.startDate) - new Date(b.createdAt || b.startDate));
}

function getPrimaryLoanForClient(clientId) {
  return getLoansForClient(clientId)[0] || null;
}

function isClientCompletelyClosed(clientId) {
  const loans = getLoansForClient(clientId);
  if (!loans.length) return false;
  return loans.every((loan) => loan.status === "closed");
}

function moveClosedClientBlocksToEnd(clients) {
  const openClients = [];
  const closedClients = [];

  clients.forEach((client) => {
    if (isClientCompletelyClosed(client.id)) {
      closedClients.push(client);
    } else {
      openClients.push(client);
    }
  });

  return [...openClients, ...closedClients];
}

function getActiveLoanForClient(clientId) {
  return state.loans.find((loan) => loan.clientId === clientId && loan.status === "active") || null;
}

function exportData() {
  const payload = JSON.stringify(state, null, 2);
  downloadBlob(payload, "application/json", `control-prestamos-${todayISO()}.json`);
}

function exportClientsExcel() {
  const clientRows = state.clients.map((client) => {
    const loans = getLoansForClient(client.id);
    const activeLoans = loans.filter((loan) => loan.status !== "closed");
    return [
      client.name,
      client.phone || "",
      client.note || "",
      isClientCompletelyClosed(client.id) ? "Cerrado" : "Activo",
      loans.length,
      Math.max(loans.length - 1, 0),
      activeLoans.reduce((sum, loan) => sum + Number(loan.remainingCapital || 0), 0),
      client.createdAt ? formatDate(String(client.createdAt).slice(0, 10)) : "",
    ];
  });

  const mainLoanRows = state.clients.flatMap((client) => {
    const loan = getPrimaryLoanForClient(client.id);
    if (!loan) return [];
    return [loanExcelRow(client, loan)];
  });

  const extensionRows = state.clients.flatMap((client) =>
    getLoansForClient(client.id)
      .slice(1)
      .map((loan, index) => [`Ampliacion ${index + 1}`, ...loanExcelRow(client, loan)])
  );

  const paymentRows = buildPaymentHistoryRows();
  const summaryRows = [
    ["Clientes", state.clients.length],
    ["Prestamos registrados", state.loans.length],
    ["Ampliaciones registradas", Math.max(state.loans.length - state.clients.filter((client) => getPrimaryLoanForClient(client.id)).length, 0)],
    ["Cobros registrados", state.payments.length],
    ["Capital pendiente", state.loans.filter((loan) => loan.status !== "closed").reduce((sum, loan) => sum + Number(loan.remainingCapital || 0), 0)],
    ["Interes cobrado", state.payments.reduce((sum, payment) => sum + Number(payment.interestPaid || 0), 0)],
    ["Capital recuperado", state.payments.reduce((sum, payment) => sum + Number(payment.capitalPaid || 0), 0)],
  ];

  const workbook = buildExcelWorkbook([
    {
      name: "Resumen",
      rows: [["Concepto", "Valor"], ...summaryRows],
    },
    {
      name: "Clientes",
      rows: [["Cliente", "Telefono", "Nota", "Estado general", "Prestamos", "Ampliaciones", "Capital pendiente", "Fecha de registro"], ...clientRows],
    },
    {
      name: "Prestamos",
      rows: [
        ["Cliente", "Telefono", "Monto prestado", "Capital pendiente", "Interes mensual", "Fecha prestada", "Fecha de cobro", "Estado", "Nota"],
        ...mainLoanRows,
      ],
    },
    {
      name: "Ampliaciones",
      rows: [
        ["Ampliacion", "Cliente", "Telefono", "Monto prestado", "Capital pendiente", "Interes mensual", "Fecha prestada", "Fecha de cobro", "Estado", "Nota"],
        ...extensionRows,
      ],
    },
    {
      name: "Pagos",
      rows: [
        [
          "Cliente",
          "Prestamo",
          "Fecha de pago",
          "Fecha programada",
          "Interes pagado",
          "Capital pagado",
          "Capital pendiente despues",
          "Proximo cobro",
          "Nota",
        ],
        ...paymentRows,
      ],
    },
  ]);

  downloadBlob(workbook, "application/vnd.ms-excel;charset=utf-8", `clientes-prestamos-${todayISO()}.xls`);
}

function loanExcelRow(client, loan) {
  const status = loan.status === "closed" ? "Cerrado" : getLoanStatus(loan).label;
  return [
    client.name,
    client.phone || "",
    Number(loan.amount || 0),
    Number(loan.remainingCapital || 0),
    `${roundMoney(loan.monthlyRate)}%`,
    formatDate(loan.startDate),
    loan.status === "active" ? formatDate(loan.nextDueDate) : "Cerrado",
    status,
    loan.note || "",
  ];
}

function buildPaymentHistoryRows() {
  return state.payments
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((payment) => {
      const client = getClient(payment.clientId);
      const loan = getLoan(payment.loanId);
      const loans = client ? getLoansForClient(client.id) : [];
      const loanIndex = loans.findIndex((item) => item.id === payment.loanId);
      const loanLabel = loanIndex <= 0 ? "Prestamo principal" : `Ampliacion ${loanIndex}`;
      return [
        client?.name || "Cliente eliminado",
        loan ? loanLabel : "Prestamo eliminado",
        formatDate(payment.date),
        payment.scheduledDueDate ? formatDate(payment.scheduledDueDate) : "",
        Number(payment.interestPaid || 0),
        Number(payment.capitalPaid || 0),
        Number(payment.remainingCapitalAfter || 0),
        payment.nextDueDateAfter ? formatDate(payment.nextDueDateAfter) : "Prestamo cerrado",
        payment.note || "",
      ];
    });
}

function buildExcelWorkbook(sheets) {
  const worksheets = sheets.map(
    (sheet) => `
      <Worksheet ss:Name="${escapeXML(sheet.name)}">
        <Table>
          ${sheet.rows
            .map(
              (row) => `
                <Row>${row.map(excelCell).join("")}</Row>
              `
            )
            .join("")}
        </Table>
      </Worksheet>
    `
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  ${worksheets.join("")}
</Workbook>`;
}

function excelCell(value) {
  const isNumber = typeof value === "number" && Number.isFinite(value);
  return `<Cell><Data ss:Type="${isNumber ? "Number" : "String"}">${escapeXML(isNumber ? String(value) : value ?? "")}</Data></Cell>`;
}

function escapeXML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function downloadBlob(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  if (isCloudMode()) {
    window.alert("La importacion masiva queda desactivada en modo SaaS para proteger los datos. Usala solo en modo demo local.");
    event.target.value = "";
    return;
  }
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", async () => {
    try {
      const imported = normalizeState(JSON.parse(reader.result));
      const confirmed = window.confirm("Esta copia reemplazara los datos actuales de esta plataforma. Deseas continuar?");
      if (!confirmed) return;

      await ensureAutomaticBackup(true);
      Object.assign(state, imported);
      saveState();
      render();
      window.alert("Copia importada correctamente.");
    } catch {
      window.alert("No se pudo importar la copia. Revisa que sea un archivo JSON valido.");
    } finally {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
}

async function handleSignOut() {
  if (isCloudMode()) {
    await saas.client.auth.signOut();
    state = createEmptyState();
    render();
    return;
  }
  resetData();
}

function resetData() {
  const confirmed = window.confirm("Cerrar sesion demo y eliminar los datos guardados en este navegador?");
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

function setDefaultDates() {
  const today = todayISO();
  const nextMonth = addOneMonthKeepingDay(today, getDayOfMonth(today));
  if ($("#clientLoanStartDate")) $("#clientLoanStartDate").value = today;
  if ($("#clientLoanDueDate")) $("#clientLoanDueDate").value = nextMonth;
}

function expectedInterest(loan) {
  return roundMoney(loan.remainingCapital * (loan.monthlyRate / 100));
}

function isOverdue(loan) {
  return startOfDay(loan.nextDueDate) < startOfDay(todayISO());
}

function daysBetween(from, to) {
  const ms = startOfDay(to) - startOfDay(from);
  return Math.ceil(ms / 86400000);
}

function isSameMonth(leftDate, rightDate) {
  return getMonthKey(leftDate) === getMonthKey(rightDate);
}

function getMonthKey(dateString) {
  const date = parseLocalDate(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getLastMonthKeys(count) {
  const current = parseLocalDate(todayISO());
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(current.getFullYear(), current.getMonth() - (count - 1 - index), 1);
    return {
      key: getMonthKey(toISODate(date)),
      label: new Intl.DateTimeFormat("es-PE", { month: "short" }).format(date),
    };
  });
}

function buildConicGradient(segments, total) {
  let cursor = 0;
  const stops = segments
    .filter((segment) => segment.value > 0)
    .map((segment) => {
      const start = cursor;
      cursor += (segment.value / total) * 100;
      return `${segment.color} ${start}% ${cursor}%`;
    });
  return `conic-gradient(${stops.join(", ")})`;
}

function addOneMonthKeepingDay(dateString, preferredDay) {
  return addMonthsKeepingDay(dateString, preferredDay, 1);
}

function addMonthsKeepingDay(dateString, preferredDay, monthOffset) {
  const date = parseLocalDate(dateString);
  const target = new Date(date.getFullYear(), date.getMonth() + monthOffset, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = Math.min(preferredDay, lastDay);
  return toISODate(new Date(target.getFullYear(), target.getMonth(), day));
}

function startOfDay(dateString) {
  return parseLocalDate(dateString).setHours(0, 0, 0, 0);
}

function parseLocalDate(dateString) {
  const cleanDate = String(dateString || todayISO()).slice(0, 10);
  const [year, month, day] = cleanDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayISO() {
  return toISODate(new Date());
}

function getDayOfMonth(dateString) {
  return parseLocalDate(dateString).getDate();
}

function createId(prefix) {
  const id = window.crypto?.randomUUID ? window.crypto.randomUUID() : Date.now().toString(36);
  return isCloudMode() ? id : `${prefix}-${id}`;
}

function getClient(id) {
  return state.clients.find((client) => client.id === id);
}

function getLoan(id) {
  return state.loans.find((loan) => loan.id === id);
}

function getLoanStatus(loan) {
  if (!loan) return { label: "Sin prestamo", className: "muted" };
  if (loan.status === "closed") return { label: "Cerrado", className: "muted" };
  if (isOverdue(loan)) return { label: "Vencido", className: "danger" };
  if (daysBetween(todayISO(), loan.nextDueDate) <= 5) return { label: "Por cobrar", className: "warn" };
  return { label: "Al dia", className: "ok" };
}

function sortLoansByDueDate(left, right) {
  return new Date(left.nextDueDate) - new Date(right.nextDueDate);
}

function hasDuplicatePhone(phone, excludeClientId = null) {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  return state.clients.some((client) => client.id !== excludeClientId && normalizePhone(client.phone) === normalized);
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function money(value) {
  const currency = state.user?.currency || "PEN";
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseLocalDate(dateString));
}

function toNumber(value) {
  return Number.parseFloat(value) || 0;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function renderEmpty(container, message) {
  if (container.children.length) return;
  container.innerHTML = `
    <div class="empty-state">
      <strong>Sin datos todavia</strong>
      <span>${escapeHTML(message)}</span>
    </div>
  `;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
