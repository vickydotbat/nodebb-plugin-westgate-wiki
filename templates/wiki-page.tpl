<div class="westgate-wiki container-lg py-4">
  <section class="wiki-page-hero mb-4">
    <p class="wiki-page-kicker">
      <a href="{config.relative_path}/wiki/category/{category.slug}">{category.name}</a>
    </p>
    <h1>{pageTitle}</h1>

    <!-- IF ancestorSections.length -->
    <div class="wiki-namespace-path">
      <!-- BEGIN ancestorSections -->
      <a href="{config.relative_path}{ancestorSections.wikiPath}">
        {ancestorSections.name}
      </a>
      <span>/</span>
      <!-- END ancestorSections -->
      <a href="{config.relative_path}/wiki/category/{category.slug}">{category.name}</a>
    </div>
    <!-- ENDIF ancestorSections.length -->

    <!-- IF hasPageParents -->
    <div class="wiki-page-path">
      <a href="{config.relative_path}/wiki/category/{category.slug}">{category.name}</a>
      <span>/</span>
      <!-- BEGIN parentPages -->
      <!-- IF parentPages.url -->
      <a href="{config.relative_path}{parentPages.url}">{parentPages.text}</a>
      <!-- ELSE -->
      <span>{parentPages.text}</span>
      <!-- ENDIF parentPages.url -->
      <span>/</span>
      <!-- END parentPages -->
      <span>{pageTitle}</span>
    </div>
    <!-- ENDIF hasPageParents -->

    <div class="wiki-page-meta">
      <!-- IF mainPost.user -->
      <span>By {mainPost.user.displayname}</span>
      <!-- ENDIF mainPost.user -->
      <!-- IF mainPost.timestampISO -->
      <span title="{mainPost.timestampISO}" class="timeago"></span>
      <!-- ENDIF mainPost.timestampISO -->
      <span>Wiki Page</span>
      <!-- IF canCreateSiblingPage -->
      <a href="#" data-wiki-create-page="1" data-cid="{category.cid}">Create Sibling Page</a>
      <!-- ENDIF canCreateSiblingPage -->
      <a href="{config.relative_path}/wiki/category/{category.slug}">More In {category.name}</a>
      <a href="{config.relative_path}/topic/{topic.slug}">Discussion Thread</a>
    </div>
  </section>

  <div class="wiki-content-layout">
    <!-- IF hasSectionNavigation -->
    <aside class="wiki-sidebar">
      <section class="wiki-sidebar-card">
        <h2>This Namespace</h2>
        <a class="wiki-sidebar-root" href="{config.relative_path}{sectionNavigation.wikiPath}">
          {sectionNavigation.name}
        </a>
      </section>

      <!-- IF hasSectionPages -->
      <section class="wiki-sidebar-card">
        <h2>Pages</h2>
        <ul class="wiki-sidebar-list">
          <!-- BEGIN sectionNavigation.topics -->
          <li class="<!-- IF (sectionNavigation.topics.tid == topic.tid) -->is-active<!-- ENDIF (sectionNavigation.topics.tid == topic.tid) -->">
            <a href="{config.relative_path}{sectionNavigation.topics.wikiPath}">
              <!-- IF sectionNavigation.topics.hasParentPath -->
              <span class="wiki-sidebar-parent-path">{sectionNavigation.topics.parentTitlePathText}</span>
              <!-- ENDIF sectionNavigation.topics.hasParentPath -->
              <span class="wiki-sidebar-page-title">{sectionNavigation.topics.titleLeaf}</span>
            </a>
          </li>
          <!-- END sectionNavigation.topics -->
        </ul>
      </section>
      <!-- ENDIF hasSectionPages -->

      <!-- IF hasSectionChildNamespaces -->
      <section class="wiki-sidebar-card">
        <h2>Child Namespaces</h2>
        <ul class="wiki-sidebar-list">
          <!-- BEGIN sectionNavigation.childSections -->
          <li>
            <a href="{config.relative_path}{sectionNavigation.childSections.wikiPath}">
              {sectionNavigation.childSections.name}
            </a>
          </li>
          <!-- END sectionNavigation.childSections -->
        </ul>
      </section>
      <!-- ENDIF hasSectionChildNamespaces -->
    </aside>
    <!-- ENDIF hasSectionNavigation -->

    <section class="wiki-page-body">
      <!-- IF mainPost -->
      <article class="wiki-page-content">
        {mainPost.content}
      </article>
      <!-- ELSE -->
      <article class="wiki-status-card">
        <h2>Page Content Unavailable</h2>
        <p>The topic exists, but its first post could not be loaded as wiki content.</p>
      </article>
      <!-- ENDIF mainPost -->
    </section>
  </div>
</div>
