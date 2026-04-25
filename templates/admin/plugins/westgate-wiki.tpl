<div class="acp-page-container">
  <!-- IMPORT admin/partials/settings/header.tpl -->

  <div class="row m-0">
    <div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
      <form role="form" class="westgate-wiki-settings">
        <div class="mb-4">
          <div class="d-flex justify-content-between align-items-center gap-3 mb-2">
            <label class="form-label mb-0" for="categoryIds">Wiki Namespaces</label>
            <span class="text-muted small">
              <span data-selected-count>0</span> selected
            </span>
          </div>
          <div class="list-group">
            <!-- BEGIN categoryOptions -->
            <label class="list-group-item">
              <div class="form-check mb-0" style="margin-left: calc({categoryOptions.depth} * 1.25rem);">
                <input
                  class="form-check-input"
                  type="checkbox"
                  value="{categoryOptions.cid}"
                  data-wiki-category-toggle="1"
                  <!-- IF categoryOptions.isSelected -->checked<!-- ENDIF categoryOptions.isSelected -->
                />
                <span class="form-check-label">
                  <strong>{categoryOptions.name}</strong>
                  <span class="text-muted small ms-2">#{categoryOptions.cid}</span>
                  <span class="text-muted small ms-2">/{categoryOptions.slug}</span>
                </span>
              </div>
              <!-- IF categoryOptions.description -->
              <div class="form-text ms-4" style="margin-left: calc(({categoryOptions.depth} * 1.25rem) + 1.5rem) !important;">
                {categoryOptions.description}
              </div>
              <!-- ENDIF categoryOptions.description -->
            </label>
            <!-- END categoryOptions -->
          </div>
          <p class="form-text">
            Select the NodeBB categories that should behave as wiki namespaces. Category permissions
            remain managed by NodeBB itself, so group-based visibility and posting rules continue to apply.
          </p>
        </div>

        <div class="mb-4">
          <label class="form-label" for="categoryIds">Stored Wiki Category IDs</label>
          <textarea
            id="categoryIds"
            class="form-control"
            name="categoryIds"
            rows="3"
            placeholder="12, 13, 14"
          >{categoryIds}</textarea>
          <p class="form-text">
            This stays editable as a fallback, but the checkbox tree above should be the normal way to manage wiki namespaces.
          </p>
        </div>

        <div class="mb-4">
          <label class="form-label" for="topicsPerCategory">Topics Per Category</label>
          <input
            id="topicsPerCategory"
            type="number"
            class="form-control"
            name="topicsPerCategory"
            min="1"
            max="50"
            value="{topicsPerCategory}"
          />
          <p class="form-text">
            Controls how many recent topics are listed for each configured wiki category.
          </p>
        </div>

        <div class="mb-4 form-check">
          <input
            id="includeChildCategories"
            class="form-check-input"
            type="checkbox"
            name="includeChildCategories"
            <!-- IF includeChildCategories -->checked<!-- ENDIF includeChildCategories -->
          />
          <label class="form-check-label" for="includeChildCategories">
            Automatically include descendant categories as wiki namespaces
          </label>
          <p class="form-text">
            When enabled, selecting a parent namespace automatically exposes its subcategories and deeper descendants through the wiki hierarchy.
          </p>
        </div>

        <div class="alert alert-info">
          Wiki namespace enablement is plugin-specific, but read/post/edit access still comes from the
          underlying NodeBB category permissions.
        </div>
      </form>
    </div>

    <!-- IMPORT admin/partials/settings/toc.tpl -->
  </div>
</div>
