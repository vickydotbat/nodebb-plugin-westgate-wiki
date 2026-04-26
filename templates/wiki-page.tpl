<div class="westgate-wiki py-4">
  <section class="wiki-page-hero card mb-4">
    <div class="card-body">
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

      <!-- IF mainPost -->
      <p class="wiki-page-byline">
        <!-- IF mainPost.user -->
        <span class="wiki-page-byline-author">By {mainPost.user.displayname}</span>
        <!-- ENDIF mainPost.user -->
        <!-- IF mainPost.timestampISO -->
        <span title="{mainPost.timestampISO}" class="wiki-page-byline-time timeago"></span>
        <!-- ENDIF mainPost.timestampISO -->
      </p>
      <!-- ENDIF mainPost -->
    </div>
  </section>

  <div class="wiki-with-fab">
    <div class="wiki-content-layout<!-- IF hasSectionNavigation --> wiki-content-layout--sidebar<!-- ENDIF hasSectionNavigation -->">
      <!-- IF hasSectionNavigation -->
      <aside class="wiki-sidebar">
        <section class="wiki-sidebar-card card">
          <div class="card-body">
            <h2>This Namespace</h2>
            <a class="wiki-sidebar-root" href="{config.relative_path}{sectionNavigation.wikiPath}">
              {sectionNavigation.name}
            </a>
          </div>
        </section>

        <!-- IF hasSectionPages -->
        <section class="wiki-sidebar-card card">
          <div class="card-body">
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
          </div>
        </section>
        <!-- ENDIF hasSectionPages -->

        <!-- IF hasSectionChildNamespaces -->
        <section class="wiki-sidebar-card card">
          <div class="card-body">
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
          </div>
        </section>
        <!-- ENDIF hasSectionChildNamespaces -->
      </aside>
      <!-- ENDIF hasSectionNavigation -->

      <div class="wiki-page-main-column">
        <section class="wiki-page-body">
          <!-- IF mainPost -->
          <article class="wiki-page-content wiki-article-prose card">
            <div class="card-body">
              {mainPost.content}
            </div>
          </article>
          <!-- ELSE -->
          <article class="wiki-status-card card">
            <div class="card-body">
              <h2>Page Content Unavailable</h2>
              <p>The topic exists, but its first post could not be loaded as wiki content.</p>
            </div>
          </article>
          <!-- ENDIF mainPost -->
        </section>
      </div>
    </div>

    <!-- IF showWikiFabDock -->
    <nav class="wiki-fab-dock wiki-fab-dock--floating" aria-label="Page tools">
      <div class="wiki-fab-dock-inner">
        <!-- IF canEditWikiPage -->
        <a class="wiki-fab-btn wiki-fab-btn--icon" href="{config.relative_path}/wiki/edit/{topic.tid}" title="Edit this wiki page" aria-label="Edit this wiki page">
          <i class="fa fa-fw fa-pencil" aria-hidden="true"></i>
        </a>
        <!-- ENDIF canEditWikiPage -->
        <!-- IF showWikiDiscussionLink -->
        <a class="wiki-fab-btn wiki-fab-btn--icon" href="{config.relative_path}/topic/{topic.slug}" title="Open the forum discussion thread" aria-label="Open discussion thread">
          <i class="fa fa-fw fa-comments" aria-hidden="true"></i>
        </a>
        <!-- ENDIF showWikiDiscussionLink -->
        <!-- IF canDeleteWikiPage -->
        <button type="button" class="wiki-fab-btn wiki-fab-btn--icon wiki-fab-btn--danger wiki-delete-page" data-wiki-delete-topic="1" data-tid="{topic.tid}" data-redirect-href="{config.relative_path}/wiki/category/{category.slug}" title="Permanently remove this wiki page" aria-label="Remove this wiki page">
          <i class="fa fa-fw fa-trash-o" aria-hidden="true"></i>
        </button>
        <!-- ENDIF canDeleteWikiPage -->
      </div>
    </nav>
    <!-- ENDIF showWikiFabDock -->
  </div>
</div>

<!-- IF config.cache-buster -->
<link rel="stylesheet" href="{config.relative_path}/westgate-wiki/compose/article-body.css?{config.cache-buster}" />
<!-- ELSE -->
<link rel="stylesheet" href="{config.relative_path}/westgate-wiki/compose/article-body.css" />
<!-- ENDIF config.cache-buster -->
