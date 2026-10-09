const NativeDate = Date;
const instant = NativeDate.parse(process.env.ERMIF_TEST_HOST_DATE);
if (!Number.isFinite(instant)) throw new Error("Fecha simulada invalida.");
global.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [instant])); }
  static now() { return instant; }
};
