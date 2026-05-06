"use strict";

const helpers = require.main.require("./src/controllers/helpers");
const topics = require.main.require("./src/topics");

const config = require("./config");
const wikiHtmlSanitizer = require("./wiki-html-sanitizer");
const wikiPaths = require("./wiki-paths");
const wikiService = require("./wiki-service");

/** Hard cap for wiki main post HTML (UTF-8 bytes) to protect servers and browsers. Keep in sync with public/wiki-compose-page.js. */
const MAX_WIKI_MAIN_BODY_UTF8_BYTES = 512 * 1024;

const BLOCKING_STATUSES = new Set([
  "namespace-collision",
  "namespace-page-collision",
  "page-collision",
  "reserved-path-segment"
]);

function getValidationMessage(result) {
  if (!result || result.status === "ok") {
    return "";
  }

  if (result.status === "page-collision") {
    return "A wiki page with this URL already exists in this namespace. Rename the page before publishing.";
  }
  if (result.status === "namespace-page-collision") {
    return "This page URL is already used by a child namespace. Rename the page before publishing.";
  }
  if (result.status === "namespace-collision") {
    return "The configured wiki namespace paths are ambiguous. Resolve the namespace collision in the ACP before publishing.";
  }
  if (result.status === "reserved-path-segment") {
    return "This title would use a reserved wiki route. Rename the page before publishing.";
  }

  return "This wiki page title cannot be published at a clean wiki URL.";
}

function isBlockingResult(result) {
  return !!(result && BLOCKING_STATUSES.has(result.status));
}

function throwIfBlockingResult(result) {
  if (isBlockingResult(result)) {
    throw new Error(getValidationMessage(result));
  }
}

function assertWikiMainBodySizeWithinLimit(content) {
  const bytes = Buffer.byteLength(String(content || ""), "utf8");
  if (bytes > MAX_WIKI_MAIN_BODY_UTF8_BYTES) {
    throw new Error(
      `This wiki article body is too large (max ${MAX_WIKI_MAIN_BODY_UTF8_BYTES} UTF-8 bytes). Split the content or shorten it before saving.`
    );
  }
}

function sanitizeAndValidateWikiMainBody(content) {
  const sanitized = wikiHtmlSanitizer.sanitizeWikiHtml(content);
  if (!wikiHtmlSanitizer.hasMeaningfulWikiHtml(sanitized)) {
    throw new Error("This wiki article body is empty after unsafe HTML was removed. Add allowed content before saving.");
  }
  assertWikiMainBodySizeWithinLimit(sanitized);
  return sanitized;
}

async function validateTopicPost(data) {
  const cid = data && data.cid;
  const title = data && data.title;
  if (!title) {
    return data;
  }

  const result = await wikiPaths.validatePageTitlePath(cid, title);
  throwIfBlockingResult(result);

  const settings = await config.getSettings();
  const parsedCid = parseInt(cid, 10);
  if (
    Number.isInteger(parsedCid) &&
    parsedCid > 0 &&
    settings.effectiveCategoryIds.includes(parsedCid) &&
    data.content != null
  ) {
    data.content = sanitizeAndValidateWikiMainBody(data.content);
  }

  return data;
}

async function validateTopicEdit(data) {
  if (!data || !data.topic || !data.topic.title) {
    return data;
  }

  const result = await wikiPaths.validatePageTitlePath(data.topic.cid, data.topic.title, {
    omitTid: data.topic.tid
  });
  throwIfBlockingResult(result);

  const settings = await config.getSettings();
  const parsedCid = parseInt(data.topic.cid, 10);
  if (!Number.isInteger(parsedCid) || parsedCid <= 0 || !settings.effectiveCategoryIds.includes(parsedCid)) {
    return data;
  }

  const post = data.post;
  if (!post || post.content == null) {
    return data;
  }

  const tid = parseInt(data.topic.tid, 10);
  if (!Number.isInteger(tid) || tid <= 0) {
    return data;
  }

  const mainPid = parseInt(await topics.getTopicField(tid, "mainPid"), 10);
  const postPid = parseInt(post.pid, 10);
  if (Number.isInteger(mainPid) && mainPid > 0 && Number.isInteger(postPid) && postPid === mainPid) {
    post.content = sanitizeAndValidateWikiMainBody(post.content);
  }

  return data;
}

async function checkPageTitle(req, res) {
  const cid = parseInt((req.query && req.query.cid) || (req.body && req.body.cid), 10);
  const title = String((req.query && req.query.title) || (req.body && req.body.title) || "").trim();
  const omitTid = parseInt((req.query && req.query.tid) || (req.body && req.body.tid), 10);

  if (!cid || !title) {
    return helpers.formatApiResponse(400, res, new Error("[[error:invalid-data]]"));
  }

  const sectionResult = await wikiService.getSection(cid, req.uid);
  if (sectionResult.status === "forbidden") {
    return helpers.formatApiResponse(403, res, new Error("[[error:no-privileges]]"));
  }
  if (sectionResult.status !== "ok") {
    return helpers.formatApiResponse(404, res, new Error("[[error:not-found]]"));
  }

  const result = await wikiPaths.validatePageTitlePath(cid, title, {
    omitTid: Number.isInteger(omitTid) && omitTid > 0 ? omitTid : null
  });
  const blocking = isBlockingResult(result);

  return helpers.formatApiResponse(200, res, {
    ok: !blocking && result.status === "ok",
    status: result.status,
    message: blocking ? getValidationMessage(result) : "",
    pageSlug: result.pageSlug || "",
    wikiPath: result.path || ""
  });
}

module.exports = {
  MAX_WIKI_MAIN_BODY_UTF8_BYTES,
  checkPageTitle,
  getValidationMessage,
  isBlockingResult,
  sanitizeAndValidateWikiMainBody,
  throwIfBlockingResult,
  validateTopicEdit,
  validateTopicPost
};
