const fs = require("fs");
const vm = require("vm");

const readText = (path) => fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");

const appCode = readText("app.js");
const htmlCode = readText("index.html");
const sqlCode = readText("supabase-financial-integrity.sql");
const schemaCode = readText("supabase-schema.sql");
const rlsCode = readText("supabase-rls-hardening.sql");
const stylesCode = readText("styles.css");
const cloudflareBuildCode = readText("scripts/build-cloudflare.js");
const wranglerCode = readText("wrangler.jsonc");
const workerCode = readText("src/worker.js");
const localStorageStore = new Map();

function createElement() {
  return {
    value: "",
    textContent: "",
    innerHTML: "",
    disabled: false,
    required: false,
    readOnly: false,
    open: false,
    dataset: {},
    children: [],
    classList: {
      add() {},
      remove() {},
      toggle() {},
    },
    addEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    closest() {
      return createElement();
    },
    querySelector() {
      return createElement();
    },
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
    focus() {},
    reset() {},
  };
}

const context = {
  console,
  Intl,
  Date,
  Math,
  Number,
  String,
  Boolean,
  Array,
  Object,
  Set,
  Map,
  RegExp,
  JSON,
  Blob: function Blob() {},
  URL: {
    createObjectURL() {
      return "blob:test";
    },
    revokeObjectURL() {},
  },
  window: {
    __PRESTAMOS_TEST__: true,
    crypto: {
      randomUUID() {
        return "00000000-0000-4000-8000-000000000000";
      },
    },
    alert() {},
    confirm() {
      return true;
    },
    clearTimeout() {},
    setTimeout() {
      return 1;
    },
  },
  document: {
    querySelector() {
      return createElement();
    },
    querySelectorAll() {
      return [];
    },
    createElement() {
      return createElement();
    },
    addEventListener() {},
    body: createElement(),
  },
  localStorage: {
    getItem(key) {
      return localStorageStore.has(key) ? localStorageStore.get(key) : null;
    },
    setItem(key, value) {
      localStorageStore.set(key, String(value));
    },
    removeItem(key) {
      localStorageStore.delete(key);
    },
  },
  SUPABASE_CONFIG: {
    url: "",
    anonKey: "",
  },
};
context.window.document = context.document;
context.window.localStorage = context.localStorage;

