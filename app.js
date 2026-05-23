(() => {
  "use strict";

  const STORAGE_KEY = "html-navi.items.v1";
  const VIEW_STORAGE_KEY = "html-navi.view.v1";
  const PRESET_CATEGORIES = [
    "技术与工具",
    "学习与研究",
    "产品与设计",
    "写作与创作",
    "商业与趋势",
    "效率与方法",
    "生活与兴趣",
    "影音娱乐",
    "待整理"
  ];
  const PRESET_TAGS = [
    "开源项目",
    "教程",
    "工具",
    "灵感",
    "AI",
    "前端",
    "设计",
    "写作",
    "效率",
    "稍后阅读",
    "重点回看",
    "可复用"
  ];
  const STATUS_LABELS = {
    inbox: "待整理",
    reading: "阅读中",
    reviewed: "已阅览",
    archived: "已归档"
  };

  const elements = {
    form: document.querySelector("#itemForm"),
    itemId: document.querySelector("#itemId"),
    title: document.querySelector("#titleInput"),
    url: document.querySelector("#urlInput"),
    summary: document.querySelector("#summaryInput"),
    category: document.querySelector("#categoryInput"),
    categoryPresets: document.querySelector("#categoryPresets"),
    tags: document.querySelector("#tagsInput"),
    tagPresets: document.querySelector("#tagPresets"),
    status: document.querySelector("#statusInput"),
    reviewDate: document.querySelector("#reviewDateInput"),
    favorite: document.querySelector("#favoriteInput"),
    formTitle: document.querySelector("#formTitle"),
    saveButton: document.querySelector("#saveButton"),
    cancelEditButton: document.querySelector("#cancelEditButton"),
    search: document.querySelector("#searchInput"),
    categoryFilter: document.querySelector("#categoryFilter"),
    statusFilter: document.querySelector("#statusFilter"),
    sort: document.querySelector("#sortSelect"),
    columns: document.querySelector("#columnSelect"),
    pageSize: document.querySelector("#pageSizeSelect"),
    itemList: document.querySelector("#itemList"),
    itemTemplate: document.querySelector("#itemTemplate"),
    emptyState: document.querySelector("#emptyState"),
    resultCount: document.querySelector("#resultCount"),
    stats: document.querySelector("#stats"),
    pagination: document.querySelector("#pagination"),
    previousPage: document.querySelector("#previousPage"),
    nextPage: document.querySelector("#nextPage"),
    pageStatus: document.querySelector("#pageStatus"),
    exportButton: document.querySelector("#exportButton"),
    importInput: document.querySelector("#importInput"),
    toast: document.querySelector("#toast")
  };

  let items = loadItems();
  let repositoryItems = [];
  let currentPage = 1;
  let toastTimer;

  function loadViewSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem(VIEW_STORAGE_KEY) || "{}");
      if (["2", "3", "4", "5"].includes(String(settings.columns))) {
        elements.columns.value = String(settings.columns);
      }
      if (["12", "24", "48"].includes(String(settings.pageSize))) {
        elements.pageSize.value = String(settings.pageSize);
      }
    } catch (error) {
      return;
    }
  }

  function persistViewSettings() {
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({
      columns: elements.columns.value,
      pageSize: elements.pageSize.value
    }));
  }

  function loadItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const stored = raw ? JSON.parse(raw) : [];
      return Array.isArray(stored) ? stored.map((item) => normalizeItem(item, "local")) : [];
    } catch (error) {
      showToast("本地数据读取失败，请尝试导入备份");
      return [];
    }
  }

  function normalizeItem(item, origin = "local") {
    return {
      id: String(item.id || makeId()),
      title: String(item.title || "").trim(),
      url: String(item.url || "").trim(),
      summary: String(item.summary || "").trim(),
      category: String(item.category || "").trim(),
      source: String(item.source || "").trim(),
      tags: Array.isArray(item.tags) ? item.tags.map(String) : parseTags(item.tags || ""),
      status: STATUS_LABELS[item.status] ? item.status : "inbox",
      reviewDate: String(item.reviewDate || ""),
      favorite: Boolean(item.favorite),
      createdAt: String(item.createdAt || new Date().toISOString()),
      updatedAt: String(item.updatedAt || new Date().toISOString()),
      origin
    };
  }

  function makeId() {
    return crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function parseTags(value) {
    return [...new Set(String(value).split(/[,，]/).map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
  }

  function createPresetButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset-chip";
    button.textContent = label;
    button.dataset.value = label;
    button.addEventListener("click", () => onClick(label));
    return button;
  }

  function renderPresets() {
    elements.categoryPresets.replaceChildren(...PRESET_CATEGORIES.map((category) => createPresetButton(category, (value) => {
      elements.category.value = value;
      syncPresetSelection();
    })));
    elements.tagPresets.replaceChildren(...PRESET_TAGS.map((tag) => createPresetButton(tag, (value) => {
      const tags = parseTags(elements.tags.value);
      const nextTags = tags.includes(value)
        ? tags.filter((entry) => entry !== value)
        : [...tags, value];
      elements.tags.value = nextTags.join(", ");
      syncPresetSelection();
    })));
    syncPresetSelection();
  }

  function syncPresetSelection() {
    const category = elements.category.value.trim();
    const tags = parseTags(elements.tags.value);
    elements.categoryPresets.querySelectorAll(".preset-chip").forEach((button) => {
      button.classList.toggle("active", button.dataset.value === category);
    });
    elements.tagPresets.querySelectorAll(".preset-chip").forEach((button) => {
      button.classList.toggle("active", tags.includes(button.dataset.value));
    });
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function libraryItems() {
    const merged = new Map(repositoryItems.map((item) => [item.id, item]));
    items.forEach((item) => merged.set(item.id, item));
    return [...merged.values()];
  }

  function escapeForSearch(item) {
    return [item.title, item.summary, item.category, domainName(item.url), ...item.tags].join(" ").toLowerCase();
  }

  function filteredItems() {
    const term = elements.search.value.trim().toLowerCase();
    const category = elements.categoryFilter.value;
    const status = elements.statusFilter.value;
    const filtered = libraryItems().filter((item) => {
      return (!term || escapeForSearch(item).includes(term))
        && (!category || item.category === category)
        && (!status || item.status === status);
    });

    return filtered.sort((first, second) => {
      switch (elements.sort.value) {
        case "oldest":
          return new Date(first.createdAt) - new Date(second.createdAt);
        case "favorite":
          return Number(second.favorite) - Number(first.favorite)
            || new Date(second.createdAt) - new Date(first.createdAt);
        case "review":
          return reviewValue(first) - reviewValue(second)
            || new Date(second.createdAt) - new Date(first.createdAt);
        default:
          return new Date(second.createdAt) - new Date(first.createdAt);
      }
    });
  }

  function reviewValue(item) {
    return item.reviewDate ? new Date(`${item.reviewDate}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
  }

  function formatDate(value) {
    if (!value) {
      return "";
    }
    return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(value));
  }

  function domainName(value) {
    try {
      return new URL(value).hostname.replace(/^www\./, "");
    } catch (error) {
      return "";
    }
  }

  function renderStats() {
    const dueToday = new Date().toISOString().slice(0, 10);
    const library = libraryItems();
    const stats = [
      { value: library.length, label: "全部资料" },
      { value: repositoryItems.length, label: "公开收纳" },
      { value: library.filter((item) => item.favorite).length, label: "重点资料" },
      { value: library.filter((item) => item.reviewDate && item.reviewDate <= dueToday).length, label: "待回看" }
    ];

    elements.stats.replaceChildren(...stats.map((stat) => {
      const card = document.createElement("div");
      card.className = "stat-card";
      const value = document.createElement("span");
      value.className = "stat-value";
      value.textContent = stat.value;
      const label = document.createElement("span");
      label.className = "stat-label";
      label.textContent = stat.label;
      card.append(value, label);
      return card;
    }));
  }

  function renderCategoryFilter() {
    const selected = elements.categoryFilter.value;
    const categories = [...new Set(libraryItems().map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh"));
    elements.categoryFilter.replaceChildren(new Option("全部分类", ""));
    categories.forEach((category) => elements.categoryFilter.add(new Option(category, category)));
    elements.categoryFilter.value = categories.includes(selected) ? selected : "";
  }

  function createPill(text, className = "") {
    const pill = document.createElement("span");
    pill.className = `pill ${className}`.trim();
    pill.textContent = text;
    return pill;
  }

  function addDetail(container, label, value) {
    if (!value) {
      return;
    }
    const term = document.createElement("dt");
    term.textContent = label;
    const detail = document.createElement("dd");
    detail.textContent = value;
    container.append(term, detail);
  }

  function renderItems() {
    const total = libraryItems().length;
    const visibleItems = filteredItems();
    const pageSize = Number(elements.pageSize.value);
    const totalPages = Math.max(1, Math.ceil(visibleItems.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const pageItems = visibleItems.slice(startIndex, startIndex + pageSize);
    elements.itemList.style.setProperty("--library-columns", elements.columns.value);
    elements.itemList.replaceChildren();
    elements.resultCount.textContent = visibleItems.length
      ? `显示 ${startIndex + 1}-${startIndex + pageItems.length} / ${visibleItems.length} 条`
      : `显示 0 / ${total} 条`;
    elements.emptyState.classList.toggle("hidden", visibleItems.length !== 0);
    elements.emptyState.querySelector("h3").textContent = total ? "没有符合条件的资料" : "还没有资料";
    elements.emptyState.querySelector("p").textContent = total
      ? "调整搜索或筛选条件，再找找看。"
      : "从左侧记录第一个链接，并写下一句它值得留下的原因。";

    elements.pagination.classList.toggle("hidden", totalPages <= 1);
    elements.pageStatus.textContent = `第 ${currentPage} / ${totalPages} 页`;
    elements.previousPage.disabled = currentPage === 1;
    elements.nextPage.disabled = currentPage === totalPages;

    pageItems.forEach((item) => {
      const fragment = elements.itemTemplate.content.cloneNode(true);
      const article = fragment.querySelector(".item-card");
      article.dataset.id = item.id;

      const category = fragment.querySelector(".compact-category");
      category.textContent = item.category || (item.origin === "repository" ? "公开收纳" : "本地暂存");

      const meta = fragment.querySelector(".meta");
      meta.append(createPill(STATUS_LABELS[item.status], `status-${item.status}`));
      meta.append(createPill(item.origin === "repository" ? "公开收纳" : "本地暂存", item.origin === "repository" ? "origin-repository" : ""));

      const favorite = fragment.querySelector(".favorite-button");
      favorite.textContent = item.favorite ? "\u2605" : "\u2606";
      favorite.classList.toggle("active", item.favorite);
      favorite.title = item.favorite ? "取消重点" : "标记重点";
      favorite.addEventListener("click", () => toggleFavorite(item.id));

      const title = fragment.querySelector(".item-title");
      title.href = item.url;
      title.textContent = item.title;

      const summary = fragment.querySelector(".summary");
      summary.textContent = item.summary || "尚未写摘要，编辑资料补充它值得保留的原因。";

      const tags = fragment.querySelector(".tag-list");
      item.tags.forEach((tag) => {
        const tagNode = document.createElement("span");
        tagNode.className = "tag";
        tagNode.textContent = `#${tag}`;
        tags.append(tagNode);
      });

      const details = fragment.querySelector(".details");
      addDetail(details, "站点", domainName(item.url) || item.source);
      addDetail(details, "收藏时间", `收藏 ${formatDate(item.createdAt)}`);
      addDetail(details, "回看时间", item.reviewDate ? `回看 ${formatDate(`${item.reviewDate}T00:00:00`)}` : "");

      fragment.querySelector(".edit-button").addEventListener("click", () => editItem(item.id));
      const deleteButton = fragment.querySelector(".delete-button");
      if (item.origin === "repository") {
        deleteButton.remove();
      } else {
        deleteButton.addEventListener("click", () => deleteItem(item.id));
      }
      elements.itemList.append(fragment);
    });
  }

  function render() {
    renderStats();
    renderCategoryFilter();
    renderItems();
  }

  function resetForm() {
    elements.form.reset();
    elements.itemId.value = "";
    elements.formTitle.textContent = "手动记录资料";
    elements.saveButton.textContent = "保存资料";
    elements.cancelEditButton.classList.add("hidden");
    elements.status.value = "inbox";
    syncPresetSelection();
  }

  function editItem(id) {
    const item = libraryItems().find((entry) => entry.id === id);
    if (!item) {
      return;
    }
    elements.itemId.value = item.id;
    elements.title.value = item.title;
    elements.url.value = item.url;
    elements.summary.value = item.summary;
    elements.category.value = item.category;
    elements.tags.value = item.tags.join(", ");
    elements.status.value = item.status;
    elements.reviewDate.value = item.reviewDate;
    elements.favorite.checked = item.favorite;
    elements.formTitle.textContent = "编辑资料";
    elements.saveButton.textContent = "更新资料";
    elements.cancelEditButton.classList.remove("hidden");
    syncPresetSelection();
    elements.title.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleFavorite(id) {
    const original = libraryItems().find((item) => item.id === id);
    if (!original) {
      return;
    }
    const changed = { ...original, favorite: !original.favorite, updatedAt: new Date().toISOString(), origin: "local" };
    const existsLocally = items.some((item) => item.id === id);
    items = existsLocally
      ? items.map((item) => item.id === id ? changed : item)
      : [changed, ...items];
    persist();
    render();
  }

  function deleteItem(id) {
    const item = items.find((entry) => entry.id === id);
    if (!item || !window.confirm(`确认删除“${item.title}”吗？`)) {
      return;
    }
    items = items.filter((entry) => entry.id !== id);
    persist();
    resetForm();
    render();
    showToast("资料已删除");
  }

  function handleSubmit(event) {
    event.preventDefault();
    const editingId = elements.itemId.value;
    const original = libraryItems().find((item) => item.id === editingId);
    const now = new Date().toISOString();
    const nextItem = normalizeItem({
      id: editingId || makeId(),
      title: elements.title.value,
      url: elements.url.value,
      summary: elements.summary.value,
      category: elements.category.value,
      source: original ? original.source : "",
      tags: parseTags(elements.tags.value),
      status: elements.status.value,
      reviewDate: elements.reviewDate.value,
      favorite: elements.favorite.checked,
      createdAt: original ? original.createdAt : now,
      updatedAt: now
    });

    items = items.some((item) => item.id === editingId)
      ? items.map((item) => item.id === editingId ? nextItem : item)
      : [nextItem, ...items];
    persist();
    resetForm();
    render();
    showToast(original ? "资料已更新" : "资料已保存到当前浏览器");
  }

  function exportItems() {
    const payload = JSON.stringify({
      app: "Html Navi",
      version: 1,
      exportedAt: new Date().toISOString(),
      items
    }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `html-navi-backup-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("备份文件已导出，请妥善保管");
  }

  async function importItems(event) {
    const [file] = event.target.files;
    if (!file) {
      return;
    }
    try {
      const content = JSON.parse(await file.text());
      const imported = Array.isArray(content) ? content : content.items;
      if (!Array.isArray(imported)) {
        throw new Error("invalid data");
      }
      const merged = new Map(items.map((item) => [item.id, item]));
      imported.map(normalizeItem).filter((item) => item.title && item.url).forEach((item) => merged.set(item.id, item));
      items = [...merged.values()];
      persist();
      render();
      showToast(`成功导入 ${imported.length} 条资料`);
    } catch (error) {
      showToast("导入失败：请选择 Html Navi 导出的 JSON 文件");
    } finally {
      elements.importInput.value = "";
    }
  }

  async function loadRepositoryItems() {
    try {
      const response = await fetch("./data/library.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("library unavailable");
      }
      const content = await response.json();
      const publicItems = Array.isArray(content) ? content : content.items;
      repositoryItems = Array.isArray(publicItems)
        ? publicItems.map((item) => normalizeItem(item, "repository")).filter((item) => item.title && item.url)
        : [];
    } catch (error) {
      repositoryItems = [];
    }
    render();
  }

  function showToast(message) {
    if (!elements.toast) {
      return;
    }
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 2800);
  }

  elements.form.addEventListener("submit", handleSubmit);
  elements.cancelEditButton.addEventListener("click", resetForm);
  elements.exportButton.addEventListener("click", exportItems);
  elements.importInput.addEventListener("change", importItems);
  elements.category.addEventListener("input", syncPresetSelection);
  elements.tags.addEventListener("input", syncPresetSelection);
  [elements.search, elements.categoryFilter, elements.statusFilter, elements.sort].forEach((element) => {
    element.addEventListener("input", () => {
      currentPage = 1;
      renderItems();
    });
    element.addEventListener("change", () => {
      currentPage = 1;
      renderItems();
    });
  });
  [elements.columns, elements.pageSize].forEach((element) => {
    element.addEventListener("change", () => {
      currentPage = 1;
      persistViewSettings();
      renderItems();
    });
  });
  elements.previousPage.addEventListener("click", () => {
    currentPage -= 1;
    renderItems();
  });
  elements.nextPage.addEventListener("click", () => {
    currentPage += 1;
    renderItems();
  });

  loadViewSettings();
  renderPresets();
  resetForm();
  render();
  loadRepositoryItems();
})();
