<div class="westgate-wiki westgate-wiki-namespace-create py-4">
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

  <h1>Create child namespace</h1>
  <p class="text-muted">New namespace under <strong>{parentName}</strong>. Access rules are copied from this parent.</p>

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
