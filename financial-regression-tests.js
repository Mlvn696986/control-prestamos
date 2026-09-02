const fs = require("fs");
const vm = require("vm");

const appCode = fs.readFileSync("app.js", "utf8");
const sqlCode = fs.readFileSync("supabase-financial-integrity.sql", "utf8");
const stylesCode = fs.readFileSync("styles.css", "utf8");

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
    getItem() {
      return null;
    },
    setItem() {},
    removeItem() {},
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

resetTestState({
  clients: [testClient("atraviesa"), testClient("cerrado")],
  loans: [
    testLoan({ id: "loan-cross", clientId: "atraviesa", amount: 500, startDate: "2026-07-15", nextDueDate: "2026-09-15" }),
    testLoan({ id: "loan-closed", clientId: "cerrado", amount: 300, remainingCapital: 0, startDate: "2026-07-01", nextDueDate: "2026-07-20", status: "closed", closedAt: "2026-07-20" }),
  ],
});
let dashboard = buildTestDashboard();
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
const expectedIndicatorCount =
  getDashboardKpiItems(dashboard).length + getDashboardManagementItems(dashboard).length + getDashboardAdvancedItems(dashboard).length;
assertEqual(indicatorItems.length, expectedIndicatorCount, "Resumen: la seccion Indicadores debe conservar todos los indicadores.");
assertEqual(new Set(indicatorItems.map((item) => item.indicatorId)).size, indicatorItems.length, "Resumen: cada indicador debe tener un ID unico para ordenar.");
const capitalAddedIndicator = indicatorItems.find((item) => item.title === "Capital agregado");
assert(capitalAddedIndicator?.tip === "Aquí te figura solo los aportes que realizas. NO cuenta los intereses.", "Capital agregado: el texto explicativo debe estar en el tooltip.");
assert(!getIndicatorMessages("Capital agregado").includes(capitalAddedIndicator.tip), "Capital agregado: la frase del tooltip no debe reemplazar los mensajes dinamicos inferiores.");

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
let preview = buildPaymentTransactionPreview(amortizationLoan, {
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

assertFileIncludes(appCode, 'saas.client.rpc("register_payment"', "Prueba E/F: el cobro en nube debe usar RPC transaccional.");
assertFileIncludes(appCode, "paymentSubmissionInProgress", "Prueba H: debe existir proteccion de doble clic en cobro.");
assertFileIncludes(appCode, "clientSubmissionInProgress", "Prueba H: debe existir proteccion de doble clic al guardar cliente/ampliacion.");
assertFileIncludes(appCode, "loanDeletionInProgress", "Prueba H: debe existir proteccion de doble clic al eliminar ampliacion.");
assertFileIncludes(appCode, "clientDeletionInProgress", "Prueba H: debe existir proteccion de doble clic al eliminar cliente.");
assertCondition(!appCode.includes('.from("payments").delete'), "Eliminaciones cloud no deben borrar pagos manualmente antes de borrar cliente/prestamo.");
assertCondition(!appCode.includes('.from("payments").insert'), "Pagos cloud no deben insertarse fuera de RPC transaccional.");
assertFileIncludes(sqlCode.toLowerCase(), "for update", "Prueba E/F: la RPC debe bloquear el prestamo con FOR UPDATE.");
assertFileIncludes(sqlCode, "loans_amount_nonnegative", "Prueba G: falta constraint de monto de prestamo no negativo.");
assertFileIncludes(sqlCode, "payments_capital_paid_nonnegative", "Prueba G: falta constraint de capital pagado no negativo.");
assertFileIncludes(sqlCode, "payments_interest_paid_nonnegative", "Prueba G: falta constraint de interes pagado no negativo.");
assertFileIncludes(sqlCode, "loans_client_same_user", "RLS/FK: falta relacion que obliga prestamo y cliente del mismo usuario.");
assertFileIncludes(sqlCode, "payments_loan_same_user", "RLS/FK: falta relacion que obliga pago y prestamo del mismo usuario.");
assertFileIncludes(sqlCode, "loans_status_matches_remaining_capital", "Invariantes: falta constraint de estado vs capital pendiente.");
assertFileIncludes(sqlCode, "payments_has_amount", "Invariantes: falta constraint que impide pagos en cero.");
assertCondition(!appCode.includes(".slice(0, 4)"), "Cobranza rapida no debe cortar registros; debe usar scroll interno.");
assertFileIncludes(appCode, "summary-scroll-count", "Cobranza rapida debe mostrar contador cuando hay mas de 3 registros.");
assertFileIncludes(appCode, "scrollQuickCollection", "Cobranza rapida debe permitir avanzar con chevron.");
assertFileIncludes(stylesCode, "overscroll-behavior: contain", "Cobranza rapida debe mantener scroll interno independiente.");
assertFileIncludes(stylesCode, "scrollbar-width: thin", "Cobranza rapida debe usar scrollbar discreta.");
assertFileIncludes(appCode, 'class="kpi-value"', "Resumen: los valores principales deben usar una clase visual compartida.");
assertFileIncludes(stylesCode, ".kpi-value", "Resumen: falta la regla CSS centralizada para valores principales.");
assertCondition(!stylesCode.includes(".summary-compact-card strong"), "Resumen: los indicadores compactos no deben tener un tamano de valor separado.");

console.log("Pruebas financieras OK");
