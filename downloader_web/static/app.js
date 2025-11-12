const formatSelect = document.getElementById("format-select");
const infoPanel = document.getElementById("info-panel");
const formatTable = document.getElementById("format-table");
const infoTitle = document.getElementById("info-title");
const infoUploader = document.getElementById("info-uploader");
const infoDuration = document.getElementById("info-duration");
const infoDescription = document.getElementById("info-description");
const infoThumbnail = document.getElementById("info-thumbnail");
const singleStatus = document.getElementById("single-status");
const bulkStatus = document.getElementById("bulk-status");
const settingsStatus = document.getElementById("settings-status");
const downloadTemplate = document.getElementById("download-link-template");
const activityList = document.getElementById("activity-list");
const activityEmpty = document.getElementById("activity-empty");
const toastContainer = document.getElementById("toast-container");
const formatTypeFilter = document.getElementById("format-type-filter");
const formatSearch = document.getElementById("format-search");
const tabButtons = document.querySelectorAll(".tabs .tab");
const tabPanels = document.querySelectorAll(".tab-panel");

const formatState = {
  items: [],
  filter: "recommended",
  search: "",
};

function setStatus(element, message, type = "", options = {}) {
  const messageContainer = element.querySelector(".status__message");
  const downloadsContainer = element.querySelector(".status__downloads");

  element.classList.remove("success", "error");
  messageContainer.textContent = "";
  downloadsContainer.innerHTML = "";

  if (!message && !options.files?.length) {
    return;
  }

  if (message) {
    messageContainer.textContent = message;
  }

  if (type) {
    element.classList.add(type);
  }

  if (options.files?.length) {
    renderDownloadLinks(downloadsContainer, options.files);
  }

  if (options.toast) {
    showToast(message, type);
  }
}

function renderDownloadLinks(container, files = []) {
  container.innerHTML = "";
  files.forEach((file) => {
    const node = downloadTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".file").textContent = file;
    const link = node.querySelector("a");
    link.href = `/files?path=${encodeURIComponent(file)}`;
    link.download = "";
    container.appendChild(node);
  });
}

function showToast(message, type = "") {
  if (!message) {
    return;
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`.trim();
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("fade-out");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  }, 3500);
}

function addActivity(entry) {
  if (activityEmpty) {
    activityEmpty.hidden = true;
  }
  const item = document.createElement("li");
  item.className = "activity__item";
  const title = document.createElement("strong");
  title.textContent = entry.title;
  const time = document.createElement("time");
  time.dateTime = new Date().toISOString();
  time.textContent = new Date().toLocaleTimeString();
  item.append(title, time);

  if (entry.details) {
    const details = document.createElement("span");
    details.className = "muted";
    details.textContent = entry.details;
    item.appendChild(details);
  }

  if (entry.files?.length) {
    const list = document.createElement("ul");
    list.className = "status__downloads";
    entry.files.forEach((file) => {
      const listItem = document.createElement("li");
      listItem.textContent = file;
      list.appendChild(listItem);
    });
    item.appendChild(list);
  }

  activityList.prepend(item);
}

function formatBytes(bytes) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function formatSeconds(seconds) {
  if (!seconds && seconds !== 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const segments = [];
  if (h) segments.push(h.toString().padStart(2, "0"));
  segments.push(m.toString().padStart(2, "0"));
  segments.push(s.toString().padStart(2, "0"));
  return segments.join(":");
}

function resolutionScore(resolution) {
  if (!resolution) return 0;
  if (typeof resolution === "number") {
    return resolution;
  }
  const match = /(?:(\d+)[pP])|(\d+)x(\d+)/.exec(resolution);
  if (!match) {
    return 0;
  }
  if (match[1]) {
    return parseInt(match[1], 10);
  }
  if (match[3]) {
    return parseInt(match[3], 10);
  }
  if (match[2]) {
    return parseInt(match[2], 10);
  }
  return 0;
}

function classifyFormat(fmt) {
  const hasVideo = fmt.vcodec && fmt.vcodec !== "none";
  const hasAudio = fmt.acodec && fmt.acodec !== "none";
  if (hasVideo && hasAudio) {
    return "video";
  }
  if (hasVideo) {
    return "video";
  }
  if (hasAudio) {
    return "audio";
  }
  return "other";
}

function updateFormatSelect(formats) {
  formatSelect.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = formats.length ? "Auto (best available)" : "No formats found";
  formatSelect.appendChild(defaultOption);

  const sorted = [...formats].sort((a, b) => resolutionScore(b.resolution) - resolutionScore(a.resolution));
  sorted.forEach((fmt) => {
    const option = document.createElement("option");
    option.value = fmt.format_id || "";
    const quality = fmt.resolution || fmt.format_note || fmt.ext || fmt.format_id;
    option.textContent = `${fmt.format_id || "?"} – ${quality}`;
    formatSelect.appendChild(option);
  });
}

function filteredFormats() {
  return formatState.items.filter((fmt) => {
    const type = classifyFormat(fmt);
    if (formatState.filter === "recommended") {
      const isMp4 = (fmt.ext || "").includes("mp4") || (fmt.ext || "").includes("m4a");
      const hasAudio = fmt.acodec && fmt.acodec !== "none";
      const hasVideo = fmt.vcodec && fmt.vcodec !== "none";
      if (!(hasAudio && hasVideo)) {
        return false;
      }
      return isMp4 || resolutionScore(fmt.resolution) >= 720;
    }
    if (formatState.filter !== "all" && type !== formatState.filter) {
      return false;
    }
    if (!formatState.search) {
      return true;
    }
    const query = formatState.search.toLowerCase();
    const text = [
      fmt.format_id,
      fmt.ext,
      fmt.resolution,
      fmt.vcodec,
      fmt.acodec,
      fmt.format_note,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return text.includes(query);
  });
}

function renderFormatTable() {
  formatTable.innerHTML = "";
  let formats = filteredFormats();
  if (!formats.length && formatState.filter === "recommended" && !formatState.search) {
    formatState.filter = "all";
    document.querySelectorAll(".chip-group .chip").forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.filter === formatState.filter);
    });
    formats = filteredFormats();
  }
  if (!formats.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "No formats match your filters.";
    row.appendChild(cell);
    formatTable.appendChild(row);
    return;
  }

  formats.forEach((fmt) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${fmt.format_id ?? ""}</td>
      <td>${fmt.ext ?? ""}</td>
      <td>${fmt.resolution ?? fmt.format_note ?? ""}</td>
      <td>${fmt.vcodec ?? ""}</td>
      <td>${fmt.acodec ?? ""}</td>
      <td>${formatBytes(fmt.filesize) ?? ""}</td>
    `;
    formatTable.appendChild(row);
  });
}

