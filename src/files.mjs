import { stringify } from "csv-stringify/sync";
import { promises as fs } from "fs";
import path from "path";
import sanitizeFilename from "sanitize-filename";
import { dateToString } from "./helper.mjs";

/**
 * Saves downloaded voucher/invoice data from @see downloadDocuments to disk
 *
 * @param {Array} document
 * @param {string} savePath
 * @returns number of saved documents
 */
const saveDocuments = async (documents, savePath) => {
  return Promise.all(
    documents.map((document) => {
      return saveDocument(document, savePath);
    })
  );
};

/**
 * Private. Saves a single document
 * @see saveDocuments
 *
 * @param {Object} document
 * @param {string} savePath
 * @returns
 */
const saveDocument = async (document, savePath) => {
  if (!document) {
    return null;
  }
  const filename = sanitizeFilename(document.fileName);
  try {
    await fs.writeFile(path.join(savePath, filename), document.document);
    return 1;
  } catch (err) {
    return 0;
  }
};

/**
 * Writes journal/report data to a csv file
 * 
 * @param {Array} reportData 
 * @param {string} savePath 
 * @returns 
 */
const writeReportCSV = async(reportData, savePath) => {
  const filename = "journal.csv";

  const data = reportData.map(entry => {
    return {
      ...entry,
      date: dateToString(entry.date),
      payDate: dateToString(entry.payDate),
      categories: Array.isArray(entry.categories) ? entry.categories.join(", ") : "",
      paidAmount: entry.paidAmount.toLocaleString("de"),
    };
  });
  const output = stringify(data, {
    header: true,
    columns: [
      {
        key: "type",
        header: "Typ"
      },
      {
        key: "date",
        header: "Rechnungs-/Belegdatum"
      },
      {
        key: "number",
        header: "Nummer"
      },
      {
        key: "contact",
        header: "Kunde/Lieferant"
      },
      {
        key: "payDate",
        header: "Zahlung Datum"
      },
      {
        key: "paidAmount",
        header: "Zahlung Summe"
      },
      {
        key: "categories",
        header: "Kategorie"
      },
      {
        key: "filename",
        header: "Dateiname"
      },
    ]
  });


  try {
    await fs.writeFile(path.join(savePath, filename), output);
    return 1;
  } catch(err) {
    return 0;
  }
};

export { saveDocuments, writeReportCSV };
