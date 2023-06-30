import { stringify } from "csv-stringify/sync";
import * as fs from "fs";
import path from "path";
import sanitizeFilename from "sanitize-filename";
import { dateToString } from "./helper.mjs";
import { createAdapter } from "webdav-fs";

export const getFileSystemProvider = ({
  webdavAddress,
  webdavUsername,
  webdavPassword,
}) => {
  if (webdavAddress) {
    const webDavAdapter = createAdapter(
      webdavAddress,
      webdavUsername && webdavPassword
        ? {
            username: webdavUsername,
            password: webdavPassword,
          }
        : undefined
    );

    return {
      ...webDavAdapter,
      readdir: (dirPath, callback) => {
        // possible workaround for https://github.com/perry-mitchell/webdav-client/pull/324
        // dirPath = dirPath.startsWith("/") ? dirPath : `/${dirPath}`;

        // use "stat" so isFile/isDirectory is available on file entries
        // also fixes returning the name of the directory (as in https://github.com/perry-mitchell/webdav-client/pull/324)
        return webDavAdapter.readdir(dirPath, "stat", callback);
      },
    };
  }

  return {
    ...fs,
    readdir: (dirPath, callback) => {
      return fs.readdir(dirPath, { withFileTypes: true }, callback);
    },
  };
};

/**
 * Saves downloaded voucher/invoice data from @see downloadDocuments to disk
 *
 * @param {fs} fsProvider
 * @param {Array} document
 * @param {object} options
 * @returns number of saved documents
 */
const saveDocuments = async (fsProvider, documents, { dir }) => {
  return Promise.all(
    documents.map((document) => {
      return saveDocument(fsProvider, document, dir);
    })
  );
};

/**
 * Private. Saves a single document
 * @see saveDocuments
 *
 * @param {fs} fsProvider
 * @param {Object} document
 * @param {string} savePath
 * @returns
 */
const saveDocument = async (fsProvider, document, savePath) => {
  if (!document) {
    return null;
  }
  const filename = sanitizeFilename(document.fileName);
  try {
    await new Promise((resolve, reject) =>
      fsProvider.writeFile(
        path.join(savePath, filename),
        document.document,
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      )
    );
    return 1;
  } catch (err) {
    return 0;
  }
};

/**
 * Writes journal/report data to a csv file
 *
 * @package {fs} fsProvider
 * @param {Array} reportData
 * @param {string} savePath
 * @returns
 */
const writeReportCSV = async (fsProvider, reportData, savePath) => {
  const filename = "journal.csv";

  const data = reportData.map((entry) => {
    return {
      ...entry,
      date: dateToString(entry.date),
      payDate: dateToString(entry.payDate),
      categories: Array.isArray(entry.categories)
        ? entry.categories.join(", ")
        : "",
      paidAmount: entry.paidAmount.toLocaleString("de"),
    };
  });
  const output = stringify(data, {
    header: true,
    columns: [
      {
        key: "type",
        header: "Typ",
      },
      {
        key: "date",
        header: "Rechnungs-/Belegdatum",
      },
      {
        key: "number",
        header: "Nummer",
      },
      {
        key: "contact",
        header: "Kunde/Lieferant",
      },
      {
        key: "payDate",
        header: "Zahlung Datum",
      },
      {
        key: "paidAmount",
        header: "Zahlung Summe",
      },
      {
        key: "categories",
        header: "Kategorie",
      },
      {
        key: "filename",
        header: "Dateiname",
      },
    ],
  });

  try {
    await new Promise((resolve, reject) =>
      fsProvider.writeFile(path.join(savePath, filename), output, (err) => {
        if (err) return reject(err);
        resolve();
      })
    );
    return 1;
  } catch (err) {
    return 0;
  }
};

const prepareDirectory = (fsProvider, exportDir) =>
  new Promise((resolve, reject) => {
    fsProvider.stat(exportDir, (err, stats) => {
      if (err) {
        // TODO create recursively
        return fsProvider.mkdir(exportDir, (err) => {
          if (err) {
            reject(err.message);
          }

          resolve();
        });
      }

      if (!stats.isDirectory()) {
        return reject(
          "Es existiert bereits eine Datei unter dem angegeben Pfad"
        );
      }

      resolve();
    });
  });

export { saveDocuments, writeReportCSV, prepareDirectory };
