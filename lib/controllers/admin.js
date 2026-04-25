"use strict";

const categories = require.main.require("./src/categories");

const config = require("../config");

const Controllers = {};

Controllers.renderAdminPage = async function (req, res) {
  const settings = await config.getSettings();
  const categoryOptions = await categories.buildForSelectAll(["description", "slug", "depth"]);

  res.render("admin/plugins/westgate-wiki", {
    title: "Westgate Wiki",
    categoryIds: settings.categoryIdsText,
    topicsPerCategory: settings.topicsPerCategory,
    includeChildCategories: settings.includeChildCategories,
    categoryOptions: categoryOptions.map((category) => ({
      cid: category.cid,
      name: category.name,
      description: category.description,
      slug: category.slug,
      depth: category.depth || 0,
      isSelected: settings.categoryIds.includes(parseInt(category.cid, 10))
    }))
  });
};

module.exports = Controllers;