function populateFormats(formats) {
  formatState.items = Array.isArray(formats) ? formats : [];
  formatState.filter = "recommended";
  formatState.search = "";
  formatSearch.value = "";
  document.querySelectorAll(".chip-group .chip").forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.filter === formatState.filter);
  });
  infoPanel.hidden = false;
  updateFormatSelect(formatState.items);
  renderFormatTable();
}

async function handleFetchInfo(event) {
  event.preventDefault();
  const urlInput = document.getElementById("single-url");
  const url = urlInput.value.trim();
  if (!url) {
    setStatus(singleStatus, "Enter a URL first.", "error");
    return;
  }
  setStatus(singleStatus, "Loading info…");

  try {
    const response = await fetch("/api/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to fetch info");
    }
    displayInfo(data.info);
    populateFormats(data.info.formats || []);
    setStatus(singleStatus, "Formats loaded", "success");
  } catch (error) {
    setStatus(singleStatus, error.message, "error");
    infoPanel.hidden = true;
    formatSelect.innerHTML = "";
    formatTable.innerHTML = "";
    formatState.items = [];
  }
}

function displayInfo(info) {
  infoTitle.textContent = info.title || "Untitled";
  infoUploader.textContent = info.uploader ? `By ${info.uploader}` : "";
  infoDuration.textContent = info.duration ? `Duration: ${formatSeconds(info.duration)}` : "";
  infoDescription.textContent = info.description ? info.description.slice(0, 500) : "";
  const thumbs = info.thumbnails || [];
  if (thumbs.length) {
    infoThumbnail.src = thumbs[thumbs.length - 1].url;
    infoThumbnail.hidden = false;
  } else {
    infoThumbnail.hidden = true;
  }
}

async function handleSingleDownload(event) {
  event.preventDefault();
  const url = document.getElementById("single-url").value.trim();
  if (!url) {
    setStatus(singleStatus, "Please enter a URL.", "error");
    return;
  }
  setStatus(singleStatus, "Downloading…");
  const payload = {
    url,
    format_id: formatSelect.value || null,
    audio_only: document.getElementById("audio-only").checked,
    output_template: document.getElementById("output-template").value || null,
    target_dir: document.getElementById("single-target").value || null,
  };

  try {
    const response = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Download failed");
    }
    setStatus(singleStatus, data.message || "Download complete", "success", {
      files: data.files,
      toast: true,
    });
    addActivity({
      title: "Single download finished",
      details: url,
      files: data.files,
    });
  } catch (error) {
    setStatus(singleStatus, error.message, "error", { toast: true });
    addActivity({
      title: "Single download failed",
      details: `${url}\n${error.message}`,
    });
  }
}

