/**
 * @file options.js
 * @description Options page functionality with Import/Export capabilities
 * @version 1.67
 */

// ===== DOM HELPER FUNCTIONS =====
const $ = (sel) => document.querySelector(sel);
const out = $("#out");

/**
 * Logs a message to the output element and console
 * @param {string} msg - Message to log
 */
function log(msg) {
  const el = out || document.getElementById("out");
  if (el) el.textContent = String(msg ?? "");
  console.log("OPTIONS LOG:", msg);
}

// ===== GRAPHQL HELPER FUNCTION =====

/**
 * Executes a GraphQL query (consistent with popup.js)
 * @param {string} endpoint - GraphQL endpoint URL
 * @param {string} token - Bearer token for authentication
 * @param {string} query - GraphQL query string
 * @param {Object} variables - Query variables
 * @returns {Promise<Object>} GraphQL response data
 */
async function executeGraphQL(endpoint, token, query, variables) {
  console.log("GraphQL Request:", { endpoint, query, variables });
  
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ query, variables })
  });

  const responseText = await response.text();
  console.log("GraphQL Raw Response:", responseText);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} — ${response.statusText}: ${responseText}`);
  }
  
  let json = {};
  try {
    json = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Invalid JSON response: ${responseText.slice(0, 200)}`);
  }
  
  if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) {
    const errorMessages = json.errors.map(e => e.message || String(e)).join("; ");
    throw new Error(`GraphQL Error: ${errorMessages}`);
  }
  
  return json.data || json;
}

// Query for page testing
const QUERY_GET_PAGE = `
  query GetPage($id: Int!) {
    pages {
      single(id: $id) {
        id
        path
        title
        editor
        content
        tags {
          id
          tag
          title
        }
      }
    }
  }
`;

// ===== CONFIGURATION MANAGEMENT =====

/**
 * Loads configuration from Chrome storage
 */
async function load() {
  const cfg = await chrome.storage.sync.get({
    endpoint: "",
    token: "",
    locale: "en",
    pageId: ""
  });
  $("#endpoint").value = cfg.endpoint;
  $("#token").value = cfg.token;
  $("#locale").value = cfg.locale;
  $("#pageId").value = cfg.pageId;
  log("");
}

/**
 * Saves configuration to Chrome storage
 */
async function save() {
  const endpoint = $("#endpoint").value.trim();
  const token    = $("#token").value.trim();
  const locale   = $("#locale").value.trim() || "en";
  const pageId   = $("#pageId").value.trim();

  // Validation
  if (!endpoint) {
    log("❌ Error: GraphQL endpoint is required");
    return;
  }
  
  if (!token) {
    log("❌ Error: API token is required");
    return;
  }
  
  if (!pageId || isNaN(Number(pageId))) {
    log("❌ Error: Page ID must be a number");
    return;
  }

  await chrome.storage.sync.set({ endpoint, token, locale, pageId });
  log("✅ Saved.");
}

/**
 * Tests Wiki connection
 */
async function test() {
  try {
    log("Testing connection...");
    
    const { endpoint, token, pageId } = await chrome.storage.sync.get();
    
    if (!endpoint || !token || !pageId) {
      throw new Error("Please enter endpoint, token and page ID.");
    }

    const id = Number(pageId);
    if (isNaN(id) || id <= 0) {
      throw new Error("Page ID must be a positive number.");
    }

    log("Testing GraphQL query...");
    
    const data = await executeGraphQL(endpoint, token, QUERY_GET_PAGE, { id });
    const page = data?.pages?.single;

    if (!page) {
      throw new Error(`Page with ID ${id} not found. Please check the page ID.`);
    }
    
    // Display tags correctly
    const tagInfo = Array.isArray(page.tags) && page.tags.length > 0 
      ? page.tags.map(tag => typeof tag === 'object' ? tag.tag : tag).join(', ')
      : 'none';
    
    log(`✅ Connection successful!

Page: "${page.title}"
ID: ${page.id}
Editor: ${page.editor || 'unknown'}
Path: ${page.path || 'unknown'}
Tags: ${tagInfo}
Content: ${page.content ? `${page.content.length} characters` : 'empty'}`);
    
  } catch (e) {
    console.error("Connection test failed:", e);
    log(`❌ Error: ${e.message}`);
  }
}

