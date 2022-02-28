import { promises as fs } from "fs";
import path from "path";

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
const deleteAllFilesInDirectory = async (directory) => {
  try {
    const dirEntries = await fs.readdir(directory, { withFileTypes: true });
    const files = dirEntries
      .filter((dirEnt) => dirEnt.isFile() && !dirEnt.name.startsWith("."))
      .map((dirEnt) => dirEnt.name);
    await Promise.all(
      files.map((file) => {
        return fs.unlink(path.join(directory, file));
      })
    );
    return true;
  } catch (err) {
    return false;
  }
};

/**
 * Builds a well-readable and unique filename from a voucher
 * consisting of the payDate (sortable), supplier/customer name and the unique document id
 *
 * @param {Object} voucher from @see downloadVouchers/@see downloadVoucher
 * @returns {string} filename
 */
const buildVoucherFileName = (voucher, extension = ".pdf") => {
  const filenameParts = [];
  if (voucher.payDate) {
    filenameParts.push(dateToString(voucher.payDate));
  }
  if (voucher.name && voucher.name !== "") {
    filenameParts.push(voucher.name);
  }
  if (voucher.id) {
    filenameParts.push(voucher.id); // make it unique
  }

  let filename = filenameParts.join("-") + extension;
  return filename;
};

export { dateToString, deleteAllFilesInDirectory, buildVoucherFileName };
