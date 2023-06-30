import ora from "ora";
import { program } from "commander";
import "dotenv/config";
import {
  getVouchers,
  getInvoices,
  downloadDocuments,
  buildVoucherReportData,
  buildInvoiceReportData,
} from "./sevdesk.mjs";
import {
  dateToString,
  deleteAllFilesInDirectory,
  customFormat,
} from "./helper.mjs";
import path from "path";
import {
  getFileSystemProvider,
  prepareDirectory,
  saveDocuments,
  writeReportCSV,
} from "./files.mjs";

const main = async () => {
  const today = new Date();
  let startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1); // automatically goes back a year if january/december
  let endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0); // set day to 0 = last day

  program
    .requiredOption(
      "--start <startDate>",
      "Stardatum (yyyy-mm-dd)",
      dateToString(startDate)
    )
    .requiredOption(
      "--end <endDate>",
      "Enddatum (yyyy-mm-dd)",
      dateToString(endDate)
    )
    .requiredOption(
      "--dir <exportDir>",
      "Verzeichnis in dem die PDFs gespeichert werden sollen",
      process.env.EXPORT_DIR || "export"
    )
    .option(
      "-d, --delete",
      "Löscht bestehende Dateien im Export-Verzeichnis",
      false
    )
    .option(
      "-r, --report",
      "Fügt einen Bericht mit Infos zu allen exportierten Dateien an (csv)",
      false
    )
    .option(
      "--extra-info-filename",
      "Speichert zusätzliche Infos (wie Kategorien) in den Dateinamen",
      false
    )
    .option(
      "--api-token",
      "API-Token für sevDesk. Einstellungen > Benutzer > API-Token. Alternativ auch via `.env` möglich",
      process.env.SEVDESK_API_KEY
    )
    .option(
      "--webdav-address",
      "Die Adresse unter der das WebDAV Verzeichnis erreichbar ist. Alternativ auch via `.env` möglich",
      process.env.WEBDAV_ADDRESS
    )
    .option(
      "--webdav-username",
      "Der WebDav Username. Alternativ auch via `.env` möglich",
      process.env.WEBDAV_USERNAME
    )
    .option(
      "--webdav-password",
      "Das WebDav Passwort. Alternativ auch via `.env` möglich",
      process.env.WEBDAV_PASSWORD
    )
    .addHelpText(
      "after",
      `\nBeispiel:
  $ sevdesk-export --start 2022-02-01 --end 2022-02-28 --dir ~/buchhaltung/2022/02 --delete`
    );

  program.parse(process.argv);

  const options = program.opts();
  startDate = new Date(options.start);
  endDate = new Date(options.end);
  const deleteExisting = options.delete;
  const exportReport = options.report;

  let exportDir = options.dir;

  const reportData = [];

  /**
   * Get the fs provider. Can either be local fs or webdav fs wrapper
   */
  let fileSystemProvider = getFileSystemProvider(options);

  /**
   * Prepare directory
   */
  try {
    await prepareDirectory(fileSystemProvider, exportDir);
  } catch (err) {
    console.error(
      `Das Ausgabeverzeichnis ${exportDir} kann nicht verwendet werden: ${err}`
    );
    process.exit(1);
  }

  /**
   * 1. delete existing files
   */

  if (deleteExisting) {
    const deleteSpinner = ora("Lösche bestehende Dateien").start();
    const deleteResult = await deleteAllFilesInDirectory(
      fileSystemProvider,
      exportDir
    );
    if (deleteResult) {
      deleteSpinner.succeed();
    } else {
      deleteSpinner.warn("Fehler beim Löschen, fahre fort");
    }
  } else {
    ora("Lösche keine bestehenden Dateien").info();
  }

  /**
   * 2. get, download and save VOUCHERS
   */
  const getSpinner = ora(
    `Hole Belegdaten von sevDesk zwischen ${customFormat(
      startDate
    )} und ${customFormat(endDate)}`
  ).start();
  let vouchers, documents, savedFiles;
  try {
    vouchers = await getVouchers(startDate, endDate, options);
    if (!vouchers.length) {
      getSpinner.info("Keine Belege gefunden");
      return;
    }
    getSpinner.succeed();
  } catch (err) {
    getSpinner.fail(`Fehler bei den Belegdaten von sevDesk: ${err.message}`);
    return;
  }

  const downloadSpinner = ora("Lade Beleg-PDFs von sevDesk").start();
  try {
    documents = await downloadDocuments("vouchers", vouchers, options);
    if (!documents.length) {
      downloadSpinner.info("Keine Beleg-PDFs gefunden");
      return;
    }
    downloadSpinner.succeed();
  } catch (err) {
    downloadSpinner.fail(`Fehler beim Laden der Beleg-PDFs: ${err.message}`);
    return;
  }

  const saveSpinner = ora("Speichere Beleg-PDFs im Ordner").start();
  try {
    savedFiles = await saveDocuments(fileSystemProvider, documents, options);
    if (!savedFiles.length) {
      saveSpinner.info("Keine Beleg-PDFs gespeichert");
      return;
    }
    saveSpinner.succeed();
  } catch (err) {
    saveSpinner.fail(`Fehler beim Speichern der Beleg-PDFs: ${err.message}`);
    return;
  }
  if (savedFiles) {
    savedFiles = savedFiles.filter((f) => f);
    ora(
      `${savedFiles.length} Belege wurden heruntergeladen und in ${exportDir} gespeichert`
    ).succeed();

    if (exportReport) {
      const voucherReportData = buildVoucherReportData(vouchers, options);
      reportData.push(...voucherReportData);
    }
  }

  /**
   * 2. get, download and save INVOICES
   */
  const getInvoicesSpinner = ora("Hole Rechnungen von sevDesk").start();
  let invoices, invoiceDocuments, savedInvoiceFiles;
  try {
    invoices = await getInvoices(startDate, endDate, options);
    if (!invoices.length) {
      getInvoicesSpinner.info("Keine Rechnungen gefunden");
      return;
    }
    getInvoicesSpinner.succeed();
  } catch (err) {
    getInvoicesSpinner.fail(
      `Fehler bei den Rechnungen von sevDesk: ${err.message}`
    );
    return;
  }

  const downloadInvoicesSpinner = ora("Lade Rechnung-PDFs von sevDesk").start();
  try {
    invoiceDocuments = await downloadDocuments("invoices", invoices, options);
    if (!invoiceDocuments.length) {
      downloadInvoicesSpinner.info("Keine Rechnung-PDFs gefunden");
      return;
    }
    downloadInvoicesSpinner.succeed();
  } catch (err) {
    downloadInvoicesSpinner.fail(
      `Fehler beim Laden der Rechnung-PPDFs: ${err.message}`
    );
    return;
  }

  const saveInvoicesSpinner = ora("Speichere Rechnung-PDFs im Ordner").start();
  try {
    savedInvoiceFiles = await saveDocuments(
      fileSystemProvider,
      invoiceDocuments,
      options
    );
    if (!savedInvoiceFiles.length) {
      saveInvoicesSpinner.info("Keine Rechnung-PDFs gespeichert");
      return;
    }
    saveInvoicesSpinner.succeed();
  } catch (err) {
    saveInvoicesSpinner.fail(
      `Fehler beim Speichern der Rechnung-PDFs: ${err.message}`
    );
    return;
  }
  if (savedInvoiceFiles) {
    savedInvoiceFiles = savedInvoiceFiles.filter((f) => f);
    ora(
      `${savedInvoiceFiles.length} Rechnungen wurden heruntergeladen und in ${exportDir} gespeichert`
    ).succeed();

    if (exportReport) {
      const invoiceReportData = buildInvoiceReportData(invoices, options);
      reportData.push(...invoiceReportData);
    }
  }

  if (exportReport) {
    writeReportCSV(fileSystemProvider, reportData, exportDir);
    ora(`Journal wurde in journal.csv gespeichert`).succeed();
  }
};
main();