async function handleBulkDownload(event) {
  event.preventDefault();
  setStatus(bulkStatus, "Preparing downloads…");
  const formData = new FormData();
  formData.append("urls", document.getElementById("bulk-urls").value || "");
  formData.append("target_dir", document.getElementById("bulk-target").value || "");
  formData.append("format_id", document.getElementById("bulk-format").value || "");
  formData.append("audio_only", document.getElementById("bulk-audio-only").checked ? "true" : "false");
  formData.append("archive", document.getElementById("bulk-archive").checked ? "true" : "false");
  formData.append("output_template", document.getElementById("bulk-template").value || "");

  const fileInput = document.getElementById("bulk-file");
  if (fileInput.files.length) {
    formData.append("file", fileInput.files[0]);
  }

  try {
    const response = await fetch("/api/bulk", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || data.errors?.join("\n") || "Bulk download failed");
    }
    const files = [...(data.files || [])];
    if (data.archive) {
      files.push(data.archive);
    }
    let message = "Bulk download complete";
    if (data.errors?.length) {
      message += ` with warnings (\n${data.errors.join("\n")}\n)`;
    }
    setStatus(bulkStatus, message, data.errors?.length ? "" : "success", {
      files,
      toast: true,
    });
    addActivity({
      title: "Bulk download finished",
      details: `${files.length} file(s) ready`,
      files,
    });
  } catch (error) {
    setStatus(bulkStatus, error.message, "error", { toast: true });
    addActivity({
      title: "Bulk download failed",
      details: error.message,
    });
  }
}

async function handleSettings(event) {
  event.preventDefault();
  setStatus(settingsStatus, "Saving…");
  const payload = {
    download_dir: document.getElementById("settings-directory").value,
    auto_archive_bulk: document.getElementById("settings-archive").checked,
  };
  try {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to update settings");
    }
    const settings = data.settings || {};
    setStatus(settingsStatus, "Settings saved", "success", { toast: true });
    document.getElementById("single-target").value = "";
    document.getElementById("bulk-target").value = "";
    document.getElementById("single-target").placeholder = settings.download_dir || "";
    document.getElementById("bulk-target").placeholder = settings.download_dir || "";
    addActivity({
      title: "Settings updated",
      details: settings.download_dir,
    });
  } catch (error) {
    setStatus(settingsStatus, error.message, "error", { toast: true });
  }
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById("bulk-urls").value = reader.result;
  };
  reader.readAsText(file);
}

function handleTabChange(event) {
  const button = event.currentTarget;
  const targetId = button.dataset.target;
  tabButtons.forEach((btn) => btn.classList.toggle("is-active", btn === button));
  tabPanels.forEach((panel) => {
    if (panel.id === targetId) {
      panel.classList.add("is-active");
      panel.removeAttribute("aria-hidden");
    } else {
      panel.classList.remove("is-active");
      panel.setAttribute("aria-hidden", "true");
    }
  });
}

function handleFormatFilter(event) {
  const button = event.target.closest(".chip");
  if (!button) return;
  const filter = button.dataset.filter;
  if (!filter || formatState.filter === filter) {
    return;
  }
  formatState.filter = filter;
  document.querySelectorAll(".chip-group .chip").forEach((chip) => {
    chip.classList.toggle("is-active", chip === button);
  });
  renderFormatTable();
}

function handleFormatSearch(event) {
  formatState.search = event.target.value.trim();
  renderFormatTable();
}

function init() {
  document.getElementById("fetch-info").addEventListener("click", handleFetchInfo);
  document.getElementById("single-form").addEventListener("submit", handleSingleDownload);
  document.getElementById("bulk-form").addEventListener("submit", handleBulkDownload);
  document.getElementById("settings-form").addEventListener("submit", handleSettings);
  document.getElementById("bulk-file").addEventListener("change", handleFileUpload);
  formatTypeFilter.addEventListener("click", handleFormatFilter);
  formatSearch.addEventListener("input", handleFormatSearch);
  tabButtons.forEach((button) => button.addEventListener("click", handleTabChange));

  // Ensure placeholders align with configured defaults on load.
  fetch("/api/settings")
    .then((response) => response.json())
    .then((data) => {
      const settings = data.settings || {};
      document.getElementById("single-target").placeholder = settings.download_dir || "";
      document.getElementById("bulk-target").placeholder = settings.download_dir || "";
    })
    .catch(() => {
      /* ignore */
    });
}

document.addEventListener("DOMContentLoaded", init);
