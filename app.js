const STORAGE_KEY = "prestamos-control-v1";
const BACKUP_STORAGE_KEY = "prestamos-control-backups-v1";
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_BACKUPS = 7;
const FREE_CLIENT_LIMIT = 10;
const CANONICAL_APP_ORIGIN = "https://ermif.com";
const LEGACY_APP_HOSTS = new Set(["reliable-kleicha-4c46be.netlify.app"]);
const INDICATOR_ORDER_STORAGE_KEY = "prestamos-dashboard-indicator-order-v1";
const OPERATION_TYPES = {
  principal: "principal",
  ampliacion: "ampliacion",
};
const INTEREST_MODES = {
  monthly: { label: "Mensual", shortLabel: "mensual", days: null, rateFactor: 1 },
  biweekly: { label: "Quincenal", shortLabel: "quincenal", days: 15, rateFactor: 1 / 2 },
  weekly: { label: "Semanal", shortLabel: "semanal", days: 7, rateFactor: 7 / 30 },
  daily: { label: "Diario", shortLabel: "diario", days: 1, rateFactor: 1 / 30 },
};
const PLAN_CATALOG = {
  free: {
    id: "free",
    label: "Gratis",
    price: "S/ 0",
    clientLimit: 10,
    description: "Para probar la plataforma y empezar con una cartera pequena.",
    features: [
      "Hasta 10 clientes",
      "Registro de prestamos y ampliaciones",
      "Control de cobros e historial",
      "Resumen con indicadores de cartera",
      "Exportacion a Excel y respaldo de datos",
    ],
  },
  basic: {
    id: "basic",
    label: "Basico",
    price: "S/ 29",
    clientLimit: 50,
    description: "Para prestamistas que ya trabajan con una cartera activa.",
    features: [
      "Hasta 50 clientes",
      "Registro de prestamos y ampliaciones",
      "Control de cobros e historial",
      "Resumen con indicadores de cartera",
      "Exportacion a Excel y respaldo de datos",
    ],
  },
  pro: {
    id: "pro",
    label: "Pro",
    price: "S/ 59",
    clientLimit: null,
    description: "Para negocios que necesitan crecer sin limite de clientes.",
    features: [
      "Clientes ilimitados",
      "Registro de prestamos y ampliaciones",
      "Control de cobros e historial",
      "Resumen con indicadores de cartera",
      "Exportacion a Excel y respaldo de datos",
    ],
  },
};

