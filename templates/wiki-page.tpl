<div class="westgate-wiki py-4">
  <header class="wiki-page-header mb-4">
    <!-- IMPORT partials/wiki/breadcrumb-trail.tpl -->
    <div class="wiki-page-heading">
      <h1 class="wiki-page-heading__title">{pageTitle}</h1>
      <!-- IF mainPost -->
      <div class="wiki-page-heading__meta wiki-page-byline wiki-page-byline--attribution">
        <!-- IF mainPost.wikiLastRevisionUser -->
        <span>Last edited by
          <!-- IF mainPost.wikiLastRevisionUser.userslug --><a class="wiki-page-byline__userlink" href="{config.relative_path}/user/{mainPost.wikiLastRevisionUser.userslug}">{mainPost.wikiLastRevisionUser.displayname}</a><!-- ELSE -->{mainPost.wikiLastRevisionUser.displayname}<!-- ENDIF mainPost.wikiLastRevisionUser.userslug -->
        </span><!-- IF mainPost.wikiLastRevisionTimeISO --> <span title="{mainPost.wikiLastRevisionTimeISO}" class="wiki-page-byline-time timeago"></span><!-- ENDIF mainPost.wikiLastRevisionTimeISO --><!-- IF mainPost.wikiCreatedByUser --><span>, created by
          <!-- IF mainPost.wikiCreatedByUser.userslug --><a class="wiki-page-byline__userlink" href="{config.relative_path}/user/{mainPost.wikiCreatedByUser.userslug}">{mainPost.wikiCreatedByUser.displayname}</a><!-- ELSE -->{mainPost.wikiCreatedByUser.displayname}<!-- ENDIF mainPost.wikiCreatedByUser.userslug -->
        </span><!-- ENDIF mainPost.wikiCreatedByUser -->
        <!-- ENDIF mainPost.wikiLastRevisionUser -->
      </div>
      <!-- ENDIF mainPost -->
    </div>
  </header>

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
                  <div
                    class="wiki-sidebar-directory"
                    data-wiki-directory-mount="1"
                    data-cid="{sectionNavigation.cid}"
                    data-initial-cursor="{sectionNavigation.directoryNextCursor}"
                    data-initial-has-more="<!-- IF sectionNavigation.directoryHasMore -->1<!-- ELSE -->0<!-- ENDIF -->"
                    data-wiki-directory-endpoint="pages"
                    data-wiki-directory-mode="nav"
                    data-around-tid="{topic.tid}"
                    data-current-tid="{topic.tid}"
                    data-limit="35"
                  >
                    <label class="visually-hidden" for="wiki-sidebar-dir-filter-{topic.tid}">Filter pages in this namespace</label>
                    <input
                      type="search"
                      id="wiki-sidebar-dir-filter-{topic.tid}"
                      class="form-control form-control-sm wiki-directory-filter"
                      placeholder="Filter pages…"
                      data-wiki-directory-filter="1"
                      autocomplete="off"
                    />
                    <!-- IF sectionNavigation -->
                    <ul class="wiki-sidebar-nav-rows wiki-sidebar-nav-rows--namespace-lead" role="list">
                      <li class="wiki-sidebar-nav-row wiki-sidebar-nav-row--namespace" data-wiki-current-namespace="1" style="--wiki-nav-depth: 0;">
                        <a class="wiki-sidebar-nav-ns" href="{config.relative_path}{sectionNavigation.wikiPath}">{sectionNavigation.name}</a>
                      </li>
                    </ul>
                    <!-- ENDIF sectionNavigation -->
                    <ul class="wiki-sidebar-nav-rows wiki-sidebar-nav-rows--child-pages" data-wiki-directory-list role="list">
                      <!-- BEGIN wikiSidebarPageRows -->
                      <li class="wiki-sidebar-nav-row wiki-sidebar-nav-row--page" data-wiki-nav-tid="{./tid}">
                        <a class="wiki-sidebar-nav-page" href="{config.relative_path}{./wikiPath}">
                          <!-- IF ./hasParentPath -->
                          <span class="wiki-sidebar-parent-path">{./parentTitlePathText}</span>
                          <!-- ENDIF ./hasParentPath -->
                          <span class="wiki-sidebar-page-title">{./titleLeaf}</span>
                        </a>
                      </li>
                      <!-- END wikiSidebarPageRows -->
                    </ul>
                    <p class="wiki-directory-status small text-muted mb-0" data-wiki-directory-status aria-live="polite"></p>
                    <!-- IF sectionNavigation.directoryHasMore -->
                    <button type="button" class="btn btn-sm btn-outline-secondary mt-2" data-wiki-directory-more>
                      Load more
                    </button>
                    <div data-wiki-directory-sentinel class="wiki-directory-sentinel" aria-hidden="true"></div>
                    <!-- ENDIF sectionNavigation.directoryHasMore -->
                  </div>

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
            <!-- IF hasArticleCss -->
            <style data-westgate-wiki-article-css>
{scopedArticleCss}
            </style>
            <!-- ENDIF hasArticleCss -->
            <div class="card-body wiki-article-custom-css-scope-{topic.tid}">
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

    <nav class="wiki-fab-dock wiki-fab-dock--floating" aria-label="Page tools">
      <div class="wiki-fab-dock-inner">
        <!-- IF canEditWikiPage -->
        <a class="wiki-fab-btn wiki-fab-btn--icon" href="{config.relative_path}/wiki/edit/{topic.tid}" title="Edit this wiki page" aria-label="Edit this wiki page">
          <i class="fa fa-fw fa-pencil" aria-hidden="true"></i>
        </a>
        <!-- ENDIF canEditWikiPage -->
        <!-- IF canWatchWikiArticle -->
        <button type="button" class="wiki-fab-btn wiki-fab-btn--icon<!-- IF wikiArticleWatched --> active<!-- ENDIF wikiArticleWatched -->" data-wiki-article-watch="1" data-tid="{topic.tid}" data-watching="<!-- IF wikiArticleWatched -->1<!-- ELSE -->0<!-- ENDIF wikiArticleWatched -->" title="<!-- IF wikiArticleWatched -->Stop watching wiki article edits<!-- ELSE -->Watch wiki article edits<!-- ENDIF wikiArticleWatched -->" aria-label="<!-- IF wikiArticleWatched -->Stop watching wiki article edits<!-- ELSE -->Watch wiki article edits<!-- ENDIF wikiArticleWatched -->" aria-pressed="<!-- IF wikiArticleWatched -->true<!-- ELSE -->false<!-- ENDIF wikiArticleWatched -->">
          <i class="fa fa-fw <!-- IF wikiArticleWatched -->fa-eye<!-- ELSE -->fa-eye-slash<!-- ENDIF wikiArticleWatched -->" aria-hidden="true"></i>
        </button>
        <!-- ENDIF canWatchWikiArticle -->
        <!-- IF showWikiDiscussionLink -->
        <a class="wiki-fab-btn wiki-fab-btn--icon" href="{config.relative_path}/topic/{topic.slug}" title="Open the forum discussion thread" aria-label="Open discussion thread">
          <i class="fa fa-fw fa-comments" aria-hidden="true"></i>
        </a>
        <!-- ENDIF showWikiDiscussionLink -->
        <!-- IF canDeleteWikiPage -->
        <button type="button" class="wiki-fab-btn wiki-fab-btn--icon wiki-fab-btn--danger wiki-delete-page" data-wiki-delete-topic="1" data-tid="{topic.tid}" data-redirect-href="{config.relative_path}{category.wikiPath}" title="Permanently remove this wiki page" aria-label="Remove this wiki page">
          <i class="fa fa-fw fa-trash-o" aria-hidden="true"></i>
        </button>
        <!-- ENDIF canDeleteWikiPage -->
        <button type="button" class="wiki-fab-btn wiki-fab-btn--icon" data-wiki-scroll-top="1" title="Scroll to top" aria-label="Scroll to top">
          <i class="fa fa-fw fa-chevron-up" aria-hidden="true"></i>
        </button>
      </div>
    </nav>
  </div>
</div>

<!-- IF config.cache-buster -->
<link rel="stylesheet" href="{config.relative_path}/westgate-wiki/compose/article-body.css?{config.cache-buster}" />
<!-- ELSE -->
<link rel="stylesheet" href="{config.relative_path}/westgate-wiki/compose/article-body.css" />
<!-- ENDIF config.cache-buster -->