const tests = `
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message + " Esperado: " + expected + ". Recibido: " + actual);
  }
}

function assertMoney(actual, expected, message) {
  if (Math.abs(actual - expected) > 0.001) {
    throw new Error(message + " Esperado: " + expected + ". Recibido: " + actual);
  }
}

function assertThrows(callback, expectedText, message) {
  try {
    callback();
  } catch (error) {
    if (!expectedText || String(error.message || error).includes(expectedText)) return;
    throw new Error(message + " Error recibido: " + (error.message || error));
  }
  throw new Error(message + " No se lanzo ningun error.");
}

function testClient(id) {
  return {
    id,
    name: id,
    phone: "",
    note: "",
    createdAt: "2026-07-01T00:00:00.000Z",
  };
}

function testLoan(data) {
  return {
    id: data.id,
    clientId: data.clientId,
    amount: data.amount,
    remainingCapital: data.remainingCapital ?? data.amount,
    monthlyRate: data.monthlyRate ?? 10,
    interestMode: data.interestMode || "monthly",
    startDate: data.startDate,
    nextDueDate: data.nextDueDate,
    dueDay: Number((data.nextDueDate || data.startDate).slice(8, 10)),
    note: "",
    status: data.status || "active",
    operationType: data.operationType || null,
    parentLoanId: data.parentLoanId || null,
    createdAt: data.createdAt || data.startDate + "T00:00:00.000Z",
    closedAt: data.closedAt || null,
  };
}

function testPayment(data) {
  return {
    id: data.id,
    loanId: data.loanId,
    clientId: data.clientId,
    date: data.date,
    scheduledDueDate: data.scheduledDueDate || data.date,
    interestPaid: data.interestPaid || 0,
    expectedInterest: data.expectedInterest ?? data.interestPaid ?? 0,
    pendingInterest: data.pendingInterest || 0,
    periodStatus: data.periodStatus || "closed",
    capitalPaid: data.capitalPaid || 0,
    remainingCapitalAfter: data.remainingCapitalAfter || 0,
    nextDueDateAfter: data.nextDueDateAfter || null,
    note: "",
    createdAt: data.date + "T00:00:00.000Z",
  };
}

function testCapitalMovement(data) {
  return {
    id: data.id,
    type: data.type,
    amount: data.amount,
    date: data.date,
    note: "",
    createdAt: data.date + "T00:00:00.000Z",
  };
}

function resetTestState({ clients, loans, payments, capitalMovements }) {
  state = {
    user: { id: "u1", currency: "PEN" },
    subscription: createFreeSubscription("u1"),
    clients,
    loans,
    payments: payments || [],
    capitalMovements: capitalMovements || [],
  };
}

function buildTestDashboard(operation = "all") {
  return buildDashboardData({
    filters: { customStart: "2026-08-01", customEnd: "2026-08-31", compare: "none", operation },
    range: { start: "2026-08-01", end: "2026-08-31", label: "Agosto" },
    skipComparison: true,
  });
}

elements.authMode.value = "signup";
elements.authPassword.value = "abcdef";
elements.authConfirmPassword.value = "abcdef";
assertEqual(getConfirmPasswordMessage(true), "Las contraseñas coinciden.", "Confirmar contraseña prueba 1: valores iguales deben coincidir.");
assertEqual(validateSignupPasswords(), true, "Confirmar contraseña prueba 1: debe permitir continuar si coinciden.");
elements.authConfirmPassword.value = "abcdeg";
assertEqual(getConfirmPasswordMessage(true), "Las contraseñas no coinciden.", "Confirmar contraseña prueba 2: valores diferentes deben mostrar error.");
assertEqual(validateSignupPasswords(), false, "Confirmar contraseña prueba 2: debe bloquear si no coinciden.");
elements.authConfirmPassword.value = "";
assertEqual(getConfirmPasswordMessage(true), "Vuelve a escribir tu contraseña.", "Confirmar contraseña prueba 3: valor vacio debe solicitar confirmacion.");
assertEqual(validateSignupPasswords(), false, "Confirmar contraseña prueba 3: debe bloquear si esta vacio.");
elements.authPassword.value = "abc";
elements.authConfirmPassword.value = "abc";
assertEqual(getConfirmPasswordMessage(true), "", "Confirmar contraseña prueba 4: password corto no debe mostrar exito.");
assertEqual(validateSignupPasswords(), false, "Confirmar contraseña prueba 4: debe bloquear si no cumple minimo.");
elements.authPassword.value = "abcdef";
elements.authConfirmPassword.value = "abcdeg";
assertEqual(validateSignupPasswords(), false, "Confirmar contraseña prueba 5: inicialmente debe bloquear si esta diferente.");
elements.authConfirmPassword.value = "abcdef";
assertEqual(validateSignupPasswords(), true, "Confirmar contraseña prueba 5: al corregir debe permitir continuar.");

assertEqual(PLAN_CATALOG.free.clientLimit, 10, "Planes: Gratis debe limitar a 10 clientes.");
assertEqual(PLAN_CATALOG.basic.clientLimit, 50, "Planes: Basico debe limitar a 50 clientes.");
assertEqual(PLAN_CATALOG.pro.clientLimit, null, "Planes: Pro debe permitir clientes ilimitados.");
assertEqual(PLAN_CATALOG.free.features.length, 5, "Planes: Gratis debe mostrar 5 puntos.");
assertEqual(PLAN_CATALOG.basic.features.length, 5, "Planes: Basico debe mostrar 5 puntos.");
assertEqual(PLAN_CATALOG.pro.features.length, 5, "Planes: Pro debe mostrar 5 puntos.");
assertEqual(PLAN_CATALOG.free.features.slice(1).join("|"), PLAN_CATALOG.basic.features.slice(1).join("|"), "Planes: los beneficios de Gratis y Basico deben coincidir excepto cantidad de clientes.");
assertEqual(PLAN_CATALOG.basic.features.slice(1).join("|"), PLAN_CATALOG.pro.features.slice(1).join("|"), "Planes: los beneficios de Basico y Pro deben coincidir excepto cantidad de clientes.");

resetTestState({
  clients: [testClient("reglas")],
  loans: [
    testLoan({ id: "reglas-main", clientId: "reglas", amount: 500, monthlyRate: 10, startDate: "2026-08-01", nextDueDate: "2026-09-01", operationType: "principal" }),
  ],
  capitalMovements: [testCapitalMovement({ id: "reglas-capital", type: "deposit", amount: 2000, date: "2026-08-01" })],
});
let dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertMoney(state.loans[0].remainingCapital, 500, "Test 1: prestamo S/500 inicia con capital pendiente S/500.");
let preview = buildPaymentTransactionPreview(state.loans[0], {
  paymentDate: "2026-09-01",
  scheduledDueDate: "2026-09-01",
  interestPaid: 50,
  capitalPaid: 250,
});
state.loans[0] = preview.updatedLoan;
state.payments.push(preview.payment);
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertMoney(state.loans[0].remainingCapital, 250, "Test 2: pagar S/250 de capital deja S/250 pendiente.");
assertMoney(dashboard.metrics.realProfit, 50, "Test 2: ganancia real suma solo S/50 de interes.");
assertMoney(expectedInterest(state.loans[0]), 25, "Test 3: siguiente interes mensual es 10% de S/250.");
state.loans.push(testLoan({
  id: "reglas-ext",
  clientId: "reglas",
  amount: 300,
  monthlyRate: 10,
  startDate: "2026-09-02",
  nextDueDate: "2026-10-02",
  operationType: "ampliacion",
  parentLoanId: "reglas-main",
}));
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertMoney(dashboard.metrics.capitalPlaced, 550, "Test 4: capital actualmente prestado suma principal pendiente + ampliacion.");
assertMoney(dashboard.metrics.totalLentAccumulated, 800, "Test 4: total prestado acumulado suma desembolsos originales.");
state.loans[0].nextDueDate = addDays(todayISO(), -1);
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertMoney(dashboard.metrics.capitalPlaced, 550, "Test 5: prestamo vencido sigue contando como capital prestado.");
assertMoney(dashboard.metrics.overdueAmount, 250, "Test 5: monto vencido muestra solo capital pendiente vencido.");
assertMoney(calculateFirstPeriodInterest(500, 10, "2026-08-01", "2026-08-31"), 50, "Test 6: primer periodo mensual de 30 dias cobra 10%.");
assertMoney(calculateFirstPeriodInterest(500, 10, "2026-08-11", "2026-08-31"), 25, "Test 6: primer periodo mensual de 20 dias cobra 5%.");
assertMoney(calculateFirstPeriodInterest(500, 10, "2026-08-24", "2026-08-31"), 0, "Test 6: primer periodo mensual de 7 dias no cobra interes.");
assertMoney(getDisplayPeriodRate(testLoan({ id: "rate-monthly", clientId: "reglas", amount: 1000, monthlyRate: 15, interestMode: "monthly", startDate: "2026-08-01", nextDueDate: "2026-09-01" })), 15, "Tasa visual mensual: debe mostrar la tasa base completa.");
assertMoney(getDisplayPeriodRate(testLoan({ id: "rate-biweekly", clientId: "reglas", amount: 1000, monthlyRate: 15, interestMode: "biweekly", startDate: "2026-08-01", nextDueDate: "2026-08-16" })), 7.5, "Tasa visual quincenal: debe mostrar mitad de la tasa mensual.");
assertMoney(getDisplayPeriodRate(testLoan({ id: "rate-weekly", clientId: "reglas", amount: 1000, monthlyRate: 15, interestMode: "weekly", startDate: "2026-08-01", nextDueDate: "2026-08-08" })), 3.5, "Tasa visual semanal: debe mostrar tasa mensual x 7/30.");
assertMoney(getDisplayPeriodRate(testLoan({ id: "rate-daily", clientId: "reglas", amount: 1000, monthlyRate: 15, interestMode: "daily", startDate: "2026-08-01", nextDueDate: "2026-08-02" })), 0.5, "Tasa visual diaria: debe mostrar tasa mensual / 30.");
const rateMarkup = renderLoanPendingCapital(testLoan({ id: "rate-render", clientId: "reglas", amount: 1000, monthlyRate: 10, interestMode: "biweekly", startDate: "2026-08-01", nextDueDate: "2026-08-16" }));
assert(rateMarkup.includes("Tasa base: 10% mensual"), "Tasa visual: la tabla debe separar tasa base mensual.");
assert(rateMarkup.includes("Cobro quincenal: 5%"), "Tasa visual: la tabla debe mostrar el cobro quincenal real.");
assert(!rateMarkup.includes("Interes: 10% quincenal"), "Tasa visual: no debe mostrar el texto confuso anterior.");

resetTestState({
  clients: [testClient("hist-next")],
  loans: [
    testLoan({ id: "hist-next-loan", clientId: "hist-next", amount: 1000, remainingCapital: 1000, startDate: "2026-01-01", nextDueDate: "2026-04-01" }),
  ],
  payments: [
    testPayment({ id: "hist-next-p1", loanId: "hist-next-loan", clientId: "hist-next", date: "2026-02-01", scheduledDueDate: "2026-02-01", interestPaid: 100, nextDueDateAfter: "2026-03-01" }),
    testPayment({ id: "hist-next-p2", loanId: "hist-next-loan", clientId: "hist-next", date: "2026-03-01", scheduledDueDate: "2026-03-01", interestPaid: 100, nextDueDateAfter: "2026-04-01" }),
  ],
});
let historicalSnapshot = loanSnapshotAtDate(state.loans[0], "2026-01-15", state.payments);
assertEqual(historicalSnapshot.nextDueDate, "2026-02-01", "Historico 1: antes del primer pago debe usar el primer scheduledDueDate, no el nextDueDate actual.");
historicalSnapshot = loanSnapshotAtDate(state.loans[0], "2026-02-15", state.payments);
assertEqual(historicalSnapshot.nextDueDate, "2026-03-01", "Historico 2: despues del primer pago debe usar nextDueDateAfter.");
historicalSnapshot = loanSnapshotAtDate(state.loans[0], "2026-03-15", state.payments);
assertEqual(historicalSnapshot.nextDueDate, "2026-04-01", "Historico 3: despues del segundo pago debe usar el siguiente nextDueDateAfter.");

resetTestState({
  clients: [testClient("hist-atraso")],
  loans: [
    testLoan({ id: "hist-atraso-loan", clientId: "hist-atraso", amount: 1000, remainingCapital: 1000, startDate: "2026-05-15", nextDueDate: "2026-07-15" }),
  ],
  payments: [
    testPayment({ id: "hist-atraso-p1", loanId: "hist-atraso-loan", clientId: "hist-atraso", date: "2026-06-20", scheduledDueDate: "2026-06-15", interestPaid: 100, nextDueDateAfter: "2026-07-15" }),
  ],
});
historicalSnapshot = loanSnapshotAtDate(state.loans[0], "2026-06-18", state.payments);
assertEqual(historicalSnapshot.nextDueDate, "2026-06-15", "Historico atraso: antes del pago tardio debe conservar la fecha vencida.");
assertEqual(isOverdueAt(historicalSnapshot, "2026-06-18"), true, "Historico atraso: el prestamo debe estar vencido antes del pago tardio.");
historicalSnapshot = loanSnapshotAtDate(state.loans[0], "2026-06-20", state.payments);
assertEqual(historicalSnapshot.nextDueDate, "2026-07-15", "Historico atraso: el dia del pago ya debe usar el siguiente cobro.");
assertEqual(isOverdueAt(historicalSnapshot, "2026-06-20"), false, "Historico atraso: el dia del pago ya no debe figurar vencido.");

resetTestState({
  clients: [testClient("hist-cierre")],
  loans: [
    testLoan({ id: "hist-cierre-loan", clientId: "hist-cierre", amount: 1000, remainingCapital: 0, startDate: "2026-07-20", nextDueDate: null, status: "closed", closedAt: "2026-08-20" }),
  ],
  payments: [
    testPayment({ id: "hist-cierre-p1", loanId: "hist-cierre-loan", clientId: "hist-cierre", date: "2026-08-20", scheduledDueDate: "2026-08-20", interestPaid: 100, capitalPaid: 1000, remainingCapitalAfter: 0, nextDueDateAfter: null }),
  ],
});
historicalSnapshot = loanSnapshotAtDate(state.loans[0], "2026-08-19", state.payments);
assertEqual(historicalSnapshot.status, "active", "Historico cierre: antes del cierre debe seguir activo.");
assertMoney(historicalSnapshot.remainingCapital, 1000, "Historico cierre: antes del cierre debe reconstruir el capital pendiente.");
assertEqual(historicalSnapshot.nextDueDate, "2026-08-20", "Historico cierre: antes del cierre debe mostrar el vencimiento vigente.");
historicalSnapshot = loanSnapshotAtDate(state.loans[0], "2026-08-20", state.payments);
assertEqual(historicalSnapshot.status, "closed", "Historico cierre: el dia del pago total debe aparecer cerrado.");
assertMoney(historicalSnapshot.remainingCapital, 0, "Historico cierre: el dia del cierre debe quedar en cero.");
assertEqual(historicalSnapshot.nextDueDate, null, "Historico cierre: un prestamo cerrado no debe tener proxima fecha.");

[
  { mode: "biweekly", startDate: "2026-06-01", firstDue: "2026-06-16", secondDue: "2026-07-01", queryDate: "2026-06-20" },
  { mode: "weekly", startDate: "2026-06-01", firstDue: "2026-06-08", secondDue: "2026-06-15", queryDate: "2026-06-09" },
  { mode: "daily", startDate: "2026-06-01", firstDue: "2026-06-02", secondDue: "2026-06-03", queryDate: "2026-06-02" },
].forEach((item) => {
  const loan = testLoan({ id: "hist-" + item.mode, clientId: "hist-modos", amount: 500, remainingCapital: 500, interestMode: item.mode, startDate: item.startDate, nextDueDate: item.secondDue });
  const payments = [
    testPayment({ id: "hist-" + item.mode + "-p1", loanId: loan.id, clientId: "hist-modos", date: item.firstDue, scheduledDueDate: item.firstDue, interestPaid: 10, nextDueDateAfter: item.secondDue }),
  ];
  const snapshot = loanSnapshotAtDate(loan, item.queryDate, payments);
  assertEqual(snapshot.nextDueDate, item.secondDue, "Historico " + item.mode + ": debe usar payments.nextDueDateAfter sin depender de la modalidad.");
});

const legacyLoan = testLoan({ id: "hist-legacy", clientId: "hist-legacy", amount: 500, remainingCapital: 500, startDate: "2026-01-01", nextDueDate: "2026-04-01" });
const legacyPayments = [
  testPayment({ id: "hist-legacy-p1", loanId: "hist-legacy", clientId: "hist-legacy", date: "2026-02-01", scheduledDueDate: "2026-02-01", interestPaid: 50, nextDueDateAfter: null }),
  testPayment({ id: "hist-legacy-p2", loanId: "hist-legacy", clientId: "hist-legacy", date: "2026-03-01", scheduledDueDate: "2026-03-01", interestPaid: 50, nextDueDateAfter: "2026-04-01" }),
];
assertEqual(getLoanHistoricalNextDueDate(legacyLoan, "2026-02-15", legacyPayments), "2026-03-01", "Historico legacy: si falta nextDueDateAfter debe usar el siguiente scheduledDueDate.");

resetTestState({
  clients: [testClient("hist-dashboard")],
  loans: [
    testLoan({ id: "hist-dashboard-loan", clientId: "hist-dashboard", amount: 1000, remainingCapital: 1000, startDate: "2026-05-15", nextDueDate: "2026-09-15" }),
  ],
  payments: [
    testPayment({ id: "hist-dashboard-p1", loanId: "hist-dashboard-loan", clientId: "hist-dashboard", date: "2026-07-05", scheduledDueDate: "2026-06-15", interestPaid: 100, nextDueDateAfter: "2026-07-15" }),
    testPayment({ id: "hist-dashboard-p2", loanId: "hist-dashboard-loan", clientId: "hist-dashboard", date: "2026-07-15", scheduledDueDate: "2026-07-15", interestPaid: 100, nextDueDateAfter: "2026-08-15" }),
    testPayment({ id: "hist-dashboard-p3", loanId: "hist-dashboard-loan", clientId: "hist-dashboard", date: "2026-08-15", scheduledDueDate: "2026-08-15", interestPaid: 100, nextDueDateAfter: "2026-09-15" }),
  ],
});
dashboard = buildDashboardData({ filters: { customStart: "2026-06-01", customEnd: "2026-06-30", compare: "none", operation: "all" }, skipComparison: true });
assertEqual(dashboard.activeLoans[0].nextDueDate, "2026-06-15", "Dashboard historico: al 30/06 debe usar el vencimiento historico, no 15/09 actual.");
assertEqual(dashboard.metrics.overdueLoans, 1, "Dashboard historico: prestamos vencidos debe usar snapshot historico.");
assertMoney(dashboard.metrics.overdueAmount, 1000, "Dashboard historico: monto vencido debe usar snapshot historico.");
assertEqual(dashboard.metrics.lateClients, 1, "Dashboard historico: clientes atrasados debe usar snapshot historico.");
assertMoney(dashboard.metrics.capitalRisk, 1000, "Dashboard historico: capital en riesgo debe usar snapshot historico.");
assertMoney(dashboard.metrics.delinquencyRate, 100, "Dashboard historico: porcentaje de morosidad debe usar snapshot historico.");
assertEqual(dashboard.charts.statusSegments.find((segment) => segment.label === "Vencidos")?.value, 1, "Dashboard historico: cartera por estado debe usar snapshot historico.");
assertEqual(dashboard.charts.delinquency[0]?.value, 1, "Dashboard historico: tendencia de morosidad debe usar snapshot historico.");

resetTestState({
  clients: [testClient("sin-limite")],
  loans: [
    testLoan({ id: "sin-limite-main", clientId: "sin-limite", amount: 700, remainingCapital: 700, startDate: "2026-08-01", nextDueDate: "2026-09-01", operationType: "principal" }),
  ],
  capitalMovements: [testCapitalMovement({ id: "sin-limite-capital", type: "deposit", amount: 2000, date: "2026-08-01" })],
});
let limitCheck = validateLoanFinancialLimits("sin-limite", 500);
assertEqual(limitCheck.ok, true, "Regla actual: cliente con S/700 pendientes puede ampliar S/500 si hay capital disponible.");
resetTestState({
  clients: [testClient("caja"), testClient("nuevo")],
  loans: [
    testLoan({ id: "caja-main", clientId: "caja", amount: 500, remainingCapital: 500, startDate: "2026-08-01", nextDueDate: "2026-09-01", operationType: "principal" }),
  ],
  capitalMovements: [testCapitalMovement({ id: "caja-capital", type: "deposit", amount: 700, date: "2026-08-01" })],
});
limitCheck = validateLoanFinancialLimits("nuevo", 500);
assertEqual(limitCheck.ok, false, "Test 8: no se puede prestar S/500 si solo hay S/200 disponible.");

resetTestState({
  clients: [testClient("captura")],
  loans: [
    testLoan({ id: "captura-main", clientId: "captura", amount: 50, remainingCapital: 50, startDate: "2026-09-06", nextDueDate: "2026-10-06", operationType: "principal" }),
  ],
  capitalMovements: [testCapitalMovement({ id: "captura-capital", type: "deposit", amount: 2000, date: "2026-09-01" })],
});
limitCheck = validateLoanFinancialLimits("captura", 960);
assertEqual(limitCheck.ok, true, "Captura: S/50 pendiente + ampliacion S/960 debe permitirse si hay capital disponible.");

preview = buildPaymentTransactionPreview(testLoan({ id: "cierra-total", clientId: "caja", amount: 500, remainingCapital: 500, startDate: "2026-08-01", nextDueDate: "2026-09-01", operationType: "principal" }), {
  paymentDate: "2026-09-01",
  scheduledDueDate: "2026-09-01",
  interestPaid: 50,
  capitalPaid: 500,
});
assertMoney(preview.updatedLoan.remainingCapital, 0, "Test 9: pago total deja capital pendiente cero.");
assertEqual(preview.updatedLoan.status, "closed", "Test 9: pago total cierra el prestamo.");
assertEqual(preview.updatedLoan.nextDueDate, null, "Test 9: prestamo cerrado deja nextDueDate null.");

resetTestState({
  clients: [testClient("parcial")],
  loans: [
    testLoan({ id: "parcial-main", clientId: "parcial", amount: 1000, remainingCapital: 1000, monthlyRate: 10, startDate: "2026-08-01", nextDueDate: "2026-09-01", operationType: "principal" }),
  ],
  capitalMovements: [testCapitalMovement({ id: "parcial-capital", type: "deposit", amount: 2000, date: "2026-08-01" })],
});
preview = buildPaymentTransactionPreview(state.loans[0], {
  paymentDate: "2026-09-01",
  scheduledDueDate: "2026-09-01",
  interestPaid: 20,
  capitalPaid: 0,
});
assertMoney(preview.payment.expectedInterest, 100, "Pago parcial: debe guardar el interes esperado del periodo.");
assertMoney(preview.payment.pendingInterest, 80, "Pago parcial: debe guardar el interes pendiente.");
assertEqual(preview.payment.periodStatus, "partial", "Pago parcial: el periodo queda parcial.");
assertEqual(preview.updatedLoan.nextDueDate, "2026-09-01", "Pago parcial: no debe avanzar la fecha de cobro.");
state.loans[0] = preview.updatedLoan;
state.payments.push(preview.payment);
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertMoney(dashboard.metrics.projectedProfit, 80, "Pago parcial: la ganancia proyectada debe mostrar solo el interes pendiente.");
preview = buildPaymentTransactionPreview(state.loans[0], {
  paymentDate: "2026-09-02",
  scheduledDueDate: "2026-09-01",
  interestPaid: 0,
  capitalPaid: 300,
});
assertMoney(preview.payment.expectedInterest, 100, "Abono a capital: debe conservar el interes esperado original.");
assertMoney(preview.payment.pendingInterest, 80, "Abono a capital: no debe perdonar el interes pendiente.");
assertEqual(preview.payment.periodStatus, "capital_only", "Abono a capital: debe distinguirse del pago del periodo.");
assertMoney(preview.updatedLoan.remainingCapital, 700, "Abono a capital: debe reducir capital pendiente.");
assertEqual(preview.updatedLoan.nextDueDate, "2026-09-01", "Abono a capital: no debe avanzar la fecha de cobro.");
state.loans[0] = preview.updatedLoan;
state.payments.push(preview.payment);
preview = buildPaymentTransactionPreview(state.loans[0], {
  paymentDate: "2026-09-03",
  scheduledDueDate: "2026-09-01",
  interestPaid: 80,
  capitalPaid: 0,
});
assertMoney(preview.payment.pendingInterest, 0, "Cierre de periodo: al pagar lo pendiente debe quedar en cero.");
assertEqual(preview.payment.periodStatus, "closed", "Cierre de periodo: debe marcar el periodo como cerrado.");
assertEqual(preview.updatedLoan.nextDueDate, "2026-10-01", "Cierre de periodo: recien ahi debe avanzar la fecha.");
assertThrows(
  () => buildPaymentTransactionPreview(state.loans[0], { paymentDate: "2026-09-04", scheduledDueDate: "2026-09-01", interestPaid: 90, capitalPaid: 700 }),
  "superar el interes pendiente",
  "Pago parcial: no debe permitir pagar mas interes que el pendiente del periodo."
);

resetTestState({
  clients: [testClient("flujo")],
  loans: [
    testLoan({ id: "flujo-main", clientId: "flujo", amount: 1000, remainingCapital: 850, startDate: "2026-08-02", nextDueDate: "2026-09-02", operationType: "principal" }),
  ],
  payments: [testPayment({ id: "flujo-pago", loanId: "flujo-main", clientId: "flujo", date: "2026-08-15", interestPaid: 50, capitalPaid: 100 })],
  capitalMovements: [
    testCapitalMovement({ id: "flujo-aporte", type: "deposit", amount: 2000, date: "2026-08-01" }),
    testCapitalMovement({ id: "flujo-retiro", type: "withdrawal", amount: 300, date: "2026-08-20" }),
  ],
});
dashboard = buildDashboardData({ filters: { customStart: "2026-08-01", customEnd: "2026-08-31", compare: "none", operation: "all" }, skipComparison: true });
assertMoney(dashboard.metrics.cashflow, 850, "Test 13: flujo debe ser +2000 -1000 +150 -300 = +850.");
dashboard = buildDashboardData({ filters: { customStart: "2026-01-01", customEnd: "2026-03-31", compare: "none", operation: "all" }, skipComparison: true });
assertEqual(dashboard.charts.months.length, 3, "Test 14: grafico enero-marzo debe tener tres meses.");
assert(dashboard.charts.months[0].label.toLowerCase().startsWith("ene"), "Test 14: primer mes debe ser enero.");
assert(dashboard.charts.months[2].label.toLowerCase().startsWith("mar"), "Test 14: tercer mes debe ser marzo.");

resetTestState({
  clients: [testClient("mora-enero"), testClient("mora-marzo")],
  loans: [
    testLoan({ id: "mora-enero-loan", clientId: "mora-enero", amount: 100, remainingCapital: 0, startDate: "2026-01-01", nextDueDate: "2026-01-15", status: "closed", closedAt: "2026-02-15" }),
    testLoan({ id: "mora-marzo-loan", clientId: "mora-marzo", amount: 200, remainingCapital: 200, startDate: "2026-02-10", nextDueDate: "2026-03-05" }),
  ],
  payments: [testPayment({ id: "mora-enero-payment", loanId: "mora-enero-loan", clientId: "mora-enero", date: "2026-02-15", capitalPaid: 100, remainingCapitalAfter: 0 })],
});
dashboard = buildDashboardData({ filters: { customStart: "2026-01-01", customEnd: "2026-03-31", compare: "none", operation: "all" }, skipComparison: true });
assertEqual(dashboard.charts.delinquency[0].value, 1, "Tendencia de morosidad: enero debe contar el vencido activo al cierre de enero.");
assertEqual(dashboard.charts.delinquency[1].value, 0, "Tendencia de morosidad: febrero no debe arrastrar vencidos ya cerrados ni anticipar marzo.");
assertEqual(dashboard.charts.delinquency[2].value, 1, "Tendencia de morosidad: marzo debe contar el vencido activo al cierre de marzo.");
let chartContainer = document.createElement("div");
renderSimpleBarChart(chartContainer, [{ label: "ene", value: 10 }], "money");
assert(chartContainer.innerHTML.includes("S/"), "Grafico de prestamos por mes: valores pequenos tambien deben mostrarse como dinero.");
renderSimpleBarChart(chartContainer, [{ label: "morosos", value: 21 }], "number");
assert(!chartContainer.innerHTML.includes("S/"), "Grafico de morosidad: cantidades grandes no deben mostrarse como dinero.");

resetTestState({
  clients: [testClient("ops")],
  loans: [
    testLoan({ id: "ops-main", clientId: "ops", amount: 400, startDate: "2026-08-01", nextDueDate: "2026-09-01", operationType: "principal" }),
    testLoan({ id: "ops-ext-1", clientId: "ops", amount: 100, startDate: "2026-08-02", nextDueDate: "2026-09-02", operationType: "ampliacion", parentLoanId: "ops-main" }),
    testLoan({ id: "ops-ext-2", clientId: "ops", amount: 100, startDate: "2026-08-03", nextDueDate: "2026-09-03", operationType: "ampliacion", parentLoanId: "ops-main" }),
    testLoan({ id: "ops-ext-3", clientId: "ops", amount: 100, startDate: "2026-08-04", nextDueDate: "2026-09-04", operationType: "ampliacion", parentLoanId: "ops-main" }),
  ],
});
assertEqual(getLoansForClient("ops").filter(isPrimaryLoan).length, 1, "Test 15: debe existir un unico principal explicito.");
assertEqual(getLoansForClient("ops").filter((loan) => !isPrimaryLoan(loan)).length, 3, "Test 15: deben existir tres ampliaciones explicitas.");

const orphanExtensionLoans = normalizeLoans([
  testLoan({
    id: "ops-orphan-ext",
    clientId: "ops-orphan",
    amount: 350,
    remainingCapital: 350,
    startDate: "2026-08-05",
    nextDueDate: "2026-09-05",
    operationType: "ampliacion",
    parentLoanId: null,
  }),
]);
resetTestState({
  clients: [testClient("ops-orphan")],
  loans: orphanExtensionLoans,
});
assertEqual(orphanExtensionLoans[0].operationType, "ampliacion", "Test 15: una ampliacion sin principal no debe convertirse en principal.");
assertEqual(getPrimaryLoanForClient("ops-orphan"), null, "Test 15: cliente con solo ampliaciones no debe inventar prestamo principal.");
assertEqual(isPrimaryLoan(state.loans[0]), false, "Test 15: ampliacion huerfana debe seguir siendo ampliacion.");
assertEqual(
  validateStateIntegrity({ user: null, subscription: null, clients: state.clients, loans: state.loans, payments: [] }).length,
  0,
  "Test 15: la auditoria debe aceptar ampliaciones pendientes aunque el principal se haya eliminado."
);

resetTestState({
  clients: [testClient("atraviesa"), testClient("cerrado")],
  loans: [
    testLoan({ id: "loan-cross", clientId: "atraviesa", amount: 500, startDate: "2026-07-15", nextDueDate: "2026-09-15" }),
    testLoan({ id: "loan-closed", clientId: "cerrado", amount: 300, remainingCapital: 0, startDate: "2026-07-01", nextDueDate: "2026-07-20", status: "closed", closedAt: "2026-07-20" }),
  ],
});
dashboard = buildTestDashboard();
assertEqual(dashboard.metrics.activeLoans, 1, "Prueba A/B: solo el prestamo que atraviesa agosto debe estar activo al cierre.");
assertMoney(dashboard.metrics.capitalPending, 500, "Prueba A: capital pendiente del prestamo que atraviesa el periodo.");
assertEqual(dashboard.metrics.activeClientCount, 1, "Prueba A: cliente activo al cierre del periodo.");

resetTestState({
  clients: [testClient("capital")],
  loans: [testLoan({ id: "capital-loan", clientId: "capital", amount: 1000, remainingCapital: 800, startDate: "2026-08-01", nextDueDate: "2026-09-01" })],
  payments: [testPayment({ id: "capital-payment", loanId: "capital-loan", clientId: "capital", date: "2026-08-15", interestPaid: 100, capitalPaid: 200 })],
  capitalMovements: [
    testCapitalMovement({ id: "capital-seed", type: "deposit", amount: 1500, date: "2026-08-01" }),
    testCapitalMovement({ id: "capital-withdrawal", type: "withdrawal", amount: 300, date: "2026-08-20" }),
  ],
});
dashboard = buildTestDashboard();
assertMoney(dashboard.metrics.capitalTotal, 1300, "Capital compuesto: aporte + interes cobrado - retiro.");
assertMoney(dashboard.metrics.availableCapital, 500, "Capital compuesto: disponible = capital total - capital pendiente activo.");
const indicatorItems = getDashboardIndicatorItems(dashboard);
const availableCapitalIndicator = getDashboardKpiItems(dashboard).find((item) => item.title === "Capital disponible");
assert(availableCapitalIndicator?.tip.startsWith("Ejemplo:"), "Capital disponible: el tooltip debe comenzar con Ejemplo.");
assert(availableCapitalIndicator?.tip.includes("intereses ya cobrados"), "Capital disponible: el tooltip debe explicar que incluye intereses cobrados.");
assert(availableCapitalIndicator?.tip.includes("no lo prestas ni lo retiras"), "Capital disponible: el tooltip debe explicar cuando aumenta por intereses.");
const expectedIndicatorCount =
  getDashboardKpiItems(dashboard).length + getDashboardManagementItems(dashboard).length + getDashboardAdvancedItems(dashboard).length;
assertEqual(indicatorItems.length, expectedIndicatorCount, "Resumen: la seccion Indicadores debe conservar todos los indicadores.");
assertEqual(new Set(indicatorItems.map((item) => item.indicatorId)).size, indicatorItems.length, "Resumen: cada indicador debe tener un ID unico para ordenar.");
assert(!getDashboardKpiItems(dashboard).some((item) => item.title === "Capital pendiente"), "Resumen: Capital pendiente no debe mostrarse como tarjeta KPI.");
assert(!getDashboardKpiItems(dashboard).some((item) => item.title === "Capital recuperado"), "Resumen: Capital recuperado no debe mostrarse como tarjeta KPI.");
assertMoney(dashboard.metrics.capitalRecovered, 200, "Capital recuperado debe conservarse como metrica interna para calculos.");
assert(!getDashboardKpiItems(dashboard).some((item) => item.title === "Total por cobrar"), "Resumen: Total por cobrar no debe mostrarse como tarjeta KPI.");
assertMoney(dashboard.metrics.totalToCollect, 880, "Total por cobrar debe conservarse como metrica interna para calculos.");
assert(getDashboardKpiReportItems(dashboard).some((item) => item.title === "Total por cobrar"), "Exportaciones: Total por cobrar debe seguir disponible en la lista interna de reporte.");
assert(!getDashboardKpiItems(dashboard).some((item) => item.title === "Ampliaciones activas"), "Resumen: Ampliaciones activas no debe mostrarse como tarjeta KPI.");
assert(getDashboardKpiReportItems(dashboard).some((item) => item.title === "Ampliaciones activas"), "Exportaciones: Ampliaciones activas debe seguir disponible en la lista interna de reporte.");
const hiddenManagementTitles = [
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
];
hiddenManagementTitles.forEach((title) => {
  assert(!getDashboardManagementItems(dashboard).some((item) => item.title === title), "Resumen: " + title + " no debe mostrarse como indicador visual.");
  assert(getDashboardManagementReportItems(dashboard).some((item) => item.title === title), "Exportaciones: " + title + " debe seguir disponible en la lista interna de reporte.");
});
["Capital agregado", "Capital retirado", "Total prestado acumulado", "Clientes atrasados", "Capital en riesgo", "Flujo de caja"].forEach((title) => {
  assert(getDashboardManagementItems(dashboard).some((item) => item.title === title), "Resumen: " + title + " debe seguir visible.");
});
const hiddenAdvancedTitles = ["Rendimiento proyectado de cartera"];
hiddenAdvancedTitles.forEach((title) => {
  assert(!getDashboardAdvancedItems(dashboard).some((item) => item.title === title), "Resumen: " + title + " no debe mostrarse como indicador visual.");
  assert(getDashboardAdvancedReportItems(dashboard).some((item) => item.title === title), "Exportaciones: " + title + " debe seguir disponible en la lista interna de reporte.");
});
assert(getDashboardAdvancedItems(dashboard).some((item) => item.title === "Cliente mas rentable"), "Resumen: Cliente mas rentable debe seguir visible.");
saveIndicatorOrder([
  "ganancia-reinvertida",
  "ampliaciones-del-periodo",
  "cobrado-en-el-periodo",
  "interes-pendiente",
  "rendimiento-proyectado-de-cartera",
  "capital-agregado",
]);
const orderedItemsAfterHiddenRemoval = getOrderedDashboardIndicatorItems(dashboard);
assert(!orderedItemsAfterHiddenRemoval.some((item) => item.title === "Ganancia reinvertida"), "Orden guardado: debe ignorar Ganancia reinvertida eliminada visualmente.");
assert(!orderedItemsAfterHiddenRemoval.some((item) => item.title === "Ampliaciones del periodo"), "Orden guardado: debe ignorar Ampliaciones del periodo eliminada visualmente.");
assert(!orderedItemsAfterHiddenRemoval.some((item) => item.title === "Cobrado en el periodo"), "Orden guardado: debe ignorar Cobrado en el periodo eliminado visualmente.");
assert(!orderedItemsAfterHiddenRemoval.some((item) => item.title === "Interes pendiente"), "Orden guardado: debe ignorar Interes pendiente eliminado visualmente.");
assert(!orderedItemsAfterHiddenRemoval.some((item) => item.title === "Rendimiento proyectado de cartera"), "Orden guardado: debe ignorar Rendimiento proyectado de cartera eliminado visualmente.");
assertEqual(orderedItemsAfterHiddenRemoval[0].title, "Capital agregado", "Orden guardado: debe conservar los indicadores visibles restantes.");
const capitalPrestadoIndicator = getDashboardKpiItems(dashboard).find((item) => item.title === "Capital actualmente prestado");
assert(capitalPrestadoIndicator?.tip.startsWith("Ejemplo:"), "Capital actualmente prestado: el tooltip debe comenzar con Ejemplo.");
assert(capitalPrestadoIndicator?.tip.includes("Los préstamos vencidos también cuentan"), "Capital actualmente prestado: el tooltip debe aclarar que vencidos siguen contando.");
const totalPrestadoAcumuladoIndicator = getDashboardManagementItems(dashboard).find((item) => item.title === "Total prestado acumulado");
assert(totalPrestadoAcumuladoIndicator?.tip.startsWith("Ejemplo:"), "Total prestado acumulado: el tooltip debe comenzar con Ejemplo.");
assert(totalPrestadoAcumuladoIndicator?.tip.includes("no disminuye cuando devuelven capital"), "Total prestado acumulado: el tooltip debe aclarar que no baja por devoluciones.");
saveIndicatorOrder(["prestado-en-el-periodo", "capital-prestado"]);
const orderedRenamedItems = getOrderedDashboardIndicatorItems(dashboard);
assertEqual(orderedRenamedItems[0].title, "Total prestado acumulado", "Orden guardado: debe migrar Prestado en el periodo al nuevo indicador acumulado.");
assertEqual(orderedRenamedItems[1].title, "Capital actualmente prestado", "Orden guardado: debe migrar Capital prestado al nuevo nombre.");
const capitalAddedIndicator = indicatorItems.find((item) => item.title === "Capital agregado");
assert(capitalAddedIndicator?.tip === "Aquí te figura solo los aportes que realizas. NO cuenta los intereses.", "Capital agregado: el texto explicativo debe estar en el tooltip.");
assert(!getIndicatorMessages("Capital agregado").includes(capitalAddedIndicator.tip), "Capital agregado: la frase del tooltip no debe reemplazar los mensajes dinamicos inferiores.");

const yesterday = addDays(todayISO(), -1);
resetTestState({
  clients: [testClient("capital-prestado")],
  loans: [
    testLoan({ id: "capital-prestado-main", clientId: "capital-prestado", amount: 1000, remainingCapital: 1000, startDate: "2026-08-01", nextDueDate: todayISO() }),
  ],
});
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertMoney(dashboard.metrics.capitalPlaced, 1000, "Capital prestado prueba 1: prestamo sin pagos debe contar completo.");
state.payments = [testPayment({ id: "capital-prestado-interest", loanId: "capital-prestado-main", clientId: "capital-prestado", date: todayISO(), interestPaid: 100 })];
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertMoney(dashboard.metrics.capitalPlaced, 1000, "Capital prestado prueba 2: pago solo de interes no reduce capital prestado.");
state.loans[0].remainingCapital = 800;
state.payments.push(testPayment({ id: "capital-prestado-capital", loanId: "capital-prestado-main", clientId: "capital-prestado", date: todayISO(), capitalPaid: 200, remainingCapitalAfter: 800 }));
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertMoney(dashboard.metrics.capitalPlaced, 800, "Capital prestado prueba 3: amortizacion de capital debe reducir el indicador.");
state.loans[0].nextDueDate = yesterday;
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertMoney(dashboard.metrics.capitalPlaced, 800, "Capital prestado prueba 4: prestamo vencido sigue contando mientras debe capital.");
state.loans.push(testLoan({ id: "capital-prestado-extension", clientId: "capital-prestado", amount: 300, remainingCapital: 300, startDate: "2026-08-02", nextDueDate: todayISO() }));
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertMoney(dashboard.metrics.capitalPlaced, 1100, "Capital prestado prueba 5: ampliacion activa debe sumarse.");
state.loans[1].remainingCapital = 200;
state.payments.push(testPayment({ id: "capital-prestado-extension-capital", loanId: "capital-prestado-extension", clientId: "capital-prestado", date: todayISO(), capitalPaid: 100, remainingCapitalAfter: 200 }));
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertMoney(dashboard.metrics.capitalPlaced, 1000, "Capital prestado prueba 6: amortizacion de ampliacion debe reducir el indicador.");
state.loans.forEach((loan) => {
  loan.remainingCapital = 0;
  loan.status = "closed";
  loan.closedAt = todayISO();
});
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertMoney(dashboard.metrics.capitalPlaced, 0, "Capital prestado prueba 7: operaciones cerradas no deben aportar al indicador.");

resetTestState({
  clients: [testClient("saldo-a"), testClient("saldo-b")],
  loans: [
    testLoan({ id: "saldo-a-main", clientId: "saldo-a", amount: 500, remainingCapital: 500, monthlyRate: 10, startDate: "2026-08-01", nextDueDate: "2026-09-01" }),
  ],
});
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertMoney(dashboard.metrics.capitalPlaced, 500, "Capital actualmente prestado: inicialmente cuenta el capital pendiente completo.");
assertMoney(dashboard.metrics.totalLentAccumulated, 500, "Total prestado acumulado: inicialmente cuenta el monto original desembolsado.");
let pendingCapitalHTML = renderLoanPendingCapital(state.loans[0]);
assert(pendingCapitalHTML.includes(money(500)), "Tabla cliente: inicialmente debe mostrar el capital pendiente completo.");
preview = buildPaymentTransactionPreview(state.loans[0], {
  paymentDate: "2026-09-01",
  scheduledDueDate: "2026-09-01",
  interestPaid: 50,
  capitalPaid: 250,
});
state.loans[0] = preview.updatedLoan;
state.payments.push(preview.payment);
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertMoney(dashboard.metrics.capitalPlaced, 250, "Capital actualmente prestado: amortizar capital debe bajar el saldo actual.");
assertMoney(dashboard.metrics.totalLentAccumulated, 500, "Total prestado acumulado: amortizar capital no debe bajar el acumulado historico.");
assertMoney(expectedInterest(state.loans[0]), 25, "Interes futuro: debe calcularse sobre los S/250 pendientes.");
pendingCapitalHTML = renderLoanPendingCapital(state.loans[0]);
assert(pendingCapitalHTML.includes(money(250)), "Tabla cliente: despues de amortizar debe mostrar S/250 pendientes, no S/500 original.");
assert(!pendingCapitalHTML.includes(money(500)), "Tabla cliente: el valor principal no debe seguir mostrando el monto original amortizado.");
state.loans[0].nextDueDate = addDays(todayISO(), -1);
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertMoney(dashboard.metrics.capitalPlaced, 250, "Capital actualmente prestado: un prestamo vencido sigue contando mientras deba capital.");
state.loans.push(testLoan({ id: "saldo-b-main", clientId: "saldo-b", amount: 1000, remainingCapital: 1000, monthlyRate: 10, startDate: "2026-09-02", nextDueDate: "2026-10-02" }));
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertMoney(dashboard.metrics.capitalPlaced, 1250, "Capital actualmente prestado: debe sumar el saldo pendiente de todos los prestamos y ampliaciones.");
assertMoney(dashboard.metrics.totalLentAccumulated, 1500, "Total prestado acumulado: debe sumar los montos originales desembolsados.");
state.loans[0].remainingCapital = 0;
state.loans[0].status = "closed";
state.loans[0].closedAt = todayISO();
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertMoney(dashboard.metrics.capitalPlaced, 1000, "Capital actualmente prestado: cerrar el primer prestamo deja solo el capital pendiente restante.");
assertMoney(dashboard.metrics.totalLentAccumulated, 1500, "Total prestado acumulado: cerrar un prestamo no debe borrar el monto original prestado.");
state.loans[1].remainingCapital = 0;
state.loans[1].status = "closed";
state.loans[1].closedAt = todayISO();
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertMoney(dashboard.metrics.capitalPlaced, 0, "Capital actualmente prestado: todo cerrado deja saldo actual en cero.");
assertMoney(dashboard.metrics.totalLentAccumulated, 1500, "Total prestado acumulado: todo cerrado mantiene el historico desembolsado.");

resetTestState({
  clients: [testClient("cobro-hoy-1"), testClient("cobro-hoy-2"), testClient("cobro-hoy-3")],
  loans: [
    testLoan({ id: "today-1", clientId: "cobro-hoy-1", amount: 1000, remainingCapital: 1000, monthlyRate: 10, startDate: "2026-08-01", nextDueDate: todayISO() }),
    testLoan({ id: "today-2", clientId: "cobro-hoy-2", amount: 2000, remainingCapital: 1500, monthlyRate: 10, startDate: "2026-08-01", nextDueDate: todayISO() }),
    testLoan({ id: "today-3", clientId: "cobro-hoy-3", amount: 500, remainingCapital: 500, monthlyRate: 10, startDate: "2026-08-01", nextDueDate: addDays(todayISO(), 1) }),
  ],
});
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertMoney(dashboard.metrics.todayAmount, 250, "Interes a cobrar hoy debe sumar solo intereses, no capital pendiente.");
const todayInterestIndicator = getDashboardKpiItems(dashboard).find((item) => item.metricKey === "todayAmount");
assertEqual(todayInterestIndicator.title, "Interés a cobrar hoy", "El indicador debe mostrar el nuevo titulo puntual.");
assertEqual(todayInterestIndicator.tip, "Ejemplo: Si hoy debes cobrar S/100 de interés a un cliente, S/250 de interés a otro y S/150 de interés a otro, el monto de interés a cobrar hoy será S/500.", "El tooltip debe explicar solo intereses.");
assert(getIndicatorMessages("Interés a cobrar hoy").includes("🚀 Cada sol recuperado fortalece capital."), "La frase inferior del indicador debe conservarse sin cambios.");

resetTestState({
  clients: [testClient("historial")],
  loans: [
    testLoan({ id: "historial-julio", clientId: "historial", amount: 700, remainingCapital: 400, startDate: "2026-07-10", nextDueDate: "2026-09-10" }),
    testLoan({ id: "historial-agosto", clientId: "historial", amount: 300, remainingCapital: 300, startDate: "2026-08-05", nextDueDate: "2026-09-05" }),
  ],
  payments: [
    testPayment({ id: "historial-payment-julio", loanId: "historial-julio", clientId: "historial", date: "2026-07-20", interestPaid: 70, capitalPaid: 300 }),
    testPayment({ id: "historial-payment-agosto", loanId: "historial-agosto", clientId: "historial", date: "2026-08-20", interestPaid: 30 }),
  ],
  capitalMovements: [testCapitalMovement({ id: "historial-capital", type: "deposit", amount: 1000, date: "2026-07-01" })],
});
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertEqual(dashboard.range.isAllHistory, true, "Fechas vacias deben activar Todo el historial.");
assertEqual(dashboard.range.start, "2026-07-01", "Todo el historial debe iniciar en el primer dato real.");
assertEqual(dashboard.range.end, todayISO(), "Todo el historial debe terminar hoy.");
assertMoney(dashboard.metrics.realProfit, 100, "Todo el historial debe incluir todos los intereses cobrados.");
assertMoney(dashboard.metrics.capitalRecovered, 300, "Todo el historial debe incluir todo el capital recuperado.");
dashboard = buildDashboardData({ filters: { customStart: "2026-08-01", customEnd: "2026-08-31", compare: "none", operation: "all" }, skipComparison: true });
assertEqual(dashboard.range.label, "Periodo seleccionado", "Rango manual debe mostrarse como periodo seleccionado.");
assertMoney(dashboard.metrics.realProfit, 30, "Rango manual debe limitar movimientos al periodo elegido.");
assertMoney(dashboard.metrics.capitalPending, 700, "Prestamo creado antes del rango pero activo al cierre debe contar en cartera.");
dashboard = buildDashboardData({ filters: { customStart: "2026-08-01", customEnd: "", compare: "none", operation: "all" }, skipComparison: true });
assertEqual(dashboard.range.start, "2026-08-01", "Solo Desde debe iniciar en la fecha seleccionada.");
assertEqual(dashboard.range.end, todayISO(), "Solo Desde debe terminar hoy.");
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "2026-07-31", compare: "none", operation: "all" }, skipComparison: true });
assertEqual(dashboard.range.start, "2026-07-01", "Solo Hasta debe iniciar en el comienzo del historial.");
assertEqual(dashboard.range.end, "2026-07-31", "Solo Hasta debe terminar en la fecha seleccionada.");
dashboard = buildDashboardData({ filters: { customStart: "", customEnd: "", compare: "previousPeriod", operation: "all" } });
assertEqual(dashboard.comparison, null, "Todo el historial no debe inventar comparacion anterior.");
dashboard = buildDashboardData({ filters: { customStart: "2026-09-30", customEnd: "2026-09-01", compare: "none", operation: "all" } });
assertEqual(dashboard.range.invalid, true, "Fecha Desde posterior a Hasta debe marcar rango invalido.");
assertEqual(buildDashboardAlertMessages(dashboard)[0], "La fecha Desde no puede ser posterior a la fecha Hasta.", "Rango invalido debe mostrar mensaje claro.");

resetTestState({
  clients: [testClient("p1"), testClient("p2"), testClient("p3")],
  loans: [
    testLoan({ id: "avg-1", clientId: "p1", amount: 500, startDate: "2026-08-05", nextDueDate: "2026-09-05" }),
    testLoan({ id: "avg-2", clientId: "p2", amount: 1000, startDate: "2026-08-10", nextDueDate: "2026-09-10" }),
    testLoan({ id: "avg-3", clientId: "p3", amount: 1500, startDate: "2026-08-15", nextDueDate: "2026-09-15" }),
  ],
});
dashboard = buildTestDashboard("primary");
assertMoney(dashboard.metrics.averageLoan, 1000, "Prueba C: promedio de prestamos principales del periodo.");

resetTestState({
  clients: [testClient("lole")],
  loans: [
    testLoan({ id: "lole-main", clientId: "lole", amount: 500, startDate: "2026-07-01", nextDueDate: "2026-09-01", createdAt: "2026-07-01T00:00:00.000Z" }),
    testLoan({ id: "lole-ext-1", clientId: "lole", amount: 100, startDate: "2026-08-01", nextDueDate: "2026-09-01", createdAt: "2026-08-01T00:00:00.000Z" }),
    testLoan({ id: "lole-ext-2", clientId: "lole", amount: 200, startDate: "2026-08-02", nextDueDate: "2026-09-02", createdAt: "2026-08-02T00:00:00.000Z" }),
    testLoan({ id: "lole-ext-3", clientId: "lole", amount: 300, startDate: "2026-08-03", nextDueDate: "2026-09-03", createdAt: "2026-08-03T00:00:00.000Z" }),
  ],
});
dashboard = buildTestDashboard("extensions");
assertEqual(dashboard.metrics.activeExtensions, 3, "Prueba D/I: ampliaciones activas reales con filtro de ampliaciones.");
assertEqual(dashboard.lists.extensions[0].extensions, 3, "Prueba D/I: ranking de ampliaciones reales sin restar uno.");

resetTestState({
  clients: [testClient("pago")],
  loans: [
    testLoan({ id: "payment-loan", clientId: "pago", amount: 500, remainingCapital: 0, startDate: "2026-08-01", nextDueDate: "2026-09-01", status: "closed", closedAt: "2026-09-15" }),
  ],
  payments: [
    testPayment({ id: "payment-1", loanId: "payment-loan", clientId: "pago", date: "2026-09-15", capitalPaid: 500, remainingCapitalAfter: 0 }),
  ],
});
dashboard = buildTestDashboard();
assertMoney(dashboard.metrics.capitalPending, 500, "Saldo historico reconstruido con pagos posteriores al periodo.");
assertEqual(dashboard.metrics.activeLoans, 1, "Prestamo cerrado despues del periodo debe estar activo al cierre del periodo revisado.");

assertMoney(calculateInterestForMode(1000, 10, "monthly", 28), 100, "Interes mensual no depende de 28 dias.");
assertMoney(calculateInterestForMode(1000, 10, "monthly", 31), 100, "Interes mensual no depende de 31 dias.");
assertMoney(calculateInterestForMode(1000, 10, "biweekly", 14), 50, "Interes quincenal usa 5% fijo.");
assertMoney(calculateInterestForMode(1000, 10, "biweekly", 16), 50, "Interes quincenal no cambia por 16 dias.");
assertMoney(calculateInterestForMode(1000, 10, "weekly", 7), 23.33, "Interes semanal redondeado.");
assertMoney(calculateInterestForMode(1000, 10, "daily", 1), 3.33, "Interes diario por un dia.");
assertMoney(calculateInterestForMode(1000, 10, "daily", 10), 33.33, "Interes diario por varios dias.");

assertEqual(addOneMonthKeepingDay("2026-01-31", 31), "2026-02-28", "31 de enero a febrero normal.");
assertEqual(addOneMonthKeepingDay("2028-01-31", 31), "2028-02-29", "31 de enero a febrero bisiesto.");
assertEqual(addOneMonthKeepingDay("2026-11-30", 30), "2026-12-30", "30 de noviembre a diciembre.");
assertEqual(addOneMonthKeepingDay("2026-12-31", 31), "2027-01-31", "31 de diciembre cambia de ano.");
assertEqual(toISODate(parseLocalDate("2026-08-31")), "2026-08-31", "Fecha local no debe retroceder por UTC.");

const amortizationLoan = testLoan({ id: "amortiza", clientId: "pago", amount: 1000, remainingCapital: 1000, startDate: "2026-08-01", nextDueDate: "2026-09-01" });
preview = buildPaymentTransactionPreview(amortizationLoan, {
  paymentDate: "2026-09-01",
  scheduledDueDate: "2026-09-01",
  interestPaid: 100,
  capitalPaid: 400,
});
assertMoney(preview.updatedLoan.remainingCapital, 600, "Amortizacion debe reducir capital pendiente.");
assertEqual(preview.updatedLoan.status, "active", "Prestamo amortizado parcialmente sigue activo.");
assertMoney(expectedInterest(preview.updatedLoan), 60, "Siguiente interes debe calcularse sobre capital pendiente.");

preview = buildPaymentTransactionPreview(testLoan({ id: "cierre", clientId: "pago", amount: 500, remainingCapital: 500, startDate: "2026-08-01", nextDueDate: "2026-09-01" }), {
  paymentDate: "2026-09-01",
  scheduledDueDate: "2026-09-01",
  interestPaid: 50,
  capitalPaid: 500,
});
assertMoney(preview.updatedLoan.remainingCapital, 0, "Cierre total deja capital en cero.");
assertEqual(preview.updatedLoan.status, "closed", "Cierre total debe cerrar prestamo.");
assertEqual(preview.payment.nextDueDateAfter, null, "Prestamo cerrado no debe generar siguiente fecha de cobro.");

resetTestState({
  clients: [testClient("mixto")],
  loans: [
    testLoan({ id: "mixto-main", clientId: "mixto", amount: 500, remainingCapital: 0, startDate: "2026-08-01", nextDueDate: "2026-09-01", status: "closed", closedAt: "2026-09-01", createdAt: "2026-08-01T00:00:00.000Z" }),
    testLoan({ id: "mixto-ext", clientId: "mixto", amount: 200, remainingCapital: 200, startDate: "2026-08-02", nextDueDate: "2026-09-02", createdAt: "2026-08-02T00:00:00.000Z" }),
  ],
});
assertEqual(isClientCompletelyClosed("mixto"), false, "Cliente con principal cerrado y ampliacion activa no esta completamente cerrado.");
state.loans[1].remainingCapital = 0;
state.loans[1].status = "closed";
state.loans[1].closedAt = "2026-09-02";
assertEqual(isClientCompletelyClosed("mixto"), true, "Cliente con todas las operaciones cerradas queda cerrado.");

resetTestState({
  clients: [testClient("comparacion")],
  loans: [testLoan({ id: "comparacion-loan", clientId: "comparacion", amount: 100, startDate: "2026-08-01", nextDueDate: "2026-09-01" })],
});
dashboard = buildDashboardData({
  filters: { customStart: "2026-08-01", customEnd: "2026-08-31", compare: "previousPeriod", operation: "all" },
  range: { start: "2026-08-01", end: "2026-08-31", label: "Agosto" },
});
const comparison = getComparisonDetails({ metricKey: "realProfit" }, dashboard);
assert(comparison && comparison.percent === null, "Comparacion sin base previa no debe producir Infinity.");

assert(validateStateIntegrity({
  user: null,
  subscription: null,
  clients: [testClient("duplicado"), testClient("duplicado")],
  loans: [],
  payments: [],
}).length > 0, "Importacion con IDs duplicados debe rechazarse.");
assert(validateStateIntegrity({
  user: null,
  subscription: null,
  clients: [testClient("negativo")],
  loans: [testLoan({ id: "negativo-loan", clientId: "negativo", amount: -100, startDate: "2026-08-01", nextDueDate: "2026-09-01" })],
  payments: [],
}).length > 0, "Importacion con monto negativo debe rechazarse.");
assert(validateStateIntegrity({
  user: null,
  subscription: null,
  clients: [testClient("huerfano")],
  loans: [],
  payments: [testPayment({ id: "payment-orphan", loanId: "sin-loan", clientId: "huerfano", date: "2026-08-10", interestPaid: 10 })],
}).length > 0, "Importacion con pago huerfano debe rechazarse.");
`;

