"use strict";

const categories = require.main.require("./src/categories");
const groups = require.main.require("./src/groups");

const config = require("../config");

const Controllers = {};

Controllers.renderAdminPage = async function (req, res) {
  const settings = await config.getSettings();
  const categoryOptions = await categories.buildForSelectAll(["description", "slug", "depth"]);
  const groupList = await groups.getNonPrivilegeGroups("groups:createtime", 0, -1, { ephemeral: false });
  const selectedGroupNames = new Set(settings.wikiNamespaceCreateGroups);

  res.render("admin/plugins/westgate-wiki", {
    title: "Westgate Wiki",
    categoryIds: settings.categoryIdsText,
    homeTopicId: settings.homeTopicIdText,
    topicsPerCategory: settings.topicsPerCategory,
    includeChildCategories: settings.includeChildCategories,
    wikiNamespaceCreateGroups: settings.wikiNamespaceCreateGroupsText,
    categoryOptions: categoryOptions.map((category) => ({
      cid: category.cid,
      name: category.name,
      description: category.description,
      slug: category.slug,
      depth: category.depth || 0,
      isSelected: settings.categoryIds.includes(parseInt(category.cid, 10))
    })),
    groupOptions: (groupList || []).filter((g) => g && g.name).map((g) => ({
      name: g.name,
      displayName: g.displayName || g.name,
      isSelected: selectedGroupNames.has(g.name)
    }))
  });
};

module.exports = Controllers;
