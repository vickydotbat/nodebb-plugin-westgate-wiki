<div id="westgate-wiki-compose" class="westgate-wiki westgate-wiki-compose py-4">
  <header class="wiki-page-header mb-3">
    <!-- IMPORT partials/wiki/breadcrumb-trail.tpl -->
    <div class="wiki-page-heading">
      <h1 class="wiki-page-heading__title">{pageHeading}</h1>
    </div>
  </header>
  <!-- IF showSetHomeBanner -->
  <div class="alert alert-info mb-3" role="status">
    This page will be published and set as the public wiki homepage at <code class="px-1">/wiki</code> (you can change
    that later in <strong>Admin &rarr; Plugins &rarr; Westgate Wiki</strong>).
  </div>
  <!-- ENDIF showSetHomeBanner -->

  <div id="westgate-wiki-compose-data" class="d-none" data-payload-b64="{composePayloadB64}"></div>

  <div class="wiki-compose-form card card-body mb-3">
    <div class="mb-3">
      <label class="form-label" for="wiki-compose-title">Title</label>
      <input id="wiki-compose-title" class="form-control" type="text" value="{defaultTitle}" maxlength="255" />
    </div>

    <!-- IF showNamespaceMainPageToggle -->
    <div class="form-check mb-3">
      <input id="wiki-compose-namespace-main-page" class="form-check-input" type="checkbox"<!-- IF isNamespaceMainPage --> checked<!-- ENDIF isNamespaceMainPage --> />
      <label class="form-check-label" for="wiki-compose-namespace-main-page">Use as the main page for this namespace</label>
      <p class="small text-muted mb-0">The main page is pinned to the top of this namespace's navigation.</p>
    </div>
    <!-- ENDIF showNamespaceMainPageToggle -->

    <!-- IF showDiscussionToggle -->
    <div class="form-check mb-3">
      <input id="wiki-compose-discussion-disabled" class="form-check-input" type="checkbox"<!-- IF discussionDisabled --> checked<!-- ENDIF discussionDisabled --> />
      <label class="form-check-label" for="wiki-compose-discussion-disabled">Disable forum discussion for this article</label>
      <p class="small text-muted mb-0">The forum topic will still link back to the wiki article, but new replies will be blocked.</p>
    </div>
    <!-- ENDIF showDiscussionToggle -->

    <div class="mb-2">
      <div id="wiki-compose-editor" class="wiki-compose-editor wiki-article-prose"></div>
    </div>

    <div class="mb-3">
      <label class="form-label" for="wiki-compose-import-md">Import Markdown (optional)</label>
      <textarea id="wiki-compose-import-md" class="form-control font-monospace" rows="6" placeholder="Paste Markdown here, then click &quot;Load into editor&quot;"></textarea>
      <button type="button" class="btn btn-outline-secondary btn-sm mt-2" id="wiki-compose-import-btn">Load into editor</button>
    </div>

    <div class="wiki-compose-actions wiki-compose-actions--floating d-flex gap-2 flex-wrap">
      <button type="button" class="btn btn-primary" id="wiki-compose-submit">{submitLabel}</button>
      <a class="btn btn-outline-secondary" id="wiki-compose-return" href="{config.relative_path}{composeCancelHref}">Return</a>
    </div>
    <p class="small text-muted mt-2 mb-0" id="wiki-compose-status" aria-live="polite"></p>
  </div>
</div>

<!-- IF config.cache-buster -->
<link rel="stylesheet" href="{config.relative_path}/westgate-wiki/compose/editor.css?{config.cache-buster}" />
<link rel="stylesheet" href="{config.relative_path}/westgate-wiki/compose/article-body.css?{config.cache-buster}" />
<script defer src="{config.relative_path}/westgate-wiki/compose/editor.js?{config.cache-buster}"></script>
<script defer src="{config.relative_path}/westgate-wiki/compose/page.js?{config.cache-buster}"></script>
<!-- ELSE -->
<link rel="stylesheet" href="{config.relative_path}/westgate-wiki/compose/editor.css" />
<link rel="stylesheet" href="{config.relative_path}/westgate-wiki/compose/article-body.css" />
<script defer src="{config.relative_path}/westgate-wiki/compose/editor.js"></script>
<script defer src="{config.relative_path}/westgate-wiki/compose/page.js"></script>
<!-- ENDIF config.cache-buster -->
