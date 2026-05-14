"use strict";

const helpers = require.main.require("./src/controllers/helpers");
const posts = require.main.require("./src/posts");
const topics = require.main.require("./src/topics");

const config = require("./config");
const wikiHtmlSanitizer = require("./wiki-html-sanitizer");
const wikiEditLocks = require("./wiki-edit-locks");
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

function sanitizeWikiMainBodyFields(target) {
  if (!target || (target.content == null && target.sourceContent == null)) {
    return;
  }
  const sanitized = sanitizeAndValidateWikiMainBody(
    target.sourceContent != null ? target.sourceContent : target.content
  );
  target.content = sanitized;
  target.sourceContent = sanitized;
}

function getEditLockToken(data) {
  return String(
    (data && data.wikiEditLockToken) ||
    (data && data.data && data.data.wikiEditLockToken) ||
    (data && data.body && data.body.wikiEditLockToken) ||
    (data && data.req && data.req.body && data.req.body.wikiEditLockToken) ||
    (data && data.req && data.req.query && data.req.query.wikiEditLockToken) ||
    (data && data.post && data.post.wikiEditLockToken) ||
    ""
  );
}

function getActorUid(data) {
  const parsed = parseInt(
    (data && (data.uid || data.editor || data.editorUid)) ||
    (data && data.post && (data.post.editor || data.post.uid)) ||
    (data && data.req && data.req.uid),
    10
  );
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
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
    (data.content != null || data.sourceContent != null)
  ) {
    sanitizeWikiMainBodyFields(data);
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
    const lockResult = await wikiEditLocks.assertSaveLock(tid, getActorUid(data), getEditLockToken(data));
    if (lockResult.status !== "ok") {
      throw new Error(wikiEditLocks.getStatusMessage(lockResult));
    }
    sanitizeWikiMainBodyFields(post);
  }

  return data;
}

async function validatePostEdit(data) {
  const post = data && data.post;
  const editData = data && data.data;
  const postPid = parseInt(editData && editData.pid, 10);
  if (!post || !Number.isInteger(postPid) || postPid <= 0 || (post.content == null && post.sourceContent == null)) {
    return data;
  }

  const postData = await posts.getPostFields(postPid, ["pid", "tid", "content", "sourceContent"]);
  const tid = parseInt(postData && postData.tid, 10);
  if (!Number.isInteger(tid) || tid <= 0) {
    return data;
  }

  const topicData = await topics.getTopicFields(tid, ["cid", "mainPid"]);
  const parsedCid = parseInt(topicData && topicData.cid, 10);
  const mainPid = parseInt(topicData && topicData.mainPid, 10);
  const settings = await config.getSettings();
  if (
    !Number.isInteger(parsedCid) ||
    parsedCid <= 0 ||
    !settings.effectiveCategoryIds.includes(parsedCid) ||
    !Number.isInteger(mainPid) ||
    mainPid <= 0 ||
    mainPid !== postPid
  ) {
    return data;
  }

  const incomingContent = String(post.sourceContent != null ? post.sourceContent : post.content || "");
  const storedContent = String(postData.sourceContent || postData.content || "");
  if (incomingContent !== storedContent) {
    const lockResult = await wikiEditLocks.assertSaveLock(tid, getActorUid(data), getEditLockToken(data));
    if (lockResult.status !== "ok") {
      throw new Error(wikiEditLocks.getStatusMessage(lockResult));
    }
  }
  sanitizeWikiMainBodyFields(post);
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
  validatePostEdit,
  validateTopicEdit,
  validateTopicPost
};