vm.runInNewContext(`${appCode}\n${tests}`, context, { filename: "financial-regression-tests.vm.js" });

function assertFileIncludes(fileText, needle, message) {
  if (!fileText.includes(needle)) {
    throw new Error(message);
  }
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

[
  "Cobrado en el periodo",
  "Nuevos prestamos del periodo",
  "Monto total en ampliaciones",
  "Dias promedio de atraso",
  "Interes pendiente",
  "Promedio de prestamo",
  "Promedio de interes cobrado",
  "Distribucion por modalidad",
].forEach((title) => {
  assertCondition(!appCode.includes('  "' + title + '": ['), "Mensajes rotativos: " + title + " no debe conservar frases visuales.");
});

assertFileIncludes(appCode, 'saas.client.rpc("register_payment"', "Prueba E/F: el cobro en nube debe usar RPC transaccional.");
assertFileIncludes(appCode, 'saas.client.rpc("create_client_with_loan"', "Test 11: crear cliente + prestamo debe usar RPC atomica.");
assertFileIncludes(appCode, 'saas.client.rpc("update_client_with_loan"', "Editar cliente + prestamo debe usar RPC atomica.");
assertFileIncludes(appCode, 'saas.client.rpc("create_loan_operation"', "Crear ampliacion debe usar RPC atomica de operacion.");
assertFileIncludes(appCode, 'saas.client.rpc("register_capital_movement"', "Capital: agregar/retiro en nube debe usar RPC transaccional.");
assertFileIncludes(appCode, 'saas.client.rpc("initialize_user_account"', "RLS: frontend debe inicializar cuenta mediante RPC controlada.");
assertFileIncludes(appCode, 'saas.client.rpc("admin_update_user_plan"', "RLS: panel Admin debe cambiar planes mediante RPC controlada.");
assertCondition(!appCode.includes('.from("subscriptions").upsert'), "RLS: frontend no debe hacer upsert directo de suscripciones.");
assertCondition(!appCode.includes('.from("plan_requests").insert'), "RLS: frontend no debe crear solicitudes de plan directo en la tabla.");
assertCondition(!appCode.includes('.from("plan_requests").update'), "RLS: frontend no debe aprobar solicitudes de plan directo en la tabla.");
assertCondition(!appCode.includes('.from("capital_movements").insert'), "Capital: frontend no debe insertar movimientos de capital directo en la tabla.");
assertCondition(!appCode.includes("restoreCloudCapitalMovements"), "Test 10: restauracion no debe duplicar delete/insert de capital_movements en frontend.");
assertFileIncludes(appCode, "paymentSubmissionInProgress", "Prueba H: debe existir proteccion de doble clic en cobro.");
assertFileIncludes(appCode, "clientSubmissionInProgress", "Prueba H: debe existir proteccion de doble clic al guardar cliente/ampliacion.");
assertFileIncludes(appCode, "loanDeletionInProgress", "Prueba H: debe existir proteccion de doble clic al eliminar ampliacion.");
assertFileIncludes(appCode, "clientDeletionInProgress", "Prueba H: debe existir proteccion de doble clic al eliminar cliente.");
assertCondition(!appCode.includes('.from("payments").delete'), "Eliminaciones cloud no deben borrar pagos manualmente antes de borrar cliente/prestamo.");
assertCondition(!appCode.includes('.from("payments").insert'), "Pagos cloud no deben insertarse fuera de RPC transaccional.");
assertFileIncludes(sqlCode.toLowerCase(), "for update", "Prueba E/F: la RPC debe bloquear el prestamo con FOR UPDATE.");
assertFileIncludes(sqlCode, "drop function if exists public.restore_user_snapshot(jsonb)", "Test 10: migracion debe retirar la RPC insegura que recibia snapshots desde el navegador.");
assertFileIncludes(sqlCode, "create or replace function public.create_user_backup", "Test 10: las copias cloud deben crearse desde datos reales en Supabase.");
assertFileIncludes(sqlCode, "create or replace function public.restore_user_backup", "Test 10: restauracion cloud debe recibir solo el ID de una copia del usuario.");
assertFileIncludes(sqlCode, "where id = p_backup_id", "Test 10: restauracion debe buscar una copia real por ID.");
assertFileIncludes(sqlCode, "and user_id = v_user_id", "Test 10: restauracion debe exigir que la copia pertenezca al usuario.");
assertFileIncludes(sqlCode, "v_snapshot_clients > v_client_limit", "Test 10: restauracion debe respetar el limite de clientes del plan.");
assertFileIncludes(sqlCode, "revoke insert, update, delete on user_backups from authenticated", "Test 10: usuarios no deben escribir backups directamente.");
assertFileIncludes(sqlCode, "grant select on user_backups to authenticated", "Test 10: usuarios solo deben leer metadatos/respaldos propios.");
assertFileIncludes(sqlCode, "perform set_config('app.restoring_snapshot', 'on', true)", "Test 10: restauracion debe ejecutarse como snapshot transaccional controlado.");
assertFileIncludes(appCode, 'rpc("create_user_backup")', "Test 10: frontend debe crear backups cloud con RPC segura.");
assertFileIncludes(appCode, 'rpc("restore_user_backup", { p_backup_id: backupId })', "Test 10: frontend debe restaurar cloud solo por ID de backup.");
assertCondition(!appCode.includes('rpc("restore_user_snapshot"'), "Test 10: frontend no debe enviar snapshots completos a Supabase.");
assertFileIncludes(sqlCode, "create or replace function public.create_client_with_loan", "Test 11: SQL debe definir RPC atomica de cliente + prestamo.");
assertFileIncludes(sqlCode, "create or replace function public.update_client_with_loan", "Editar: SQL debe definir RPC atomica de cliente + prestamo.");
assertFileIncludes(sqlCode, "create or replace function public.create_loan_operation", "Ampliacion: SQL debe definir RPC atomica de prestamo/ampliacion.");
assertFileIncludes(sqlCode, "Ya existe un cobro registrado para este periodo.", "Test 12: register_payment debe rechazar doble pago del mismo vencimiento.");
assertFileIncludes(sqlCode, "Este periodo ya fue cobrado o el prestamo ya avanzo a otra fecha.", "Test 12: register_payment debe rechazar pagos atrasados por dos pestanas.");
assertFileIncludes(sqlCode, "v_pending_interest", "Pago parcial: register_payment debe calcular interes pendiente del periodo.");
assertFileIncludes(sqlCode, "period_status", "Pago parcial: SQL debe guardar el estado del periodo.");
assertFileIncludes(sqlCode, "when v_period_closed then v_next_due", "Pago parcial: RPC solo debe avanzar fecha cuando el periodo cierre.");
assertFileIncludes(sqlCode, "Para cerrar el prestamo debes completar primero el interes pendiente", "Pago parcial: RPC debe impedir cierre de capital con interes pendiente.");
assertFileIncludes(appCode, "buildPaymentPeriodSummary", "Pago parcial: frontend debe calcular el estado del periodo antes de guardar.");
assertFileIncludes(schemaCode, "expected_interest numeric not null default 0", "Pago parcial: esquema base debe incluir interes esperado.");
assertFileIncludes(sqlCode, "calculate_available_capital", "Test 8: servidor debe validar capital disponible desde una funcion central.");
assertFileIncludes(sqlCode, "create or replace function public.register_capital_movement", "Capital: SQL debe definir RPC segura para movimientos de capital.");
assertFileIncludes(sqlCode, "create or replace function public.validate_capital_movement_rules", "Capital: SQL debe validar movimientos de capital desde una funcion central.");
assertFileIncludes(sqlCode, "create trigger trg_enforce_capital_movement_rules", "Capital: SQL debe bloquear inserciones directas invalidas con trigger.");
assertFileIncludes(sqlCode, "before insert on capital_movements", "Capital: trigger debe ejecutarse antes de registrar movimientos.");
assertFileIncludes(sqlCode, "current_setting('app.restoring_snapshot', true) = 'on'", "Capital: restauracion oficial debe mantener una excepcion controlada.");
assertFileIncludes(sqlCode, "capital movements own restore delete", "Capital: usuarios solo deben borrar movimientos durante restauracion oficial.");
assertFileIncludes(sqlCode, "perform pg_advisory_xact_lock(hashtext(p_user_id::text)::bigint);", "Capital: validaciones financieras deben usar candado por usuario.");
assertFileIncludes(schemaCode, "create or replace function public.register_capital_movement", "Esquema base debe incluir RPC segura de movimientos de capital.");
assertFileIncludes(schemaCode, "create trigger trg_enforce_capital_movement_rules", "Esquema base debe incluir trigger de movimientos de capital.");
assertFileIncludes(schemaCode, "capital movements own restore delete", "Esquema base debe restringir borrado de movimientos de capital.");
assertFileIncludes(rlsCode, "revoke all on subscriptions from anon, authenticated", "RLS: migracion debe retirar permisos directos amplios de suscripciones.");
assertFileIncludes(rlsCode, "grant select on subscriptions to authenticated", "RLS: usuarios normales solo deben leer su suscripcion.");
assertFileIncludes(rlsCode, "grant update (business_name, owner_name, currency) on profiles to authenticated", "RLS: profiles solo debe permitir columnas editables.");
assertFileIncludes(rlsCode, "create or replace function public.initialize_user_account", "RLS: migracion debe crear RPC segura de inicializacion.");
assertFileIncludes(rlsCode, "values (v_user_id, 'free', 'active', 10, now(), now())", "RLS: inicializacion solo debe crear plan gratis.");
assertFileIncludes(rlsCode, "create or replace function public.admin_update_user_plan", "RLS: migracion debe crear RPC controlada para cambios de plan admin.");
assertFileIncludes(rlsCode, "if not public.is_admin() then", "RLS: RPC admin debe validar administrador en PostgreSQL.");
assertFileIncludes(rlsCode, "revoke all on payments from anon, authenticated", "RLS: migracion debe bloquear escrituras directas de pagos.");
assertFileIncludes(rlsCode, "grant select on payments to authenticated", "RLS: usuarios normales solo deben leer pagos propios.");
assertFileIncludes(rlsCode, "grant select on capital_movements to authenticated", "RLS: usuarios normales solo deben leer movimientos de capital propios.");
assertFileIncludes(rlsCode, "grant select, delete on loans to authenticated", "RLS: prestamos mantienen borrado propio sin permitir insert/update directo.");
assertFileIncludes(rlsCode, "create policy \"subscriptions admin select\"", "RLS: admin solo necesita select global de suscripciones.");
assertFileIncludes(schemaCode, "revoke all on subscriptions from anon, authenticated", "Esquema base debe retirar permisos directos amplios de suscripciones.");
assertFileIncludes(schemaCode, "grant update (business_name, owner_name, currency) on profiles to authenticated", "Esquema base debe proteger is_admin con permisos de columna.");
assertCondition(!sqlCode.includes("El cliente supera el limite de S/1,000"), "Regla actual: servidor no debe bloquear por limite S/1,000 por cliente.");
assertFileIncludes(sqlCode, "create or replace function public.enforce_client_plan_limit", "Planes: servidor debe validar limite de clientes por plan.");
assertFileIncludes(sqlCode, "create trigger trg_enforce_client_plan_limit", "Planes: falta trigger servidor para bloquear exceso de clientes.");
assertFileIncludes(sqlCode, "v_current_clients >= v_client_limit", "Planes: el trigger debe bloquear cuando llega al limite de clientes.");
assertFileIncludes(sqlCode, "pg_advisory_xact_lock", "Planes: el limite de clientes debe protegerse contra doble registro simultaneo.");
assertFileIncludes(schemaCode, "create or replace function public.enforce_client_plan_limit", "Esquema base debe incluir validacion servidor de limite de clientes.");
assertFileIncludes(schemaCode, "create trigger trg_enforce_client_plan_limit", "Esquema base debe incluir trigger servidor de limite de clientes.");
assertCondition(!appCode.includes("clientLimit: 100"), "Planes: Basico ya no debe quedar configurado en 100 clientes.");
assertCondition(!appCode.includes("Hasta 100 clientes"), "Planes: el texto de Basico ya no debe decir 100 clientes.");
assertFileIncludes(sqlCode, "loans_amount_nonnegative", "Prueba G: falta constraint de monto de prestamo no negativo.");
assertFileIncludes(sqlCode, "payments_capital_paid_nonnegative", "Prueba G: falta constraint de capital pagado no negativo.");
assertFileIncludes(sqlCode, "payments_interest_paid_nonnegative", "Prueba G: falta constraint de interes pagado no negativo.");
assertFileIncludes(sqlCode, "loans_client_same_user", "RLS/FK: falta relacion que obliga prestamo y cliente del mismo usuario.");
assertFileIncludes(sqlCode, "payments_loan_same_user", "RLS/FK: falta relacion que obliga pago y prestamo del mismo usuario.");
assertFileIncludes(sqlCode, "loans_status_matches_remaining_capital", "Invariantes: falta constraint de estado vs capital pendiente.");
assertFileIncludes(sqlCode, "loans_status_matches_due_date", "Invariantes: falta constraint de estado vs proxima fecha.");
assertFileIncludes(sqlCode, "loans_operation_type_valid", "Test 15: falta constraint de tipo de operacion.");
assertFileIncludes(sqlCode, "loans_parent_matches_type", "Test 15: falta constraint de parent_loan_id para ampliaciones.");
assertFileIncludes(sqlCode, "alter table loans drop constraint if exists loans_parent_matches_type", "Clientes: la migracion debe reemplazar el constraint anterior de ampliaciones.");
assertCondition(!sqlCode.includes("(operation_type = 'ampliacion' and parent_loan_id is not null)"), "Clientes: las ampliaciones deben poder quedarse sin principal si se elimina el prestamo principal.");
assertFileIncludes(sqlCode, "loans_one_principal_per_client", "Test 15: debe existir indice unico de principal por cliente.");
assertFileIncludes(sqlCode, "payments_has_amount", "Invariantes: falta constraint que impide pagos en cero.");
assertFileIncludes(schemaCode, "create or replace function public.create_client_with_loan", "Esquema base debe incluir RPC atomica de cliente + prestamo.");
assertFileIncludes(schemaCode, "create or replace function public.create_loan_operation", "Esquema base debe incluir RPC atomica de ampliacion.");
assertFileIncludes(schemaCode, "create or replace function public.update_client_with_loan", "Esquema base debe incluir RPC atomica de edicion.");
assertFileIncludes(schemaCode, "operation_type text not null default 'principal'", "Esquema base debe crear operation_type desde el inicio.");
assertFileIncludes(schemaCode, "parent_loan_id uuid references loans(id)", "Esquema base debe crear parent_loan_id desde el inicio.");
assertCondition(!appCode.includes(".slice(0, 4)"), "Cobranza rapida no debe cortar registros; debe usar scroll interno.");
assertFileIncludes(appCode, "summary-scroll-count", "Cobranza rapida debe mostrar contador cuando hay mas de 3 registros.");
assertFileIncludes(appCode, "scrollQuickCollection", "Cobranza rapida debe permitir avanzar con chevron.");
assertFileIncludes(appCode, "renderScrollableSummaryList", "Listas del resumen deben reutilizar el componente scrollable.");
assertFileIncludes(appCode, 'renderScrollableSummaryList(container, items.length, cards, emptyMessage, "Listado de clientes y metricas"', "Clientes y movimientos clave deben usar scroll interno en rankings.");
assertFileIncludes(appCode, 'renderScrollableSummaryList(container, items.length, cards, emptyMessage, "Listado de movimientos"', "Clientes y movimientos clave deben usar scroll interno en movimientos.");
assertFileIncludes(stylesCode, "overscroll-behavior: contain", "Cobranza rapida debe mantener scroll interno independiente.");
assertFileIncludes(stylesCode, "scrollbar-width: thin", "Cobranza rapida debe usar scrollbar discreta.");
assertFileIncludes(appCode, 'class="kpi-value"', "Resumen: los valores principales deben usar una clase visual compartida.");
assertFileIncludes(stylesCode, ".kpi-value", "Resumen: falta la regla CSS centralizada para valores principales.");
assertCondition(!stylesCode.includes(".summary-compact-card strong"), "Resumen: los indicadores compactos no deben tener un tamano de valor separado.");
assertFileIncludes(htmlCode, "<h3>Indicadores:</h3>", "Resumen: el titulo de Indicadores debe incluir dos puntos.");
assertFileIncludes(htmlCode, "Mantén presionada una tarjeta y arrástrala para ordenar los indicadores como prefieras.", "Resumen: debe explicar como ordenar indicadores arrastrando.");
assertFileIncludes(stylesCode, ".section-helper", "Resumen: el texto de ayuda debe tener estilo propio.");
assertFileIncludes(htmlCode, 'src="assets/ermif-logo.png"', "Marca: el login debe usar el logo completo ERMIF.");
assertFileIncludes(htmlCode, 'src="assets/ermif-mark.png"', "Marca: la barra lateral debe usar el simbolo compacto ERMIF.");
assertFileIncludes(htmlCode, '<span id="ownerLabel" class="is-hidden">Prestamista</span>', "Sidebar: Prestamista no debe mostrarse visualmente debajo del nombre del negocio.");
assertCondition(!htmlCode.includes('class="plan-card"'), "Sidebar: el plan actual no debe mostrarse como tarjeta separada.");
assertFileIncludes(htmlCode, 'id="planInlineStatus"', "Sidebar: el estado del plan debe mostrarse debajo del nombre.");
assertFileIncludes(appCode, "getPlanInlineStatusText", "Sidebar: el estado del plan debe armarse en una sola linea.");
assertFileIncludes(stylesCode, ".plan-inline-status", "Sidebar: el estado del plan debe tener estilo propio.");
assertFileIncludes(stylesCode, "color: #18d38a", "Sidebar: el estado del plan debe verse en verde.");
assertFileIncludes(stylesCode, ".brand-logo-auth", "Marca: el logo del login debe tener estilo propio.");
assertFileIncludes(stylesCode, ".brand-logo-sidebar", "Marca: el logo lateral debe tener estilo propio.");
assertFileIncludes(appCode, "Registra hasta 10 clientes gratis, prueba el sistema con calma y pasa a Premium cuando quieras crecer.", "Registro: la nota informativa debe tener un texto comercial breve.");
assertFileIncludes(appCode, "auth-notice-premium", "Registro: la nota informativa debe activar el estilo premium.");
assertFileIncludes(stylesCode, ".auth-notice-premium", "Registro: la nota informativa debe tener estilo premium.");
assertFileIncludes(stylesCode, ".auth-notice-icon", "Registro: la nota informativa debe incluir un icono discreto.");
assertFileIncludes(htmlCode, 'id="authConfirmPassword"', "Registro: debe existir el campo Confirmar contraseña.");
assertFileIncludes(htmlCode, 'name="confirmPassword" type="password"', "Registro: Confirmar contraseña debe ser type password.");
assertFileIncludes(htmlCode, 'placeholder="Vuelve a escribir tu contraseña" autocomplete="new-password"', "Registro: Confirmar contraseña debe tener placeholder y autocomplete correctos.");
assertFileIncludes(appCode, "validateSignupPasswords", "Registro: debe validar coincidencia de contraseñas antes de crear cuenta.");
assertFileIncludes(stylesCode, ".field-feedback", "Registro: el mensaje de coincidencia debe tener estilo propio.");
assertCondition(!appCode.includes("confirmPassword:"), "Registro: Confirmar contraseña no debe enviarse a metadata ni Supabase.");
assertFileIncludes(htmlCode, 'id="googleAuthButton"', "Google Auth: debe existir el boton de acceso con Google.");
assertFileIncludes(appCode, 'signInWithOAuth({', "Google Auth: debe usar OAuth de Supabase.");
assertFileIncludes(appCode, 'provider: "google"', "Google Auth: el proveedor debe ser Google.");
assertFileIncludes(appCode, "redirectTo: window.location.origin", "Google Auth: debe volver al dominio actual.");
assertFileIncludes(htmlCode, 'id="completeProfileDialog"', "Google Auth: debe existir modal para completar perfil.");
assertFileIncludes(htmlCode, 'id="completeBusinessName"', "Google Auth: el modal debe pedir nombre del negocio.");
assertFileIncludes(appCode, "pendingProfileCompletion", "Google Auth: debe detectar cuentas nuevas con perfil pendiente.");
assertFileIncludes(appCode, "openCompleteProfileDialog", "Google Auth: debe abrir el modal de perfil pendiente.");
assertFileIncludes(appCode, "business_name: businessName || \"Mi negocio\"", "Registro: el nombre del negocio debe guardarse en metadata de Auth.");
assertFileIncludes(appCode, "metadata.business_name || metadata.businessName || \"\"", "Carga de perfil: debe recuperar nombre del negocio desde metadata si falta profile.");
assertFileIncludes(cloudflareBuildCode, 'const publicDirs = ["assets"]', "Cloudflare: el build debe copiar la carpeta assets.");
assertFileIncludes(cloudflareBuildCode, "fs.cpSync", "Cloudflare: el build debe copiar assets de forma recursiva.");
assertFileIncludes(appCode, 'CANONICAL_APP_ORIGIN = "https://ermif.com"', "Dominio: la app debe tener ermif.com como origen canonico.");
assertFileIncludes(appCode, "redirectLegacyHost", "Dominio: la app debe redirigir hosts antiguos al dominio canonico.");
assertFileIncludes(appCode, "reliable-kleicha-4c46be.netlify.app", "Dominio: debe cubrir el antiguo despliegue de Netlify.");
assertFileIncludes(appCode, 'host.endsWith(".netlify.app")', "Dominio: cualquier host Netlify heredado debe salir hacia ermif.com.");
assertCondition(!htmlCode.includes('id="exportExcel"'), "Topbar: Exportar Excel no debe mostrarse en la barra superior.");
assertFileIncludes(htmlCode, "topbar-primary-actions", "Topbar: Agregar, Retirar y Nuevo cliente deben estar agrupados a la derecha.");
assertFileIncludes(appCode, "elements.exportExcelButton?.addEventListener", "Topbar: JS debe tolerar que Exportar Excel no exista en HTML.");
assertFileIncludes(appCode, 'dataMenu: $(".data-menu")', "Topbar: JS debe tener referencia al menu Seguridad de datos.");
assertFileIncludes(appCode, '!event.target.closest(".data-menu")', "Topbar: Seguridad de datos debe cerrarse al hacer clic fuera del menu.");
assertFileIncludes(appCode, 'elements.dataMenu.removeAttribute("open")', "Topbar: el clic externo debe cerrar el menu Seguridad de datos.");
assertFileIncludes(htmlCode, 'class="topbar-date-pill" id="todayLabel"', "Topbar: la fecha debe mostrarse como una capsula tipo boton.");
assertFileIncludes(htmlCode, '<h2 id="viewTitle" class="sr-only">Resumen</h2>', "Topbar: el titulo de vista debe quedar oculto visualmente.");
assertFileIncludes(appCode, "formatTopbarDate", "Topbar: la fecha debe usar un formato propio.");
assertFileIncludes(appCode, '["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"]', "Topbar: el mes de septiembre debe mostrarse como SEP.");
assertFileIncludes(appCode, '<span class="status-pill ok">Capital disponible</span>', "Resumen superior: la tarjeta derecha debe mostrar Capital disponible.");
assertFileIncludes(appCode, "<strong>${money(dashboard.metrics.availableCapital)}</strong>", "Resumen superior: la tarjeta derecha debe usar capital disponible.");
assertFileIncludes(appCode, "<small>Monto que debe figurar en tu tarjeta</small>", "Resumen superior: el mensaje bajo el valor debe ser el texto solicitado.");
assertCondition(!appCode.includes("<small>Total por cobrar estimado</small>"), "Resumen superior: no debe conservar el texto anterior de total por cobrar.");
assertFileIncludes(htmlCode, "Periodo de fechas", "Resumen: las fechas deben estar agrupadas bajo Periodo de fechas.");
assertFileIncludes(htmlCode, "summary-date-group", "Resumen: falta el contenedor visual del periodo de fechas.");
assertFileIncludes(stylesCode, ".summary-compare-field {\n  display: flex;\n  align-items: center;\n  align-self: stretch;", "Resumen: el boton de comparacion debe centrarse respecto al bloque de fechas.");
assertFileIncludes(stylesCode, ".summary-filter-actions {\n  display: flex;\n  align-items: center;\n  align-self: stretch;", "Resumen: el boton Exportar resumen debe centrarse respecto al bloque de fechas.");
assertFileIncludes(stylesCode, "padding-top: calc(0.84rem * 1.2 + 4px)", "Resumen: los botones de filtros deben compensar la altura del titulo Periodo de fechas.");
assertFileIncludes(htmlCode, 'id="summaryComparePreviousMonth"', "Resumen: debe existir el boton para comparar con mes anterior.");
assertFileIncludes(htmlCode, "Comparar con mes anterior", "Resumen: el boton de comparacion debe mostrar Mes anterior.");
assertFileIncludes(htmlCode, "summary-compare-info", "Resumen: el boton Mes anterior debe tener icono de informacion.");
assertFileIncludes(htmlCode, '<button id="summaryComparePreviousMonth" class="ghost-button summary-compare-button" type="button">\n                  Comparar con mes anterior\n                  <span', "Resumen: el icono de informacion debe estar dentro del boton Mes anterior.");
assertFileIncludes(htmlCode, "compara el periodo seleccionado contra el mismo rango movido un mes atras", "Resumen: el tooltip debe explicar contra que compara.");
assertFileIncludes(htmlCode, "06/08/2026 - 06/09/2026 contra 06/07/2026 - 06/08/2026", "Resumen: el tooltip debe incluir un ejemplo claro.");
assertFileIncludes(htmlCode, "S/1,300 otorgados ese mes", "Resumen: el tooltip de prestamos por mes debe explicar que el grafico muestra monto otorgado.");
assertFileIncludes(appCode, 'excelHeaderRow(["Mes", "Monto otorgado"])', "Exportacion: prestamos otorgados por mes debe exportarse como monto, no como cantidad.");
assertCondition(!appCode.includes('excelHeaderRow(["Mes", "Prestamos creados"])'), "Exportacion: prestamos otorgados por mes no debe conservar encabezado de cantidad.");
assertCondition(!htmlCode.includes('<select id="summaryCompare"'), "Resumen: el selector de comparacion debe ser reemplazado por un boton.");
assertFileIncludes(appCode, "setDashboardPreviousMonthComparison", "Resumen: falta la funcion del boton Mes anterior.");
assertFileIncludes(appCode, 'elements.summaryCompare.value = "previousMonth"', "Resumen: el boton debe activar previousMonth.");
assertFileIncludes(appCode, 'elements.summaryComparePreviousMonth.addEventListener("click"', "Resumen: el boton debe estar conectado al clic.");
assertFileIncludes(appCode, "elements.summaryCustomStart.value = addMonthsKeepingDay(today, getDayOfMonth(today), -1)", "Resumen: el boton debe iniciar en el mismo dia del mes anterior.");
assertCondition(!htmlCode.includes("Restablecer orden"), "Resumen: el boton Restablecer orden no debe mostrarse en Indicadores.");
assertFileIncludes(stylesCode, ".filter-cell {\n  display: grid;\n  grid-template-rows: 28px 34px;", "Clientes: las cabeceras con filtros deben quedar alineadas en filas consistentes.");
assertFileIncludes(stylesCode, ".filter-cell > span:first-child {\n  display: flex;\n  align-items: center;\n  justify-content: center;", "Clientes: los titulos de filtros deben estar centrados.");
assertFileIncludes(stylesCode, ".filter-cell input {\n  width: 100%;\n  min-width: 0;\n  min-height: 34px;", "Clientes: los campos de filtro deben mantener altura consistente.");
assertFileIncludes(stylesCode, "text-transform: none;\n  text-align: center;", "Clientes: los textos de los filtros deben quedar centrados.");
assertFileIncludes(stylesCode, ".filter-actions {\n  display: grid;\n  grid-template-rows: 28px 34px;", "Clientes: la columna Acciones debe alinearse con las filas del encabezado.");
assertFileIncludes(stylesCode, "minmax(150px, 0.84fr)", "Clientes: las columnas de fecha deben conservar un ancho minimo que evite deformaciones.");
assertFileIncludes(stylesCode, "minmax(370px, 1.24fr)", "Clientes: la columna Acciones debe tener ancho suficiente para centrar todos sus botones.");
assertFileIncludes(stylesCode, "min-width: 1100px", "Clientes: la tabla debe conservar ancho minimo para no deformar Acciones.");
assertFileIncludes(stylesCode, '.filter-cell input[type="date"]', "Clientes: los filtros de fecha deben tener ajuste especifico.");
assertFileIncludes(stylesCode, ".client-row > span:nth-of-type(4),\n.client-row > span:nth-of-type(5)", "Clientes: las fechas de la cartera deben permanecer en una sola linea.");
assertFileIncludes(stylesCode, ".client-row > .row-actions {\n  border-left: 1px solid var(--line);\n  justify-content: center;", "Clientes: las acciones principales deben centrarse dentro de su columna.");
assertFileIncludes(stylesCode, ".client-extension-row > .row-actions {\n  border-left: 1px solid var(--line);\n  justify-content: center;", "Clientes: las acciones de ampliaciones deben centrarse dentro de su columna.");
assertFileIncludes(stylesCode, ".row-actions .small-button {\n  flex: 0 0 auto;", "Clientes: los botones de acciones no deben comprimirse.");
assertCondition(!appCode.includes("${icons.trash} Eliminar"), "Clientes: eliminar debe ser solo icono, sin texto.");
assertFileIncludes(appCode, 'class="delete-button small-button history-action"', "Clientes: Historial debe ocupar el lugar visual del boton amarillo.");
assertFileIncludes(appCode, "${icons.history}\n              Historial", "Clientes: el boton Historial debe usar icono de historial y texto.");
assertFileIncludes(appCode, 'class="icon-button square-action delete-icon-action"', "Clientes: el tachito debe ser un boton cuadrado pequeno.");
assertFileIncludes(stylesCode, ".history-action", "Clientes: el nuevo boton Historial debe tener estilo propio.");
assertFileIncludes(stylesCode, ".delete-icon-action", "Clientes: el tachito de eliminar debe tener estilo propio.");
assertFileIncludes(htmlCode, 'id="loanDeleteTitle">Eliminar prestamo</h3>', "Clientes: el modal de borrado debe servir para prestamo principal y ampliacion.");
assertFileIncludes(appCode, "clientLoans.find(isPrimaryLoan) || null", "Clientes: la fila principal debe mostrar solo el prestamo principal, no tomar una ampliacion como principal.");
assertFileIncludes(appCode, "const hasExplicitOperationTypes = clientLoans.some", "Clientes: la normalizacion no debe convertir ampliaciones explicitas en principal.");
assertFileIncludes(appCode, "return hasExplicitOperationTypes ? null : loans[0] || null;", "Clientes: no debe inventarse prestamo principal desde la primera ampliacion explicita.");
assertFileIncludes(appCode, 'title="Eliminar prestamo principal"', "Clientes: el tachito de la fila principal debe borrar el prestamo principal.");
assertFileIncludes(appCode, "El cliente y sus ampliaciones se mantendran en la cartera.", "Clientes: al borrar el prestamo principal se deben conservar las ampliaciones.");
assertFileIncludes(appCode, "loan.parentLoanId === loanId ? { ...loan, parentLoanId: null }", "Clientes: al borrar el principal se deben desvincular las ampliaciones locales sin eliminarlas.");
assertFileIncludes(appCode, "principals.length > 1", "Clientes: la auditoria debe permitir clientes con ampliaciones y sin prestamo principal.");
assertCondition(!appCode.includes("Ampliaciones de ${escapeHTML(client.name)}"), "Clientes: no debe mostrarse una franja separada con el titulo de ampliaciones.");
assertFileIncludes(appCode, "Ampliacion ${index + 1}", "Clientes: cada ampliacion debe indicar Ampliacion 1, Ampliacion 2, etc.");
assertFileIncludes(appCode, "<strong>${escapeHTML(client.name)}</strong>", "Clientes: cada ampliacion debe mostrar primero el nombre del cliente.");
assertFileIncludes(appCode, '<small class="extension-client-name">Ampliacion ${index + 1}</small>', "Clientes: cada ampliacion debe mostrar Ampliacion debajo del nombre del cliente.");
assertFileIncludes(stylesCode, ".client-extension-panel {\n  grid-column: 1 / -1;\n  display: grid;\n  gap: 0;", "Clientes: las ampliaciones deben quedar pegadas al cliente principal.");
assertFileIncludes(stylesCode, ".extension-client-name", "Clientes: el nombre del cliente en ampliaciones debe tener estilo propio.");
assertFileIncludes(htmlCode, 'id="clientHorizontalScroll"', "Clientes: debe existir una barra horizontal auxiliar para la tabla.");
assertFileIncludes(stylesCode, ".client-horizontal-scroll {\n  position: fixed;", "Clientes: la barra horizontal auxiliar debe quedar fija en pantalla.");
assertFileIncludes(appCode, "initClientHorizontalScrollbar", "Clientes: falta inicializar la barra horizontal auxiliar.");
assertFileIncludes(appCode, "syncClientHorizontalScrollbar", "Clientes: la barra horizontal auxiliar debe sincronizarse con la tabla.");
assertFileIncludes(appCode, "clientsViewIsActive && tableIsVisible", "Clientes: la barra auxiliar solo debe mostrarse en la vista Clientes cuando la tabla esta visible.");
assertCondition(!htmlCode.includes("summaryOperation"), "Resumen: el filtro visual Tipo de operacion no debe seguir en el HTML.");
assertFileIncludes(appCode, 'operation: "all"', "Resumen: al retirar el filtro visual, la operacion interna debe quedar en Todos.");
assertCondition(!appCode.includes("summaryCustomStart.value = getCalendarMonthRange"), "Resumen: Desde no debe llenarse automaticamente con el mes actual.");
assertCondition(!appCode.includes("summaryCustomEnd.value = getCalendarMonthRange"), "Resumen: Hasta no debe llenarse automaticamente con el mes actual.");
assertFileIncludes(wranglerCode, '"main": "src/worker.js"', "Pagos: Cloudflare debe usar Worker para endpoints seguros.");
assertFileIncludes(wranglerCode, '"binding": "ASSETS"', "Pagos: Worker debe servir los assets estaticos con binding.");
assertFileIncludes(appCode, 'fetch("/api/billing/checkout"', "Pagos: el frontend debe iniciar checkout desde el Worker.");
assertFileIncludes(appCode, "checkoutUrl", "Pagos: el frontend debe redirigir al enlace de Mercado Pago.");
assertFileIncludes(workerCode, "/api/billing/mercadopago/webhook", "Pagos: falta endpoint de webhook de Mercado Pago.");
assertFileIncludes(workerCode, "MERCADOPAGO_ACCESS_TOKEN", "Pagos: el Worker debe usar token privado de Mercado Pago.");
assertFileIncludes(workerCode, "SUPABASE_SERVICE_ROLE_KEY", "Pagos: el Worker debe activar planes con service role, no desde navegador.");
assertFileIncludes(workerCode, 'if (!serviceKey.startsWith("sb_secret_"))', "Pagos: las claves sb_secret de Supabase no deben enviarse como Bearer.");
assertFileIncludes(workerCode, 'requireEnv(env, "MERCADOPAGO_WEBHOOK_SECRET")', "Pagos: el webhook debe exigir clave secreta de Mercado Pago.");
assertFileIncludes(workerCode, "verifyMercadoPagoSignature", "Pagos: el webhook debe poder validar la firma de Mercado Pago.");
assertFileIncludes(workerCode, 'url.searchParams.get("data_id")', "Pagos: el webhook debe aceptar data_id de Mercado Pago.");
assertFileIncludes(workerCode, "/v1/payments/", "Pagos: el webhook debe consultar el pago confirmado a Mercado Pago.");
assertFileIncludes(workerCode, "APPROVED_PAYMENT_STATUSES", "Pagos: solo estados aprobados deben activar plan.");
assertFileIncludes(workerCode, 'status: "active"', "Pagos: el plan se activa desde el webhook.");
assertFileIncludes(workerCode, "client_limit: plan.clientLimit", "Pagos: el webhook debe aplicar el limite del plan.");
assertFileIncludes(workerCode, "cancelPendingPlanRequests", "Pagos: antes de crear checkout debe cancelar solicitudes pendientes anteriores.");
assertFileIncludes(workerCode, "cancelMercadoPagoPreapproval", "Pagos: al cambiar de plan debe cancelar la suscripcion anterior de Mercado Pago.");
assertFileIncludes(workerCode, 'method: "PUT"', "Pagos: la cancelacion de suscripcion debe actualizar la preapproval en Mercado Pago.");
assertFileIncludes(workerCode, 'body: { status: "cancelled" }', "Pagos: Mercado Pago debe recibir estado cancelled para detener cobros recurrentes.");
assertFileIncludes(workerCode, "mapProviderStatusToSubscriptionStatus", "Pagos: el webhook debe mapear cancelaciones, rechazos y renovaciones.");
assertFileIncludes(workerCode, "past_due", "Pagos: debe existir estado para pagos vencidos o rechazados.");
assertFileIncludes(workerCode, "refunded", "Pagos: debe existir estado para devoluciones.");
assertFileIncludes(workerCode, "chargeback", "Pagos: debe existir estado para contracargos.");
assertFileIncludes(workerCode, "current_period_end", "Pagos: debe guardar el fin del periodo vigente cuando el proveedor lo informe.");
assertCondition(!workerCode.includes('!requestRecord || requestRecord.status === "approved"'), "Pagos: el webhook no debe ignorar solicitudes ya aprobadas porque puede llegar cancelacion o renovacion.");
assertFileIncludes(workerCode, "isTerminalPlanRequestStatus", "Pagos: un webhook tardio de una solicitud cancelada no debe afectar la suscripcion nueva.");
assertFileIncludes(appCode, 'state.subscription?.status && state.subscription.status !== "active"', "Pagos: el frontend debe tratar como Gratis una suscripcion no activa.");
assertFileIncludes(appCode, "El plan Gratis no usa checkout de Mercado Pago", "Pagos: Gratis no debe abrir checkout automatico.");
assertFileIncludes(workerCode, "external_reference", "Pagos: Mercado Pago debe guardar referencia de la solicitud.");
assertFileIncludes(workerCode, "back_url", "Pagos: el regreso desde Mercado Pago no debe activar plan.");
assertFileIncludes(htmlCode, 'id="planTermsAccept"', "Pagos: debe existir casilla para aceptar terminos antes del checkout.");
assertFileIncludes(htmlCode, "el cobro mensual de mi suscripcion", "Pagos: el modal debe mostrar aceptacion de terminos y cobro mensual.");
assertFileIncludes(appCode, "Debes aceptar los terminos y el cobro mensual", "Pagos: debe bloquear checkout si no se aceptan terminos.");
assertFileIncludes(stylesCode, ".billing-terms-note", "Pagos: la nota legal de suscripcion debe tener estilo propio.");
assertFileIncludes(htmlCode, 'id="termsDialog"', "Legal: debe existir modal de Terminos y Condiciones.");
assertFileIncludes(htmlCode, "sidebar-legal", "Legal: debe existir acceso a terminos en la barra lateral.");
assertFileIncludes(htmlCode, 'data-open-claims', "Legal: debe existir acceso lateral al Libro de Reclamaciones.");
assertFileIncludes(htmlCode, 'assets/libro-reclamaciones.png', "Legal: el acceso lateral debe usar la imagen del Libro de Reclamaciones.");
assertFileIncludes(htmlCode, 'id="claimsDialog"', "Legal: debe existir modal de Libro de Reclamaciones.");
assertFileIncludes(htmlCode, 'id="claimBookForm"', "Legal: debe existir formulario de Libro de Reclamaciones.");
assertFileIncludes(htmlCode, "Mz. E Lote 33 Urb. Tres Orizontes", "Libro de Reclamaciones: debe mostrar direccion del proveedor.");
assertFileIncludes(htmlCode, 'class="whatsapp-float"', "Soporte: debe existir boton flotante de WhatsApp.");
assertFileIncludes(htmlCode, "https://wa.me/51984096252", "Soporte: el boton de WhatsApp debe apuntar al numero autorizado.");
assertFileIncludes(htmlCode, "tengo%20una%20duda%20o%20sugerencia", "Soporte: WhatsApp debe abrir con mensaje sugerido.");
assertFileIncludes(stylesCode, ".whatsapp-float {\n  position: fixed;", "Soporte: el boton de WhatsApp debe quedar fijo en pantalla.");
assertFileIncludes(appCode, 'fetch("/api/reclamaciones"', "Libro de Reclamaciones: el frontend debe registrar la hoja via Worker.");
assertFileIncludes(workerCode, "/api/reclamaciones", "Libro de Reclamaciones: el Worker debe exponer endpoint seguro.");
assertFileIncludes(workerCode, "normalizeClaimBookEntry", "Libro de Reclamaciones: el Worker debe validar datos antes de guardar.");
assertFileIncludes(sqlCode, "create table if not exists claim_book_entries", "Libro de Reclamaciones: migracion debe crear tabla.");
assertFileIncludes(sqlCode, "grant select, insert, update, delete on claim_book_entries to service_role", "Libro de Reclamaciones: service_role debe poder guardar hojas.");
assertFileIncludes(schemaCode, "create table if not exists claim_book_entries", "Libro de Reclamaciones: esquema base debe crear tabla.");
assertFileIncludes(htmlCode, "HOYOS BUENO MELVIN", "Legal: los terminos deben incluir titular legal.");
assertFileIncludes(htmlCode, "10735063818", "Legal: los terminos deben incluir RUC correcto.");
assertFileIncludes(htmlCode, "MLVN696986@GMAIL.COM", "Legal: los terminos deben incluir correo de soporte.");
assertCondition(!htmlCode.includes("Domicilio fiscal:"), "Legal: los terminos no deben mostrar direccion fiscal en el bloque publico.");
assertFileIncludes(htmlCode, "Regresar</button>", "Legal: el modal debe tener boton Regresar al final.");
assertFileIncludes(htmlCode, "hasta 29 dias calendario", "Legal: los terminos deben reflejar la politica de reembolso.");
assertFileIncludes(htmlCode, 'id="authTermsAccept"', "Legal: registro debe pedir aceptacion de terminos.");
assertFileIncludes(appCode, "Debes aceptar los Terminos y Condiciones", "Legal: registro debe bloquear si no acepta terminos.");
assertFileIncludes(stylesCode, ".legal-panel", "Legal: el documento debe tener estilo propio.");
assertFileIncludes(stylesCode, "width: min(94vw, 1040px)", "Legal: el modal de terminos debe ser mas ancho para lectura comoda.");
assertFileIncludes(stylesCode, ".sidebar-legal", "Legal: el acceso lateral debe tener estilo profesional.");
assertFileIncludes(stylesCode, "margin-top: auto", "Legal: el bloque lateral debe quedar pegado a la parte inferior del sidebar.");
assertFileIncludes(sqlCode, "provider_subscription_id", "Pagos: SQL debe guardar el ID de suscripcion/pago del proveedor.");
assertFileIncludes(sqlCode, "current_period_end", "Pagos: SQL debe guardar el fin del periodo vigente de la suscripcion.");
assertFileIncludes(sqlCode, "subscriptions_status_lifecycle", "Pagos: SQL debe validar el ciclo de vida de la suscripcion.");
assertFileIncludes(sqlCode, "plan_requests_status_lifecycle", "Pagos: SQL debe validar estados de solicitudes de plan.");
assertFileIncludes(sqlCode, "subscriptions_provider_subscription_idx", "Pagos: SQL debe indexar suscripciones por proveedor para webhooks.");
assertFileIncludes(sqlCode, "plan_requests_provider_subscription_idx", "Pagos: SQL debe indexar busqueda de webhook por proveedor.");
assertFileIncludes(sqlCode, "grant select, insert, update, delete on plan_requests to service_role", "Pagos: service_role debe poder escribir plan_requests desde el Worker.");
assertFileIncludes(sqlCode, "grant select, insert, update, delete on subscriptions to service_role", "Pagos: service_role debe poder activar subscriptions desde el Worker.");
assertFileIncludes(schemaCode, "provider_status text", "Pagos: esquema base debe incluir estado del proveedor.");
assertFileIncludes(schemaCode, "current_period_end timestamptz", "Pagos: esquema base debe incluir fin de periodo vigente.");
assertFileIncludes(schemaCode, "grant usage on schema public to service_role", "Pagos: service_role debe tener uso del esquema public.");

console.log("Pruebas financieras OK");
