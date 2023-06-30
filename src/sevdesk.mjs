import axios from "axios";
import sanitizeFilename from "sanitize-filename";
import {
  getCategories,
  buildDocumentFileName,
  dateToString,
} from "./helper.mjs";

/**
 * Make a call to the sevDesk API
 *
 * @param {string} path
 * @param {string} apiToken
 * @param {object} config
 * @returns
 */
const makeApiCall = (path, apiToken, config = {}) => {
  return axios.get(`https://my.sevdesk.de/api/v1/${path}`, {
    headers: {
      Authorization: apiToken,
      ...(config.headers || {}),
    },
    ...config,
  });
};

/**
 * Returns all vouchers in a specific payDate-range
 * including supplier and positions data
 *
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {object} options
 * @returns {Array} Voucher objects as defined in sevDesk API
 */
const getVouchers = async (startDate, endDate, { apiToken }) => {
  try {
    const result = await makeApiCall("Voucher", apiToken, {
      params: {
        startPayDate: startDate.getTime() / 1000,
        endPayDate: endDate.getTime() / 1000,
        embed: "supplier,document",
      },
    });
    const vouchers = await Promise.all(
      result.data.objects.map(async (voucher) => {
        const positions = await getVoucherPositions(voucher.id, apiToken);
        return {
          ...voucher,
          positions: positions,
        };
      })
    );
    return vouchers;
  } catch (err) {
    throw new Error(err.message);
  }
};

/**
 * Returns all voucher positions for a specific voucher
 * including the accounting type information (= buchhaltungskonto)
 *
 * @param {string} voucherId
 * @param {string} apiToken
 * @returns {Array} Voucher position objects as defined in sevDesk API
 */
const getVoucherPositions = async (voucherId, apiToken) => {
  try {
    const result = await makeApiCall("VoucherPos", apiToken, {
      params: {
        "voucher[id]": voucherId,
        "voucher[objectName]": "Voucher",
        embed: "accountingType",
      },
    });
    return result.data.objects;
  } catch (err) {
    // return empty set
  }
  return [];
};

/**
 * Returns all invoices in a specific payDate-range
 * sevDesk API does not allow filtering invoices by payDate
 * therefore geht invoices from the range and the range before that
 * and than manually filter by payDate, this should be enough to get most invoices
 *
 * include contact data
 *
 * @param {Date} startPayDate
 * @param {Date} endPayDate
 * @param {object} options
 * @returns {Array} Invoice objects as defined in sevDesk API
 */
const getInvoices = async (startPayDate, endPayDate, { apiToken }) => {
  const timeRangeLength = endPayDate.getTime() - startPayDate.getTime();
  const startDate = new Date(startPayDate.getTime() - 2 * timeRangeLength);
  try {
    const result = await makeApiCall("Invoice", apiToken, {
      params: {
        startDate: startDate.getTime() / 1000,
        endDate: endPayDate.getTime() / 1000,
        embed: "contact,document",
      },
    });

    const invoices = result.data.objects;
    const filteredInvoices = invoices.filter((invoice) => {
      if (!invoice.payDate) {
        return false;
      }
      const invoicePayDate = new Date(invoice.payDate);
      if (!invoicePayDate) {
        return false;
      }
      return invoicePayDate >= startPayDate && invoicePayDate <= endPayDate;
    });

    return filteredInvoices;
  } catch (err) {
    throw new Error(err.message);
  }
};

/**
 * Downloads all the passed vouchers/invoices as PDF + meta data for storage
 * Does NOT store the files
 *
 * @param {string} type of object ("vouchers" or "invoices")
 * @param {Array} vouchers/invoices from API / @see getVouchers
 * @param {object} options
 * @returns {Array} for each voucher: PDF Buffer Data and meta data (payDate, supplierName, documentId)
 */
const downloadDocuments = async (objectType, objects, options) => {
  let documents = [];
  try {
    const promises = objects.map((object) => {
      return downloadDocument(objectType, object, options);
    });
    documents = await Promise.all(promises);
  } catch (err) {
    throw err;
  }
  return documents.filter((vd) => vd); // filter out null values - values without a document attached
};

