import ora from "ora";
import { program } from "commander";
import "dotenv/config";
import { downloadVouchers, getVouchers } from "./sevdesk.mjs";
import { dateToString, deleteAllFilesInDirectory } from "./helper.mjs";
import path from "path";
import { saveVouchers } from "./files.mjs";

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
      path.join(process.cwd(), "export")
    )
    .option(
      "-d, --delete",
      "Löscht bestehende Dateien im Export-Verzeichnis",
      false
    )
    .option(
      "--api-token",
      "API-Token für sevDesk. Einstellungen > Benutzer > API-Token. Alternativ auch via `.env` möglich",
      process.env.SEVDESK_API_KEY
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
  const exportDir = options.dir;
  const deletExisting = options.delete;
  const apiToken = options.apiToken;

  if (deletExisting) {
    const deleteSpinner = ora("Lösche bestehende Dateien").start();
    const deleteResult = await deleteAllFilesInDirectory(exportDir);
    if (deleteResult) {
      deleteSpinner.succeed();
    } else {
      deleteSpinner.warn("Fehler beim Löschen, fahre fort");
    }
  } else {
    ora("Lösche keine bestehenden Dateien").info();
  }

  const getSpinner = ora("Hole Belegdaten von sevDesk").start();
  let vouchers, documents, savedFiles;
  try {
    vouchers = await getVouchers(startDate, endDate, apiToken);
    getSpinner.succeed();
  } catch (err) {
    getSpinner.fail(`Fehler bei den Belegdaten von sevDesk: ${err.message}`);
    return;
  }

  const downloadSpinner = ora("Lade PDFs von sevDesk").start();
  try {
    documents = await downloadVouchers(vouchers, apiToken);
    downloadSpinner.succeed();
  } catch (err) {
    downloadSpinner.fail(`Fehler beim Laden der PDFs: ${err.message}`);
    return;
  }

  const saveSpinner = ora("Speichere PDFs im Ordner").start();
  try {
    savedFiles = await saveVouchers(documents, exportDir);
    saveSpinner.succeed();
  } catch (err) {
    saveSpinner.fail(`Fehler beim Speichern der PDFs: ${err.message}`);
    return;
  }
  if (savedFiles) {
    savedFiles = savedFiles.filter((f) => f);
    ora(
      `${savedFiles.length} Belege wurden heruntergeladen und in ${exportDir} gespeichert`
    ).succeed();
  }
};
main();
