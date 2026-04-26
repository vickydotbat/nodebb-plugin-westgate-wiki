<div class="westgate-wiki py-4">
  <section class="wiki-page-hero card mb-4">
    <div class="card-body">
      <!-- IMPORT partials/wiki/breadcrumb-trail.tpl -->
      <h1>{section.name}</h1>

      <!-- IF section.description -->
      <div class="wiki-section-description wiki-article-prose">
        {section.description}
      </div>
      <!-- ENDIF section.description -->
    </div>
  </section>

  <div class="wiki-with-fab wiki-with-fab--section">
    <div class="wiki-content-layout">
      <div class="wiki-page-main-column">
        <!-- IF hasCreateIntent -->
        <section class="wiki-status-card wiki-status-card-redlink card mb-4">
          <div class="card-body">
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
          </div>
        </section>
        <!-- ENDIF hasCreateIntent -->

        <section class="wiki-page-body">
          <article class="wiki-page-content wiki-article-prose wiki-namespace-index card">
            <div class="card-body">
              <!-- IF hasNamespaceIndexContent -->
              <!-- IF hasWikiIndexNamespaces -->
              <section class="wiki-index-namespaces-block" aria-labelledby="wiki-index-ns-heading">
                <h3 class="wiki-index-subsection-title" id="wiki-index-ns-heading" style="margin-top:0;">Child Namespaces</h3>
                <ul class="wiki-index-list wiki-index-list--namespaces">
                  <!-- BEGIN wikiIndexNamespaces -->
                  <li class="wiki-index-entry wiki-index-entry--namespace">
                    <div class="wiki-index-entry-main">
                      <a class="wiki-index-entry-title" href="{config.relative_path}{wikiIndexNamespaces.wikiPath}">
                        {wikiIndexNamespaces.displayTitle}
                      </a>
                      <p>({wikiIndexNamespaces.articleCountLabel})</p>
                    </div>
                  </li>
                  <!-- END wikiIndexNamespaces -->
                </ul>
              </section>
              <!-- ENDIF hasWikiIndexNamespaces -->

              <!-- IF hasWikiIndexPageLetters -->
              <!-- IF hasWikiIndexNamespaces -->
              <hr class="wiki-index-section-rule" />
              <!-- ENDIF hasWikiIndexNamespaces -->

              <section class="wiki-index-pages-block" aria-labelledby="wiki-index-pages-heading">
                <h3 class="wiki-index-subsection-title" id="wiki-index-pages-heading">Articles</h3>

                <!-- IF hasMultipleWikiIndexLetterGroups -->
                <nav class="wiki-index-jump" aria-label="Jump to wiki page letter">
                  <!-- BEGIN wikiIndexPageLetters -->
                  <a class="wiki-index-jump-link" href="#wiki-page-letter-{wikiIndexPageLetters.letterAnchor}">{wikiIndexPageLetters.letterLabel}</a>
                  <!-- END wikiIndexPageLetters -->
                </nav>
                <!-- ENDIF hasMultipleWikiIndexLetterGroups -->

                <div class="wiki-index-body">
                  <!-- BEGIN wikiIndexPageLetters -->
                  <section class="wiki-index-letter-block" aria-labelledby="wiki-page-letter-{wikiIndexPageLetters.letterAnchor}">
                    <h4 class="wiki-index-letter" id="wiki-page-letter-{wikiIndexPageLetters.letterAnchor}">
                      <span class="wiki-index-letter-label">{wikiIndexPageLetters.letterLabel}</span>
                    </h4>
                    <ul class="wiki-index-list">
                      {{{ each ./entries }}}
                      <li class="wiki-index-entry">
                        <div class="wiki-index-entry-main">
                          <a class="wiki-index-entry-title" href="{config.relative_path}{../wikiPath}">
                            {{{ if ../hasParentPath }}}
                            <span class="wiki-topic-parent-path">{../parentTitlePathText}</span>
                            {{{ end }}}
                            <span class="wiki-topic-title-leaf">{../titleLeaf}</span>
                          </a>
                        </div>
                      </li>
                      {{{ end }}}
                    </ul>
                  </section>
                  <!-- END wikiIndexPageLetters -->
                </div>
              </section>
              <!-- ENDIF hasWikiIndexPageLetters -->

              <!-- ELSE -->
              <p class="wiki-namespace-index-empty">
                There are no visible child namespaces or wiki pages in this namespace yet.
              </p>
              <!-- ENDIF hasNamespaceIndexContent -->
            </div>
          </article>
        </section>
      </div>
    </div>

    <!-- IF showWikiSectionFab -->
    <nav class="wiki-fab-dock wiki-fab-dock--floating" aria-label="Namespace tools">
      <div class="wiki-fab-dock-inner">
        <!-- IF canCreatePage -->
        <a class="wiki-fab-btn wiki-fab-btn--icon" href="#" data-wiki-create-page="1" data-cid="{section.cid}" title="Create a new wiki page in this namespace" aria-label="Create a new wiki page in this namespace">
          <i class="fa fa-fw fa-file-text" aria-hidden="true"></i>
        </a>
        <!-- ENDIF canCreatePage -->
        <!-- IF canCreateWikiNamespaces -->
        <a class="wiki-fab-btn wiki-fab-btn--icon" href="{config.relative_path}/wiki/namespace/create/{section.cid}" title="Create a child wiki namespace under this category" aria-label="Create a child wiki namespace">
          <i class="fa fa-fw fa-folder-open" aria-hidden="true"></i>
        </a>
        <!-- ENDIF canCreateWikiNamespaces -->
      </div>
    </nav>
    <!-- ENDIF showWikiSectionFab -->
  </div>
</div>

<!-- IF config.cache-buster -->
<link rel="stylesheet" href="{config.relative_path}/westgate-wiki/compose/article-body.css?{config.cache-buster}" />
<!-- ELSE -->
<link rel="stylesheet" href="{config.relative_path}/westgate-wiki/compose/article-body.css" />
<!-- ENDIF config.cache-buster -->