/**
 * Private. Downloads a single document
 * @see downloadDocuments
 *
 * @param {string} type of object ("vouchers" or "invoices")
 * @param {Object} voucher (@see getVouchers) or invoices (@see getInvoices)
 * @param {object} options
 * @returns {Object} PDF Buffer Data and document name
 */
const downloadDocument = async (objectType, object, options) => {
  const { apiToken } = options;
  try {
    let result = null;
    if (objectType === "vouchers") {
      result = await makeApiCall(
        `Voucher/${object.id}/downloadDocument`,
        apiToken
      );
    } else if (objectType === "invoices") {
      result = await makeApiCall(`Invoice/${object.id}/getPdf`, apiToken);
    }

    if (!result) {
      return null;
    }

    const document = result.data.objects;
    if (!document) {
      // values without a document attached - eg transaction costs automatically generated by sevDesk - ignore them
      return null;
    }
    let content = document.content;
    if (document.base64Encoded) {
      content = Buffer.from(content, "base64");
    }

    return {
      document: content,
      fileName: getDocumentFileName(object, objectType, options),
    };
  } catch (err) {
    return null;
  }
};

const getDocumentFileName = (object, objectType, options = {}) => {
  const payDate = object.payDate ? new Date(object.payDate) : null;
  let name = "";
  let extraInfos = "";

  if (objectType === "vouchers") {
    name = object.supplierName || object.supplierNameAtSave || "";
  } else if (objectType === "invoices") {
    name = object.addressName || "";
  }

  if (options.extraInfoFilename && object.positions) {
    extraInfos += getCategories(object.positions);
  }

  let extension = "pdf";
  if (object.document) {
    if (object.document.extension) {
      extension = object.document.extension;
    }
    if (
      object.document.filename &&
      object.document.filename.split(".").pop() !== object.document.filename
    ) {
      extension = object.document.filename.split(".").pop();
    }
  }

  let fileName = buildDocumentFileName(
    payDate,
    name,
    object.id,
    extraInfos,
    extension
  );
  fileName = sanitizeFilename(fileName);
  return fileName;
};

/**
 * Gets information about all vouchers (date, amount, contact name, categories, filename)
 * to be used in a report/journal
 *
 * @param {Array} Vouchers from @see getVouchers
 * @param {object} options
 * @returns {Array} data used for exporting a report
 */
const buildVoucherReportData = (vouchers, options) => {
  const reportData = [];
  vouchers.forEach((voucher) => {
    const payDate = new Date(voucher.payDate);
    reportData.push({
      type: "AR",
      date: new Date(voucher.voucherDate),
      number: voucher.description,
      contact:
        voucher.supplierNameAtSave ||
        voucher.supplierName ||
        voucher.supplier.name ||
        "",
      payDate: payDate,
      paidAmount: voucher.paidAmount,
      categories: getCategories(voucher.positions),
      filename: getDocumentFileName(voucher, "vouchers", options),
    });
  });
  return reportData;
};

/**
 * Gets information about all invoices (date, amount, contact name, categories, filename)
 * to be used in a report/journal
 *
 * @param {Array} Invoices from @see getInvoices
 * @param {object} options
 * @returns {Array} data used for exporting a report
 */
const buildInvoiceReportData = (invoices, options) => {
  const reportData = [];
  invoices.forEach((invoice) => {
    const payDate = new Date(invoice.payDate);
    reportData.push({
      type: "ER",
      date: new Date(invoice.invoiceDate),
      number: invoice.invoiceNumber,
      contact: invoice.addressName || invoice.contact.name || "",
      payDate: payDate,
      paidAmount: invoice.paidAmount,
      categories: [],
      filename: getDocumentFileName(invoice, "invoices", options),
    });
  });
  return reportData;
};

export {
  getVouchers,
  getInvoices,
  downloadDocuments,
  buildVoucherReportData,
  buildInvoiceReportData,
};