// ===== IMPORT/EXPORT FUNCTIONS =====

/**
 * Exports configuration as JSON file
 */
async function exportConfig() {
  try {
    log("Exporting configuration...");
    
    // Get current configuration
    const config = await chrome.storage.sync.get({
      endpoint: "",
      token: "",
      locale: "en",
      pageId: "",
      containers: [],
      categories: []
    });
    
    // Create export object with metadata
    const exportData = {
      version: "1.67",
      exportDate: new Date().toISOString(),
      config: config
    };
    
    // Create JSON file
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wiki-linker-config-${new Date().toISOString().slice(0, 10)}.json`;
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    log(`✅ Configuration exported as: ${a.download}`);
    
  } catch (error) {
    console.error("Export failed:", error);
    log(`❌ Export failed: ${error.message}`);
  }
}

/**
 * Imports configuration from JSON file
 */
async function importConfig() {
  const fileInput = $("#importFile");
  fileInput.click(); // Open file dialog
}

/**
 * Handles selected file import
 * @param {Event} event - File input change event
 */
async function handleFileImport(event) {
  try {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    
    log("Importing configuration...");
    
    // Read file as text
    const text = await file.text();
    
    // Parse JSON
    let importData;
    try {
      importData = JSON.parse(text);
    } catch (e) {
      throw new Error("Invalid JSON file");
    }
    
    // Validate data structure
    if (!importData.config) {
      throw new Error("Invalid configuration file - 'config' object missing");
    }
    
    const config = importData.config;
    
    // Validate required fields
    if (!config.endpoint || !config.token || !config.pageId) {
      throw new Error("Incomplete configuration - endpoint, token or page ID missing");
    }
    
    // Validate page ID
    if (isNaN(Number(config.pageId))) {
      throw new Error("Invalid page ID");
    }
    
    // Save configuration to storage
    await chrome.storage.sync.set({
      endpoint: config.endpoint,
      token: config.token,
      locale: config.locale || "en",
      pageId: config.pageId,
      containers: config.containers || [],
      categories: config.categories || []
    });
    
    // Update UI fields
    $("#endpoint").value = config.endpoint;
    $("#token").value = config.token;
    $("#locale").value = config.locale || "en";
    $("#pageId").value = config.pageId;
    
    // Success info
    const containerCount = (config.containers || []).length;
    const categoryCount = (config.categories || []).length;
    
    log(`✅ Configuration imported!

Endpoint: ${config.endpoint}
Page ID: ${config.pageId}
Locale: ${config.locale || "en"}
Containers: ${containerCount}
Categories: ${categoryCount}
Export Date: ${importData.exportDate ? new Date(importData.exportDate).toLocaleString('en-US') : 'unknown'}

Configuration has been automatically saved.`);
    
    // Reset file input
    event.target.value = '';
    
  } catch (error) {
    console.error("Import failed:", error);
    log(`❌ Import failed: ${error.message}`);
    
    // Reset file input
    event.target.value = '';
  }
}

// ===== EVENT LISTENERS =====
document.addEventListener("DOMContentLoaded", () => {
  // Initialize out element reference
  const outElement = document.getElementById("out");
  if (outElement) {
    Object.defineProperty(window, 'out', { 
      value: outElement, 
      writable: false 
    });
  }
  
  // Load saved configuration
  load();
  
  // Standard button event listeners
  const saveBtn = document.getElementById("save");
  const testBtn = document.getElementById("test");
  
  if (saveBtn) saveBtn.addEventListener("click", save);
  if (testBtn) testBtn.addEventListener("click", test);
  
  // Import/Export button event listeners
  const exportBtn = document.getElementById("exportConfig");
  const importBtn = document.getElementById("importConfig");
  const fileInput = document.getElementById("importFile");
  
  if (exportBtn) exportBtn.addEventListener("click", exportConfig);
  if (importBtn) importBtn.addEventListener("click", importConfig);
  if (fileInput) fileInput.addEventListener("change", handleFileImport);
  
  console.log("OPTIONS LOG: Options page with Import/Export loaded and configured");
});