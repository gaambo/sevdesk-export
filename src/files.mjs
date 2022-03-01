import { promises as fs } from "fs";
import path from "path";
import sanitize from "sanitize-filename";
import { buildDocumentFileName } from "./helper.mjs";

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
  let filename = buildDocumentFileName(document);
  filename = sanitize(filename);
  try {
    await fs.writeFile(path.join(savePath, filename), document.document);
    return 1;
  } catch (err) {
    return 0;
  }
};

export { saveDocuments };
