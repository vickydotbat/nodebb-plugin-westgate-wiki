<div id="westgate-wiki-compose" class="westgate-wiki westgate-wiki-compose py-4">
  <p class="wiki-page-kicker">
    <a href="{config.relative_path}/wiki">Westgate Wiki</a>
    <!-- BEGIN breadcrumbs -->
    <span> / </span>
    <!-- IF breadcrumbs.url -->
    <a href="{config.relative_path}{breadcrumbs.url}">{breadcrumbs.text}</a>
    <!-- ELSE -->
    <span>{breadcrumbs.text}</span>
    <!-- ENDIF breadcrumbs.url -->
    <!-- END breadcrumbs -->
  </p>

  <h1>{pageHeading}</h1>
  <p class="text-muted">Namespace: <strong>{section.name}</strong></p>
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

    <div class="mb-2">
      <label class="form-label">Article body</label>
      <p class="small text-muted mb-1">The editor saves HTML for the wiki topic. Wiki links like <code>[[Page]]</code> are turned into normal links when the page is viewed. You can still import Markdown below and load it into the editor.</p>
      <div id="wiki-compose-editor" class="wiki-compose-editor wiki-article-prose"></div>
    </div>

    <div class="mb-3">
      <label class="form-label" for="wiki-compose-import-md">Import Markdown (optional)</label>
      <textarea id="wiki-compose-import-md" class="form-control font-monospace" rows="6" placeholder="Paste Markdown here, then click &quot;Load into editor&quot;"></textarea>
      <button type="button" class="btn btn-outline-secondary btn-sm mt-2" id="wiki-compose-import-btn">Load into editor</button>
    </div>

    <div class="mb-3 wiki-compose-wikilink">
      <label class="form-label">Insert wiki link</label>
      <div class="input-group input-group-sm mb-2">
        <input type="search" id="wiki-compose-link-search" class="form-control" placeholder="Search pages in this namespace…" autocomplete="off" />
        <button type="button" class="btn btn-outline-secondary" id="wiki-compose-link-search-btn">Search</button>
      </div>
      <select id="wiki-compose-link-pick" class="form-select form-select-sm mb-2" size="4" aria-label="Matching wiki pages"></select>
      <button type="button" class="btn btn-outline-primary btn-sm" id="wiki-compose-link-insert">Insert [[selection]]</button>
    </div>

    <div class="wiki-compose-actions d-flex gap-2 flex-wrap">
      <button type="button" class="btn btn-primary" id="wiki-compose-submit">{submitLabel}</button>
      <a class="btn btn-link" id="wiki-compose-cancel" href="{config.relative_path}{composeCancelHref}">Cancel</a>
    </div>
    <p class="small text-muted mt-2 mb-0" id="wiki-compose-status" aria-live="polite"></p>
  </div>
</div>

<!-- IF config.cache-buster -->
<link rel="stylesheet" href="{config.relative_path}/westgate-wiki/compose/vendor.css?{config.cache-buster}" />
<link rel="stylesheet" href="{config.relative_path}/westgate-wiki/compose/article-body.css?{config.cache-buster}" />
<script defer src="{config.relative_path}/westgate-wiki/compose/vendor.js?{config.cache-buster}"></script>
<script defer src="{config.relative_path}/westgate-wiki/compose/page.js?{config.cache-buster}"></script>
<!-- ELSE -->
<link rel="stylesheet" href="{config.relative_path}/westgate-wiki/compose/vendor.css" />
<link rel="stylesheet" href="{config.relative_path}/westgate-wiki/compose/article-body.css" />
<script defer src="{config.relative_path}/westgate-wiki/compose/vendor.js"></script>
<script defer src="{config.relative_path}/westgate-wiki/compose/page.js"></script>
<!-- ENDIF config.cache-buster -->
