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


function setStatus(element, message, type = "") {
  element.textContent = "";
  element.classList.remove("success", "error");
  if (!message) {
    return;
  }
  element.textContent = message;
  if (type) {
    element.classList.add(type);
  }
}

function renderDownloadLinks(container, files = []) {
  const wrapper = document.createElement("div");
  wrapper.className = "download-links";
  files.forEach((file) => {
    const node = downloadTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".file").textContent = file;
    const link = node.querySelector("a");
    link.href = `/files?path=${encodeURIComponent(file)}`;
    link.download = "";
    wrapper.appendChild(node);
  });
  container.appendChild(wrapper);
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

function populateFormats(formats) {
  formatSelect.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = formats.length ? "Auto (best)" : "No formats found";
  formatSelect.appendChild(defaultOption);

  formatTable.innerHTML = "";

  formats.forEach((fmt) => {
    const option = document.createElement("option");
    option.value = fmt.format_id || "";
    const quality = fmt.resolution || fmt.format_note || fmt.ext || fmt.format_id;
    option.textContent = `${fmt.format_id || "?"} – ${quality}`;
    formatSelect.appendChild(option);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${fmt.format_id ?? ""}</td>
      <td>${fmt.ext ?? ""}</td>
      <td>${fmt.resolution ?? ""}</td>
      <td>${fmt.vcodec ?? ""}</td>
      <td>${fmt.acodec ?? ""}</td>
      <td>${formatBytes(fmt.filesize) ?? ""}</td>
    `;
    formatTable.appendChild(row);
  });
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
    populateFormats(data.info.formats || []);
    setStatus(singleStatus, "Formats loaded", "success");
    displayInfo(data.info);
  } catch (error) {
    setStatus(singleStatus, error.message, "error");
    infoPanel.hidden = true;
    formatSelect.innerHTML = "";
    formatTable.innerHTML = "";
  }
}

function displayInfo(info) {
  infoPanel.hidden = false;
  infoTitle.textContent = info.title || "Untitled";
  infoUploader.textContent = info.uploader ? `By ${info.uploader}` : "";
  infoDuration.textContent = info.duration ? `Duration: ${formatSeconds(info.duration)}` : "";
  infoDescription.textContent = info.description ? info.description.slice(0, 400) : "";
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
    setStatus(singleStatus, data.message || "Download complete", "success");
    if (data.files?.length) {
      renderDownloadLinks(singleStatus, data.files);
    }
  } catch (error) {
    setStatus(singleStatus, error.message, "error");
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
    let message = "Bulk download complete";
    if (data.errors?.length) {
      message += ` with warnings (\n${data.errors.join("\n")}\n)`;
    }
    setStatus(bulkStatus, message, data.errors?.length ? "" : "success");
    if (data.files?.length) {
      renderDownloadLinks(bulkStatus, data.files);
    }
    if (data.archive) {
      renderDownloadLinks(bulkStatus, [data.archive]);
    }
  } catch (error) {
    setStatus(bulkStatus, error.message, "error");
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
    setStatus(settingsStatus, "Settings saved", "success");
    document.getElementById("single-target").value = settings.download_dir || "";
    document.getElementById("bulk-target").value = settings.download_dir || "";
  } catch (error) {
    setStatus(settingsStatus, error.message, "error");
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

function init() {
  document.getElementById("fetch-info").addEventListener("click", handleFetchInfo);
  document.getElementById("single-form").addEventListener("submit", handleSingleDownload);
  document.getElementById("bulk-form").addEventListener("submit", handleBulkDownload);
  document.getElementById("settings-form").addEventListener("submit", handleSettings);
  document.getElementById("bulk-file").addEventListener("change", handleFileUpload);
}

document.addEventListener("DOMContentLoaded", init);