let state = createEmptyState();
let adminState = createEmptyAdminState();
let activeClientTab = "all";
let signupSuccessTimer = null;
let pendingLoanDelete = null;
let dashboardMessageTimers = [];
let quickCollectionScrollPositions = new Map();
let activeInfoTooltipTarget = null;
let indicatorDragState = null;
let indicatorTouchDragState = null;
let clientSubmissionInProgress = false;
let editSubmissionInProgress = false;
let paymentSubmissionInProgress = false;
let loanDeletionInProgress = false;
let clientDeletionInProgress = false;
let capitalSubmissionInProgress = false;
const saas = {
  client: null,
  session: null,
  mode: "local",
  loading: true,
  passwordRecovery: false,
  pendingProfileCompletion: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const elements = {
  authScreen: $("#authScreen"),
  appShell: $("#appShell"),
  registerForm: $("#registerForm"),
  authEmail: $("#authEmail"),
  authPassword: $("#authPassword"),
  authConfirmPassword: $("#authConfirmPassword"),
  authConfirmPasswordLabel: $("#authConfirmPasswordLabel"),
  authConfirmPasswordMessage: $("#authConfirmPasswordMessage"),
  authMode: $("#authMode"),
  authNotice: $("#authNotice"),
  authPasswordLabelText: $("#authPasswordLabelText"),
  authTermsLabel: $("#authTermsLabel"),
  authTermsAccept: $("#authTermsAccept"),
  authSubmitText: $("#authSubmitText"),
  googleAuthButton: $("#googleAuthButton"),
  googleAuthText: $("#googleAuthText"),
  forgotPassword: $("#forgotPassword"),
  forgotPasswordDialog: $("#forgotPasswordDialog"),
  forgotPasswordForm: $("#forgotPasswordForm"),
  forgotPasswordEmail: $("#forgotPasswordEmail"),
  forgotPasswordNotice: $("#forgotPasswordNotice"),
  completeProfileDialog: $("#completeProfileDialog"),
  completeProfileForm: $("#completeProfileForm"),
  completeProfileNotice: $("#completeProfileNotice"),
  completeBusinessName: $("#completeBusinessName"),
  completeOwnerName: $("#completeOwnerName"),
  completeCurrency: $("#completeCurrency"),
  completeProfileLogout: $("#completeProfileLogout"),
  completeProfileSubmit: $("#completeProfileSubmit"),
  passwordSuccessDialog: $("#passwordSuccessDialog"),
  passwordSuccessClose: $("#passwordSuccessClose"),
  signupSuccessDialog: $("#signupSuccessDialog"),
  termsDialog: $("#termsDialog"),
  claimsDialog: $("#claimsDialog"),
  claimBookForm: $("#claimBookForm"),
  claimBookNotice: $("#claimBookNotice"),
  claimBookSubmit: $("#claimBookSubmit"),
  claimBookResult: $("#claimBookResult"),
  claimType: $("#claimType"),
  claimService: $("#claimService"),
  claimFirstName: $("#claimFirstName"),
  claimLastName: $("#claimLastName"),
  claimDocumentType: $("#claimDocumentType"),
  claimDocumentNumber: $("#claimDocumentNumber"),
  claimEmail: $("#claimEmail"),
  claimPhone: $("#claimPhone"),
  claimAddress: $("#claimAddress"),
  claimAmount: $("#claimAmount"),
  claimPaymentReference: $("#claimPaymentReference"),
  claimDetail: $("#claimDetail"),
  claimRequest: $("#claimRequest"),
  claimTruthAccept: $("#claimTruthAccept"),
  showSignup: $("#showSignup"),
  showLogin: $("#showLogin"),
  businessLabel: $("#businessLabel"),
  ownerLabel: $("#ownerLabel"),
  planInlineStatus: $("#planInlineStatus"),
  todayLabel: $("#todayLabel"),
  viewTitle: $("#viewTitle"),
  exportButton: $("#exportData"),
  exportExcelButton: $("#exportExcel"),
  openAddCapitalButton: $("#openAddCapital"),
  openWithdrawCapitalButton: $("#openWithdrawCapital"),
  restoreBackupButton: $("#restoreBackup"),
  importButton: $("#importData"),
  importFile: $("#importFile"),
  capitalDialog: $("#capitalDialog"),
  capitalForm: $("#capitalForm"),
  capitalFormMode: $("#capitalFormMode"),
  capitalDialogEyebrow: $("#capitalDialogEyebrow"),
  capitalDialogTitle: $("#capitalDialogTitle"),
  capitalAmount: $("#capitalAmount"),
  capitalDate: $("#capitalDate"),
  capitalNote: $("#capitalNote"),
  capitalAvailableHint: $("#capitalAvailableHint"),
  capitalSubmitButton: $("#capitalSubmitButton"),
  capitalHistoryButton: $("#capitalHistoryButton"),
  capitalHistoryDialog: $("#capitalHistoryDialog"),
  capitalHistoryTitle: $("#capitalHistoryTitle"),
  capitalHistorySummary: $("#capitalHistorySummary"),
  capitalHistoryList: $("#capitalHistoryList"),
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
  loanLimitHint: $("#loanLimitHint"),
  clientSubmitButton: $("#clientSubmitButton"),
  interestInfoButton: $("#interestInfoButton"),
  interestInfoDialog: $("#interestInfoDialog"),
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
  loanDeleteDialog: $("#loanDeleteDialog"),
  loanDeleteForm: $("#loanDeleteForm"),
  loanDeleteSummary: $("#loanDeleteSummary"),
  plansGrid: $("#plansGrid"),
  planRequestDialog: $("#planRequestDialog"),
  planRequestForm: $("#planRequestForm"),
  planRequestTitle: $("#planRequestTitle"),
  requestedPlan: $("#requestedPlan"),
  planRequestSummary: $("#planRequestSummary"),
  planRequestMessage: $("#planRequestMessage"),
  planTermsAccept: $("#planTermsAccept"),
  summaryHeroMeta: $("#summaryHeroMeta"),
  summaryHealth: $("#summaryHealth"),
  summaryCustomStart: $("#summaryCustomStart"),
  summaryCustomEnd: $("#summaryCustomEnd"),
  summaryCompare: $("#summaryCompare"),
  summaryComparePreviousMonth: $("#summaryComparePreviousMonth"),
  summaryExport: $("#summaryExport"),
  summaryCriticalGrid: $("#summaryCriticalGrid"),
  summaryIndicatorsGrid: $("#summaryIndicatorsGrid"),
  resetIndicatorOrder: $("#resetIndicatorOrder"),
  summaryTodayList: $("#summaryTodayList"),
  summaryOverdueList: $("#summaryOverdueList"),
  summarySoonList: $("#summarySoonList"),
  summaryMonthList: $("#summaryMonthList"),
  summaryManagementGrid: $("#summaryManagementGrid"),
  summaryMonthlyChart: $("#summaryMonthlyChart"),
  summaryLoansChart: $("#summaryLoansChart"),
  summaryStatusChart: $("#summaryStatusChart"),
  summaryCapitalChart: $("#summaryCapitalChart"),
  summaryModeChart: $("#summaryModeChart"),
  summaryProjectionChart: $("#summaryProjectionChart"),
  summaryDelinquencyChart: $("#summaryDelinquencyChart"),
  summaryCashflowChart: $("#summaryCashflowChart"),
  summaryDebtList: $("#summaryDebtList"),
  summaryProfitList: $("#summaryProfitList"),
  summaryExtensionList: $("#summaryExtensionList"),
  summaryPunctualList: $("#summaryPunctualList"),
  summaryLateList: $("#summaryLateList"),
  summaryPaymentList: $("#summaryPaymentList"),
  summaryLoanList: $("#summaryLoanList"),
  summaryRecentExtensionList: $("#summaryRecentExtensionList"),
  summaryAdvancedGrid: $("#summaryAdvancedGrid"),
  summaryAlerts: $("#summaryAlerts"),
  adminNav: $("#adminNav"),
  adminRefresh: $("#adminRefresh"),
  adminTotalUsers: $("#adminTotalUsers"),
  adminTotalClients: $("#adminTotalClients"),
  adminPendingRequests: $("#adminPendingRequests"),
  adminMonthlyRevenue: $("#adminMonthlyRevenue"),
  adminRequestsList: $("#adminRequestsList"),
  adminUserList: $("#adminUserList"),
  adminIntegrityCheck: $("#adminIntegrityCheck"),
  integrityDialog: $("#integrityDialog"),
  integritySummary: $("#integritySummary"),
  integrityList: $("#integrityList"),
};

const icons = {
  edit:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>',
  coin:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v8"/><path d="M9.5 10.5c.5-1 1.3-1.5 2.5-1.5 1.5 0 2.5.8 2.5 2s-1 2-2.5 2-2.5.8-2.5 2 1 2 2.5 2c1.2 0 2-.5 2.5-1.5"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>',
  history:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>',
};

if (!window.__PRESTAMOS_TEST__ && !redirectLegacyHost()) {
  init();
}

function redirectLegacyHost() {
  if (window.location.protocol !== "http:" && window.location.protocol !== "https:") {
    return false;
  }

  const host = window.location.hostname.toLowerCase();
  if (!LEGACY_APP_HOSTS.has(host) && !host.endsWith(".netlify.app")) {
    return false;
  }

  const targetUrl = `${CANONICAL_APP_ORIGIN}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(targetUrl);
  return true;
}

async function init() {
  setDefaultDates();
  bindEvents();
  setAuthMode("signup");
  await initSaaS();
  render();
}

function bindEvents() {
  elements.registerForm.addEventListener("submit", handleRegister);
  elements.authPassword.addEventListener("input", updateConfirmPasswordFeedback);
  elements.authConfirmPassword.addEventListener("input", updateConfirmPasswordFeedback);
  elements.googleAuthButton.addEventListener("click", handleGoogleAuth);
  elements.completeProfileForm.addEventListener("submit", handleCompleteProfileSubmit);
  elements.completeProfileLogout.addEventListener("click", handleCompleteProfileLogout);
  elements.clientForm.addEventListener("submit", handleClientSubmit);
  elements.editForm.addEventListener("submit", handleEditSubmit);
  elements.paymentForm.addEventListener("submit", handlePaymentSubmit);
  elements.loanDeleteForm.addEventListener("submit", handleLoanDeleteSubmit);
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
  elements.exportExcelButton?.addEventListener("click", exportClientsExcel);
  elements.openAddCapitalButton.addEventListener("click", () => openCapitalDialog("deposit"));
  elements.openWithdrawCapitalButton.addEventListener("click", () => openCapitalDialog("withdrawal"));
  elements.capitalForm.addEventListener("submit", handleCapitalSubmit);
  elements.capitalHistoryButton.addEventListener("click", () => openCapitalHistoryDialog(elements.capitalFormMode.value));
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
  $$("[data-open-terms]").forEach((button) => {
    button.addEventListener("click", () => elements.termsDialog.showModal());
  });
  $$("[data-open-claims]").forEach((button) => {
    button.addEventListener("click", openClaimBookDialog);
  });
  elements.claimBookForm.addEventListener("submit", handleClaimBookSubmit);
  elements.adminRefresh.addEventListener("click", refreshAdminPanel);
  elements.adminIntegrityCheck.addEventListener("click", openIntegrityDialog);
  elements.interestInfoButton.addEventListener("click", () => elements.interestInfoDialog.showModal());
  $$("[data-dashboard-filter]").forEach((filter) => {
    filter.addEventListener("input", renderDashboard);
    filter.addEventListener("change", renderDashboard);
  });
  elements.summaryComparePreviousMonth.addEventListener("click", setDashboardPreviousMonthComparison);
  elements.summaryExport.addEventListener("click", exportDashboardSummary);
  $("#clientLoanStartDate").addEventListener("change", () => updateSuggestedDueDate("clientLoan"));
  $("#clientLoanInterestMode").addEventListener("change", () => updateSuggestedDueDate("clientLoan"));
  $("#editLoanStartDate").addEventListener("change", () => updateSuggestedDueDate("editLoan"));
  $("#editLoanInterestMode").addEventListener("change", () => updateSuggestedDueDate("editLoan"));

  $("#openClientView").addEventListener("click", () => {
    openClientChoiceDialog();
  });
  elements.chooseNewClient.addEventListener("click", () => openClientDialog("new"));
  elements.chooseLoanExtension.addEventListener("click", () => openClientDialog("extension"));
  elements.clientNameSelect.addEventListener("change", fillExtensionClientFields);
  $("#clientLoanAmount").addEventListener("input", updateLoanLimitHint);
  elements.clientNameSelect.addEventListener("change", updateLoanLimitHint);
  $("#resetDemo").addEventListener("click", handleSignOut);

  $$("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog").close());
  });

  $$(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });
  window.addEventListener("resize", () => {
    scheduleQuickCollectionSetup();
    positionActiveInfoTooltip();
  });
  window.addEventListener("scroll", positionActiveInfoTooltip, true);
  initInfoTooltipEvents();
  initIndicatorOrderEvents();

  document.addEventListener("click", (event) => {
    const infoDot = event.target.closest(".info-dot");
    if (infoDot) {
      event.preventDefault();
      toggleInfoTooltip(infoDot);
      return;
    }
    hideInfoTooltip();

    const editButton = event.target.closest("[data-edit-client]");
    const editLoanButton = event.target.closest("[data-edit-loan]");
    const paymentButton = event.target.closest("[data-pay-loan]");
    const historyButton = event.target.closest("[data-history-client]");
    const deleteLoanButton = event.target.closest("[data-delete-loan]");
    const deleteButton = event.target.closest("[data-delete-client]");
    const planButton = event.target.closest("[data-request-plan]");
    const adminPlanButton = event.target.closest("[data-admin-plan]");
    const quickScrollButton = event.target.closest("[data-scroll-quick-list]");
    if (quickScrollButton) {
      scrollQuickCollection(quickScrollButton.dataset.scrollQuickList);
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

    if (deleteLoanButton) {
      openLoanDeleteDialog(deleteLoanButton.dataset.deleteClient, deleteLoanButton.dataset.deleteLoan);
      return;
    }

    if (deleteButton) {
      deleteClient(deleteButton.dataset.deleteClient, deleteButton);
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
    capitalMovements: [],
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
    loans: normalizeLoans(raw.loans),
    payments: Array.isArray(raw.payments) ? raw.payments : [],
    capitalMovements: normalizeCapitalMovements(raw.capitalMovements || raw.capital_movements),
  };
}

function normalizeCapitalMovements(movements) {
  return Array.isArray(movements)
    ? movements.map((movement) => ({
        ...movement,
        type: normalizeCapitalMovementType(movement.type),
        amount: Number(movement.amount || 0),
        date: movement.date || todayISO(),
        note: movement.note || "",
        createdAt: movement.createdAt || movement.created_at || new Date().toISOString(),
      }))
    : [];
}

function normalizeCapitalMovementType(type) {
  return type === "withdrawal" ? "withdrawal" : "deposit";
}

function normalizeLoans(loans) {
  const normalizedLoans = Array.isArray(loans)
    ? loans.map((loan) => ({
        ...loan,
        amount: Number(loan.amount || 0),
        remainingCapital: Number(loan.remainingCapital || loan.remaining_capital || 0),
        monthlyRate: Number(loan.monthlyRate || loan.monthly_rate || 0),
        interestMode: normalizeInterestMode(loan.interestMode || loan.interest_mode),
        operationType: normalizeOperationType(loan.operationType || loan.operation_type),
        parentLoanId: loan.parentLoanId || loan.parent_loan_id || null,
      }))
    : [];
  return normalizeLoanOperationTypes(normalizedLoans);
}

function normalizeLoanOperationTypes(loans) {
  const byClient = new Map();
  loans.forEach((loan) => {
    if (!byClient.has(loan.clientId)) byClient.set(loan.clientId, []);
    byClient.get(loan.clientId).push(loan);
  });

  byClient.forEach((clientLoans) => {
    clientLoans.sort(compareLoansForOperationOrder);
    let principal = clientLoans.find((loan) => normalizeOperationType(loan.operationType) === OPERATION_TYPES.principal);
    if (!principal) {
      principal = clientLoans[0];
      if (principal) principal.operationType = OPERATION_TYPES.principal;
    }
    clientLoans.forEach((loan) => {
      loan.operationType = normalizeOperationType(loan.operationType) || (loan.id === principal?.id ? OPERATION_TYPES.principal : OPERATION_TYPES.ampliacion);
      loan.parentLoanId = loan.operationType === OPERATION_TYPES.ampliacion ? loan.parentLoanId || principal?.id || null : null;
    });
  });

  return loans;
}

function compareLoansForOperationOrder(left, right) {
  const leftDate = new Date(left.createdAt || left.created_at || left.startDate || 0).getTime();
  const rightDate = new Date(right.createdAt || right.created_at || right.startDate || 0).getTime();
  return leftDate - rightDate || String(left.id || "").localeCompare(String(right.id || ""));
}

function normalizeOperationType(type) {
  return Object.prototype.hasOwnProperty.call(OPERATION_TYPES, type) ? type : null;
}

function validateStateIntegrity(candidate) {
  const errors = [];
  const clients = Array.isArray(candidate?.clients) ? candidate.clients : [];
  const loans = Array.isArray(candidate?.loans) ? candidate.loans : [];
  const payments = Array.isArray(candidate?.payments) ? candidate.payments : [];
  const capitalMovements = Array.isArray(candidate?.capitalMovements) ? candidate.capitalMovements : [];
  const clientIds = new Set();
  const loanIds = new Set();
  const paymentIds = new Set();
  const capitalMovementIds = new Set();
  const loansByClient = new Map();

  clients.forEach((client, index) => {
    if (!client?.id) errors.push(`Cliente #${index + 1} sin ID.`);
    if (client?.id && clientIds.has(client.id)) errors.push(`Cliente duplicado: ${client.id}.`);
    if (client?.id) clientIds.add(client.id);
    if (!String(client?.name || "").trim()) errors.push(`Cliente #${index + 1} sin nombre.`);
  });

  loans.forEach((loan, index) => {
    if (!loan?.id) errors.push(`Prestamo #${index + 1} sin ID.`);
    if (loan?.id && loanIds.has(loan.id)) errors.push(`Prestamo duplicado: ${loan.id}.`);
    if (loan?.id) loanIds.add(loan.id);
    if (!clientIds.has(loan?.clientId)) errors.push(`Prestamo ${loan?.id || `#${index + 1}`} sin cliente valido.`);
    if (!isPositiveMoney(loan?.amount)) errors.push(`Prestamo ${loan?.id || `#${index + 1}`} con monto invalido.`);
    if (!isNonNegativeMoney(loan?.remainingCapital)) errors.push(`Prestamo ${loan?.id || `#${index + 1}`} con capital pendiente invalido.`);
    if (Number(loan?.remainingCapital || 0) > Number(loan?.amount || 0)) errors.push(`Prestamo ${loan?.id || `#${index + 1}`} con capital pendiente mayor al monto.`);
    if (!isNonNegativeMoney(loan?.monthlyRate)) errors.push(`Prestamo ${loan?.id || `#${index + 1}`} con tasa invalida.`);
    if (!INTEREST_MODES[normalizeInterestMode(loan?.interestMode)]) errors.push(`Prestamo ${loan?.id || `#${index + 1}`} con modalidad invalida.`);
    if (!isBusinessDate(loan?.startDate)) errors.push(`Prestamo ${loan?.id || `#${index + 1}`} con fecha prestada invalida.`);
    if (loan?.nextDueDate && !isBusinessDate(loan.nextDueDate)) errors.push(`Prestamo ${loan?.id || `#${index + 1}`} con fecha de cobro invalida.`);
    if (loan?.status === "closed" && loan?.nextDueDate) errors.push(`Prestamo ${loan?.id || `#${index + 1}`} cerrado con proxima fecha de cobro.`);
    if (loan?.status === "active" && !isBusinessDate(loan?.nextDueDate)) errors.push(`Prestamo ${loan?.id || `#${index + 1}`} activo sin fecha de cobro valida.`);
    if (isBusinessDate(loan?.startDate) && isBusinessDate(loan?.nextDueDate) && startOfDay(loan.nextDueDate) < startOfDay(loan.startDate)) {
      errors.push(`Prestamo ${loan?.id || `#${index + 1}`} con fecha de cobro antes de fecha prestada.`);
    }
    if (!Number.isInteger(Number(loan?.dueDay)) || Number(loan?.dueDay) < 1 || Number(loan?.dueDay) > 31) {
      errors.push(`Prestamo ${loan?.id || `#${index + 1}`} con dia de cobro invalido.`);
    }
    if (!["active", "closed"].includes(loan?.status)) errors.push(`Prestamo ${loan?.id || `#${index + 1}`} con estado invalido.`);
    if (loan?.status === "closed" && Number(loan?.remainingCapital || 0) !== 0) {
      errors.push(`Prestamo ${loan?.id || `#${index + 1}`} cerrado con capital pendiente.`);
    }
    if (loan?.status === "active" && Number(loan?.remainingCapital || 0) <= 0) {
      errors.push(`Prestamo ${loan?.id || `#${index + 1}`} activo sin capital pendiente.`);
    }
    const operationType = normalizeOperationType(loan?.operationType || loan?.operation_type);
    if (!operationType) errors.push(`Prestamo ${loan?.id || `#${index + 1}`} sin tipo de operacion valido.`);
    if (loan?.clientId) {
      if (!loansByClient.has(loan.clientId)) loansByClient.set(loan.clientId, []);
      loansByClient.get(loan.clientId).push({ ...loan, operationType });
    }
  });

  loansByClient.forEach((clientLoans, clientId) => {
    const principals = clientLoans.filter((loan) => loan.operationType === OPERATION_TYPES.principal);
    if (principals.length !== 1) errors.push(`Cliente ${clientId} debe tener un unico prestamo principal.`);
    const principalId = principals[0]?.id;
    clientLoans
      .filter((loan) => loan.operationType === OPERATION_TYPES.ampliacion)
      .forEach((loan) => {
        if (!loan.parentLoanId && !loan.parent_loan_id) errors.push(`Ampliacion ${loan.id} sin prestamo principal vinculado.`);
        if ((loan.parentLoanId || loan.parent_loan_id) && (loan.parentLoanId || loan.parent_loan_id) !== principalId) {
          errors.push(`Ampliacion ${loan.id} vinculada a un principal invalido.`);
        }
      });
  });

  payments.forEach((payment, index) => {
    const loan = loans.find((item) => item.id === payment?.loanId);
    if (!payment?.id) errors.push(`Pago #${index + 1} sin ID.`);
    if (payment?.id && paymentIds.has(payment.id)) errors.push(`Pago duplicado: ${payment.id}.`);
    if (payment?.id) paymentIds.add(payment.id);
    if (!loanIds.has(payment?.loanId)) errors.push(`Pago ${payment?.id || `#${index + 1}`} sin prestamo valido.`);
    if (!clientIds.has(payment?.clientId)) errors.push(`Pago ${payment?.id || `#${index + 1}`} sin cliente valido.`);
    if (loan && payment?.clientId !== loan.clientId) errors.push(`Pago ${payment?.id || `#${index + 1}`} no pertenece al cliente del prestamo.`);
    if (!isBusinessDate(payment?.date)) errors.push(`Pago ${payment?.id || `#${index + 1}`} con fecha invalida.`);
    if (!isNonNegativeMoney(payment?.interestPaid)) errors.push(`Pago ${payment?.id || `#${index + 1}`} con interes invalido.`);
    if (!isNonNegativeMoney(payment?.capitalPaid)) errors.push(`Pago ${payment?.id || `#${index + 1}`} con capital invalido.`);
    if (Number(payment?.interestPaid || 0) === 0 && Number(payment?.capitalPaid || 0) === 0) {
      errors.push(`Pago ${payment?.id || `#${index + 1}`} sin monto cobrado.`);
    }
    if (payment?.remainingCapitalAfter !== undefined && !isNonNegativeMoney(payment.remainingCapitalAfter)) {
      errors.push(`Pago ${payment?.id || `#${index + 1}`} con saldo posterior invalido.`);
    }
  });

  capitalMovements.forEach((movement, index) => {
    if (!movement?.id) errors.push(`Movimiento de capital #${index + 1} sin ID.`);
    if (movement?.id && capitalMovementIds.has(movement.id)) errors.push(`Movimiento de capital duplicado: ${movement.id}.`);
    if (movement?.id) capitalMovementIds.add(movement.id);
    if (!["deposit", "withdrawal"].includes(movement?.type)) errors.push(`Movimiento de capital ${movement?.id || `#${index + 1}`} con tipo invalido.`);
    if (!isPositiveMoney(movement?.amount)) errors.push(`Movimiento de capital ${movement?.id || `#${index + 1}`} con monto invalido.`);
    if (!isBusinessDate(movement?.date)) errors.push(`Movimiento de capital ${movement?.id || `#${index + 1}`} con fecha invalida.`);
  });

  return errors;
}

function normalizeInterestMode(mode) {
  return INTEREST_MODES[mode] ? mode : "monthly";
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
  elements.authConfirmPasswordLabel.classList.toggle("is-hidden", isLogin || isRecovery);
  elements.authTermsLabel.classList.toggle("is-hidden", isLogin || isRecovery);
  $("#businessName").required = !isLogin && !isRecovery;
  $("#ownerName").required = !isLogin && !isRecovery;
  elements.authConfirmPassword.required = !isLogin && !isRecovery;
  elements.authTermsAccept.required = !isLogin && !isRecovery;
  if (isLogin || isRecovery) {
    elements.authConfirmPassword.value = "";
    elements.authTermsAccept.checked = false;
  }
  updateConfirmPasswordFeedback();
  elements.forgotPassword.classList.toggle("is-hidden", !isLogin);
  elements.authPasswordLabelText.textContent = isRecovery ? "Nueva contrasena" : "Contrasena";
  elements.authPassword.placeholder = isRecovery ? "Minimo 6 caracteres nuevos" : "Minimo 6 caracteres";
  elements.authSubmitText.textContent = isRecovery ? "Guardar nueva contrasena" : isLogin ? "Iniciar sesion" : "Crear mi plataforma";
  elements.googleAuthButton.classList.toggle("is-hidden", isRecovery);
  elements.googleAuthText.textContent = "Continuar con Google";
  setAuthNotice(
    isRecovery
      ? "Escribe tu nueva contrasena para recuperar el acceso."
      : isLogin
      ? "Accede a tu cartera desde cualquier equipo."
      : "Registra hasta 10 clientes gratis, prueba el sistema con calma y pasa a Premium cuando quieras crecer.",
    isRecovery || isLogin ? "info" : "trial"
  );
}

function setAuthNotice(message, variant = "info") {
  if (!elements.authNotice) return;
  elements.authNotice.classList.toggle("auth-notice-premium", variant === "trial");
  if (variant === "trial") {
    elements.authNotice.innerHTML = `
      <span class="auth-notice-icon" aria-hidden="true">i</span>
      <span>
        <strong>Prueba gratis</strong>
        <small>${escapeHTML(message || "")}</small>
      </span>
    `;
    return;
  }
  elements.authNotice.textContent = message || "";
}

async function handleGoogleAuth() {
  if (!saas.client) {
    setAuthNotice("Google estara disponible cuando Supabase este configurado.");
    return;
  }
  setButtonBusy(elements.googleAuthButton, true, "Conectando con Google...");
  try {
    const { error } = await saas.client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  } catch (error) {
    setButtonBusy(elements.googleAuthButton, false);
    setAuthNotice(error.message || "No se pudo iniciar con Google.");
  }
}

function isGoogleSession(session) {
  const user = session?.user;
  return Boolean(
    user?.app_metadata?.provider === "google" || (user?.identities || []).some((identity) => identity.provider === "google")
  );
}

function openCompleteProfileDialog() {
  const pending = saas.pendingProfileCompletion;
  if (!pending || elements.completeProfileDialog.open) return;
  elements.completeProfileNotice.textContent = "Escribe el nombre de tu negocio para terminar la configuracion de ERMIF.";
  elements.completeBusinessName.value = "";
  elements.completeOwnerName.value = pending.ownerName || "";
  elements.completeCurrency.value = pending.currency || "PEN";
  elements.completeProfileDialog.showModal();
  elements.completeBusinessName.focus();
}

async function handleCompleteProfileSubmit(event) {
  event.preventDefault();
  const pending = saas.pendingProfileCompletion;
  const businessName = elements.completeBusinessName.value.trim();
  const ownerName = elements.completeOwnerName.value.trim();
  const currency = elements.completeCurrency.value;
  if (!pending || !saas.session?.user) return;
  if (!businessName) {
    elements.completeProfileNotice.textContent = "Escribe el nombre de tu negocio para continuar.";
    elements.completeBusinessName.focus();
    return;
  }
  if (!ownerName) {
    elements.completeProfileNotice.textContent = "Escribe tu nombre para continuar.";
    elements.completeOwnerName.focus();
    return;
  }

  setButtonBusy(elements.completeProfileSubmit, true, "Guardando...");
  try {
    await ensureCloudAccount(saas.session.user.id, {
      email: pending.email || saas.session.user.email,
      businessName,
      ownerName,
      currency,
    });
    saas.pendingProfileCompletion = null;
    elements.completeProfileDialog.close();
    await loadCloudState();
    render();
  } catch (error) {
    elements.completeProfileNotice.textContent = error.message || "No se pudo completar tu cuenta.";
  } finally {
    setButtonBusy(elements.completeProfileSubmit, false);
  }
}

async function handleCompleteProfileLogout() {
  saas.pendingProfileCompletion = null;
  elements.completeProfileDialog.close();
  await saas.client?.auth.signOut();
  state = createEmptyState();
  render();
}

function updateConfirmPasswordFeedback() {
  const message = getConfirmPasswordMessage(false);
  renderConfirmPasswordFeedback(message);
}

function validateSignupPasswords() {
  const message = getConfirmPasswordMessage(true);
  renderConfirmPasswordFeedback(message);
  return message === "Las contraseñas coinciden.";
}

function getConfirmPasswordMessage(forceRequired) {
  if (elements.authMode.value !== "signup") return "";
  const password = elements.authPassword.value;
  const confirmPassword = elements.authConfirmPassword.value;
  if (!confirmPassword) return forceRequired ? "Vuelve a escribir tu contraseña." : "";
  if (password.length < 6) return "";
  if (password !== confirmPassword) return "Las contraseñas no coinciden.";
  return "Las contraseñas coinciden.";
}

function renderConfirmPasswordFeedback(message) {
  const isSuccess = message === "Las contraseñas coinciden.";
  const isError = Boolean(message) && !isSuccess;
  elements.authConfirmPasswordMessage.textContent = message;
  elements.authConfirmPasswordMessage.classList.toggle("is-valid", isSuccess);
  elements.authConfirmPassword.classList.toggle("field-error", isError);
  elements.authConfirmPassword.classList.toggle("field-success", isSuccess);
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

function getPlanInlineStatusText() {
  const plan = getCurrentPlan();
  if (plan.clientLimit === null) return `Plan ${plan.label} · clientes ilimitados`;
  return `Plan ${plan.label} · ${state.clients.length} de ${plan.clientLimit} clientes`;
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
    const metadata = saas.session.user.user_metadata || {};
    const businessName = metadata.business_name || metadata.businessName || "";
    const ownerName = metadata.owner_name || metadata.ownerName || metadata.full_name || metadata.name || "";
    if (isGoogleSession(saas.session) && !businessName.trim()) {
      saas.pendingProfileCompletion = {
        userId,
        email: saas.session.user.email,
        ownerName,
        currency: metadata.currency || "PEN",
      };
      state = createEmptyState();
      return;
    }
    await ensureCloudAccount(userId, {
      email: saas.session.user.email,
      businessName: businessName || saas.session.user.email || "Mi negocio",
      ownerName: ownerName || "Prestamista",
      currency: metadata.currency || "PEN",
    });
    return loadCloudState();
  }

  saas.pendingProfileCompletion = null;

  const capitalMovementsResult = await loadCloudCapitalMovements(userId);

  state = {
    user: profileFromRow(profileResult.data, saas.session.user.email),
    subscription: subscriptionFromRow(subscriptionResult.data || createFreeSubscription(userId)),
    clients: (clientsResult.data || []).map(clientFromRow),
    loans: normalizeLoanOperationTypes((loansResult.data || []).map(loanFromRow)),
    payments: (paymentsResult.data || []).map(paymentFromRow),
    capitalMovements: (capitalMovementsResult.data || []).map(capitalMovementFromRow),
  };

  if (state.user?.isAdmin) {
    await loadAdminState();
  } else {
    adminState = createEmptyAdminState();
  }

  await ensureAutomaticBackup();
}

async function loadCloudCapitalMovements(userId) {
  const result = await saas.client
    .from("capital_movements")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });
  if (isCapitalMovementsTableError(result.error)) {
    return { data: [] };
  }
  if (result.error) throw result.error;
  return result;
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
  const { error } = await saas.client.rpc("create_client_with_loan", {
    p_client_id: client.id,
    p_name: client.name,
    p_phone: client.phone || "",
    p_client_note: client.note || "",
    p_loan_id: loan.id,
    p_amount: loan.amount,
    p_monthly_rate: loan.monthlyRate,
    p_interest_mode: normalizeInterestMode(loan.interestMode),
    p_start_date: loan.startDate,
    p_next_due_date: loan.nextDueDate,
    p_due_day: loan.dueDay,
    p_loan_note: loan.note || "",
    p_created_at: loan.createdAt,
  });
  if (error) throw error;
}

async function createCloudLoan(loan) {
  if (!isCloudMode()) return;
  const { error } = await saas.client.rpc("create_loan_operation", {
    p_loan_id: loan.id,
    p_client_id: loan.clientId,
    p_amount: loan.amount,
    p_monthly_rate: loan.monthlyRate,
    p_interest_mode: normalizeInterestMode(loan.interestMode),
    p_operation_type: normalizeOperationType(loan.operationType) || OPERATION_TYPES.ampliacion,
    p_parent_loan_id: loan.parentLoanId,
    p_start_date: loan.startDate,
    p_next_due_date: loan.nextDueDate,
    p_due_day: loan.dueDay,
    p_note: loan.note || "",
    p_created_at: loan.createdAt,
  });
  if (error) throw error;
}

async function updateCloudClientAndLoan(client, loan) {
  if (!isCloudMode()) return;
  const { error } = await saas.client.rpc("update_client_with_loan", {
    p_client_id: client.id,
    p_name: client.name,
    p_phone: client.phone || "",
    p_client_note: client.note || "",
    p_loan_id: loan?.id || null,
    p_amount: loan ? loan.amount : null,
    p_remaining_capital: loan ? loan.remainingCapital : null,
    p_monthly_rate: loan ? loan.monthlyRate : null,
    p_interest_mode: loan ? normalizeInterestMode(loan.interestMode) : null,
    p_start_date: loan ? loan.startDate : null,
    p_next_due_date: loan ? loan.nextDueDate : null,
    p_due_day: loan ? loan.dueDay : null,
    p_loan_note: loan ? loan.note || "" : "",
    p_status: loan ? loan.status : null,
    p_closed_at: loan ? loan.closedAt : null,
  });
  if (error) throw error;
}

async function createCloudPaymentAndUpdateLoan(payment) {
  if (!isCloudMode()) return;
  const { data, error } = await saas.client.rpc("register_payment", {
    p_payment_id: payment.id,
    p_loan_id: payment.loanId,
    p_client_id: payment.clientId,
    p_date: payment.date,
    p_scheduled_due_date: payment.scheduledDueDate,
    p_interest_paid: payment.interestPaid,
    p_capital_paid: payment.capitalPaid,
    p_note: payment.note,
    p_created_at: payment.createdAt,
  });
  if (error) throw error;
  return data;
}

async function createCloudCapitalMovement(movement) {
  if (!isCloudMode()) return;
  const userId = saas.session.user.id;
  const { error } = await saas.client.from("capital_movements").insert(capitalMovementToRow(movement, userId));
  if (error) throw error;
}

async function insertCloudLoanRow(loan, userId) {
  let row = loanToRow(loan, userId);
  let { error } = await saas.client.from("loans").insert(row);
  if (isInterestModeColumnError(error)) {
    row = withoutInterestMode(row);
    const retry = await saas.client.from("loans").insert(row);
    error = retry.error;
  }
  if (error) throw error;
}

async function updateCloudLoanRow(loan, userId) {
  let row = loanToRow(loan, userId);
  let { error } = await saas.client.from("loans").update(row).eq("id", loan.id).eq("user_id", userId);
  if (isInterestModeColumnError(error)) {
    row = withoutInterestMode(row);
    const retry = await saas.client.from("loans").update(row).eq("id", loan.id).eq("user_id", userId);
    error = retry.error;
  }
  if (error) throw error;
}

function withoutInterestMode(row) {
  const { interest_mode, ...compatibleRow } = row;
  return compatibleRow;
}

function isInterestModeColumnError(error) {
  return Boolean(error && /interest_mode|schema cache/i.test(error.message || ""));
}

function isCapitalMovementsTableError(error) {
  return Boolean(error && /capital_movements|schema cache|relation .* does not exist/i.test(error.message || ""));
}

async function deleteCloudClient(clientId) {
  if (!isCloudMode()) return;
  const userId = saas.session.user.id;
  const clientDelete = await saas.client.from("clients").delete().eq("user_id", userId).eq("id", clientId);
  if (clientDelete.error) throw clientDelete.error;
}

async function deleteCloudLoanExtension(clientId, loanId) {
  if (!isCloudMode()) return;
  const userId = saas.session.user.id;
  const loanDelete = await saas.client
    .from("loans")
    .delete()
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .eq("id", loanId);
  if (loanDelete.error) throw loanDelete.error;
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

async function createPlanCheckout(requestedPlan, message) {
  if (!isCloudMode()) {
    throw new Error("Debes iniciar sesion para solicitar un plan.");
  }

  const response = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${saas.session.access_token}`,
    },
    body: JSON.stringify({
      planId: requestedPlan,
      message,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "No se pudo iniciar el pago.");
  }

  if (!data.checkoutUrl) {
    throw new Error("No se recibio el enlace de pago.");
  }

  return data.checkoutUrl;
}

function openClaimBookDialog() {
  elements.claimBookNotice.classList.add("is-hidden");
  elements.claimBookNotice.textContent = "";
  elements.claimBookResult.classList.add("is-hidden");
  elements.claimBookResult.textContent = "";
  elements.claimBookSubmit.disabled = false;
  elements.claimBookSubmit.textContent = "Registrar hoja";

  if (!elements.claimService.value.trim()) {
    elements.claimService.value = "Suscripcion ERMIF";
  }

  if (!elements.claimEmail.value.trim()) {
    elements.claimEmail.value = state.user?.email || saas.session?.user?.email || "";
  }

  elements.claimsDialog.showModal();
}

function setClaimBookNotice(message, variant = "info") {
  elements.claimBookNotice.textContent = message || "";
  elements.claimBookNotice.classList.toggle("is-hidden", !message);
  elements.claimBookNotice.classList.toggle("auth-notice-premium", variant === "success");
}

function collectClaimBookPayload() {
  const amountText = elements.claimAmount.value.trim();
  const amount = amountText ? Number(amountText) : null;

  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    throw new Error("El monto reclamado debe ser cero o mayor.");
  }

  return {
    requestType: elements.claimType.value,
    serviceName: elements.claimService.value.trim(),
    consumerFirstName: elements.claimFirstName.value.trim(),
    consumerLastName: elements.claimLastName.value.trim(),
    documentType: elements.claimDocumentType.value,
    documentNumber: elements.claimDocumentNumber.value.trim(),
    email: elements.claimEmail.value.trim(),
    phone: elements.claimPhone.value.trim(),
    address: elements.claimAddress.value.trim(),
    amount,
    paymentReference: elements.claimPaymentReference.value.trim(),
    detail: elements.claimDetail.value.trim(),
    request: elements.claimRequest.value.trim(),
  };
}

async function submitClaimBook(payload) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (saas.session?.access_token) {
    headers.Authorization = `Bearer ${saas.session.access_token}`;
  }

  const response = await fetch("/api/reclamaciones", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "No se pudo registrar la hoja de reclamacion.");
  }

  return data;
}

async function handleClaimBookSubmit(event) {
  event.preventDefault();

  if (!elements.claimTruthAccept.checked) {
    window.alert("Debes confirmar que la informacion registrada es verdadera.");
    return;
  }

  try {
    const payload = collectClaimBookPayload();
    elements.claimBookSubmit.disabled = true;
    elements.claimBookSubmit.textContent = "Registrando...";
    setClaimBookNotice("Registrando tu hoja de reclamacion...", "info");

    const result = await submitClaimBook(payload);
    const claimCode = result.claimCode || "codigo generado";
    elements.claimBookResult.textContent = `Hoja registrada correctamente. Codigo de seguimiento: ${claimCode}. Conserva este codigo; ERMIF respondera por escrito al correo indicado en un plazo maximo de 15 dias habiles.`;
    elements.claimBookResult.classList.remove("is-hidden");
    setClaimBookNotice("Tu hoja fue registrada correctamente.", "success");
    elements.claimBookForm.reset();
    elements.claimService.value = "Suscripcion ERMIF";
    elements.claimBookSubmit.textContent = "Registrar otra hoja";
  } catch (error) {
    setClaimBookNotice(error.message || "No se pudo registrar la hoja de reclamacion.");
    elements.claimBookSubmit.textContent = "Registrar hoja";
  } finally {
    elements.claimBookSubmit.disabled = false;
  }
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
    interestMode: normalizeInterestMode(row.interest_mode),
    operationType: normalizeOperationType(row.operation_type),
    parentLoanId: row.parent_loan_id || null,
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

function capitalMovementFromRow(row) {
  return {
    id: row.id,
    type: normalizeCapitalMovementType(row.type),
    amount: Number(row.amount),
    date: row.date,
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
    interest_mode: normalizeInterestMode(loan.interestMode),
    operation_type: normalizeOperationType(loan.operationType) || OPERATION_TYPES.principal,
    parent_loan_id: loan.parentLoanId || null,
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

function capitalMovementToRow(movement, userId) {
  return {
    id: movement.id,
    user_id: userId,
    type: normalizeCapitalMovementType(movement.type),
    amount: movement.amount,
    date: movement.date,
    note: movement.note,
    created_at: movement.createdAt,
  };
}

function createBackupSnapshot() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    clients: state.clients,
    loans: state.loans,
    payments: state.payments,
    capitalMovements: state.capitalMovements || [],
  };
}

function normalizeBackupSnapshot(snapshot) {
  const data = typeof snapshot === "string" ? JSON.parse(snapshot) : snapshot || {};
  return {
    clients: Array.isArray(data.clients) ? data.clients : [],
    loans: normalizeLoans(data.loans),
    payments: Array.isArray(data.payments) ? data.payments : [],
    capitalMovements: normalizeCapitalMovements(data.capitalMovements || data.capital_movements),
  };
}

async function ensureAutomaticBackup(force = false) {
  if (!state.user && !state.clients.length && !state.loans.length && !state.payments.length && !(state.capitalMovements || []).length) return;

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
  setButtonBusy(elements.restoreBackupButton, true, "Restaurando...");
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

    await ensureAutomaticBackup(true);

    const snapshot = normalizeBackupSnapshot(backup.snapshot);
    if (isCloudMode()) {
      await restoreCloudSnapshot(snapshot);
    }

    state.clients = snapshot.clients;
    state.loans = snapshot.loans;
    state.payments = snapshot.payments;
    state.capitalMovements = snapshot.capitalMovements;
    saveState();
    render();
    window.alert(
      `Restauracion completada correctamente.\n\nClientes restaurados: ${snapshot.clients.length}\nPrestamos: ${snapshot.loans.length}\nPagos: ${snapshot.payments.length}\nMovimientos de capital: ${snapshot.capitalMovements.length}`
    );
  } catch (error) {
    const message = error.message || "";
    if (/user_backups|restore_user_snapshot|schema cache|relation|function/i.test(message)) {
      window.alert("Para restaurar copias automaticas en Supabase, primero ejecuta el SQL actualizado que crea las funciones seguras de respaldo.");
      return;
    }
    window.alert(message || "No se pudo restaurar la copia automatica.");
  } finally {
    setButtonBusy(elements.restoreBackupButton, false);
  }
}

async function restoreCloudSnapshot(snapshot) {
  const rpcRestore = await saas.client.rpc("restore_user_snapshot", { snapshot });
  if (!rpcRestore.error) return;
  throw rpcRestore.error;
}

async function insertCloudLoanRows(loans, userId) {
  if (!loans.length) return;
  let rows = loans.map((loan) => loanToRow(loan, userId));
  let { error } = await saas.client.from("loans").insert(rows);
  if (isInterestModeColumnError(error)) {
    rows = rows.map(withoutInterestMode);
    const retry = await saas.client.from("loans").insert(rows);
    error = retry.error;
  }
  if (error) throw error;
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

  if (mode === "signup" && !validateSignupPasswords()) {
    elements.authConfirmPassword.focus();
    return;
  }

  if (mode === "signup" && !elements.authTermsAccept.checked) {
    setAuthNotice("Debes aceptar los Terminos y Condiciones para crear tu cuenta.");
    elements.authTermsAccept.focus();
    return;
  }

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
      const { data, error } = await saas.client.auth.signUp({
        email,
        password,
        options: {
          data: {
            business_name: businessName || "Mi negocio",
            owner_name: ownerName || "Prestamista",
            currency,
          },
        },
      });
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
      await ensureCloudAccount(data.user.id, { email, businessName, ownerName, currency });
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
  if (clientSubmissionInProgress) return;

  const formMode = elements.clientFormMode.value;
  const isExtension = formMode === "extension";
  const selectedClient = isExtension ? getClient(elements.clientNameSelect.value) : null;
  const name = isExtension ? selectedClient?.name || "" : $("#clientName").value.trim();
  const phone = $("#clientPhone").value.trim();
  const amount = toNumber($("#clientLoanAmount").value);
  const startDate = $("#clientLoanStartDate").value;
  const dueDate = $("#clientLoanDueDate").value;
  const rateValue = $("#clientLoanRate").value.trim();
  const monthlyRate = toNumber(rateValue);
  const interestMode = normalizeInterestMode($("#clientLoanInterestMode").value);
  if (!name || !isPositiveMoney(amount) || !startDate || !dueDate) return;
  if (isExtension && !selectedClient) {
    window.alert("Selecciona el cliente que solicita la ampliacion.");
    return;
  }
  if (!rateValue) {
    window.alert("Ingresa el interes mensual antes de guardar.");
    return;
  }
  if (!isNonNegativeMoney(monthlyRate)) {
    window.alert("El interes mensual no puede ser negativo.");
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
  const primaryLoan = isExtension ? getPrimaryLoanForClient(selectedClient.id) : null;
  if (isExtension && !primaryLoan) {
    window.alert("Este cliente no tiene un prestamo principal valido para vincular la ampliacion.");
    return;
  }
  const limitCheck = validateLoanFinancialLimits(clientId, amount);
  if (!limitCheck.ok) {
    window.alert(limitCheck.message);
    return;
  }

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
    monthlyRate,
    interestMode,
    operationType: isExtension ? OPERATION_TYPES.ampliacion : OPERATION_TYPES.principal,
    parentLoanId: isExtension ? primaryLoan.id : null,
    startDate,
    nextDueDate: dueDate,
    dueDay: getDayOfMonth(dueDate),
    note,
    status: "active",
    createdAt: new Date().toISOString(),
    closedAt: null,
  };

  const submitButton = event.submitter || elements.clientForm.querySelector("button[type='submit']");
  clientSubmissionInProgress = true;
  setButtonBusy(submitButton, true, isExtension ? "Guardando ampliacion..." : "Guardando cliente...");

  try {
    await ensureAutomaticBackup();

    if (isExtension) {
      await createCloudLoan(loan);
    } else {
      await createCloudClientAndLoan(client, loan);
    }
  } catch (error) {
    window.alert(error.message || "No se pudo guardar la informacion en la nube.");
    await reloadAfterCloudError();
    return;
  } finally {
    clientSubmissionInProgress = false;
    setButtonBusy(submitButton, false);
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
  if (editSubmissionInProgress) return;

  const client = getClient($("#editClientId").value);
  if (!client) return;

  const amount = toNumber($("#editLoanAmount").value);
  const startDate = $("#editLoanStartDate").value;
  const dueDate = $("#editLoanDueDate").value;
  const rateValue = $("#editLoanRate").value.trim();
  const monthlyRate = toNumber(rateValue);
  const interestMode = normalizeInterestMode($("#editLoanInterestMode").value);
  const note = $("#editClientNote").value.trim();
  const phone = $("#editClientPhone").value.trim();

  if (!rateValue) {
    window.alert("Ingresa el interes mensual antes de guardar.");
    return;
  }
  if (!isNonNegativeMoney(amount)) {
    window.alert("El capital prestado no puede ser negativo.");
    return;
  }
  if (!isNonNegativeMoney(monthlyRate)) {
    window.alert("El interes mensual no puede ser negativo.");
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

  const submitButton = event.submitter || elements.editForm.querySelector("button[type='submit']");
  editSubmissionInProgress = true;
  setButtonBusy(submitButton, true, "Guardando...");

  try {
    await ensureAutomaticBackup();
  } catch (error) {
    editSubmissionInProgress = false;
    setButtonBusy(submitButton, false);
    window.alert(error.message || "No se pudo crear la copia de seguridad antes de editar.");
    return;
  }

  const previousClient = { ...client };
  const previousLoans = state.loans.map((loanItem) => ({ ...loanItem }));

  client.name = $("#editClientName").value.trim();
  client.phone = phone;
  client.note = note;

  let loan = getLoan($("#editLoanId").value);
  if (!loan && amount > 0) {
    const limitCheck = validateLoanFinancialLimits(client.id, amount);
    if (!limitCheck.ok) {
      window.alert(limitCheck.message);
      editSubmissionInProgress = false;
      setButtonBusy(submitButton, false);
      return;
    }
    loan = {
      id: createId("loan"),
      clientId: client.id,
      amount,
      remainingCapital: amount,
      monthlyRate,
      interestMode,
      operationType: OPERATION_TYPES.principal,
      parentLoanId: null,
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
      if (!confirmed) {
        editSubmissionInProgress = false;
        setButtonBusy(submitButton, false);
        return;
      }
    }
    const limitCheck = validateLoanFinancialLimits(client.id, amount, loan);
    if (!limitCheck.ok) {
      window.alert(limitCheck.message);
      editSubmissionInProgress = false;
      setButtonBusy(submitButton, false);
      return;
    }
    loan.amount = amount;
    loan.remainingCapital = Math.max(roundMoney(amount - alreadyPaidCapital), 0);
    loan.monthlyRate = monthlyRate;
    loan.interestMode = interestMode;
    loan.startDate = startDate;
    loan.nextDueDate = loan.remainingCapital > 0 ? dueDate : null;
    loan.dueDay = getDayOfMonth(dueDate);
    loan.note = note;
    loan.status = loan.remainingCapital > 0 ? "active" : "closed";
    loan.closedAt = loan.status === "closed" ? loan.closedAt || new Date().toISOString() : null;
  }

  try {
    await updateCloudClientAndLoan(client, loan);
  } catch (error) {
    Object.assign(client, previousClient);
    state.loans = previousLoans;
    window.alert(error.message || "No se pudieron guardar los cambios en la nube.");
    await reloadAfterCloudError();
    return;
  } finally {
    editSubmissionInProgress = false;
    setButtonBusy(submitButton, false);
  }

  elements.editDialog.close();
  saveState();
  render();
}

async function handlePaymentSubmit(event) {
  event.preventDefault();
  if (paymentSubmissionInProgress) return;

  const loan = getLoan($("#paymentLoanId").value);
  if (!loan || loan.status !== "active") return;

  const paymentDate = $("#paymentDate").value;
  const scheduledDueDate = loan.nextDueDate;
  const interestPaid = toNumber($("#paymentInterest").value);
  const capitalPaid = toNumber($("#paymentCapital").value);
  if (!$("#paymentInterest").value.trim()) {
    window.alert("Ingresa el interes pagado antes de registrar el cobro.");
    return;
  }
  if (!paymentDate) {
    window.alert("Selecciona la fecha de pago.");
    return;
  }
  if (!isNonNegativeMoney(interestPaid) || !isNonNegativeMoney(capitalPaid)) {
    window.alert("Los montos del cobro no pueden ser negativos.");
    return;
  }
  if (capitalPaid > Number(loan.remainingCapital || 0)) {
    window.alert("El capital pagado no puede ser mayor que el capital pendiente.");
    return;
  }
  if (interestPaid === 0 && capitalPaid === 0) {
    window.alert("Registra interes o capital pagado para guardar el cobro.");
    return;
  }

  const submitButton = event.submitter || elements.paymentForm.querySelector("button[type='submit']");
  paymentSubmissionInProgress = true;
  setButtonBusy(submitButton, true, "Registrando...");

  const { payment, updatedLoan } = buildPaymentTransactionPreview(loan, {
    paymentDate,
    scheduledDueDate,
    interestPaid,
    capitalPaid,
    note: $("#paymentNote").value.trim(),
  });

  try {
    await ensureAutomaticBackup();

    if (isCloudMode()) {
      const result = await createCloudPaymentAndUpdateLoan(payment);
      if (result?.loan) Object.assign(loan, loanFromRow(result.loan));
      state.payments.push(result?.payment ? paymentFromRow(result.payment) : payment);
    } else {
      Object.assign(loan, updatedLoan);
      state.payments.push(payment);
    }
  } catch (error) {
    window.alert(error.message || "No se pudo registrar el cobro en la nube.");
    await reloadAfterCloudError();
    return;
  } finally {
    paymentSubmissionInProgress = false;
    setButtonBusy(submitButton, false);
  }

  event.target.reset();
  elements.paymentDialog.close();
  saveState();
  render();
}

function openCapitalDialog(mode) {
  const isWithdrawal = mode === "withdrawal";
  elements.capitalForm.reset();
  elements.capitalFormMode.value = isWithdrawal ? "withdrawal" : "deposit";
  elements.capitalDate.value = todayISO();
  elements.capitalDialogEyebrow.textContent = isWithdrawal ? "Retiro" : "Capital";
  elements.capitalDialogTitle.textContent = isWithdrawal ? "Retirar capital" : "Agregar capital";
  elements.capitalHistoryButton.textContent = isWithdrawal ? "Historial de retiro" : "Historial de ingreso de capital";
  elements.capitalSubmitButton.textContent = isWithdrawal ? "Retirar capital" : "Agregar capital";
  elements.capitalSubmitButton.classList.toggle("danger-button", isWithdrawal);
  elements.capitalSubmitButton.classList.toggle("primary-button", !isWithdrawal);
  const position = buildCapitalPositionAtDate(todayISO());
  elements.capitalAvailableHint.textContent = isWithdrawal
    ? `Disponible actual para retirar: ${money(position.availableCapital)}. El retiro no afecta prestamos ni pagos registrados.`
    : `Registra aqui tu capital inicial o un aporte extra. Disponible actual: ${money(position.availableCapital)}.`;
  elements.capitalDialog.showModal();
}

function openCapitalHistoryDialog(type) {
  const normalizedType = normalizeCapitalMovementType(type);
  const isWithdrawal = normalizedType === "withdrawal";
  const title = isWithdrawal ? "Historial de retiro" : "Historial de ingreso de capital";
  const movements = (state.capitalMovements || [])
    .filter((movement) => normalizeCapitalMovementType(movement.type) === normalizedType)
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const total = sum(movements, "amount");

  elements.capitalHistoryTitle.textContent = title;
  elements.capitalHistorySummary.textContent = movements.length
    ? `${movements.length} movimiento(s). Total: ${money(total)}.`
    : isWithdrawal
    ? "Todavia no registraste retiros de capital."
    : "Todavia no registraste ingresos de capital.";
  elements.capitalHistoryList.innerHTML = movements.length
    ? movements
        .map(
          (movement) => `
            <article class="history-item ${isWithdrawal ? "withdrawal-history-item" : ""}">
              <div>
                <strong>${formatDate(movement.date)}</strong>
                <span>${isWithdrawal ? "Retiro de capital" : "Ingreso de capital"}</span>
                ${movement.note ? `<small>${escapeHTML(movement.note)}</small>` : ""}
              </div>
              <span class="status-pill ${isWithdrawal ? "withdrawal" : "ok"}">${money(movement.amount)}</span>
            </article>
          `
        )
        .join("")
    : `<div class="empty-state compact-empty">${isWithdrawal ? "Sin retiros registrados." : "Sin ingresos registrados."}</div>`;
  elements.capitalHistoryDialog.showModal();
}

async function handleCapitalSubmit(event) {
  event.preventDefault();
  if (capitalSubmissionInProgress) return;

  const type = normalizeCapitalMovementType(elements.capitalFormMode.value);
  const amount = toNumber(elements.capitalAmount.value);
  const date = elements.capitalDate.value;
  const note = elements.capitalNote.value.trim();
  if (!isPositiveMoney(amount)) {
    window.alert("Ingresa un monto de capital mayor a cero.");
    return;
  }
  if (!isBusinessDate(date)) {
    window.alert("Selecciona una fecha valida para el movimiento de capital.");
    return;
  }

  if (type === "withdrawal") {
    const position = buildCapitalPositionAtDate(date);
    if (amount > position.availableCapital) {
      window.alert(`No puedes retirar ${money(amount)} porque solo hay ${money(position.availableCapital)} disponible en esa fecha.`);
      return;
    }
    const confirmed = window.confirm(`Se retirara ${money(amount)} del capital disponible. Esta accion no modificara prestamos ni pagos. Deseas continuar?`);
    if (!confirmed) return;
  }

  const movement = {
    id: createId("capital"),
    type,
    amount,
    date,
    note,
    createdAt: new Date().toISOString(),
  };
  const submitButton = event.submitter || elements.capitalSubmitButton;
  capitalSubmissionInProgress = true;
  setButtonBusy(submitButton, true, type === "withdrawal" ? "Retirando..." : "Guardando...");

  try {
    await ensureAutomaticBackup();
    if (isCloudMode()) {
      await createCloudCapitalMovement(movement);
    }
    state.capitalMovements = state.capitalMovements || [];
    state.capitalMovements.push(movement);
  } catch (error) {
    const message = error.message || "";
    if (isCapitalMovementsTableError(error)) {
      window.alert("Para usar agregar y retirar capital en Supabase, primero ejecuta el SQL actualizado que crea la tabla capital_movements.");
    } else {
      window.alert(message || "No se pudo guardar el movimiento de capital.");
    }
    await reloadAfterCloudError();
    return;
  } finally {
    capitalSubmissionInProgress = false;
    setButtonBusy(submitButton, false);
  }

  elements.capitalDialog.close();
  saveState();
  render();
}

function buildPaymentTransactionPreview(loan, paymentData) {
  const remainingCapitalAfter = roundMoney(Number(loan.remainingCapital || 0) - Number(paymentData.capitalPaid || 0));
  const nextDueDateAfter = remainingCapitalAfter <= 0 ? null : getNextDueDateAfterPayment(loan);
  const updatedLoan = {
    ...loan,
    remainingCapital: remainingCapitalAfter,
    nextDueDate: nextDueDateAfter,
    status: remainingCapitalAfter <= 0 ? "closed" : "active",
    closedAt: remainingCapitalAfter <= 0 ? paymentData.paymentDate : null,
  };
  const payment = {
    id: createId("payment"),
    loanId: loan.id,
    clientId: loan.clientId,
    date: paymentData.paymentDate,
    scheduledDueDate: paymentData.scheduledDueDate || loan.nextDueDate,
    interestPaid: Number(paymentData.interestPaid || 0),
    capitalPaid: Number(paymentData.capitalPaid || 0),
    remainingCapitalAfter: updatedLoan.remainingCapital,
    nextDueDateAfter: updatedLoan.status === "active" ? updatedLoan.nextDueDate : null,
    note: paymentData.note || "",
    createdAt: new Date().toISOString(),
  };
  return { payment, updatedLoan };
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
    openCompleteProfileDialog();
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
  elements.planInlineStatus.textContent = getPlanInlineStatusText();
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
  const dashboard = buildDashboardData();
  renderDashboardHeader(dashboard);
  renderDashboardIndicators(dashboard);
  renderDashboardCollections(dashboard);
  renderDashboardCharts(dashboard);
  renderDashboardLists(dashboard);
  renderDashboardAlerts(dashboard);
  initDashboardMessageRotators();
}

function buildDashboardData(options = {}) {
  const filters = options.filters || getDashboardFilters();
  const range = options.range || getDashboardDateRange(filters);
  if (range.invalid) {
    return buildInvalidDashboardData(filters, range);
  }
  const scopeLoans = state.loans.filter((loan) => loanMatchesDashboardScope(loan, filters));
  const scopePayments = state.payments.filter((payment) => paymentMatchesDashboardScope(payment, scopeLoans));
  const loans = scopeLoans.filter((loan) => loanWasInPortfolioDuringRange(loan, range));
  const payments = scopePayments.filter((payment) => dateInRange(payment.date, range));
  const paymentsToRangeEnd = scopePayments.filter((payment) => startOfDay(payment.date) <= startOfDay(range.end));
  const capitalMovementsInPeriod = (state.capitalMovements || []).filter((movement) => dateInRange(movement.date, range));
  const activeLoans = scopeLoans
    .filter((loan) => loanWasActiveOnDate(loan, range.end))
    .map((loan) => {
      const snapshot = loanSnapshotAtDate(loan, range.end, scopePayments);
      return { ...snapshot, expectedInterest: expectedInterest(snapshot, paymentsToRangeEnd) };
    });
  const overdueLoans = activeLoans.filter((loan) => isOverdueAt(loan, range.end));
  const todayLoans = scopeLoans.filter((loan) => loan.status === "active" && loan.nextDueDate === todayISO()).sort(sortLoansByDueDate);
  const soonLoans = scopeLoans
    .filter((loan) => loan.status === "active" && !isOverdue(loan) && daysBetween(todayISO(), loan.nextDueDate) > 0 && daysBetween(todayISO(), loan.nextDueDate) <= 7)
    .sort(sortLoansByDueDate);
  const monthLoans = scopeLoans
    .filter((loan) => loan.status === "active" && !isOverdue(loan) && daysBetween(todayISO(), loan.nextDueDate) > 7 && daysBetween(todayISO(), loan.nextDueDate) <= 30)
    .sort(sortLoansByDueDate);
  const loansStartedInPeriod = scopeLoans.filter((loan) => dateInRange(loan.startDate, range));
  const extensionLoans = loansStartedInPeriod.filter((loan) => !isPrimaryLoan(loan));
  const activeExtensions = activeLoans.filter((loan) => !isPrimaryLoan(loan));
  const previousMonthRange = getShiftedMonthRange(range, -1, "Mes anterior");
  const nextMonthRange = getShiftedMonthRange(range, 1, "Proximo mes");
  const currentMonthPayments = payments;
  const previousMonthPayments = scopePayments.filter((payment) => dateInRange(payment.date, previousMonthRange));
  const nextMonthLoans = activeLoans.filter((loan) => dateInRange(loan.nextDueDate, nextMonthRange));
  const capitalPending = calculateCapitalPrestadoActual(activeLoans);
  const capitalRecovered = sum(payments, "capitalPaid");
  const realProfit = sum(payments, "interestPaid");
  const projectedProfit = activeLoans.reduce((total, loan) => total + getLoanExpectedInterest(loan, paymentsToRangeEnd), 0);
  const capitalPlaced = capitalPending;
  const totalLentAccumulated = sum(scopeLoans, "amount");
  const capitalPosition = buildCapitalPositionAtDate(range.end, state.loans, state.payments, state.capitalMovements || []);
  const capitalTotal = capitalPosition.capitalTotal;
  const availableCapital = capitalPosition.availableCapital;
  const periodLoanAmount = sum(loansStartedInPeriod, "amount");
  const periodPaymentAmount = payments.reduce((total, payment) => total + Number(payment.capitalPaid || 0) + Number(payment.interestPaid || 0), 0);
  const periodCapitalDeposited = sum(capitalMovementsInPeriod.filter((movement) => movement.type === "deposit"), "amount");
  const periodCapitalWithdrawn = sum(capitalMovementsInPeriod.filter((movement) => movement.type === "withdrawal"), "amount");
  const periodCashInflows = periodCapitalDeposited + periodPaymentAmount;
  const periodCashOutflows = periodLoanAmount + periodCapitalWithdrawn;
  const firstPaymentDate = payments.slice().sort((a, b) => new Date(a.date) - new Date(b.date))[0]?.date || null;
  const reinvested = firstPaymentDate
    ? Math.min(capitalRecovered, loansStartedInPeriod.filter((loan) => loan.startDate >= firstPaymentDate).reduce((total, loan) => total + loan.amount, 0))
    : 0;
  const newMoney = Math.max(periodLoanAmount - capitalRecovered, 0);
  const overdueAmount = sum(overdueLoans, "remainingCapital");
  const todayAmount = todayLoans.reduce((total, loan) => total + getLoanExpectedInterest(loan), 0);
  const nextMonthInterest = nextMonthLoans.reduce((total, loan) => total + getLoanExpectedInterest(loan, paymentsToRangeEnd), 0);
  const nextMonthCapital = sum(nextMonthLoans, "remainingCapital");
  const averageLateDays = overdueLoans.length
    ? overdueLoans.reduce((total, loan) => total + Math.max(daysBetween(loan.nextDueDate, range.end), 0), 0) / overdueLoans.length
    : 0;
  const recoveryRate = periodLoanAmount ? (capitalRecovered / periodLoanAmount) * 100 : 0;
  const delinquencyRate = capitalPending ? (sum(overdueLoans, "remainingCapital") / capitalPending) * 100 : 0;
  const activeClientCount = new Set(activeLoans.map((loan) => loan.clientId)).size;
  const modeSegments = Object.keys(INTEREST_MODES).map((mode) => ({
    label: INTEREST_MODES[mode].label,
    value: activeLoans.filter((loan) => normalizeInterestMode(loan.interestMode) === mode).length,
  }));
  const closedLoansInPeriod = scopeLoans.filter((loan) => {
    const closedDate = getLoanClosedDate(loan);
    return closedDate && dateInRange(closedDate, range);
  });
  const statusSegments = [
    { label: "Activos", value: activeLoans.filter((loan) => !isOverdueAt(loan, range.end)).length, color: "#00a76f" },
    { label: "Vencidos", value: overdueLoans.length, color: "#061826" },
    { label: "Cerrados", value: closedLoansInPeriod.length, color: "#ffb000" },
  ];

  const dashboard = {
    filters,
    range,
    loans,
    scopeLoans,
    payments,
    activeLoans,
    overdueLoans,
    todayLoans,
    soonLoans,
    monthLoans,
    metrics: {
      capitalTotal,
      availableCapital,
      capitalDeposited: capitalPosition.capitalDeposited,
      capitalWithdrawn: capitalPosition.capitalWithdrawn,
      compoundedProfit: capitalPosition.compoundedProfit,
      capitalPlaced,
      capitalPending,
      totalLentAccumulated,
      capitalRecovered,
      realProfit,
      projectedProfit,
      totalToCollect: capitalPending + projectedProfit,
      todayCount: todayLoans.length,
      todayAmount,
      activeLoans: activeLoans.length,
      overdueLoans: overdueLoans.length,
      overdueAmount,
      closedLoans: closedLoansInPeriod.length,
      activeClientCount,
      activeExtensions: activeExtensions.length,
      activeExtensionsAmount: sum(activeExtensions, "remainingCapital"),
      reinvested,
      newMoney,
      currentMonthProfit: sum(currentMonthPayments, "interestPaid"),
      previousMonthProfit: sum(previousMonthPayments, "interestPaid"),
      nextMonthProfit: nextMonthInterest,
      nextMonthCapital,
      nextMonthTotal: nextMonthCapital + nextMonthInterest,
      chargedThisMonth: currentMonthPayments.reduce((total, payment) => total + payment.capitalPaid + payment.interestPaid, 0),
      lentThisMonth: periodLoanAmount,
      newLoansPeriod: loansStartedInPeriod.filter(isPrimaryLoan).length,
      extensionsPeriod: extensionLoans.length,
      extensionAmount: sum(extensionLoans, "amount"),
      lateClients: new Set(overdueLoans.map((loan) => loan.clientId)).size,
      averageLateDays,
      capitalRisk: sum(overdueLoans, "remainingCapital"),
      pendingInterest: projectedProfit,
      averageLoan: loansStartedInPeriod.length ? periodLoanAmount / loansStartedInPeriod.length : 0,
      averageInterestPaid: payments.length ? realProfit / payments.length : 0,
      cashflow: roundMoney(periodCashInflows - periodCashOutflows),
      availableAfterProjected: availableCapital + nextMonthCapital + nextMonthInterest,
      profitability: capitalTotal ? (realProfit / capitalTotal) * 100 : 0,
      monthlyRoi: capitalPending ? (projectedProfit / capitalPending) * 100 : 0,
      delinquencyRate,
      recoveryRate,
    },
    charts: {
      months: buildMonthSeries(payments, range),
      loansByMonth: buildLoanMonthSeries(loansStartedInPeriod, range),
      statusSegments,
      modeSegments,
      projections: [
        { label: "Prox. mes", value: nextMonthInterest },
        { label: "3 meses", value: projectedProfit * 3 },
        { label: "6 meses", value: projectedProfit * 6 },
        { label: "12 meses", value: projectedProfit * 12 },
      ],
      delinquency: buildDelinquencySeries(scopeLoans, range, scopePayments),
      cashflow: [
        { label: "Ingresos", value: periodCashInflows, color: "#00a76f" },
        { label: "Egresos", value: periodCashOutflows, color: "#ffb000" },
      ],
    },
    lists: buildDashboardLists(activeLoans, payments, scopeLoans, loansStartedInPeriod, range),
  };
  dashboard.comparison = options.skipComparison ? null : buildDashboardComparison(dashboard);
  return dashboard;
}

function buildInvalidDashboardData(filters, range) {
  return {
    filters: { ...filters, compare: "none" },
    range,
    loans: [],
    scopeLoans: [],
    payments: [],
    activeLoans: [],
    overdueLoans: [],
    todayLoans: [],
    soonLoans: [],
    monthLoans: [],
    metrics: createEmptyDashboardMetrics(),
    charts: createEmptyDashboardCharts(),
    lists: createEmptyDashboardLists(),
    comparison: null,
  };
}

function createEmptyDashboardMetrics() {
  return {
    capitalTotal: 0,
    availableCapital: 0,
    capitalDeposited: 0,
    capitalWithdrawn: 0,
    compoundedProfit: 0,
    capitalPlaced: 0,
    capitalPending: 0,
    totalLentAccumulated: 0,
    capitalRecovered: 0,
    realProfit: 0,
    projectedProfit: 0,
    totalToCollect: 0,
    todayCount: 0,
    todayAmount: 0,
    activeLoans: 0,
    overdueLoans: 0,
    overdueAmount: 0,
    closedLoans: 0,
    activeClientCount: 0,
    activeExtensions: 0,
    activeExtensionsAmount: 0,
    reinvested: 0,
    newMoney: 0,
    currentMonthProfit: 0,
    previousMonthProfit: 0,
    nextMonthProfit: 0,
    nextMonthCapital: 0,
    nextMonthTotal: 0,
    chargedThisMonth: 0,
    lentThisMonth: 0,
    newLoansPeriod: 0,
    extensionsPeriod: 0,
    extensionAmount: 0,
    lateClients: 0,
    averageLateDays: 0,
    capitalRisk: 0,
    pendingInterest: 0,
    averageLoan: 0,
    averageInterestPaid: 0,
    cashflow: 0,
    availableAfterProjected: 0,
    profitability: 0,
    monthlyRoi: 0,
    delinquencyRate: 0,
    recoveryRate: 0,
  };
}

function createEmptyDashboardCharts() {
  const emptyRange = getDashboardDateRange({ customStart: "", customEnd: "" });
  return {
    months: buildMonthSeries([], emptyRange),
    loansByMonth: buildLoanMonthSeries([], emptyRange),
    statusSegments: [
      { label: "Activos", value: 0, color: "#00a76f" },
      { label: "Vencidos", value: 0, color: "#061826" },
      { label: "Cerrados", value: 0, color: "#ffb000" },
    ],
    modeSegments: Object.values(INTEREST_MODES).map((mode) => ({ label: mode.label, value: 0 })),
    projections: [
      { label: "Prox. mes", value: 0 },
      { label: "3 meses", value: 0 },
      { label: "6 meses", value: 0 },
      { label: "12 meses", value: 0 },
    ],
    delinquency: buildDelinquencySeries([], emptyRange),
    cashflow: [
      { label: "Ingresos", value: 0, color: "#00a76f" },
      { label: "Egresos", value: 0, color: "#ffb000" },
    ],
  };
}

function createEmptyDashboardLists() {
  return {
    debt: [],
    profit: [],
    extensions: [],
    punctual: [],
    late: [],
    payments: [],
    loans: [],
    recentExtensions: [],
  };
}

function calculateCapitalPrestadoActual(loans) {
  return calculateOutstandingPrincipal(loans);
}

function getDashboardFilters() {
  const customStart = elements.summaryCustomStart?.value || "";
  const customEnd = elements.summaryCustomEnd?.value || "";
  const hasManualRange = Boolean(customStart || customEnd);
  let compare = elements.summaryCompare?.value || "none";
  if (!hasManualRange && compare !== "none") {
    compare = "none";
    if (elements.summaryCompare) elements.summaryCompare.value = "none";
  }
  syncDashboardCompareOptions(hasManualRange);
  return {
    customStart,
    customEnd,
    compare,
    operation: "all",
  };
}

function setDashboardPreviousMonthComparison() {
  if (!elements.summaryCompare) return;
  const hasManualRange = Boolean(elements.summaryCustomStart?.value || elements.summaryCustomEnd?.value);
  if (!hasManualRange) {
    const today = todayISO();
    elements.summaryCustomStart.value = addMonthsKeepingDay(today, getDayOfMonth(today), -1);
    elements.summaryCustomEnd.value = today;
  }
  elements.summaryCompare.value = "previousMonth";
  renderDashboard();
}

function getDashboardDateRange(filters = {}) {
  const start = filters.customStart || getDashboardHistoryStartDate();
  const end = filters.customEnd || todayISO();
  const isAllHistory = !filters.customStart && !filters.customEnd;
  if (startOfDay(start) > startOfDay(end)) {
    return {
      start,
      end,
      label: "Rango invalido",
      invalid: true,
      isAllHistory: false,
      error: "La fecha Desde no puede ser posterior a la fecha Hasta.",
    };
  }
  return { start, end, label: isAllHistory ? "Todo el historial" : "Periodo seleccionado", isAllHistory };
}

function getDashboardHistoryStartDate() {
  const dates = [];
  addValidDashboardDate(dates, state.user?.createdAt);
  state.clients.forEach((client) => addValidDashboardDate(dates, client.createdAt));
  state.loans.forEach((loan) => {
    addValidDashboardDate(dates, loan.startDate);
    addValidDashboardDate(dates, loan.createdAt);
  });
  state.payments.forEach((payment) => {
    addValidDashboardDate(dates, payment.date);
    addValidDashboardDate(dates, payment.createdAt);
  });
  (state.capitalMovements || []).forEach((movement) => {
    addValidDashboardDate(dates, movement.date);
    addValidDashboardDate(dates, movement.createdAt);
  });
  return dates.sort((left, right) => startOfDay(left) - startOfDay(right))[0] || todayISO();
}

function addValidDashboardDate(dates, value) {
  const date = String(value || "").slice(0, 10);
  if (isBusinessDate(date)) dates.push(date);
}

function syncDashboardCompareOptions(hasManualRange) {
  if (elements.summaryComparePreviousMonth) {
    elements.summaryComparePreviousMonth.classList.toggle("active", elements.summaryCompare?.value === "previousMonth" && hasManualRange);
  }
  if (!elements.summaryCompare?.options) return;
  Array.from(elements.summaryCompare.options || []).forEach((option) => {
    option.disabled = !hasManualRange && option.value !== "none";
  });
}

function normalizeDateRange(start, end, label = "Periodo seleccionado") {
  const startValue = start || todayISO();
  const endValue = end || startValue;
  if (startOfDay(startValue) <= startOfDay(endValue)) {
    return { start: startValue, end: endValue, label };
  }
  return { start: endValue, end: startValue, label };
}

function getCalendarMonthRange(monthOffset = 0) {
  const today = parseLocalDate(todayISO());
  return {
    start: toISODate(new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)),
    end: toISODate(new Date(today.getFullYear(), today.getMonth() + monthOffset + 1, 0)),
    label: monthOffset === 0 ? "Este mes" : monthOffset === -1 ? "Mes anterior" : "Proximo mes",
  };
}

function getShiftedMonthRange(range, monthOffset, label) {
  const start = parseLocalDate(range.start);
  const end = parseLocalDate(range.end);
  return normalizeDateRange(
    addMonthsKeepingDay(range.start, start.getDate(), monthOffset),
    addMonthsKeepingDay(range.end, end.getDate(), monthOffset),
    label
  );
}

function getComparisonRange(range, compareType) {
  const start = parseLocalDate(range.start);
  const end = parseLocalDate(range.end);
  if (compareType === "previousPeriod") {
    const dayCount = daysBetween(range.start, range.end) + 1;
    return normalizeDateRange(addDays(range.start, -dayCount), addDays(range.start, -1), "Periodo anterior");
  }
  if (compareType === "previousMonth") {
    return getShiftedMonthRange(range, -1, "Mes anterior");
  }
  if (compareType === "previousYear") {
    return normalizeDateRange(
      toISODate(new Date(start.getFullYear() - 1, start.getMonth(), Math.min(start.getDate(), new Date(start.getFullYear() - 1, start.getMonth() + 1, 0).getDate()))),
      toISODate(new Date(end.getFullYear() - 1, end.getMonth(), Math.min(end.getDate(), new Date(end.getFullYear() - 1, end.getMonth() + 1, 0).getDate()))),
      "Ano anterior"
    );
  }
  return null;
}

function buildDashboardComparison(dashboard) {
  if (dashboard.filters.compare === "none" || dashboard.range.isAllHistory || dashboard.range.invalid) return null;
  const range = getComparisonRange(dashboard.range, dashboard.filters.compare);
  if (!range) return null;
  const comparisonDashboard = buildDashboardData({
    filters: { ...dashboard.filters, compare: "none" },
    range,
    skipComparison: true,
  });
  return {
    label: dashboardCompareLabel(dashboard.filters.compare),
    range,
    metrics: comparisonDashboard.metrics,
  };
}

function dashboardCompareLabel(compareType) {
  const labels = {
    none: "Sin comparacion",
    previousPeriod: "Periodo anterior",
    previousMonth: "Mes anterior",
    previousYear: "Ano anterior",
  };
  return labels[compareType] || labels.none;
}

function dashboardOperationLabel(operation) {
  const labels = {
    all: "Todos",
    primary: "Prestamos principales",
    extensions: "Ampliaciones",
  };
  return labels[operation] || labels.all;
}

function addDateDays(date, dayCount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + dayCount);
  return copy;
}

function loanMatchesDashboardScope(loan, filters) {
  if (filters.operation === "primary" && !isPrimaryLoan(loan)) return false;
  if (filters.operation === "extensions" && isPrimaryLoan(loan)) return false;
  return true;
}

function paymentMatchesDashboardScope(payment, scopeLoans) {
  return scopeLoans.some((loan) => loan.id === payment.loanId);
}

function loanWasInPortfolioDuringRange(loan, range) {
  if (!loan?.startDate || startOfDay(loan.startDate) > startOfDay(range.end)) return false;
  const closedDate = getLoanClosedDate(loan);
  return !closedDate || startOfDay(closedDate) >= startOfDay(range.start);
}

function loanWasActiveOnDate(loan, dateString) {
  if (!loan?.startDate || startOfDay(loan.startDate) > startOfDay(dateString)) return false;
  const closedDate = getLoanClosedDate(loan);
  if (closedDate && startOfDay(closedDate) <= startOfDay(dateString)) return false;
  return getLoanBalanceAtDate(loan, dateString) > 0;
}

function loanSnapshotAtDate(loan, dateString, payments = state.payments) {
  return {
    ...loan,
    remainingCapital: getLoanBalanceAtDate(loan, dateString, payments),
    status: "active",
    closedAt: null,
  };
}

function getLoanBalanceAtDate(loan, dateString, payments = state.payments) {
  if (!loan?.startDate || startOfDay(loan.startDate) > startOfDay(dateString)) return 0;
  const closedDate = getLoanClosedDate(loan);
  if (closedDate && startOfDay(closedDate) <= startOfDay(dateString)) return 0;
  const capitalPaidAfterDate = payments
    .filter((payment) => payment.loanId === loan.id && startOfDay(payment.date) > startOfDay(dateString))
    .reduce((total, payment) => total + Number(payment.capitalPaid || 0), 0);
  const reconstructedBalance = Number(loan.remainingCapital || 0) + capitalPaidAfterDate;
  return Math.min(Math.max(roundMoney(reconstructedBalance), 0), Number(loan.amount || 0));
}

function getLoanClosedDate(loan) {
  return loan?.closedAt ? String(loan.closedAt).slice(0, 10) : null;
}

function isOverdueAt(loan, dateString) {
  if (!loan?.nextDueDate) return false;
  return startOfDay(loan.nextDueDate) < startOfDay(dateString);
}

function dateInRange(dateString, range) {
  if (!dateString) return false;
  return startOfDay(dateString) >= startOfDay(range.start) && startOfDay(dateString) <= startOfDay(range.end);
}

function isBusinessDate(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateString || ""))) return false;
  const date = parseLocalDate(dateString);
  return toISODate(date) === String(dateString).slice(0, 10);
}

function isPrimaryLoan(loan) {
  const operationType = normalizeOperationType(loan?.operationType);
  if (operationType) return operationType === OPERATION_TYPES.principal;
  return getPrimaryLoanForClient(loan.clientId)?.id === loan.id;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function calculateOutstandingPrincipal(loans) {
  return roundMoney((loans || []).reduce((total, loan) => total + Math.max(Number(loan.remainingCapital || 0), 0), 0));
}

function getClientPendingCapital(clientId, excludeLoanId = "") {
  return calculateOutstandingPrincipal(
    state.loans.filter((loan) => loan.clientId === clientId && loan.id !== excludeLoanId && loan.status !== "closed")
  );
}

function getLoanFinancialPosition(clientId, amount, currentLoan = null) {
  const alreadyPaidCapital = currentLoan ? Math.max(Number(currentLoan.amount || 0) - Number(currentLoan.remainingCapital || 0), 0) : 0;
  const proposedRemaining = currentLoan ? Math.max(roundMoney(Number(amount || 0) - alreadyPaidCapital), 0) : Number(amount || 0);
  const currentRemaining = currentLoan ? Number(currentLoan.remainingCapital || 0) : 0;
  const pendingOther = getClientPendingCapital(clientId, currentLoan?.id || "");
  const currentClientPending = roundMoney(pendingOther + currentRemaining);
  const additionalDisbursement = Math.max(roundMoney(proposedRemaining - currentRemaining), 0);
  const availableCapital = buildCapitalPositionAtDate(todayISO()).availableCapital;

  return {
    pendingOther,
    currentClientPending,
    proposedRemaining,
    additionalDisbursement,
    availableCapital,
  };
}

function validateLoanFinancialLimits(clientId, amount, currentLoan = null) {
  const position = getLoanFinancialPosition(clientId, amount, currentLoan);
  if (position.additionalDisbursement > position.availableCapital) {
    return {
      ok: false,
      message: `No puedes desembolsar ${money(position.additionalDisbursement)} porque solo tienes ${money(position.availableCapital)} disponible.`,
      position,
    };
  }
  return { ok: true, position };
}

function buildCapitalPositionAtDate(dateString, loans = state.loans, payments = state.payments, capitalMovements = state.capitalMovements || []) {
  const end = startOfDay(dateString || todayISO());
  const movementsToDate = (capitalMovements || []).filter((movement) => startOfDay(movement.date) <= end);
  const paymentsToDate = (payments || []).filter((payment) => startOfDay(payment.date) <= end);
  const activeLoansAtDate = (loans || [])
    .filter((loan) => loanWasActiveOnDate(loan, dateString || todayISO()))
    .map((loan) => loanSnapshotAtDate(loan, dateString || todayISO(), payments || []));
  const capitalDeposited = sum(movementsToDate.filter((movement) => movement.type === "deposit"), "amount");
  const capitalWithdrawn = sum(movementsToDate.filter((movement) => movement.type === "withdrawal"), "amount");
  const compoundedProfit = sum(paymentsToDate, "interestPaid");
  const capitalPlacedAtDate = sum(activeLoansAtDate, "remainingCapital");
  const capitalTotal = roundMoney(capitalDeposited + compoundedProfit - capitalWithdrawn);

  return {
    capitalDeposited,
    capitalWithdrawn,
    compoundedProfit,
    capitalPlaced: capitalPlacedAtDate,
    capitalTotal,
    availableCapital: roundMoney(capitalTotal - capitalPlacedAtDate),
  };
}

function renderDashboardHeader(dashboard) {
  if (dashboard.range.invalid) {
    elements.summaryHeroMeta.textContent = dashboard.range.error;
    elements.summaryHealth.innerHTML = `
      <span class="status-pill danger">Revisar fechas</span>
      <strong>--</strong>
      <small>Corrige el periodo para calcular</small>
    `;
    return;
  }
  elements.summaryHeroMeta.textContent = dashboard.range.isAllHistory
    ? `Todo el historial · ${dashboard.loans.length} prestamo(s) analizados.`
    : `Periodo seleccionado: ${formatDate(dashboard.range.start)} - ${formatDate(dashboard.range.end)} · ${dashboard.loans.length} prestamo(s) analizados.`;
  elements.summaryHealth.innerHTML = `
    <span class="status-pill ok">Capital disponible</span>
    <strong>${money(dashboard.metrics.availableCapital)}</strong>
    <small>Monto que debe figurar en tu tarjeta</small>
  `;
}

function renderDashboardIndicators(dashboard) {
  if (!elements.summaryIndicatorsGrid) return;
  const cards = getOrderedDashboardIndicatorItems(dashboard);
  elements.summaryIndicatorsGrid.innerHTML = cards.map((item) => renderDashboardIndicatorCard(item, dashboard)).join("");
}

function getDashboardIndicatorItems(dashboard) {
  return [
    ...getDashboardKpiItems(dashboard).map((item) => ({ ...item, cardType: "kpi" })),
    ...getDashboardManagementItems(dashboard).map((item) => ({ ...item, cardType: "compact" })),
    ...getDashboardAdvancedItems(dashboard).map((item) => ({ ...item, cardType: "compact" })),
  ].map((item) => ({ ...item, indicatorId: getIndicatorId(item) }));
}

function getOrderedDashboardIndicatorItems(dashboard) {
  const items = getDashboardIndicatorItems(dashboard);
  const savedIds = getSavedIndicatorOrder().map(normalizeIndicatorOrderId);
  const seenIds = new Set();
  const order = savedIds.filter((id) => {
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });
  if (!order.length) return items;

  const byId = new Map(items.map((item) => [item.indicatorId, item]));
  const ordered = order.map((id) => byId.get(id)).filter(Boolean);
  const missing = items.filter((item) => !order.includes(item.indicatorId));
  return [...ordered, ...missing];
}

const INDICATOR_ORDER_ID_ALIASES = {
  "capital-prestado": "capital-actualmente-prestado",
  "prestado-en-el-periodo": "total-prestado-acumulado",
};

function normalizeIndicatorOrderId(id) {
  return INDICATOR_ORDER_ID_ALIASES[id] || id;
}

function getIndicatorId(item) {
  return String(item.title)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function renderDashboardIndicatorCard(item, dashboard) {
  const className = item.cardType === "kpi" ? "summary-kpi-card" : "summary-compact-card";
  const tooltipText = item.tip || item.note || "Indicador del resumen.";
  const messages = getIndicatorMessages(item.title);
  return `
    <article class="${className} dashboard-indicator-card" draggable="true" data-indicator-id="${escapeHTML(item.indicatorId)}">
      <span>${escapeHTML(item.title)} ${renderInfoDot(tooltipText)}</span>
      <strong class="kpi-value">${escapeHTML(item.value)}</strong>
      ${renderComparisonBadge(item, dashboard)}
      ${renderIndicatorMessage(messages, item.title)}
    </article>
  `;
}

function renderDashboardKpis(dashboard) {
  const cards = getDashboardKpiItems(dashboard);
  if (!elements.summaryCriticalGrid) return;
  elements.summaryCriticalGrid.innerHTML = cards.map((item) => renderKpiCard(item, dashboard)).join("");
}

function getDashboardKpiItems(dashboard) {
  return getDashboardKpiReportItems(dashboard).filter((item) => !HIDDEN_DASHBOARD_KPI_TITLES.has(item.title));
}

const HIDDEN_DASHBOARD_KPI_TITLES = new Set(["Total por cobrar", "Ampliaciones activas"]);

function getDashboardKpiReportItems(dashboard) {
  const m = dashboard.metrics;
  return [
    ["Capital total", money(m.capitalTotal), "", "Capital real acumulado: capital agregado mas intereses cobrados, menos retiros registrados.", "capitalTotal"],
    ["Capital disponible", money(m.availableCapital), "", "Ejemplo: Es el dinero libre que tienes para volver a prestar o retirar. Incluye tu capital agregado y los intereses ya cobrados, menos retiros y menos el capital que todavia esta en manos de clientes. Si cobras S/100 de interes y no lo prestas ni lo retiras, tu capital disponible sube S/100.", "availableCapital"],
    ["Capital actualmente prestado", money(m.capitalPlaced), "", "Ejemplo: Si prestaste S/500 y el cliente ya devolvió S/250 de capital, actualmente tienes S/250 prestados. Si otro cliente todavía debe S/1,000, tu capital actualmente prestado será S/1,250. Los préstamos vencidos también cuentan mientras el capital no haya sido devuelto.", "capitalPlaced"],
    ["Ganancia real", money(m.realProfit), "", "Ejemplo: Si en el periodo seleccionado recibiste S/650 solo en intereses, tu ganancia real es S/650; el capital devuelto no cuenta como ganancia.", "realProfit"],
    ["Ganancia proyectada", money(m.projectedProfit), "", "Ejemplo: Si tus prestamos activos deberian generar S/900 en intereses futuros, esa es tu ganancia proyectada hasta que se cobre.", "projectedProfit"],
    ["Total por cobrar", money(m.totalToCollect), "", "Ejemplo: Si tienes S/5,000 de capital pendiente y S/600 de intereses pendientes, el total por cobrar es S/5,600.", "totalToCollect"],
    ["Cobros de hoy", m.todayCount, "", "Ejemplo: Si hoy tienen fecha de cobro 3 prestamos diferentes, este indicador mostrara 3 cobros de hoy.", "todayCount"],
    ["Interés a cobrar hoy", money(m.todayAmount), "", "Ejemplo: Si hoy debes cobrar S/100 de interés a un cliente, S/250 de interés a otro y S/150 de interés a otro, el monto de interés a cobrar hoy será S/500.", "todayAmount"],
    ["Prestamos activos", m.activeLoans, "", "Ejemplo: Si tienes 6 prestamos principales y 2 ampliaciones con saldo pendiente, tienes 8 prestamos activos.", "activeLoans"],
    ["Prestamos vencidos", m.overdueLoans, "", "Ejemplo: Si la fecha de cobro de 3 prestamos ya paso y todavia mantienen deuda, este indicador mostrara 3 prestamos vencidos.", "overdueLoans"],
    ["Monto vencido", money(m.overdueAmount), "", "Ejemplo: Si Pepe tiene S/500 vencidos y Ana S/300 vencidos, el monto vencido total es S/800.", "overdueAmount"],
    ["Prestamos cerrados", m.closedLoans, "", "Ejemplo: Si 5 prestamos ya fueron pagados completamente y quedaron en S/0.00, tienes 5 prestamos cerrados.", "closedLoans"],
    ["Clientes activos", m.activeClientCount, "", "Ejemplo: Si tienes 7 clientes y 5 mantienen al menos un prestamo o ampliacion pendiente, tienes 5 clientes activos.", "activeClientCount"],
    ["Ampliaciones activas", `${m.activeExtensions} / ${money(m.activeExtensionsAmount)}`, "", "Ejemplo: Si Lole tiene 2 ampliaciones pendientes y Melvin tiene 1, existen 3 ampliaciones activas.", "activeExtensions"],
  ].map(([title, value, note, tip, metricKey]) => ({ title, value, note, tip, metricKey }));
}

function renderKpiCard({ title, value, note, tip, metricKey, compareFactor }, dashboard) {
  const tooltipText = tip || note;
  const messages = getIndicatorMessages(title);
  return `
    <article class="summary-kpi-card">
      <span>${escapeHTML(title)} ${renderInfoDot(tooltipText)}</span>
      <strong class="kpi-value">${escapeHTML(value)}</strong>
      ${renderComparisonBadge({ title, metricKey, compareFactor }, dashboard)}
      ${renderIndicatorMessage(messages, title)}
    </article>
  `;
}

function renderInfoDot(text) {
  return `<i class="info-dot" tabindex="0" data-tip="${escapeHTML(text)}">i</i>`;
}

function initInfoTooltipEvents() {
  document.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch") return;
    const dot = event.target.closest(".info-dot");
    if (dot) showInfoTooltip(dot);
  });
  document.addEventListener("pointerout", (event) => {
    const dot = event.target.closest(".info-dot");
    if (!dot) return;
    const nextTarget = event.relatedTarget;
    if (nextTarget && dot.contains(nextTarget)) return;
    hideInfoTooltip();
  });
  document.addEventListener("focusin", (event) => {
    const dot = event.target.closest(".info-dot");
    if (dot) showInfoTooltip(dot);
  });
  document.addEventListener("focusout", (event) => {
    if (event.target.closest(".info-dot")) hideInfoTooltip();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideInfoTooltip();
  });
}

function toggleInfoTooltip(target) {
  if (activeInfoTooltipTarget === target) {
    hideInfoTooltip();
    return;
  }
  showInfoTooltip(target);
}

function showInfoTooltip(target) {
  const text = target?.dataset?.tip;
  if (!text) return;
  const tooltip = getInfoTooltipElement();
  tooltip.textContent = text;
  tooltip.classList.add("is-visible");
  activeInfoTooltipTarget = target;
  positionActiveInfoTooltip();
}

function hideInfoTooltip() {
  const tooltip = document.querySelector(".smart-info-tooltip");
  if (tooltip) tooltip.classList.remove("is-visible");
  activeInfoTooltipTarget = null;
}

function getInfoTooltipElement() {
  let tooltip = document.querySelector(".smart-info-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "smart-info-tooltip";
    tooltip.setAttribute("role", "tooltip");
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

function positionActiveInfoTooltip() {
  if (!activeInfoTooltipTarget) return;
  const tooltip = document.querySelector(".smart-info-tooltip");
  if (!tooltip?.classList.contains("is-visible")) return;
  const rect = activeInfoTooltipTarget.getBoundingClientRect();
  if (!rect.width && !rect.height) {
    hideInfoTooltip();
    return;
  }

  const margin = 12;
  const tooltipWidth = tooltip.offsetWidth || 280;
  const tooltipHeight = tooltip.offsetHeight || 80;
  const x = clamp(rect.left + rect.width / 2 - tooltipWidth / 2, margin, window.innerWidth - tooltipWidth - margin);
  const hasRoomAbove = rect.top >= tooltipHeight + margin * 2;
  const preferredY = hasRoomAbove ? rect.top - tooltipHeight - 8 : rect.bottom + 8;
  const y = clamp(preferredY, margin, window.innerHeight - tooltipHeight - margin);
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function initIndicatorOrderEvents() {
  const grid = elements.summaryIndicatorsGrid;
  if (!grid || grid.dataset.dragBound) return;
  grid.dataset.dragBound = "true";
  grid.addEventListener("dragstart", handleIndicatorDragStart);
  grid.addEventListener("dragover", handleIndicatorDragOver);
  grid.addEventListener("drop", handleIndicatorDrop);
  grid.addEventListener("dragend", clearIndicatorDragState);
  grid.addEventListener("pointerdown", handleIndicatorPointerDown);
  grid.addEventListener("pointermove", handleIndicatorPointerMove);
  grid.addEventListener("pointerup", handleIndicatorPointerEnd);
  grid.addEventListener("pointercancel", handleIndicatorPointerEnd);

  if (elements.resetIndicatorOrder) {
    elements.resetIndicatorOrder.addEventListener("click", resetDashboardIndicatorOrder);
  }
}

function handleIndicatorDragStart(event) {
  const card = event.target.closest(".dashboard-indicator-card");
  if (!card || isIndicatorDragBlockedTarget(event.target)) {
    event.preventDefault();
    return;
  }
  indicatorDragState = { id: card.dataset.indicatorId };
  card.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", card.dataset.indicatorId || "");
}

function handleIndicatorDragOver(event) {
  const grid = elements.summaryIndicatorsGrid;
  const dragging = grid?.querySelector(".dashboard-indicator-card.is-dragging");
  if (!grid || !dragging || !indicatorDragState) return;
  event.preventDefault();
  moveIndicatorCardAtPoint(grid, dragging, event.clientX, event.clientY, event.target);
}

function handleIndicatorDrop(event) {
  if (!indicatorDragState) return;
  event.preventDefault();
  saveCurrentIndicatorOrder();
  clearIndicatorDragState();
}

function handleIndicatorPointerDown(event) {
  if (event.pointerType === "mouse") return;
  const card = event.target.closest(".dashboard-indicator-card");
  if (!card || isIndicatorDragBlockedTarget(event.target)) return;
  const timer = window.setTimeout(() => {
    if (!indicatorTouchDragState || indicatorTouchDragState.card !== card) return;
    indicatorTouchDragState.active = true;
    indicatorDragState = { id: card.dataset.indicatorId, touch: true };
    card.classList.add("is-dragging", "is-touch-dragging");
    card.setPointerCapture?.(event.pointerId);
  }, 420);
  indicatorTouchDragState = {
    active: false,
    card,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    timer,
  };
}

function handleIndicatorPointerMove(event) {
  if (!indicatorTouchDragState) return;
  const movement = Math.hypot(event.clientX - indicatorTouchDragState.startX, event.clientY - indicatorTouchDragState.startY);
  if (!indicatorTouchDragState.active && movement > 10) {
    clearIndicatorTouchDragState(false);
    return;
  }
  if (!indicatorTouchDragState.active) return;
  event.preventDefault();
  moveIndicatorCardAtPoint(elements.summaryIndicatorsGrid, indicatorTouchDragState.card, event.clientX, event.clientY);
}

function handleIndicatorPointerEnd() {
  if (!indicatorTouchDragState) return;
  const shouldSave = indicatorTouchDragState.active;
  clearIndicatorTouchDragState(shouldSave);
}

function moveIndicatorCardAtPoint(grid, dragging, clientX, clientY, eventTarget = null) {
  const hovered = (eventTarget || document.elementFromPoint(clientX, clientY))?.closest?.(".dashboard-indicator-card");
  if (hovered && hovered !== dragging && grid.contains(hovered)) {
    const rect = hovered.getBoundingClientRect();
    const before = clientY < rect.top + rect.height / 2;
    grid.insertBefore(dragging, before ? hovered : hovered.nextSibling);
    return;
  }

  const afterElement = getIndicatorInsertBeforeCard(grid, dragging, clientY);
  if (afterElement) {
    grid.insertBefore(dragging, afterElement);
  } else {
    grid.appendChild(dragging);
  }
}

function getIndicatorInsertBeforeCard(grid, dragging, clientY) {
  return Array.from(grid.querySelectorAll(".dashboard-indicator-card:not(.is-dragging)")).reduce(
    (closest, card) => {
      const rect = card.getBoundingClientRect();
      const offset = clientY - rect.top - rect.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, card };
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, card: null }
  ).card;
}

function isIndicatorDragBlockedTarget(target) {
  return Boolean(
    target.closest(
      ".info-dot, button, a, input, select, textarea, label, .comparison-badge, .dashboard-indicator-card > span, .dashboard-indicator-card > strong, .indicator-message"
    )
  );
}

function saveCurrentIndicatorOrder() {
  const order = Array.from(elements.summaryIndicatorsGrid?.querySelectorAll(".dashboard-indicator-card") || [])
    .map((card) => card.dataset.indicatorId)
    .filter(Boolean);
  saveIndicatorOrder(order);
}

function clearIndicatorDragState() {
  document.querySelectorAll(".dashboard-indicator-card.is-dragging").forEach((card) => card.classList.remove("is-dragging", "is-touch-dragging"));
  indicatorDragState = null;
}

function clearIndicatorTouchDragState(shouldSave) {
  if (indicatorTouchDragState?.timer) window.clearTimeout(indicatorTouchDragState.timer);
  if (shouldSave) saveCurrentIndicatorOrder();
  clearIndicatorDragState();
  indicatorTouchDragState = null;
}

function getIndicatorOrderStorageKey() {
  return `${INDICATOR_ORDER_STORAGE_KEY}:${state.user?.id || "local-user"}`;
}

function getSavedIndicatorOrder() {
  try {
    const saved = localStorage.getItem(getIndicatorOrderStorageKey());
    const order = JSON.parse(saved || "[]");
    return Array.isArray(order) ? order.filter((id) => typeof id === "string") : [];
  } catch {
    localStorage.removeItem(getIndicatorOrderStorageKey());
    return [];
  }
}

function saveIndicatorOrder(order) {
  localStorage.setItem(getIndicatorOrderStorageKey(), JSON.stringify(order));
}

function resetDashboardIndicatorOrder() {
  const confirmed = window.confirm("¿Deseas volver al orden predeterminado de los indicadores?");
  if (!confirmed) return;
  localStorage.removeItem(getIndicatorOrderStorageKey());
  renderDashboard();
}

const DASHBOARD_TREND_RULES = {
  capitalTotal: "up",
  availableCapital: "up",
  capitalDeposited: "up",
  capitalWithdrawn: "down",
  compoundedProfit: "up",
  capitalPlaced: "up",
  totalLentAccumulated: "up",
  capitalRecovered: "up",
  realProfit: "up",
  projectedProfit: "up",
  totalToCollect: "up",
  todayAmount: "up",
  closedLoans: "up",
  activeClientCount: "up",
  activeExtensions: "up",
  reinvested: "up",
  newMoney: "up",
  currentMonthProfit: "up",
  previousMonthProfit: "up",
  nextMonthProfit: "up",
  nextMonthCapital: "up",
  nextMonthTotal: "up",
  chargedThisMonth: "up",
  lentThisMonth: "up",
  newLoansPeriod: "up",
  extensionsPeriod: "up",
  extensionAmount: "up",
  pendingInterest: "up",
  averageLoan: "up",
  averageInterestPaid: "up",
  cashflow: "up",
  availableAfterProjected: "up",
  profitability: "up",
  monthlyRoi: "up",
  recoveryRate: "up",
  overdueLoans: "down",
  overdueAmount: "down",
  lateClients: "down",
  averageLateDays: "down",
  capitalRisk: "down",
  delinquencyRate: "down",
};

const DASHBOARD_PERCENT_METRICS = new Set(["profitability", "monthlyRoi", "delinquencyRate", "recoveryRate"]);
const DASHBOARD_DAY_METRICS = new Set(["averageLateDays"]);
const DASHBOARD_COUNT_METRICS = new Set([
  "todayCount",
  "activeLoans",
  "overdueLoans",
  "closedLoans",
  "activeClientCount",
  "activeExtensions",
  "newLoansPeriod",
  "extensionsPeriod",
  "lateClients",
]);

function renderComparisonBadge(item, dashboard) {
  const details = getComparisonDetails(item, dashboard);
  if (!details) return "";
  return `<small class="comparison-badge ${details.className}" tabindex="0" data-tip="${escapeHTML(details.tooltip)}">${details.arrow} ${escapeHTML(details.label)}</small>`;
}

function getComparisonDetails(item, dashboard) {
  if (!item.metricKey || !dashboard?.comparison) return null;
  const factor = Number(item.compareFactor || 1);
  const current = Number(dashboard.metrics[item.metricKey]);
  const previous = Number(dashboard.comparison.metrics[item.metricKey]);
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  const currentValue = current * factor;
  const previousValue = previous * factor;
  const difference = currentValue - previousValue;
  const percent = previousValue === 0 ? null : (difference / Math.abs(previousValue)) * 100;
  const arrow = difference > 0 ? "▲" : difference < 0 ? "▼" : "—";
  const className = getComparisonTrendClass(item.metricKey, difference);
  const label = percent === null ? (difference === 0 ? "Sin cambios" : "Sin base previa") : `${formatSignedNumber(percent)}%`;
  const tooltip = [
    `Actual (${formatDate(dashboard.range.start)} - ${formatDate(dashboard.range.end)}): ${formatMetricValue(currentValue, item.metricKey)}`,
    `Comparado (${formatDate(dashboard.comparison.range.start)} - ${formatDate(dashboard.comparison.range.end)}): ${formatMetricValue(previousValue, item.metricKey)}`,
    `Diferencia: ${formatSignedMetricValue(difference, item.metricKey)}${percent === null ? "" : ` (${formatSignedNumber(percent)}%)`}`,
  ].join(" | ");
  return { arrow, className, label, tooltip, currentValue, previousValue, difference, percent };
}

function getComparisonTrendClass(metricKey, difference) {
  if (!difference) return "is-neutral";
  const direction = DASHBOARD_TREND_RULES[metricKey] || "neutral";
  if (direction === "neutral") return "is-neutral";
  const isGood = direction === "up" ? difference > 0 : difference < 0;
  return isGood ? "is-good" : "is-bad";
}

function formatMetricValue(value, metricKey) {
  if (DASHBOARD_PERCENT_METRICS.has(metricKey)) return `${roundMoney(value)}%`;
  if (DASHBOARD_DAY_METRICS.has(metricKey)) return `${roundMoney(value)} dias`;
  if (DASHBOARD_COUNT_METRICS.has(metricKey)) return String(Math.round(value));
  return money(value);
}

function formatSignedMetricValue(value, metricKey) {
  const prefix = value > 0 ? "+" : "";
  if (DASHBOARD_PERCENT_METRICS.has(metricKey)) return `${prefix}${roundMoney(value)}%`;
  if (DASHBOARD_DAY_METRICS.has(metricKey)) return `${prefix}${roundMoney(value)} dias`;
  if (DASHBOARD_COUNT_METRICS.has(metricKey)) return `${prefix}${Math.round(value)}`;
  return `${prefix}${money(value)}`;
}

function formatSignedNumber(value) {
  const rounded = roundMoney(value);
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

const INDICATOR_MESSAGES = {
  "Capital actualmente prestado": [
    "🎉 Tu dinero ya esta trabajando.",
    "💰 Capital colocado que sigue en manos de clientes.",
    "🚀 Los vencidos cuentan hasta que devuelvan capital.",
    "🔄 Cada devolucion de capital reduce este monto.",
    "😊 Ahora toca seguirlo de cerca.",
  ],
  "Ganancia real": [
    "🎉 Esta ganancia ya esta en tus manos.",
    "💰 Tus intereses ya dieron resultado.",
    "😊 La utilidad real ya empezo a crecer.",
    "📈 Cada interes cobrado suma ganancia.",
    "👏 Ganar empieza cuando el interes se paga.",
  ],
  "Ganancia proyectada": [
    "🚀 Potencial futuro de tu cartera.",
    "💡 Aun hay utilidad por capturar.",
    "😊 Buena cobranza la vuelve real.",
    "📈 Te ayuda a mirar hacia adelante.",
    "😉 No cobrado aun, pero con potencial.",
  ],
  "Cobros de hoy": [
    "⏰ Hoy hay movimientos por atender.",
    "😊 Buen dia para cobrar a tiempo.",
    "📲 Revisa clientes y mantente activo.",
    "👏 Cada cobro de hoy suma.",
    "🚀 Convierte pendientes en dinero recuperado.",
  ],
  "Interés a cobrar hoy": [
    "💸 Dinero que puedes recuperar hoy.",
    "😊 Cobrar hoy mejora tu liquidez.",
    "📈 Recuperarlo da margen para prestar.",
    "👏 Hoy puede ser un gran dia de caja.",
    "🚀 Cada sol recuperado fortalece capital.",
  ],
  "Prestamos activos": [
    "📌 Prestamos que siguen en movimiento.",
    "😊 Tu cartera activa esta trabajando.",
    "💰 Cada prestamo activo produce oportunidad.",
    "🚀 Buena gestion impulsa crecimiento.",
    "👏 Seguimiento constante, mejores resultados.",
  ],
  "Prestamos vencidos": [
    "⚠️ Necesitan seguimiento cercano.",
    "👀 Recuperarlos protege tu capital.",
    "📌 Detecta riesgos rapidamente.",
    "💪 Menos vencidos, cartera mas fuerte.",
    "🚨 Mientras menor, mas saludable.",
  ],
  "Monto vencido": [
    "⚠️ Prioridad para recuperar.",
    "👀 Cobrarlo rapido mejora tu flujo.",
    "💡 Capital retrasado que debes vigilar.",
    "📌 Mantenerlo bajo reduce riesgo.",
    "💪 Recuperarlo da tranquilidad.",
  ],
  "Prestamos cerrados": [
    "🎉 Operaciones que completaron su ciclo.",
    "👏 Cada cierre es una meta alcanzada.",
    "😊 Cerrar prestamos sana la cartera.",
    "💰 Capital recuperado crea oportunidades.",
    "🚀 Buenos cierres reflejan buena gestion.",
  ],
  "Clientes activos": [
    "👥 Clientes con movimiento contigo.",
    "😊 Son parte vital del negocio.",
    "📈 Bien gestionados impulsan ingresos.",
    "👏 Controlarlos mejora resultados.",
    "💡 Seguimiento bueno fortalece relaciones.",
  ],
  "Total prestado acumulado": [
    "💰 Todo lo que has prestado suma aqui.",
    "📈 Capital colocado a lo largo del tiempo.",
    "🚀 Cada nuevo prestamo hace crecer este acumulado.",
    "📊 Mide cuanto movimiento has generado.",
    "👏 Refleja todo el capital desembolsado.",
  ],
  "Clientes atrasados": [
    "⚠️ Necesitan seguimiento prioritario.",
    "📲 Un recordatorio puede ayudar.",
    "👀 Vigila el riesgo.",
    "💪 Reducirlos fortalece la cartera.",
    "🚨 Menos atrasos, mejor cobranza.",
  ],
  "Capital en riesgo": [
    "⚠️ Capital que requiere atencion.",
    "👀 Dinero pendiente en vencidos.",
    "💪 Recuperarlo es prioridad.",
    "📲 Seguimiento reduce riesgo.",
    "🚨 Menor monto, cartera mas sana.",
  ],
  "Flujo de caja": [
    "💸 Muestra si entra mas de lo que sale.",
    "📈 Flujo positivo fortalece liquidez.",
    "⚠️ Si sale mucho, revisa disponible.",
    "💰 Buen flujo permite prestar tranquilo.",
    "🚀 Mantenerlo sano ayuda a crecer.",
  ],
  "Cliente mas rentable": [
    "🏆 Cliente que mas ganancia genera.",
    "💰 Buen historial puede valer mucho.",
    "😊 Identifica tus mejores relaciones.",
    "📈 Rentabilidad ayuda a priorizar.",
    "👏 Cuida a quien paga bien.",
  ],
  "Cliente con mayor deuda": [
    "👀 Cliente que requiere seguimiento.",
    "💰 Mayor deuda merece control cercano.",
    "📌 Ayuda a priorizar cobranza.",
    "💪 Gestionarlo protege capital.",
    "⚠️ Revisa siempre su estado.",
  ],
  "Cliente con mas ampliaciones": [
    "🔄 Cliente con mas operaciones extra.",
    "😊 Muestra continuidad contigo.",
    "💰 Puede aportar mas rendimiento.",
    "👀 Tambien requiere control cercano.",
    "📈 Bien gestionado puede crecer.",
  ],
  "Clientes puntuales": [
    "👏 Clientes que ayudan a la estabilidad.",
    "😊 Pagar a tiempo fortalece confianza.",
    "💰 Puntualidad mejora tu flujo.",
    "📈 Buen historial vale mucho.",
    "🏆 Clientes asi impulsan el negocio.",
  ],
  "Clientes con historial de atraso": [
    "⚠️ Revisa antes de volver a prestar.",
    "👀 Historial ayuda a medir riesgo.",
    "📲 Seguimiento temprano puede servir.",
    "💪 Controlarlos protege tu cartera.",
    "📌 Buen dato para decidir.",
  ],
  "Porcentaje de morosidad": [
    "⚠️ Mide que parte esta vencida.",
    "👀 Menor morosidad, mejor salud.",
    "📉 Bajarlo protege tu capital.",
    "💪 Cobranza constante ayuda.",
    "🚨 Vigila si empieza a subir.",
  ],
  "Tasa de recuperacion": [
    "📈 Mide cuanto capital vuelve.",
    "💰 Alta recuperacion mejora liquidez.",
    "😊 Buen cobro fortalece este valor.",
    "🚀 Recuperar rapido ayuda a crecer.",
    "👏 Senal de cartera bien gestionada.",
  ],
  "Proyeccion a 3 meses": [
    "🔮 Vista corta de ganancias futuras.",
    "💰 Ayuda a planificar proximos cobros.",
    "📈 Tres meses dan una meta cercana.",
    "😊 Buen horizonte para ordenar cartera.",
    "🚀 Convierte proyeccion en cobro real.",
  ],
  "Proyeccion a 6 meses": [
    "🔮 Mira medio ano hacia adelante.",
    "📈 Ideal para planificar crecimiento.",
    "💰 Intereses futuros en perspectiva.",
    "😊 Ordena decisiones con anticipacion.",
    "🚀 Buena gestion acerca esta cifra.",
  ],
  "Proyeccion a 12 meses": [
    "🔮 Vision anual de utilidad.",
    "📈 Te ayuda a pensar en grande.",
    "💰 Intereses proyectados a largo plazo.",
    "😊 Plan anual con mas claridad.",
    "🎯 Buen dato para metas futuras.",
  ],
  "Nivel de riesgo del cliente": [
    "⚠️ Ayuda a detectar cuidado especial.",
    "👀 Riesgo controlado protege capital.",
    "📌 Observa atrasos y saldos.",
    "💪 Buen seguimiento reduce riesgo.",
    "🚨 Alto riesgo pide accion.",
  ],
  "Variacion de ganancia vs periodo anterior": [
    "📈 Compara si ganas mas que antes.",
    "💰 Ganancia creciente es buena senal.",
    "😊 Cada interes suma al avance.",
    "🚀 Buena cobranza impulsa utilidad.",
    "🎯 Busca crecer sin descuidar riesgo.",
  ],
  "Comparativo capital vs interes": [
    "📊 Separa deuda de utilidad.",
    "💰 Capital e interes cuentan distinto.",
    "😊 Te ayuda a leer mejor la cartera.",
    "📈 Balance sano mejora decisiones.",
    "🔍 Mira cuanto falta y cuanto ganas.",
  ],
};

function getIndicatorMessages(title) {
  return INDICATOR_MESSAGES[title] || [
    "😊 Mantener este dato visible ayuda a decidir mejor.",
    "📊 Revisa este indicador para entender tu cartera.",
    "💰 Cada numero cuenta una parte del negocio.",
    "🚀 Un buen control abre nuevas oportunidades.",
    "🎯 Usa este dato para seguir mejorando.",
  ];
}

function renderIndicatorMessage(messages, title) {
  const safeMessages = messages.slice(0, 5);
  const startIndex = Math.abs(hashText(title)) % safeMessages.length;
  return `<small class="indicator-message" data-message-index="${startIndex}" data-messages="${escapeHTML(JSON.stringify(safeMessages))}">${escapeHTML(safeMessages[startIndex])}</small>`;
}

function initDashboardMessageRotators() {
  clearDashboardMessageRotators();
  const messageNodes = Array.from(document.querySelectorAll("#dashboardView .indicator-message"));
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  messageNodes.forEach((node, position) => {
    let messages = [];
    try {
      messages = JSON.parse(node.dataset.messages || "[]");
    } catch {
      messages = [];
    }
    if (messages.length < 2) return;
    let index = Number(node.dataset.messageIndex || 0);
    const rotate = () => {
      index = (index + 1) % messages.length;
      if (reducedMotion) {
        node.textContent = messages[index];
        return;
      }
      node.classList.add("is-fading");
      const fadeTimer = window.setTimeout(() => {
        node.textContent = messages[index];
        node.classList.remove("is-fading");
      }, 260);
      dashboardMessageTimers.push({ type: "timeout", id: fadeTimer });
    };
    const initialDelay = 450 + ((position * 419) % 2600);
    const startTimer = window.setTimeout(() => {
      rotate();
      const intervalTimer = window.setInterval(rotate, 5000);
      dashboardMessageTimers.push({ type: "interval", id: intervalTimer });
    }, initialDelay);
    dashboardMessageTimers.push({ type: "timeout", id: startTimer });
  });
}

function clearDashboardMessageRotators() {
  dashboardMessageTimers.forEach((timer) => {
    if (timer.type === "interval") {
      window.clearInterval(timer.id);
    } else {
      window.clearTimeout(timer.id);
    }
  });
  dashboardMessageTimers = [];
}

function hashText(value) {
  return String(value).split("").reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0);
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function renderDashboardCollections(dashboard) {
  renderLoanMiniList(elements.summaryTodayList, dashboard.todayLoans, "No hay cobros para hoy.");
  renderLoanMiniList(elements.summaryOverdueList, dashboard.overdueLoans.sort(sortLoansByDueDate), "No hay cobros vencidos.");
  renderLoanMiniList(elements.summarySoonList, dashboard.soonLoans, "No hay cobros en los proximos 7 dias.");
  renderLoanMiniList(elements.summaryMonthList, dashboard.monthLoans, "No hay cobros en los proximos 30 dias.");
}

function renderLoanMiniList(container, loans, emptyMessage) {
  const items = loans
    .map((loan) => {
      const client = getClient(loan.clientId);
      const status = getLoanStatus(loan);
      return `
        <article class="summary-mini-item">
          <div>
            <strong>${escapeHTML(client?.name || "Cliente sin nombre")}</strong>
            <span>${escapeHTML(client?.phone || "Sin telefono")} · ${formatDate(loan.nextDueDate)}</span>
            <small>${money(loan.remainingCapital)} pendiente · ${money(getLoanExpectedInterest(loan))} interes</small>
          </div>
          <span class="status-pill ${status.className}">${status.label}</span>
          <button class="primary-button small-button" type="button" data-pay-loan="${loan.id}">${icons.coin} Cobro</button>
        </article>
      `;
    })
    .join("");
  renderScrollableSummaryList(container, loans.length, items, emptyMessage, "Listado de cobros", "Ver siguiente cobro");
}

function renderScrollableSummaryList(container, itemCount, itemsHtml, emptyMessage, ariaLabel, nextLabel) {
  const key = container.id || createId("summary-list");
  const previousScroller = container.querySelector(".summary-mini-scroll");
  if (previousScroller) quickCollectionScrollPositions.set(key, previousScroller.scrollTop);

  if (!itemCount) {
    container.classList.remove("is-scrollable");
    container.innerHTML = "";
    renderEmpty(container, emptyMessage);
    return;
  }

  const hasOverflow = itemCount > 3;
  container.classList.toggle("is-scrollable", hasOverflow);
  container.dataset.quickListKey = key;
  container.innerHTML = `
    <div class="summary-mini-scroll" tabindex="0" role="list" aria-label="${escapeHTML(ariaLabel)}">
      ${itemsHtml}
    </div>
    ${
      hasOverflow
        ? `
          <div class="summary-mini-scroll-footer">
            <button class="summary-scroll-next" type="button" data-scroll-quick-list="${escapeHTML(key)}" aria-label="${escapeHTML(nextLabel)}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <span class="summary-scroll-count" aria-live="polite">3 de ${itemCount}</span>
          </div>
        `
        : ""
    }
  `;
  scheduleQuickCollectionSetup();
}

function scheduleQuickCollectionSetup() {
  const schedule = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));
  schedule(() => {
    document.querySelectorAll(".summary-mini-list").forEach(setupQuickCollectionList);
  });
}

function setupQuickCollectionList(container) {
  const scroller = container.querySelector(".summary-mini-scroll");
  if (!scroller) return;

  const items = Array.from(scroller.querySelectorAll(".summary-mini-item"));
  const isScrollable = items.length > 3;
  if (!isScrollable) {
    scroller.style.maxHeight = "";
    return;
  }

  const scrollerStyles = window.getComputedStyle ? window.getComputedStyle(scroller) : null;
  const gap = Number.parseFloat(scrollerStyles?.rowGap || scrollerStyles?.gap || "8") || 8;
  const visibleHeight = items.slice(0, 3).reduce((total, item) => total + item.offsetHeight, 0) + gap * 2;
  scroller.style.maxHeight = `${Math.ceil(visibleHeight)}px`;

  const key = container.dataset.quickListKey || container.id;
  const savedScrollTop = quickCollectionScrollPositions.get(key);
  if (Number.isFinite(savedScrollTop)) {
    scroller.scrollTop = Math.min(savedScrollTop, Math.max(scroller.scrollHeight - scroller.clientHeight, 0));
  }

  updateQuickCollectionControls(container);
  if (!scroller.dataset.scrollBound) {
    scroller.dataset.scrollBound = "true";
    scroller.addEventListener("scroll", () => {
      quickCollectionScrollPositions.set(key, scroller.scrollTop);
      updateQuickCollectionControls(container);
    });
  }
}

function updateQuickCollectionControls(container) {
  const scroller = container.querySelector(".summary-mini-scroll");
  const counter = container.querySelector(".summary-scroll-count");
  const nextButton = container.querySelector(".summary-scroll-next");
  if (!scroller || !counter || !nextButton) return;

  const total = scroller.querySelectorAll(".summary-mini-item").length;
  const maxScroll = Math.max(scroller.scrollHeight - scroller.clientHeight, 0);
  const progress = maxScroll ? scroller.scrollTop / maxScroll : 0;
  const visibleEnd = Math.min(total, Math.max(3, Math.round(3 + progress * (total - 3))));
  const isAtEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;

  counter.textContent = `${visibleEnd} de ${total}`;
  nextButton.classList.toggle("is-disabled", isAtEnd);
  nextButton.disabled = isAtEnd;
}

function scrollQuickCollection(key) {
  const container = Array.from(document.querySelectorAll(".summary-mini-list")).find((item) => item.dataset.quickListKey === key);
  const scroller = container?.querySelector(".summary-mini-scroll");
  const firstItem = scroller?.querySelector(".summary-mini-item");
  if (!scroller || !firstItem) return;

  const scrollerStyles = window.getComputedStyle ? window.getComputedStyle(scroller) : null;
  const gap = Number.parseFloat(scrollerStyles?.rowGap || scrollerStyles?.gap || "8") || 8;
  scroller.scrollBy({
    top: firstItem.offsetHeight + gap,
    behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth",
  });
}

function renderDashboardManagement(dashboard) {
  const cards = getDashboardManagementItems(dashboard);
  if (!elements.summaryManagementGrid) return;
  elements.summaryManagementGrid.innerHTML = cards.map((item) => renderCompactMetric(item, dashboard)).join("");
}

function getDashboardManagementItems(dashboard) {
  return getDashboardManagementReportItems(dashboard).filter((item) => !HIDDEN_DASHBOARD_MANAGEMENT_TITLES.has(item.title));
}

const HIDDEN_DASHBOARD_MANAGEMENT_TITLES = new Set([
  "Ganancia reinvertida",
  "Ganancia del periodo",
  "Ganancia del periodo anterior",
  "Ganancia esperada siguiente periodo",
  "Capital que regresara siguiente periodo",
  "Total estimado siguiente periodo",
  "Cobrado en el periodo",
  "Nuevos prestamos del periodo",
  "Ampliaciones del periodo",
  "Monto total en ampliaciones",
  "Dias promedio de atraso",
  "Interes pendiente",
  "Promedio de prestamo",
  "Promedio de interes cobrado",
  "Distribucion por modalidad",
]);

function getDashboardManagementReportItems(dashboard) {
  const m = dashboard.metrics;
  const modeText = dashboard.charts.modeSegments.map((item) => `${item.label}: ${item.value}`).join(" · ");
  return [
    ["Capital agregado", money(m.capitalDeposited), "Aquí te figura solo los aportes que realizas. NO cuenta los intereses.", "capitalDeposited"],
    ["Capital retirado", money(m.capitalWithdrawn), "Suma de retiros registrados hasta la fecha final del resumen.", "capitalWithdrawn"],
    ["Ganancia reinvertida", money(m.compoundedProfit), "Intereses cobrados acumulados que ya forman parte del capital total.", "compoundedProfit"],
    ["Ganancia del periodo", money(m.currentMonthProfit), "Ejemplo: Si durante el periodo seleccionado cobraste S/850 en intereses, tu ganancia del periodo es S/850.", "currentMonthProfit"],
    ["Ganancia del periodo anterior", money(m.previousMonthProfit), "Ejemplo: Si en el periodo anterior comparable cobraste S/700 en intereses, ese monto corresponde a la ganancia anterior.", "previousMonthProfit"],
    ["Ganancia esperada siguiente periodo", money(m.nextMonthProfit), "Ejemplo: Si los prestamos del siguiente periodo comparable deberian generar S/1,200 en intereses, esa es la ganancia esperada.", "nextMonthProfit"],
    ["Capital que regresara siguiente periodo", money(m.nextMonthCapital), "Ejemplo: Si en el siguiente periodo comparable tus clientes deben devolver S/3,000 de capital, ese sera el capital estimado que regresara.", "nextMonthCapital"],
    ["Total estimado siguiente periodo", money(m.nextMonthTotal), "Ejemplo: Si esperas recuperar S/3,000 de capital y S/800 de intereses, el total estimado sera S/3,800.", "nextMonthTotal"],
    ["Cobrado en el periodo", money(m.chargedThisMonth), "Ejemplo: Si en el periodo seleccionado recibiste S/2,000 de capital y S/500 de intereses, el total cobrado es S/2,500.", "chargedThisMonth"],
    ["Total prestado acumulado", money(m.totalLentAccumulated), "Ejemplo: Si primero prestaste S/500 y luego otros S/1,000, tu total prestado acumulado es S/1,500. Este indicador no disminuye cuando devuelven capital, porque registra todo el dinero que has llegado a prestar históricamente.", "totalLentAccumulated"],
    ["Nuevos prestamos del periodo", m.newLoansPeriod, "Ejemplo: Si en el periodo seleccionado registraste 4 prestamos principales nuevos, este indicador mostrara 4.", "newLoansPeriod"],
    ["Ampliaciones del periodo", m.extensionsPeriod, "Ejemplo: Si durante el periodo seleccionado registraste 5 ampliaciones de prestamo, este indicador mostrara 5 ampliaciones.", "extensionsPeriod"],
    ["Monto total en ampliaciones", money(m.extensionAmount), "Ejemplo: Si otorgaste ampliaciones de S/200, S/300 y S/500, el monto total en ampliaciones es S/1,000.", "extensionAmount"],
    ["Clientes atrasados", m.lateClients, "Ejemplo: Si Pepe tiene un prestamo vencido y Ana una ampliacion vencida, tienes 2 clientes atrasados.", "lateClients"],
    ["Dias promedio de atraso", `${roundMoney(m.averageLateDays)} dias`, "Ejemplo: Si un prestamo debia pagarse el 10 de agosto y hoy es 15 de agosto, tiene 5 dias de atraso.", "averageLateDays"],
    ["Capital en riesgo", money(m.capitalRisk), "Ejemplo: Si tienes tres prestamos vencidos con S/500, S/800 y S/700 pendientes, tienes S/2,000 de capital en riesgo.", "capitalRisk"],
    ["Interes pendiente", money(m.pendingInterest), "Ejemplo: Si todavia faltan cobrar intereses de S/100, S/150 y S/50, tienes S/300 de interes pendiente.", "pendingInterest"],
    ["Promedio de prestamo", money(m.averageLoan), "Ejemplo: Si otorgaste prestamos de S/500, S/1,000 y S/1,500, el promedio de prestamo es S/1,000.", "averageLoan"],
    ["Promedio de interes cobrado", money(m.averageInterestPaid), "Ejemplo: Si cobraste S/50, S/100 y S/150 de interes en tres pagos, el promedio de interes cobrado es S/100.", "averageInterestPaid"],
    ["Distribucion por modalidad", modeText || "Sin datos", "Ejemplo: Si tienes 5 prestamos mensuales, 3 quincenales, 2 semanales y 1 diario, aqui ves esa distribucion."],
    ["Flujo de caja", money(m.cashflow), "Ejemplo: Si agregas S/2,000, prestas S/1,000, recibes S/150 y retiras S/300, tu flujo neto es +S/850. No es lo mismo que ganancia: la ganancia real solo cuenta intereses cobrados.", "cashflow"],
  ].map(([title, value, tip, metricKey]) => ({ title, value, tip, metricKey }));
}

function renderCompactMetric({ title, value, tip, metricKey, compareFactor }, dashboard) {
  const messages = getIndicatorMessages(title);
  return `
    <article class="summary-compact-card">
      <span>${escapeHTML(title)} ${renderInfoDot(tip)}</span>
      <strong class="kpi-value">${escapeHTML(value)}</strong>
      ${renderComparisonBadge({ title, metricKey, compareFactor }, dashboard)}
      ${renderIndicatorMessage(messages, title)}
    </article>
  `;
}

function renderDashboardCharts(dashboard) {
  renderStackedMonthChart(elements.summaryMonthlyChart, dashboard.charts.months, "capital", "interest");
  renderSimpleBarChart(elements.summaryLoansChart, dashboard.charts.loansByMonth, "money");
  renderDonutChart(elements.summaryStatusChart, dashboard.charts.statusSegments);
  renderHorizontalChart(elements.summaryCapitalChart, [
    { label: "Capital pendiente", value: dashboard.metrics.capitalPending, color: "#00a76f" },
    { label: "Capital recuperado", value: dashboard.metrics.capitalRecovered, color: "#2f6fed" },
    { label: "Ganancia real", value: dashboard.metrics.realProfit, color: "#ffb000" },
    { label: "Ganancia proyectada", value: dashboard.metrics.projectedProfit, color: "#0f766e" },
  ]);
  renderDonutChart(
    elements.summaryModeChart,
    dashboard.charts.modeSegments.map((item, index) => ({ ...item, color: ["#00a76f", "#2f6fed", "#ffb000", "#0f766e"][index] }))
  );
  renderProjectionChart(elements.summaryProjectionChart, dashboard.charts.projections);
  renderSimpleBarChart(elements.summaryDelinquencyChart, dashboard.charts.delinquency, "number");
  renderHorizontalChart(elements.summaryCashflowChart, dashboard.charts.cashflow);
}

function buildMonthSeries(payments, range) {
  return getMonthKeysForDashboardRange(range).map((month) => {
    const monthPayments = payments.filter((payment) => getMonthKey(payment.date) === month.key);
    return {
      label: month.label,
      capital: sum(monthPayments, "capitalPaid"),
      interest: sum(monthPayments, "interestPaid"),
    };
  });
}

function buildLoanMonthSeries(loans, range) {
  return getMonthKeysForDashboardRange(range).map((month) => ({
    label: month.label,
    value: loans.filter((loan) => getMonthKey(loan.startDate) === month.key).reduce((total, loan) => total + loan.amount, 0),
  }));
}

function buildDelinquencySeries(loans, range, payments = state.payments) {
  return getMonthKeysForDashboardRange(range).map((month) => {
    const monthEnd = getDashboardMonthEnd(month.key, range);
    const overdueAtMonthEnd = loans
      .filter((loan) => loanWasActiveOnDate(loan, monthEnd))
      .map((loan) => loanSnapshotAtDate(loan, monthEnd, payments))
      .filter((loan) => isOverdueAt(loan, monthEnd)).length;
    return {
      label: month.label,
      value: overdueAtMonthEnd,
    };
  });
}

function getDashboardMonthEnd(monthKey, range) {
  const [year, month] = String(monthKey).split("-").map(Number);
  const monthEnd = toISODate(new Date(year, month, 0));
  if (range?.end && startOfDay(monthEnd) > startOfDay(range.end)) return range.end;
  return monthEnd;
}

function renderStackedMonthChart(container, data, firstKey, secondKey) {
  const max = Math.max(...data.map((item) => item[firstKey] + item[secondKey]), 1);
  container.innerHTML = data
    .map((item) => {
      const firstHeight = Math.max((item[firstKey] / max) * 100, item[firstKey] ? 7 : 0);
      const secondHeight = Math.max((item[secondKey] / max) * 100, item[secondKey] ? 7 : 0);
      return `
        <div class="summary-bar-item">
          <div class="summary-bar-track" title="${money(item[firstKey] + item[secondKey])}">
            <span class="summary-bar-fill capital-fill" style="height:${firstHeight}%"></span>
            <span class="summary-bar-fill interest-fill" style="height:${secondHeight}%"></span>
          </div>
          <strong>${escapeHTML(item.label)}</strong>
          <span>${money(item[firstKey] + item[secondKey])}</span>
        </div>
      `;
    })
    .join("");
}

function renderSimpleBarChart(container, data, valueType = "money") {
  const max = Math.max(...data.map((item) => item.value), 1);
  container.innerHTML = data
    .map((item) => {
      const formattedValue = valueType === "money" ? money(item.value) : escapeHTML(roundMoney(item.value));
      return `
        <div class="summary-bar-item">
          <div class="summary-bar-track" title="${formattedValue}">
            <span class="summary-bar-fill single-fill" style="height:${Math.max((item.value / max) * 100, item.value ? 7 : 0)}%"></span>
          </div>
          <strong>${escapeHTML(item.label)}</strong>
          <span>${formattedValue}</span>
        </div>
      `;
    })
    .join("");
}

function renderDonutChart(container, segments) {
  const total = segments.reduce((value, segment) => value + segment.value, 0);
  const chartSegments = segments.map((segment, index) => ({ ...segment, color: segment.color || ["#00a76f", "#ffb000", "#061826", "#2f6fed"][index] }));
  container.innerHTML = `
    <div class="donut-chart" style="background:${total ? buildConicGradient(chartSegments, total) : "rgba(0, 167, 111, 0.12)"}">
      <div class="donut-center"><strong>${total}</strong><span>total</span></div>
    </div>
    <div class="legend-list">
      ${chartSegments
        .map((segment) => `
          <div class="legend-item">
            <i style="background:${segment.color}"></i>
            <span>${escapeHTML(segment.label)}</span>
            <strong>${segment.value}</strong>
          </div>
        `)
        .join("")}
    </div>
  `;
}

function renderHorizontalChart(container, rows) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  container.innerHTML = rows
    .map((row) => `
      <div class="summary-horizontal-row">
        <div><strong>${escapeHTML(row.label)}</strong><span>${money(row.value)}</span></div>
        <div class="risk-track"><span style="width:${Math.max((row.value / max) * 100, row.value ? 5 : 0)}%; background:${row.color}"></span></div>
      </div>
    `)
    .join("");
}

function renderProjectionChart(container, projections) {
  container.innerHTML = projections
    .map((item) => `
      <article>
        <span>${escapeHTML(item.label)}</span>
        <strong>${money(item.value)}</strong>
      </article>
    `)
    .join("");
}

function buildDashboardLists(activeLoans, payments, scopeLoans, periodLoans, range) {
  const clients = state.clients.map((client) => {
    const clientLoans = activeLoans.filter((loan) => loan.clientId === client.id);
    const clientScopeLoans = scopeLoans.filter((loan) => loan.clientId === client.id);
    const clientPayments = payments.filter((payment) => payment.clientId === client.id);
    return {
      client,
      debt: clientLoans.filter((loan) => loan.status === "active").reduce((total, loan) => total + loan.remainingCapital, 0),
      profit: clientPayments.reduce((total, payment) => total + payment.interestPaid, 0),
      extensions: clientScopeLoans.filter((loan) => !isPrimaryLoan(loan)).length,
      overdue: clientLoans.filter((loan) => isOverdueAt(loan, range.end)).length,
      punctual: clientPayments.filter((payment) => payment.scheduledDueDate && startOfDay(payment.date) <= startOfDay(payment.scheduledDueDate)).length,
    };
  });

  return {
    debt: clients.filter((item) => item.debt > 0).sort((a, b) => b.debt - a.debt).slice(0, 5),
    profit: clients.filter((item) => item.profit > 0).sort((a, b) => b.profit - a.profit).slice(0, 5),
    extensions: clients.filter((item) => item.extensions > 0).sort((a, b) => b.extensions - a.extensions).slice(0, 5),
    punctual: clients.filter((item) => item.punctual > 0).sort((a, b) => b.punctual - a.punctual).slice(0, 5),
    late: clients.filter((item) => item.overdue > 0).sort((a, b) => b.overdue - a.overdue).slice(0, 5),
    payments: payments.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
    loans: periodLoans.filter(isPrimaryLoan).slice().sort((a, b) => new Date(b.createdAt || b.startDate) - new Date(a.createdAt || a.startDate)).slice(0, 5),
    recentExtensions: periodLoans.filter((loan) => !isPrimaryLoan(loan)).slice().sort((a, b) => new Date(b.createdAt || b.startDate) - new Date(a.createdAt || a.startDate)).slice(0, 5),
  };
}

function renderDashboardLists(dashboard) {
  renderClientMetricList(elements.summaryDebtList, dashboard.lists.debt, "No hay deuda activa.", (item) => [money(item.debt), "Capital pendiente"]);
  renderClientMetricList(elements.summaryProfitList, dashboard.lists.profit, "No hay ganancias registradas.", (item) => [money(item.profit), "Interes cobrado"]);
  renderClientMetricList(elements.summaryExtensionList, dashboard.lists.extensions, "No hay ampliaciones registradas.", (item) => [item.extensions, "Ampliaciones"]);
  renderClientMetricList(elements.summaryPunctualList, dashboard.lists.punctual, "No hay pagos puntuales registrados.", (item) => [item.punctual, "Pagos puntuales"]);
  renderClientMetricList(elements.summaryLateList, dashboard.lists.late, "No hay clientes atrasados.", (item) => [item.overdue, "Prestamos vencidos"]);
  renderMovementList(elements.summaryPaymentList, dashboard.lists.payments, "No hay pagos registrados.", "payment");
  renderMovementList(elements.summaryLoanList, dashboard.lists.loans, "No hay prestamos creados.", "loan");
  renderMovementList(elements.summaryRecentExtensionList, dashboard.lists.recentExtensions, "No hay ampliaciones creadas.", "loan");
}

function renderClientMetricList(container, items, emptyMessage, getValue) {
  const cards = items
    .map((item) => {
      const [value, label] = getValue(item);
      return `
        <article class="summary-mini-item">
          <div>
            <strong>${escapeHTML(item.client.name)}</strong>
            <span>${escapeHTML(item.client.phone || "Sin telefono")}</span>
          </div>
          <div class="summary-mini-value"><strong>${escapeHTML(value)}</strong><small>${escapeHTML(label)}</small></div>
        </article>
      `;
    })
    .join("");
  renderScrollableSummaryList(container, items.length, cards, emptyMessage, "Listado de clientes y metricas", "Ver siguiente cliente");
}

function renderMovementList(container, items, emptyMessage, type) {
  const cards = items
    .map((item) => {
      const client = getClient(item.clientId);
      const value = type === "payment" ? money(Number(item.interestPaid || 0) + Number(item.capitalPaid || 0)) : money(item.amount);
      const date = type === "payment" ? item.date : item.startDate;
      return `
        <article class="summary-mini-item">
          <div>
            <strong>${escapeHTML(client?.name || "Cliente eliminado")}</strong>
            <span>${formatDate(date)} · ${type === "payment" ? "Pago" : isPrimaryLoan(item) ? "Prestamo" : "Ampliacion"}</span>
          </div>
          <div class="summary-mini-value"><strong>${value}</strong><small>${type === "payment" ? "Registrado" : getInterestModeLabel(item.interestMode)}</small></div>
        </article>
      `;
    })
    .join("");
  renderScrollableSummaryList(container, items.length, cards, emptyMessage, "Listado de movimientos", "Ver siguiente movimiento");
}

function renderDashboardAdvanced(dashboard) {
  const cards = getDashboardAdvancedItems(dashboard);
  if (!elements.summaryAdvancedGrid) return;
  elements.summaryAdvancedGrid.innerHTML = cards.map((item) => renderCompactMetric(item, dashboard)).join("");
}

function getDashboardAdvancedItems(dashboard) {
  return getDashboardAdvancedReportItems(dashboard).filter((item) => !HIDDEN_DASHBOARD_ADVANCED_TITLES.has(item.title));
}

const HIDDEN_DASHBOARD_ADVANCED_TITLES = new Set(["Rendimiento proyectado de cartera"]);

function getDashboardAdvancedReportItems(dashboard) {
  const m = dashboard.metrics;
  const mostProfitable = dashboard.lists.profit[0]?.client.name || "Sin datos";
  const highestDebt = dashboard.lists.debt[0]?.client.name || "Sin datos";
  const mostExtensions = dashboard.lists.extensions[0]?.client.name || "Sin datos";
  return [
    ["Rendimiento proyectado de cartera", `${roundMoney(m.monthlyRoi)}%`, "Ejemplo: Si tienes S/10,000 de capital pendiente y S/500 de interes proyectado, el rendimiento estimado es 5%.", "monthlyRoi"],
    ["Cliente mas rentable", mostProfitable, "Ejemplo: Si Pepe genero S/800 en intereses y los demas clientes menos que eso, Pepe sera el cliente mas rentable."],
    ["Cliente con mayor deuda", highestDebt, "Ejemplo: Si Ana debe S/3,000 y ningun otro cliente supera ese saldo, Ana aparecera como cliente con mayor deuda."],
    ["Cliente con mas ampliaciones", mostExtensions, "Ejemplo: Si Lole tiene 4 ampliaciones y ningun otro cliente tiene mas, Lole sera el cliente con mas ampliaciones."],
    ["Porcentaje de morosidad", `${roundMoney(m.delinquencyRate)}%`, "Ejemplo: Si tienes S/10,000 pendientes y S/2,000 estan vencidos, tu morosidad aproximada es 20%.", "delinquencyRate"],
    ["Tasa de recuperacion", `${roundMoney(m.recoveryRate)}%`, "Ejemplo: Si prestaste S/10,000 y ya recuperaste S/7,000 de capital, tu tasa de recuperacion es 70%.", "recoveryRate"],
    ["Proyeccion a 3 meses", money(m.projectedProfit * 3), "Ejemplo: Si esperas recibir S/1,000 de intereses por mes, la proyeccion simple a 3 meses seria S/3,000.", "projectedProfit", 3],
    ["Proyeccion a 6 meses", money(m.projectedProfit * 6), "Ejemplo: Si tus prestamos actuales proyectan S/1,000 mensuales en intereses, a 6 meses serian S/6,000.", "projectedProfit", 6],
    ["Proyeccion a 12 meses", money(m.projectedProfit * 12), "Ejemplo: Si el sistema estima S/1,000 mensuales en intereses, la proyeccion anual seria cerca de S/12,000.", "projectedProfit", 12],
    ["Nivel de riesgo del cliente", m.overdueLoans ? "Riesgo activo" : "Controlado", "Ejemplo: Si un cliente acumula atrasos o tiene deuda vencida, el sistema lo puede marcar con mayor riesgo."],
    ["Variacion de ganancia vs periodo anterior", money(m.currentMonthProfit - m.previousMonthProfit), "Ejemplo: Si en el periodo anterior ganaste S/700 y en este S/900, la ganancia aumento S/200."],
    ["Comparativo capital vs interes", `${money(m.capitalPending)} / ${money(m.projectedProfit)}`, "Ejemplo: Si tienes S/3,000 de capital pendiente y S/700 de intereses, aqui comparas deuda contra ganancia."],
  ].map(([title, value, tip, metricKey, compareFactor]) => ({ title, value, tip, metricKey, compareFactor }));
}

function renderDashboardAlerts(dashboard) {
  const alerts = buildDashboardAlertMessages(dashboard);
  elements.summaryAlerts.innerHTML = alerts.map((alert) => `<article>${escapeHTML(alert)}</article>`).join("");
}

function buildDashboardAlertMessages(dashboard) {
  if (dashboard.range?.invalid) {
    return [dashboard.range.error];
  }
  const alerts = [];
  if (dashboard.metrics.overdueLoans) {
    alerts.push(`Hay ${dashboard.metrics.overdueLoans} prestamo(s) vencido(s) por ${money(dashboard.metrics.overdueAmount)}.`);
  }
  if (dashboard.metrics.todayCount) {
    alerts.push(`Hoy tienes ${dashboard.metrics.todayCount} cobro(s) programado(s) por ${money(dashboard.metrics.todayAmount)}.`);
  }
  if (!dashboard.metrics.activeLoans) {
    alerts.push("No hay prestamos activos dentro del filtro actual.");
  }
  if (dashboard.metrics.delinquencyRate > 30) {
    alerts.push(`La morosidad estimada esta en ${roundMoney(dashboard.metrics.delinquencyRate)}%. Conviene revisar clientes atrasados.`);
  }
  if (!alerts.length) {
    alerts.push("La cartera filtrada se ve estable: no hay alertas criticas en este momento.");
  }
  return alerts;
}

function exportDashboardSummary() {
  const dashboard = buildDashboardData();
  const criticalRows = getDashboardKpiReportItems(dashboard).map((item) => dashboardIndicatorRow(item, dashboard));
  const managementRows = getDashboardManagementReportItems(dashboard).map((item) => dashboardIndicatorRow(item, dashboard));
  const advancedRows = getDashboardAdvancedReportItems(dashboard).map((item) => dashboardIndicatorRow(item, dashboard));
  const alerts = buildDashboardAlertMessages(dashboard);
  const workbook = buildExcelWorkbook([
    buildSummaryIndicatorsSheet(dashboard, criticalRows, managementRows, advancedRows),
    buildSummaryCollectionsSheet(dashboard, alerts),
    buildSummaryChartsSheet(dashboard),
    buildSummaryListsSheet(dashboard),
  ]);
  downloadBlob(workbook, "application/vnd.ms-excel;charset=utf-8", `resumen-prestamos-${todayISO()}.xls`);
}

function dashboardRangeText(dashboard) {
  if (dashboard.range.invalid) return dashboard.range.error;
  if (dashboard.range.isAllHistory) return "Todo el historial";
  return `${formatDate(dashboard.range.start)} - ${formatDate(dashboard.range.end)}`;
}

function buildSummaryIndicatorsSheet(dashboard, criticalRows, managementRows, advancedRows) {
  const hasComparison = Boolean(dashboard.comparison);
  const columns = hasComparison ? [220, 135, 135, 135, 115, 390] : [230, 145, 420];
  const mergeAcross = columns.length - 1;
  const header = hasComparison
    ? ["Indicador", "Valor actual", "Valor comparado", "Diferencia", "Variacion", "Explicacion"]
    : ["Indicador", "Valor", "Explicacion"];
  const comparisonPeriod = hasComparison
    ? `${formatDate(dashboard.comparison.range.start)} - ${formatDate(dashboard.comparison.range.end)}`
    : "Sin comparacion";
  return {
    name: "Resumen financiero",
    columns,
    rows: [
      excelTitleRow("REPORTE DE RESUMEN FINANCIERO", mergeAcross),
      excelMetaRow("Fecha de reporte", formatDate(todayISO()), "Periodo", dashboardRangeText(dashboard)),
      excelMetaRow("Tipo de operacion", dashboardOperationLabel(dashboard.filters.operation), "Comparar con", hasComparison ? dashboard.comparison.label : "Sin comparacion"),
      excelMetaRow("Periodo comparado", comparisonPeriod, "", ""),
      excelSpacerRow(),
      excelSectionRow("INDICADORES PRINCIPALES", mergeAcross),
      excelHeaderRow(header),
      ...criticalRows,
      excelSpacerRow(),
      excelSectionRow("INDICADORES DE GESTION", mergeAcross),
      excelHeaderRow(header),
      ...managementRows,
      excelSpacerRow(),
      excelSectionRow("INDICADORES AVANZADOS", mergeAcross),
      excelHeaderRow(header),
      ...advancedRows,
    ],
  };
}

function buildSummaryCollectionsSheet(dashboard, alerts) {
  return {
    name: "Cobranza y alertas",
    columns: [180, 120, 125, 110, 120, 120, 125, 120],
    rows: [
      excelTitleRow("COBRANZA RAPIDA", 7),
      excelMetaRow("Fecha de reporte", formatDate(todayISO()), "Periodo", dashboardRangeText(dashboard)),
      excelSpacerRow(),
      ...dashboardLoanSectionRows("COBRAR HOY", dashboard.todayLoans),
      excelSpacerRow(),
      ...dashboardLoanSectionRows("COBROS VENCIDOS", dashboard.overdueLoans.slice().sort(sortLoansByDueDate)),
      excelSpacerRow(),
      ...dashboardLoanSectionRows("PROXIMOS 7 DIAS", dashboard.soonLoans),
      excelSpacerRow(),
      ...dashboardLoanSectionRows("PROXIMOS 30 DIAS", dashboard.monthLoans),
      excelSpacerRow(),
      excelSectionRow("ALERTAS DEL RESUMEN", 7),
      excelHeaderRow(["Alerta"]),
      ...alerts.map((alert) => [excelCellData(alert, "Text", 7)]),
    ],
  };
}

function buildSummaryChartsSheet(dashboard) {
  return {
    name: "Graficos y tendencias",
    columns: [180, 140, 140, 140],
    rows: [
      excelTitleRow("DATOS PARA GRAFICOS DEL RESUMEN", 3),
      excelMetaRow("Fecha de reporte", formatDate(todayISO()), "Periodo", dashboardRangeText(dashboard)),
      excelSpacerRow(),
      excelSectionRow("COBROS REALES POR MES", 3),
      excelHeaderRow(["Mes", "Capital recuperado", "Interes cobrado", "Total"]),
      ...dashboard.charts.months.map((item) => [excelCellData(item.label, "Text"), excelCellData(money(item.capital), "MoneyText"), excelCellData(money(item.interest), "MoneyText"), excelCellData(money(item.capital + item.interest), "MoneyText")]),
      excelSpacerRow(),
      excelSectionRow("PRESTAMOS OTORGADOS POR MES", 3),
      excelHeaderRow(["Mes", "Monto otorgado"]),
      ...dashboard.charts.loansByMonth.map((item) => [excelCellData(item.label, "Text"), excelCellData(money(item.value), "MoneyText")]),
      excelSpacerRow(),
      excelSectionRow("CARTERA POR ESTADO", 3),
      excelHeaderRow(["Estado", "Cantidad"]),
      ...dashboard.charts.statusSegments.map((item) => [excelCellData(item.label, "Text"), excelCellData(item.value, "Number")]),
      excelSpacerRow(),
      excelSectionRow("MODALIDAD DE INTERES", 3),
      excelHeaderRow(["Modalidad", "Cantidad"]),
      ...dashboard.charts.modeSegments.map((item) => [excelCellData(item.label, "Text"), excelCellData(item.value, "Number")]),
      excelSpacerRow(),
      excelSectionRow("PROYECCION DE GANANCIAS", 3),
      excelHeaderRow(["Periodo", "Ganancia proyectada"]),
      ...dashboard.charts.projections.map((item) => [excelCellData(item.label, "Text"), excelCellData(money(item.value), "MoneyText")]),
      excelSpacerRow(),
      excelSectionRow("TENDENCIA DE MOROSIDAD", 3),
      excelHeaderRow(["Mes", "Prestamos vencidos"]),
      ...dashboard.charts.delinquency.map((item) => [excelCellData(item.label, "Text"), excelCellData(item.value, "Number")]),
      excelSpacerRow(),
      excelSectionRow("FLUJO DE CAJA", 3),
      excelHeaderRow(["Concepto", "Monto"]),
      ...dashboard.charts.cashflow.map((item) => [excelCellData(item.label, "Text"), excelCellData(money(item.value), "MoneyText")]),
    ],
  };
}

function buildSummaryListsSheet(dashboard) {
  return {
    name: "Listas inteligentes",
    columns: [210, 130, 160, 140],
    rows: [
      excelTitleRow("LISTAS INTELIGENTES DEL RESUMEN", 3),
      excelMetaRow("Fecha de reporte", formatDate(todayISO()), "Periodo", dashboardRangeText(dashboard)),
      excelSpacerRow(),
      ...dashboardClientSectionRows("CLIENTES CON MAYOR DEUDA", dashboard.lists.debt, (item) => [money(item.debt), "Capital pendiente"]),
      excelSpacerRow(),
      ...dashboardClientSectionRows("CLIENTES MAS RENTABLES", dashboard.lists.profit, (item) => [money(item.profit), "Interes cobrado"]),
      excelSpacerRow(),
      ...dashboardClientSectionRows("CLIENTES CON MAS AMPLIACIONES", dashboard.lists.extensions, (item) => [item.extensions, "Ampliaciones"]),
      excelSpacerRow(),
      ...dashboardClientSectionRows("CLIENTES PUNTUALES", dashboard.lists.punctual, (item) => [item.punctual, "Pagos puntuales"]),
      excelSpacerRow(),
      ...dashboardClientSectionRows("CLIENTES ATRASADOS", dashboard.lists.late, (item) => [item.overdue, "Prestamos vencidos"]),
      excelSpacerRow(),
      ...dashboardMovementSectionRows("ULTIMOS PAGOS REGISTRADOS", dashboard.lists.payments, "payment"),
      excelSpacerRow(),
      ...dashboardMovementSectionRows("ULTIMOS PRESTAMOS CREADOS", dashboard.lists.loans, "loan"),
      excelSpacerRow(),
      ...dashboardMovementSectionRows("ULTIMAS AMPLIACIONES CREADAS", dashboard.lists.recentExtensions, "loan"),
    ],
  };
}

function dashboardIndicatorRow(item, dashboard) {
  const explanation = item.note && item.tip && item.note !== item.tip ? `${item.tip} ${item.note}` : item.tip || item.note || "";
  const comparison = getComparisonDetails(item, dashboard);
  if (dashboard.comparison) {
    return [
      excelCellData(item.title, "Text"),
      excelCellData(item.value, "Value"),
      excelCellData(comparison ? formatMetricValue(comparison.previousValue, item.metricKey) : "No aplica", "Value"),
      excelCellData(comparison ? formatSignedMetricValue(comparison.difference, item.metricKey) : "No aplica", "Value"),
      excelCellData(comparison ? (comparison.percent === null ? "Sin base previa" : `${formatSignedNumber(comparison.percent)}%`) : "No aplica", "Value"),
      excelCellData(explanation, "Text"),
    ];
  }
  return [excelCellData(item.title, "Text"), excelCellData(item.value, "Value"), excelCellData(explanation, "Text")];
}

function dashboardLoanSectionRows(title, loans) {
  const rows = [
    excelSectionRow(title, 7),
    excelHeaderRow(["Cliente", "Telefono", "Prestamo", "Estado", "Fecha de cobro", "Capital pendiente", "Interes esperado", "Total estimado"]),
  ];
  if (!loans.length) {
    rows.push([excelCellData("Sin datos para esta seccion.", "Muted", 7)]);
    return rows;
  }
  loans.forEach((loan) => {
    const client = getClient(loan.clientId);
    const status = getLoanStatus(loan);
    const interest = getLoanExpectedInterest(loan);
    rows.push([
      excelCellData(client?.name || "Cliente sin nombre", "Text"),
      excelCellData(client?.phone || "Sin telefono", "Text"),
      excelCellData(getLoanExcelLabel(loan), "Text"),
      excelCellData(status.label, "Status"),
      excelCellData(formatDate(loan.nextDueDate), "Text"),
      excelCellData(money(loan.remainingCapital), "MoneyText"),
      excelCellData(money(interest), "MoneyText"),
      excelCellData(money(Number(loan.remainingCapital || 0) + interest), "MoneyText"),
    ]);
  });
  return rows;
}

function dashboardClientSectionRows(title, items, getValue) {
  const rows = [excelSectionRow(title, 3), excelHeaderRow(["Cliente", "Telefono", "Valor", "Detalle"])];
  if (!items.length) {
    rows.push([excelCellData("Sin datos para esta seccion.", "Muted", 3)]);
    return rows;
  }
  items.forEach((item) => {
    const [value, label] = getValue(item);
    rows.push([
      excelCellData(item.client.name, "Text"),
      excelCellData(item.client.phone || "Sin telefono", "Text"),
      excelCellData(value, "Value"),
      excelCellData(label, "Text"),
    ]);
  });
  return rows;
}

function dashboardMovementSectionRows(title, items, type) {
  const rows = [excelSectionRow(title, 3), excelHeaderRow(["Cliente", "Fecha", "Tipo", "Monto"])];
  if (!items.length) {
    rows.push([excelCellData("Sin datos para esta seccion.", "Muted", 3)]);
    return rows;
  }
  items.forEach((item) => {
    const client = getClient(item.clientId);
    const value = type === "payment" ? Number(item.interestPaid || 0) + Number(item.capitalPaid || 0) : Number(item.amount || 0);
    const date = type === "payment" ? item.date : item.startDate;
    rows.push([
      excelCellData(client?.name || "Cliente eliminado", "Text"),
      excelCellData(formatDate(date), "Text"),
      excelCellData(type === "payment" ? "Pago registrado" : getLoanExcelLabel(item), "Text"),
      excelCellData(money(value), "MoneyText"),
    ]);
  });
  return rows;
}

function getLoanExcelLabel(loan) {
  const loans = getLoansForClient(loan.clientId);
  const index = loans.findIndex((item) => item.id === loan.id);
  return index <= 0 ? "Prestamo principal" : `Ampliacion ${index}`;
}

function dashboardStatusLabel(status) {
  const labels = {
    all: "Todos",
    active: "Activos",
    overdue: "Vencidos",
    closed: "Cerrados",
    today: "Por cobrar hoy",
    extensions: "Con ampliaciones",
  };
  return labels[status] || "Todos";
}

function dashboardModeLabel(mode) {
  return mode === "all" ? "Todas" : INTEREST_MODES[mode]?.label || "Todas";
}

function excelTitleRow(title, mergeAcross = 1) {
  return { height: 32, cells: [excelCellData(title, "Title", mergeAcross)] };
}

function excelSectionRow(title, mergeAcross = 1) {
  return { height: 24, cells: [excelCellData(title, "Section", mergeAcross)] };
}

function excelHeaderRow(values) {
  return values.map((value) => excelCellData(value, "Header"));
}

function excelMetaRow(labelA, valueA, labelB = "", valueB = "") {
  return [
    excelCellData(labelA, "MetaLabel"),
    excelCellData(valueA, "MetaValue"),
    excelCellData(labelB, "MetaLabel"),
    excelCellData(valueB, "MetaValue"),
  ];
}

function excelSpacerRow() {
  return { height: 10, cells: [excelCellData("", "Blank")] };
}

function excelCellData(value, styleId = "Text", mergeAcross = 0) {
  return { value, styleId, mergeAcross };
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
      const extensions = clientLoans.filter((loan) => !isPrimaryLoan(loan));
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
          <span data-label="Capital pendiente">${renderLoanPendingCapital(loan)}</span>
          <span data-label="Fecha prestada">${loan ? formatDate(loan.startDate) : "-"}</span>
          <span data-label="Fecha de cobro">${loan && loan.status === "active" ? formatDate(loan.nextDueDate) : "Cerrado"}</span>
          <span class="row-actions" data-label="Acciones">
            <button class="ghost-button small-button" type="button" data-edit-client="${client.id}">${icons.edit} Editar</button>
            ${paymentButton}
            <button class="delete-button small-button" type="button" data-delete-client="${client.id}">${icons.trash} Eliminar</button>
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

async function deleteClient(clientId, actionButton = null) {
  if (clientDeletionInProgress) return;

  const client = state.clients.find((item) => item.id === clientId);
  if (!client) return;

  const clientLoans = getLoansForClient(clientId);
  const paymentCount = state.payments.filter((payment) => payment.clientId === clientId).length;
  const confirmed = window.confirm(
    `Seguro que deseas eliminar a ${client.name}?\n\nSe eliminaran tambien sus prestamos, ampliaciones y ${paymentCount} cobro(s) registrados.\n\nEsta accion no se puede deshacer desde esta pantalla. Deseas continuar?`
  );
  if (!confirmed) return;

  clientDeletionInProgress = true;
  setButtonBusy(actionButton, true, "Eliminando...");
  try {
    await ensureAutomaticBackup(true);
    await deleteCloudClient(clientId);

    const loanIds = new Set(clientLoans.map((loan) => loan.id));
    state.clients = state.clients.filter((item) => item.id !== clientId);
    state.loans = state.loans.filter((loan) => loan.clientId !== clientId);
    state.payments = state.payments.filter((payment) => payment.clientId !== clientId && !loanIds.has(payment.loanId));

    saveState();
    render();
    window.alert("Cliente eliminado correctamente.");
  } catch (error) {
    if (isCloudMode()) {
      await reloadAfterCloudError();
    }
    window.alert(error.message || "No se pudo eliminar el cliente.");
  } finally {
    clientDeletionInProgress = false;
    setButtonBusy(actionButton, false);
  }
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
                <span data-label="Capital pendiente">${renderLoanPendingCapital(loan)}</span>
                <span data-label="Fecha prestada">${formatDate(loan.startDate)}</span>
                <span data-label="Fecha de cobro">${loan.status === "active" ? formatDate(loan.nextDueDate) : "Cerrado"}</span>
                <span class="row-actions" data-label="Acciones">
                  <button class="ghost-button small-button" type="button" data-edit-client="${client.id}" data-edit-loan="${loan.id}">${icons.edit} Editar</button>
                  ${paymentButton}
                  <button class="delete-button small-button" type="button" data-delete-client="${client.id}" data-delete-loan="${loan.id}">${icons.trash} Eliminar</button>
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

function openLoanDeleteDialog(clientId, loanId) {
  const client = state.clients.find((item) => item.id === clientId);
  const loan = state.loans.find((item) => item.id === loanId && item.clientId === clientId);
  if (!client || !loan || getLoansForClient(clientId)[0]?.id === loanId) return;

  pendingLoanDelete = { clientId, loanId };
  elements.loanDeleteSummary.textContent =
    "Estas seguro de que deseas eliminar esta ampliacion? Esta accion eliminara unicamente esta ampliacion y su historial asociado.";
  elements.loanDeleteDialog.showModal();
}

async function handleLoanDeleteSubmit(event) {
  event.preventDefault();
  if (!pendingLoanDelete || loanDeletionInProgress) return;

  const { clientId, loanId } = pendingLoanDelete;
  const submitButton = event.submitter || elements.loanDeleteForm.querySelector("button[type='submit']");
  loanDeletionInProgress = true;
  setButtonBusy(submitButton, true, "Eliminando...");

  try {
    await ensureAutomaticBackup(true);
    await deleteCloudLoanExtension(clientId, loanId);

    state.loans = state.loans.filter((loan) => loan.id !== loanId);
    state.payments = state.payments.filter((payment) => payment.loanId !== loanId);

    pendingLoanDelete = null;
    saveState();
    elements.loanDeleteDialog.close();
    render();
  } catch (error) {
    if (isCloudMode()) {
      await reloadAfterCloudError();
    }
    window.alert(error.message || "No se pudo eliminar la ampliacion.");
  } finally {
    loanDeletionInProgress = false;
    setButtonBusy(submitButton, false);
  }
}

function renderLoanPendingCapital(loan) {
  if (!loan) return "Sin prestamo";

  return `
    <span class="amount-stack">
      <strong>${money(loan.remainingCapital)}</strong>
      <small>Interes: ${roundMoney(loan.monthlyRate)}% ${getInterestModeShortLabel(loan.interestMode)}</small>
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

function openIntegrityDialog() {
  const findings = buildIntegrityFindings();
  elements.integritySummary.textContent = findings.length
    ? `Se encontraron ${findings.length} inconsistencia(s). No se modifico ningun dato.`
    : "Sin inconsistencias detectadas.";
  elements.integrityList.innerHTML = findings.length
    ? findings
        .map(
          (finding) => `
            <article class="history-item">
              <div>
                <strong>${escapeHTML(finding.title)}</strong>
                <span>${escapeHTML(finding.detail)}</span>
              </div>
              <span class="status-pill warn">${escapeHTML(finding.severity)}</span>
            </article>
          `
        )
        .join("")
    : `<div class="empty-state compact-empty">Sin inconsistencias detectadas.</div>`;
  elements.integrityDialog.showModal();
}

function buildIntegrityFindings() {
  const findings = [];
  validateStateIntegrity(state).forEach((error) => {
    findings.push({ title: "Integridad de datos", detail: error, severity: "Revisar" });
  });

  const paymentSignatures = new Map();
  state.payments.forEach((payment) => {
    const signature = [payment.loanId, payment.clientId, payment.date, payment.scheduledDueDate || "", payment.interestPaid || 0, payment.capitalPaid || 0].join("|");
    paymentSignatures.set(signature, (paymentSignatures.get(signature) || 0) + 1);
  });
  paymentSignatures.forEach((count, signature) => {
    if (count > 1) {
      findings.push({ title: "Pago duplicado sospechoso", detail: `${count} pagos comparten la misma firma: ${signature}.`, severity: "Medio" });
    }
  });

  const capitalPosition = buildCapitalPositionAtDate(todayISO());
  const reconciliationDifference = roundMoney(capitalPosition.capitalTotal - (capitalPosition.availableCapital + capitalPosition.capitalPlaced));
  if (Math.abs(reconciliationDifference) > 0.01) {
    findings.push({
      title: "Reconciliacion de capital",
      detail: `Capital total no cuadra con disponible + prestado. Diferencia: ${money(reconciliationDifference)}.`,
      severity: "Alto",
    });
  }

  if (state.user?.isAdmin) {
    adminState.loans.forEach((loan) => {
      if (loan.user_id && loan.client_id) {
        const client = adminState.clients.find((item) => item.id === loan.client_id);
        if (client && client.user_id !== loan.user_id) {
          findings.push({ title: "Registro de otro usuario", detail: `Prestamo ${loan.id} apunta a un cliente de otro usuario.`, severity: "Alto" });
        }
      }
    });
  }

  return findings;
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
      const amount = String(loan.remainingCapital);
      const formattedAmount = money(loan.remainingCapital).toLowerCase();
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
  elements.planRequestSummary.textContent = `${plan.label}: ${plan.price}/mes. Paga con Mercado Pago y tu plan se activara cuando el pago sea confirmado.`;
  elements.planRequestMessage.value = `Quiero activar el plan ${plan.label} para mi cuenta.`;
  elements.planTermsAccept.checked = false;
  elements.planRequestDialog.showModal();
}

async function handlePlanRequestSubmit(event) {
  event.preventDefault();
  const requestedPlan = elements.requestedPlan.value;
  const plan = PLAN_CATALOG[requestedPlan];
  if (!plan) return;

  if (!elements.planTermsAccept.checked) {
    window.alert("Debes aceptar los terminos y el cobro mensual para continuar.");
    return;
  }

  try {
    const checkoutUrl = await createPlanCheckout(requestedPlan, elements.planRequestMessage.value.trim());
    elements.planRequestDialog.close();
    window.location.href = checkoutUrl;
  } catch (error) {
    window.alert(error.message || "No se pudo iniciar el pago del plan.");
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
  $("#editLoanInterestMode").value = normalizeInterestMode(loan?.interestMode);
  $("#editLoanStartDate").value = loan ? loan.startDate : todayISO();
  $("#editLoanDueDate").value = loan ? loan.nextDueDate : getSuggestedDueDate(todayISO(), $("#editLoanInterestMode").value);
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
  $("#clientLoanInterestMode").value = "monthly";
  updateSuggestedDueDate("clientLoan");
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
  updateLoanLimitHint();

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
  updateLoanLimitHint();
}

function updateLoanLimitHint() {
  if (!elements.loanLimitHint) return;
  const isExtension = elements.clientFormMode.value === "extension";
  const selectedClient = isExtension ? getClient(elements.clientNameSelect.value) : null;
  const clientId = selectedClient?.id || "";
  const amount = toNumber($("#clientLoanAmount").value);
  const position = clientId ? getLoanFinancialPosition(clientId, amount) : null;
  const availableCapital = buildCapitalPositionAtDate(todayISO()).availableCapital;
  const capitalTip = "Muestra cuanto capital tienes libre para entregar en nuevos prestamos o ampliaciones. Si no alcanza, el sistema bloquea el desembolso.";

  if (isExtension && position) {
    elements.loanLimitHint.innerHTML = `
      <span>Capital pendiente del cliente: <strong>${money(position.currentClientPending)}</strong></span>
      <span>Capital disponible: <strong>${money(position.availableCapital)}</strong> ${renderInfoDot(capitalTip)}</span>
    `;
    return;
  }

  elements.loanLimitHint.innerHTML = `
    <span>Capital disponible: <strong>${money(availableCapital)}</strong> ${renderInfoDot(capitalTip)}</span>
  `;
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
  elements.paymentSummary.textContent = `Cobro programado: ${formatDate(loan.nextDueDate)}. Modalidad: ${getInterestModeLabel(loan.interestMode)}. Interes esperado: ${money(interest)}. Capital pendiente: ${money(loan.remainingCapital)}.`;
  elements.paymentDialog.showModal();
}

function openHistoryDialog(clientId) {
  const client = getClient(clientId);
  if (!client) return;

  const loans = getLoansForClient(clientId);
  const extensions = loans.filter((loan) => !isPrimaryLoan(loan));
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
    .sort((a, b) => {
      const leftType = normalizeOperationType(a.operationType);
      const rightType = normalizeOperationType(b.operationType);
      if (leftType === OPERATION_TYPES.principal && rightType !== OPERATION_TYPES.principal) return -1;
      if (rightType === OPERATION_TYPES.principal && leftType !== OPERATION_TYPES.principal) return 1;
      return compareLoansForOperationOrder(a, b);
    });
}

function getPrimaryLoanForClient(clientId) {
  const loans = getLoansForClient(clientId);
  return loans.find((loan) => normalizeOperationType(loan.operationType) === OPERATION_TYPES.principal) || loans[0] || null;
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
      loans.filter((loan) => !isPrimaryLoan(loan)).length,
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
      .filter((loan) => !isPrimaryLoan(loan))
      .map((loan, index) => [`Ampliacion ${index + 1}`, ...loanExcelRow(client, loan)])
  );

  const paymentRows = buildPaymentHistoryRows();
  const capitalPosition = buildCapitalPositionAtDate(todayISO());
  const capitalMovementRows = buildCapitalMovementRows();
  const summaryRows = [
    ["Clientes", state.clients.length],
    ["Prestamos registrados", state.loans.length],
    ["Ampliaciones registradas", state.loans.filter((loan) => !isPrimaryLoan(loan)).length],
    ["Cobros registrados", state.payments.length],
    ["Capital total", capitalPosition.capitalTotal],
    ["Capital disponible", capitalPosition.availableCapital],
    ["Capital agregado", capitalPosition.capitalDeposited],
    ["Capital retirado", capitalPosition.capitalWithdrawn],
    ["Ganancia reinvertida", capitalPosition.compoundedProfit],
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
    {
      name: "Capital",
      rows: [["Fecha", "Tipo", "Monto", "Nota"], ...capitalMovementRows],
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

function buildCapitalMovementRows() {
  return (state.capitalMovements || [])
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((movement) => [
      formatDate(movement.date),
      movement.type === "withdrawal" ? "Retiro" : "Aporte",
      Number(movement.amount || 0),
      movement.note || "",
    ]);
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
          ${(sheet.columns || []).map((width) => `<Column ss:AutoFitWidth="0" ss:Width="${Number(width) || 120}"/>`).join("")}
          ${sheet.rows
            .map(
              (row) => {
                const rowCells = Array.isArray(row) ? row : row.cells || [];
                const height = !Array.isArray(row) && row.height ? ` ss:AutoFitHeight="0" ss:Height="${Number(row.height)}"` : "";
                return `
                <Row${height}>${rowCells.map(excelCell).join("")}</Row>
              `;
              }
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
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#061826"/>
    </Style>
    <Style ss:ID="Title">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="18" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#00A76F" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Section">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#061826" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Header">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#061826"/>
      <Interior ss:Color="#E9F1F5" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#AFC8C4"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D8E2E0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D8E2E0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D8E2E0"/>
      </Borders>
    </Style>
    <Style ss:ID="MetaLabel">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#435565"/>
      <Interior ss:Color="#F3FAF7" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="MetaValue">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#061826"/>
      <Interior ss:Color="#F3FAF7" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Text">
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D8E2E0"/>
      </Borders>
    </Style>
    <Style ss:ID="Value">
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#061826"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D8E2E0"/>
      </Borders>
    </Style>
    <Style ss:ID="MoneyText">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#061826"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D8E2E0"/>
      </Borders>
    </Style>
    <Style ss:ID="Number">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#061826"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D8E2E0"/>
      </Borders>
    </Style>
    <Style ss:ID="Status">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#007A52"/>
      <Interior ss:Color="#EAF6EF" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D8E2E0"/>
      </Borders>
    </Style>
    <Style ss:ID="Muted">
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Italic="1" ss:Color="#6B7A86"/>
      <Interior ss:Color="#F4F7FB" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Blank">
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  ${worksheets.join("")}
</Workbook>`;
}

function excelCell(value) {
  const cell = value && typeof value === "object" && !Array.isArray(value) ? value : { value };
  const isNumber = typeof cell.value === "number" && Number.isFinite(cell.value);
  const style = cell.styleId ? ` ss:StyleID="${escapeXML(cell.styleId)}"` : "";
  const mergeAcross = Number(cell.mergeAcross || 0) > 0 ? ` ss:MergeAcross="${Number(cell.mergeAcross)}"` : "";
  return `<Cell${style}${mergeAcross}><Data ss:Type="${isNumber ? "Number" : "String"}">${escapeXML(isNumber ? String(cell.value) : cell.value ?? "")}</Data></Cell>`;
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
      const integrityErrors = validateStateIntegrity(imported);
      if (integrityErrors.length) {
        throw new Error(`La copia tiene datos inconsistentes:\n- ${integrityErrors.slice(0, 8).join("\n- ")}`);
      }
      const confirmed = window.confirm("Esta copia reemplazara los datos actuales de esta plataforma. Deseas continuar?");
      if (!confirmed) return;

      await ensureAutomaticBackup(true);
      Object.assign(state, imported);
      saveState();
      render();
      window.alert("Copia importada correctamente.");
    } catch (error) {
      window.alert(error.message || "No se pudo importar la copia. Revisa que sea un archivo JSON valido.");
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
  const interestMode = normalizeInterestMode($("#clientLoanInterestMode")?.value);
  if ($("#clientLoanStartDate")) $("#clientLoanStartDate").value = today;
  if ($("#clientLoanDueDate")) $("#clientLoanDueDate").value = getSuggestedDueDate(today, interestMode);
}

function expectedInterest(loan, payments = state.payments) {
  return calculateInterestForMode(
    loan.remainingCapital,
    loan.monthlyRate,
    normalizeInterestMode(loan.interestMode),
    getInterestPeriodDays(loan, payments),
    getInterestPeriodFactor(loan, payments)
  );
}

function getLoanExpectedInterest(loan, payments = state.payments) {
  return Number.isFinite(Number(loan?.expectedInterest)) ? Number(loan.expectedInterest) : expectedInterest(loan, payments);
}

function calculateInterestForMode(capital, monthlyRate, interestMode = "monthly", days = 1, periodFactor = null) {
  const mode = normalizeInterestMode(interestMode);
  const modeConfig = INTEREST_MODES[mode];
  const periodDays = Math.max(Number(days) || 1, 1);
  const hasPeriodFactor = periodFactor !== null && periodFactor !== undefined && Number.isFinite(Number(periodFactor));
  const factor = hasPeriodFactor ? Number(periodFactor) : mode === "daily" ? modeConfig.rateFactor * periodDays : modeConfig.rateFactor;
  return roundMoney(Number(capital || 0) * (Number(monthlyRate || 0) / 100) * factor);
}

function getInterestPeriodFactor(loan, payments = state.payments) {
  if (normalizeInterestMode(loan?.interestMode) !== "monthly" || !isFirstInterestPeriod(loan, payments)) {
    return null;
  }
  return calculateFirstPeriodInterestFactor(loan.startDate, loan.nextDueDate);
}

function calculateFirstPeriodInterestFactor(startDate, dueDate) {
  const calendarDays = Math.max(daysBetween(startDate, dueDate), 0);
  if (calendarDays >= 25) return 1;
  if (calendarDays >= 15) return 0.5;
  return 0;
}

function calculateFirstPeriodInterest(capital, monthlyRate, startDate, dueDate) {
  return calculateInterestForMode(capital, monthlyRate, "monthly", 1, calculateFirstPeriodInterestFactor(startDate, dueDate));
}

function isFirstInterestPeriod(loan, payments = state.payments) {
  return !(payments || []).some((payment) => payment.loanId === loan?.id);
}

function getInterestPeriodDays(loan, payments = state.payments) {
  if (normalizeInterestMode(loan?.interestMode) !== "daily") return 1;
  const latestPayment = (payments || [])
    .filter((payment) => payment.loanId === loan.id && payment.scheduledDueDate)
    .slice()
    .sort((a, b) => new Date(a.scheduledDueDate) - new Date(b.scheduledDueDate))
    .at(-1);
  const periodStart = latestPayment?.scheduledDueDate || loan.startDate;
  return Math.max(daysBetween(periodStart, loan.nextDueDate), 1);
}

function getSuggestedDueDate(startDate, interestMode) {
  const mode = normalizeInterestMode(interestMode);
  if (mode === "monthly") {
    return addOneMonthKeepingDay(startDate, getDayOfMonth(startDate));
  }
  return addDays(startDate, INTEREST_MODES[mode].days);
}

function updateSuggestedDueDate(prefix) {
  const startInput = $(`#${prefix}StartDate`);
  const modeInput = $(`#${prefix}InterestMode`);
  const dueInput = $(`#${prefix}DueDate`);
  if (!startInput || !modeInput || !dueInput || !startInput.value) return;
  dueInput.value = getSuggestedDueDate(startInput.value, modeInput.value);
}

function getNextDueDateAfterPayment(loan) {
  const mode = normalizeInterestMode(loan.interestMode);
  if (mode === "monthly") {
    return addOneMonthKeepingDay(loan.nextDueDate, loan.dueDay);
  }
  return addDays(loan.nextDueDate, INTEREST_MODES[mode].days);
}

function getInterestModeLabel(mode) {
  return INTEREST_MODES[normalizeInterestMode(mode)].label;
}

function getInterestModeShortLabel(mode) {
  return INTEREST_MODES[normalizeInterestMode(mode)].shortLabel;
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

function getMonthKeysForDashboardRange(range) {
  if (!range || range.invalid) return getLastMonthKeys(6);
  const start = parseLocalDate(range.start);
  const end = parseLocalDate(range.end);
  const months = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  const labelOptions = start.getFullYear() === end.getFullYear() ? { month: "short" } : { month: "short", year: "2-digit" };
  while (cursor <= endMonth) {
    months.push({
      key: getMonthKey(toISODate(cursor)),
      label: new Intl.DateTimeFormat("es-PE", labelOptions).format(cursor),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months.length ? months : getLastMonthKeys(6);
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

function addDays(dateString, dayCount) {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + Number(dayCount || 0));
  return toISODate(date);
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

function setButtonBusy(button, busy, busyText = "Procesando...") {
  if (!button) return;
  if (busy) {
    button.dataset.idleHtml = button.innerHTML;
    button.innerHTML = busyText;
    button.disabled = true;
    return;
  }
  button.innerHTML = button.dataset.idleHtml || button.innerHTML;
  button.disabled = false;
  delete button.dataset.idleHtml;
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

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function isNonNegativeMoney(value) {
  return isFiniteNumber(value) && Number(value) >= 0;
}

function isPositiveMoney(value) {
  return isFiniteNumber(value) && Number(value) > 0;
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
