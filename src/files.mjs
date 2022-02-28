import { promises as fs } from "fs";
import path from "path";
import sanitize from "sanitize-filename";
import { buildVoucherFileName } from "./helper.mjs";

/**
 * Saves downloaded voucher data from @see downloadVouchers to disk
 *
 * @param {Array} vouchers
 * @param {string} savePath
 * @returns number of saved vouchers
 */
const saveVouchers = async (vouchers, savePath) => {
  return Promise.all(
    vouchers.map((voucher) => {
      return saveVoucher(voucher, savePath);
    })
  );
};

/**
 * Private. Saves a single voucher
 * @see saveVoucher
 *
 * @param {Object} voucher
 * @param {string} savePath
 * @returns
 */
const saveVoucher = async (voucher, savePath) => {
  if (!voucher) {
    return null;
  }
  let filename = buildVoucherFileName(voucher);
  filename = sanitize(filename);
  try {
    await fs.writeFile(path.join(savePath, filename), voucher.document);
    return 1;
  } catch (err) {
    return 0;
  }
};

export { saveVouchers };
