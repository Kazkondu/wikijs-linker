/**
 * @file demo-template.js
 * @description Generates a complete demo template with containers, categories and example links
 */

// ===== HELPER FUNCTIONS (GraphQL, etc.) =====

async function executeGraphQL(endpoint, token, query, variables) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ query, variables })
  });
  const responseText = await response.text();
  if (!response.ok) { throw new Error(`HTTP ${response.status} — ${response.statusText}: ${responseText}`); }
  let json = {};
  try { json = JSON.parse(responseText); } catch (e) { throw new Error(`Invalid JSON response: ${responseText.slice(0, 200)}`); }
  if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) { throw new Error(`GraphQL Error: ${json.errors.map(e => e.message || String(e)).join("; ")}`); }
  return json.data || json;
}

async function loadWikiPage(endpoint, token, pageId) {
  const id = Number(pageId);
  const data = await executeGraphQL(endpoint, token, QUERY_GET_PAGE, { id });
  const page = data?.pages?.single;
  if (!page) { throw new Error(`Wiki page with ID ${id} not found`); }
  return page;
}

async function updateWikiPage(endpoint, token, page, newContent) {
  const currentPageDetails = page;
  const tagStrings = Array.isArray(currentPageDetails.tags) ? currentPageDetails.tags.map(tag => (typeof tag === 'object' && tag.tag) ? tag.tag : String(tag)) : [];
  const variables = {
    id: Number(currentPageDetails.id),
    content: newContent,
    title: currentPageDetails.title || "",
    isPublished: currentPageDetails.isPublished !== undefined ? currentPageDetails.isPublished : true,
    isPrivate: currentPageDetails.isPrivate || false,
    locale: currentPageDetails.locale || "en",
    path: currentPageDetails.path || "",
    tags: tagStrings
  };
  const result = await executeGraphQL(endpoint, token, MUTATION_UPDATE_PAGE, variables);
  const responseResult = result?.pages?.update?.responseResult;
  if (!responseResult?.succeeded) { throw new Error(`Wiki Update Error: ${responseResult?.message || "Update failed"}`); }
  return result;
}

const QUERY_GET_PAGE = `query GetPage($id: Int!) { pages { single(id: $id) { id path title editor content description isPrivate isPublished locale tags { id tag title } createdAt updatedAt } } }`;
const MUTATION_UPDATE_PAGE = `mutation UpdatePage($id: Int!, $content: String!, $title: String, $isPublished: Boolean, $isPrivate: Boolean, $locale: String, $path: String, $tags: [String]) { pages { update(id: $id, content: $content, title: $title, isPublished: $isPublished, isPrivate: $isPrivate, locale: $locale, path: $path, tags: $tags) { responseResult { succeeded errorCode message } page { id updatedAt } } } }`;

// ===== DEMO-TEMPLATE GENERATOR =====

function generateDemoTemplate() {
  return `<div class="layout-container layout-3col" id="development-container">
  <!-- Container: development - Development & Tools -->
  <!-- CONTAINER_DEVELOPMENT_CONTENT_START -->
  <section class="section-card accent-blue" id="webdev-section">
    <header class="section-card__header">
      <div class="section-card__title">Web Development</div>
      <div class="section-card__meta">Tools and resources for web development</div>
    </header>
    <div class="links">
      <a class="linkcard" href="https://www.youtube.com/" target="_blank" rel="noopener">
        <img src="https://www.google.com/s2/favicons?domain=youtube.com&sz=32" alt="">
        <div>
          <div class="title">YouTube</div>
          <div class="url">youtube.com</div>
        </div>
      </a>
      <!-- WEBDEV_LINKS_END -->
    </div>
  </section>
  <section class="section-compact accent-green" id="tools-section">
    <header class="section-compact__header">
      <div class="section-compact__title">Developer Tools</div>
      <div class="section-compact__meta">Practical utilities for everyday use</div>
    </header>
    <div class="compact-links">
      <!-- TOOLS_LINKS_END -->
    </div>
  </section>
  <section class="section-large accent-purple" id="resources-section">
    <header class="section-large__header">
      <div class="section-large__title">Learning Resources</div>
      <div class="section-large__meta">Tutorials and documentation</div>
    </header>
    <div class="large-links">
      <!-- RESOURCES_LINKS_END -->
    </div>
  </section>
  <!-- CONTAINER_DEVELOPMENT_CONTENT_END -->
</div>

<div class="layout-container layout-2col" id="productivity-container">
  <!-- Container: productivity - Productivity -->
  <!-- CONTAINER_PRODUCTIVITY_CONTENT_START -->
  <section class="section-card accent-orange" id="office-section">
    <header class="section-card__header">
      <div class="section-card__title">Office & Docs</div>
      <div class="section-card__meta">Documents and office applications</div>
    </header>
    <div class="links">
      <!-- OFFICE_LINKS_END -->
    </div>
  </section>
  <section class="section-card accent-teal" id="communication-section">
    <header class="section-card__header">
      <div class="section-card__title">Communication</div>
      <div class="section-card__meta">Chat, video calls and collaboration</div>
    </header>
    <div class="links">
      <!-- COMMUNICATION_LINKS_END -->
    </div>
  </section>
  <!-- CONTAINER_PRODUCTIVITY_CONTENT_END -->
</div>

`;
}

// Demo data for storage
const DEMO_CONTAINERS = [
  { key: 'development', name: 'Development & Tools', columns: 3 },
  { key: 'productivity', name: 'Productivity', columns: 2 }
];

const DEMO_CATEGORIES = [
  { key: 'webdev', name: 'Web Development', description: 'Tools and resources for web development', layout: 'cards', accent: 'blue', containerKey: 'development', column: 0 },
  { key: 'tools', name: 'Developer Tools', description: 'Practical utilities for everyday use', layout: 'compact', accent: 'green', containerKey: 'development', column: 1 },
  { key: 'resources', name: 'Learning Resources', description: 'Tutorials and documentation', layout: 'large', accent: 'purple', containerKey: 'development', column: 2 },
  { key: 'office', name: 'Office & Docs', description: 'Documents and office applications', layout: 'cards', accent: 'orange', containerKey: 'productivity', column: 0 },
  { key: 'communication', name: 'Communication', description: 'Chat, video calls and collaboration', layout: 'cards', accent: 'teal', containerKey: 'productivity', column: 1 }
];

// ===== EXPORTED MAIN FUNCTION =====

/**
 * Loads a complete demo template into the Wiki page
 * @param {Function} log - Logging function for status updates
 * @returns {Object} Result object with success status and created data
 */
export async function loadDemoTemplate(log) {
  log("Loading demo template...");
  try {
    const config = await chrome.storage.sync.get(['endpoint', 'token', 'pageId']);
    if (!config.endpoint || !config.token || !config.pageId) {
      throw new Error("Wiki configuration incomplete. Please check in options.");
    }

    const page = await loadWikiPage(config.endpoint, config.token, config.pageId);
    const demoContent = generateDemoTemplate();

    await updateWikiPage(config.endpoint, config.token, page, demoContent);

    // Save demo structure in extension storage
    await chrome.storage.sync.set({
      'containers': DEMO_CONTAINERS,
      'categories': DEMO_CATEGORIES
    });

    log(`✅ Demo template successfully loaded!

Contains:
- 2 containers (3-column & 2-column)
- 5 categories (different layouts)
- 1 example link to YouTube

The structure has been synchronized and is ready to use.`);
    
    return { success: true, containers: DEMO_CONTAINERS, categories: DEMO_CATEGORIES };

  } catch (error) {
    console.error("Error loading demo template:", error);
    log(`❌ Loading failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}