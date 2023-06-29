import path from "path";
import { format } from "date-fns";
import { de } from "date-fns/locale/index.js";

/**
 * Formats a JS-Date to a YYYY-MM-DD string
 *
 * @param {Date} date
 * @returns string
 */
const dateToString = (date) => {
  const offset = date.getTimezoneOffset();
  date = new Date(date.getTime() - offset * 60 * 1000);
  return date.toISOString().split("T")[0];
};

/**
 * Deletes all non-hidden files in a directory
 *
 * @param {string} directory
 * @returns {boolean}
 */
const deleteAllFilesInDirectory = async (fsProvider, directory) => {
  try {
    const dirEntries = await new Promise((resolve, reject) => {
      fsProvider.readdir(directory, { withFileTypes: true }, (err, files) => {
        if (err) return reject(err);
        resolve(files);
      });
    });
    const files = dirEntries
      .filter((dirEnt) => dirEnt.isFile() && !dirEnt.name.startsWith("."))
      .map((dirEnt) => dirEnt.name);
    await Promise.all(
      files.map((file) => {
        return new Promise((resolve, reject) => fsProvider.unlink(path.join(directory, file), (err) => {
          if (err) return reject(err);
          resolve();
        }));
      })
    );
    return true;
  } catch (err) {
    return false;
  }
};

/**
 * Builds a well-readable and unique filename from a voucher/invoice document
 * consisting of the payDate (sortable), supplier/customer name and the unique document id
 *
 * @param {Object} document from @see downloadDocuments/@see downloadDocument
 * @returns {string} filename
 */
const buildDocumentFileName = (payDate, name, id, extraInfo, extension = ".pdf") => {
  const filenameParts = [];
  if (payDate) {
    filenameParts.push(dateToString(payDate));
  }
  if (name && name !== "") {
    filenameParts.push(name);
  }
  if (id) {
    filenameParts.push(id); // make it unique
  }
  if (extraInfo) {
    filenameParts.push(extraInfo);
  }

  let filename = filenameParts.join("-") + `.${extension}`;
  return filename;
};

/**
 * Builds an array of categorie names from voucher positions
 *
 * @param {array} positions
 * @returns
 */
const getCategories = (positions) => {
  const categories = positions.map((position) => {
    return position.accountingType.name || "";
  });

  return categories;
};

const customFormat = (date, pattern = "PPP") => {
  return format(date, pattern, { locale: de });
};

export { dateToString, deleteAllFilesInDirectory, buildDocumentFileName, getCategories, customFormat };
