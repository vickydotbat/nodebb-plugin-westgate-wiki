"use strict";

const topics = require.main.require("./src/topics");

const config = require("./config");

/**
 * When a topic is deleted in the forum UI, NodeBB soft-deletes it first, then
 * fires action:topic.delete. For configured wiki namespaces we immediately
 * purge the topic and posts so the page is fully removed (not recoverable via
 * "restore" in the usual soft-delete flow).
 */
async function onTopicDelete({ topic, uid }) {
  if (!topic || !topic.tid) {
    return;
  }

  const settings = await config.getSettings();
  if (settings.homeTopicId && parseInt(topic.tid, 10) === settings.homeTopicId) {
    return;
  }

  if (!settings.isConfigured) {
    return;
  }

  const cid = parseInt(topic.cid, 10);
  if (!Number.isInteger(cid) || !settings.effectiveCategoryIds.includes(cid)) {
    return;
  }

  await topics.purgePostsAndTopic([topic.tid], uid);
}

module.exports = {
  onTopicDelete
};
