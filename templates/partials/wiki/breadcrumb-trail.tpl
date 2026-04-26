<nav class="wiki-breadcrumb-trail" aria-label="Wiki location">
  <ol class="wiki-breadcrumb-trail__list">
    <!-- BEGIN wikiBreadcrumbs -->
    <li class="wiki-breadcrumb-trail__item">
      <!-- IF wikiBreadcrumbs.url -->
      <a class="wiki-breadcrumb-trail__link" href="{config.relative_path}{wikiBreadcrumbs.url}">{wikiBreadcrumbs.text}</a>
      <!-- ELSE -->
      <!-- IF wikiBreadcrumbs.isAriaCurrent -->
      <span class="wiki-breadcrumb-trail__text wiki-breadcrumb-trail__text--current" aria-current="page">{wikiBreadcrumbs.text}</span>
      <!-- ELSE -->
      <span class="wiki-breadcrumb-trail__text">{wikiBreadcrumbs.text}</span>
      <!-- ENDIF wikiBreadcrumbs.isAriaCurrent -->
      <!-- ENDIF wikiBreadcrumbs.url -->
    </li>
    <!-- END wikiBreadcrumbs -->
  </ol>
  <!-- IF hasWikiBreadcrumbAction -->
  <span class="wiki-breadcrumb-trail__action" aria-current="page">{wikiBreadcrumbAction}</span>
  <!-- ENDIF hasWikiBreadcrumbAction -->
</nav>
