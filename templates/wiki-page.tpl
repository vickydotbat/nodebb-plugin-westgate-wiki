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
        <div class="wiki-sidebar-panels">
          <div class="wiki-article-toc card wiki-article-toc--sidebar" data-wiki-article-toc-root hidden>
            <details class="wiki-sidebar-disclosure" open>
              <summary class="wiki-sidebar-disclosure__summary" id="wiki-article-toc-heading-sidebar">Table of Contents</summary>
              <div class="wiki-sidebar-disclosure__body">
                <nav class="wiki-article-toc__list-host wiki-sidebar-panel-scroll" data-wiki-article-toc aria-labelledby="wiki-article-toc-heading-sidebar"></nav>
              </div>
            </details>
          </div>
          <div class="wiki-sidebar-panel wiki-sidebar-panel--nav card" data-wiki-sidebar-nav-panel>
            <details class="wiki-sidebar-disclosure wiki-sidebar-disclosure--nav" open>
              <summary class="wiki-sidebar-disclosure__summary" id="wiki-article-wiki-nav-heading">Navigation</summary>
              <div class="wiki-sidebar-disclosure__body wiki-sidebar-disclosure__body--nav wiki-sidebar-panel-scroll">
                <nav class="wiki-sidebar-merged-nav" aria-label="Namespace, pages, and child namespaces">
                  <ul class="wiki-sidebar-nav-rows">
                    <!-- BEGIN wikiSidebarNavRows -->
                    <li class="wiki-sidebar-nav-row<!-- IF wikiSidebarNavRows.isPage --> wiki-sidebar-nav-row--page<!-- ENDIF wikiSidebarNavRows.isPage --><!-- IF wikiSidebarNavRows.isNamespace --> wiki-sidebar-nav-row--namespace<!-- ENDIF wikiSidebarNavRows.isNamespace --><!-- IF wikiSidebarNavRows.isActive --> is-active<!-- ENDIF wikiSidebarNavRows.isActive -->"<!-- IF wikiSidebarNavRows.isCurrentNamespace --> data-wiki-current-namespace="1"<!-- ENDIF wikiSidebarNavRows.isCurrentNamespace --> style="--wiki-nav-depth: {wikiSidebarNavRows.depth};">
                      <!-- IF wikiSidebarNavRows.isNamespace -->
                      <a class="wiki-sidebar-nav-ns" href="{config.relative_path}{wikiSidebarNavRows.wikiPath}">{wikiSidebarNavRows.name}</a>
                      <!-- ENDIF wikiSidebarNavRows.isNamespace -->
                      <!-- IF wikiSidebarNavRows.isPage -->
                      <a class="wiki-sidebar-nav-page" href="{config.relative_path}{wikiSidebarNavRows.wikiPath}">
                        <!-- IF wikiSidebarNavRows.hasParentPath -->
                        <span class="wiki-sidebar-parent-path">{wikiSidebarNavRows.parentTitlePathText}</span>
                        <!-- ENDIF wikiSidebarNavRows.hasParentPath -->
                        <span class="wiki-sidebar-page-title">{wikiSidebarNavRows.titleLeaf}</span>
                      </a>
                      <!-- ENDIF wikiSidebarNavRows.isPage -->
                    </li>
                    <!-- END wikiSidebarNavRows -->
                  </ul>
                  <!-- IF hasSectionChildNamespaces -->
                  <hr class="wiki-sidebar-divider" />
                  <h2 class="wiki-sidebar-child-ns-heading" id="wiki-sidebar-child-ns-heading">Child namespaces</h2>
                  <ul class="wiki-sidebar-nav-rows" aria-labelledby="wiki-sidebar-child-ns-heading">
                    <!-- BEGIN sectionNavigation.childSections -->
                    <li class="wiki-sidebar-nav-row wiki-sidebar-nav-row--page">
                      <a class="wiki-sidebar-nav-page" href="{config.relative_path}{sectionNavigation.childSections.wikiPath}">
                        <span class="wiki-sidebar-page-title">{sectionNavigation.childSections.name}</span>
                      </a>
                    </li>
                    <!-- END sectionNavigation.childSections -->
                  </ul>
                  <!-- ENDIF hasSectionChildNamespaces -->
                </nav>
              </div>
            </details>
          </div>
        </div>
      </aside>
      <!-- ENDIF hasSectionNavigation -->

      <div class="wiki-page-main-column">
        <!-- IF showWikiTocInline -->
        <div class="wiki-article-toc card mb-3 wiki-article-toc--inline" data-wiki-article-toc-root hidden>
          <details class="wiki-sidebar-disclosure" open>
            <summary class="wiki-sidebar-disclosure__summary" id="wiki-article-toc-heading-inline">Table of Contents</summary>
            <div class="wiki-sidebar-disclosure__body">
              <nav class="wiki-article-toc__list-host wiki-sidebar-panel-scroll" data-wiki-article-toc aria-labelledby="wiki-article-toc-heading-inline"></nav>
            </div>
          </details>
        </div>
        <!-- ENDIF showWikiTocInline -->
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
