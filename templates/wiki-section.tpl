<div class="westgate-wiki container-lg py-4">
  <section class="wiki-page-hero wiki-section-hero mb-4">
    <p class="wiki-page-kicker">
      <a href="{config.relative_path}/wiki">Westgate Wiki</a>
    </p>
    <h1>{section.name}</h1>

    <!-- IF section.ancestorSections.length -->
    <div class="wiki-namespace-path">
      <!-- BEGIN section.ancestorSections -->
      <a href="{config.relative_path}{section.ancestorSections.wikiPath}">
        {section.ancestorSections.name}
      </a>
      <span>/</span>
      <!-- END section.ancestorSections -->
      <span>{section.name}</span>
    </div>
    <!-- ENDIF section.ancestorSections.length -->

    <!-- IF section.description -->
    <div class="wiki-section-description">
      {section.description}
    </div>
    <!-- ENDIF section.description -->

    <div class="wiki-page-meta">
      <span>{section.topicCount} visible pages</span>
      <span>{section.childSections.length} child namespaces</span>
      <span>Showing up to {topicsPerCategory} recent topics</span>
      <!-- IF canCreatePage -->
      <a href="#" data-wiki-create-page="1" data-cid="{section.cid}">Create Page In This Namespace</a>
      <!-- ENDIF canCreatePage -->
      <a href="{config.relative_path}{section.categoryPath}">Open Forum Category</a>
    </div>
  </section>

  <!-- IF hasCreateIntent -->
  <section class="wiki-status-card wiki-status-card-redlink mb-4">
    <h2>Missing Wiki Page</h2>
    <p>
      <strong>{createIntentTitle}</strong> does not exist in <strong>{section.name}</strong> yet.
    </p>
    <p>
      Follow the wiki pattern and create it directly in this namespace.
    </p>
    <a
      class="wiki-card-link wiki-redlink-action"
      href="#"
      data-wiki-create-page="1"
      data-cid="{section.cid}"
      data-title="{createIntentTitle}"
      data-wiki-create-autoload="1"
    >
      Create {createIntentTitle}
    </a>
  </section>
  <!-- ENDIF hasCreateIntent -->

  <!-- IF hasChildSections -->
  <section class="wiki-subsection-block mb-4">
    <div class="wiki-section-heading">
      <h2>Namespaces</h2>
      <p>Configured child wiki categories under this section.</p>
    </div>

    <div class="wiki-grid">
      <!-- BEGIN section.childSections -->
      <article class="wiki-card wiki-subsection-card">
        <div class="wiki-card-header">
          <h3>
            <a href="{config.relative_path}{section.childSections.wikiPath}">
              {section.childSections.name}
            </a>
          </h3>
        </div>

        <!-- IF section.childSections.description -->
        <div class="wiki-card-description">
          {section.childSections.description}
        </div>
        <!-- ENDIF section.childSections.description -->

        <a class="wiki-card-link" href="{config.relative_path}{section.childSections.wikiPath}">
          Open Namespace
        </a>
      </article>
      <!-- END section.childSections -->
    </div>
  </section>
  <!-- ENDIF hasChildSections -->

  <!-- IF hasTopics -->
  <section class="wiki-section-list">
    <div class="wiki-section-heading">
      <h2>Pages</h2>
      <p>Recent wiki pages in this namespace.</p>
    </div>

    <!-- BEGIN section.topics -->
    <article class="wiki-topic-card">
      <h2>
        <a href="{config.relative_path}{section.topics.wikiPath}">
          {section.topics.title}
        </a>
      </h2>

      <div class="wiki-topic-card-meta">
        <span>{section.topics.replyCount} discussion replies</span>
        <a href="{config.relative_path}{section.topics.topicPath}">Discussion Thread</a>
      </div>
    </article>
    <!-- END section.topics -->
  </section>
  <!-- ELSE -->
  <section class="wiki-status-card">
    <h2>No Visible Wiki Pages Yet</h2>
    <p>
      This category is configured for the wiki, but there are no readable topics to list right now.
    </p>
  </section>
  <!-- ENDIF hasTopics -->
</div>
