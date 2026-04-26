<div class="westgate-wiki westgate-wiki-namespace-create py-4">
  <header class="wiki-page-header mb-3">
    <!-- IMPORT partials/wiki/breadcrumb-trail.tpl -->
    <div class="wiki-page-heading">
      <h1 class="wiki-page-heading__title">Create child namespace</h1>
    </div>
    <p class="wiki-namespace-create-lead text-muted mb-0 mt-2 small">
      New namespace under <strong>{parentName}</strong>. Access rules are copied from this parent.
    </p>
  </header>

  <div
    id="wiki-namespace-create-config"
    class="d-none"
    data-api-url="{wikiNamespaceApiUrl}"
    data-csrf-token="{csrfToken}"
    data-parent-cid="{parentCid}"
  ></div>

  <form id="wiki-namespace-create-form" class="wiki-namespace-create-form card card-body mb-3">
    <div class="mb-3">
      <label class="form-label" for="wiki-namespace-name">Name</label>
      <input id="wiki-namespace-name" class="form-control" type="text" name="name" maxlength="255" required />
    </div>

    <div class="mb-3">
      <label class="form-label" for="wiki-namespace-description">Description (optional)</label>
      <textarea id="wiki-namespace-description" class="form-control" name="description" rows="3"></textarea>
    </div>

    <p id="wiki-namespace-create-status" class="small text-muted mb-2" aria-live="polite"></p>

    <button type="submit" class="btn btn-primary" id="wiki-namespace-create-submit">Create namespace</button>
  </form>
</div>
