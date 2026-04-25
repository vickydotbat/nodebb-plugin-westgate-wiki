<div class="westgate-wiki container-lg py-4">
  <section class="wiki-hero mb-4">
    <h1>Westgate Wiki</h1>
    <p>
      Lore, factions, locations, rules, and player guidance for Shadows Over Westgate.
    </p>
  </section>

  <!-- IF setupRequired -->
  <section class="wiki-status-card mb-4">
    <h2>Wiki Setup Required</h2>
    <p>
      No wiki categories are configured yet. Add category IDs in the ACP at
      <strong>Plugins &gt; Westgate Wiki</strong> to populate this page.
    </p>
  </section>
  <!-- ENDIF setupRequired -->

  <!-- IF hasInvalidCategoryIds -->
  <section class="wiki-status-card wiki-status-card-warning mb-4">
    <h2>Some Configured Categories Could Not Be Loaded</h2>
    <p>
      The following category IDs are currently invalid or unavailable:
      <code>{invalidCategoryIdsText}</code>
    </p>
  </section>
  <!-- ENDIF hasInvalidCategoryIds -->

  <!-- IF hasSections -->
  <section class="wiki-grid">
    <!-- BEGIN sections -->
    <article class="wiki-card">
      <div class="wiki-card-header">
        <h2>
          <a href="{config.relative_path}{sections.wikiPath}">
            {sections.name}
          </a>
        </h2>
        <span class="wiki-topic-count">{sections.topicCount} pages</span>
      </div>

      <!-- IF sections.description -->
      <div class="wiki-card-description">
        {sections.description}
      </div>
      <!-- ENDIF sections.description -->

      <ul class="wiki-topic-list">
        <!-- BEGIN ./topics -->
        <li>
          <a href="{config.relative_path}{./wikiPath}">
            {./title}
          </a>
        </li>
        <!-- END ./topics -->
      </ul>

      <a class="wiki-card-link" href="{config.relative_path}{sections.wikiPath}">
        Browse Section
      </a>
      <!-- IF sections.privileges.canCreatePage -->
      <a
        class="wiki-card-link wiki-card-link-secondary"
        href="#"
        data-wiki-create-page="1"
        data-cid="{sections.cid}"
      >
        Create Page
      </a>
      <!-- ENDIF sections.privileges.canCreatePage -->
    </article>
    <!-- END sections -->
  </section>
  <!-- ELSE -->
  <section class="wiki-status-card">
    <h2>No Wiki Pages Yet</h2>
    <p>
      {configuredCategoryCount} wiki categories are configured, but there are no visible topics to list right now.
    </p>
    <!-- IF includeChildCategories -->
    <p>
      Descendant namespace inheritance is enabled, so the wiki currently spans {effectiveCategoryCount} categories including child namespaces.
    </p>
    <!-- ENDIF includeChildCategories -->
  </section>
  <!-- ENDIF hasSections -->
</div>
