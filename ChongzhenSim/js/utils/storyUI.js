export function showCustomEdictPanel(onChoice) {
  const existing = document.getElementById("custom-edict-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "custom-edict-overlay";
  overlay.className = "custom-edict-overlay";

  const panel = document.createElement("div");
  panel.className = "custom-edict-panel";

  const header = document.createElement("div");
  header.className = "custom-edict-panel__header";
  const title = document.createElement("div");
  title.className = "custom-edict-panel__title";
  title.textContent = "自拟诏书";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "custom-edict-panel__close";
  closeBtn.textContent = "\u2715";
  closeBtn.addEventListener("click", () => overlay.remove());
  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const fields = [
    { id: "ce-neizhi", label: "内政", placeholder: "如：减免赋税、整顿吏治..." },
    { id: "ce-junshi", label: "军事", placeholder: "如：增兵辽东、加强城防..." },
    { id: "ce-waijiao", label: "外交", placeholder: "如：遣使议和、联络蒙古..." },
    { id: "ce-qita", label: "其他", placeholder: "如：祭天祈福、下罪己诏..." },
  ];

  const textareas = [];

  fields.forEach((f) => {
    const field = document.createElement("div");
    field.className = "custom-edict-field";
    const label = document.createElement("label");
    label.textContent = f.label;
    label.setAttribute("for", f.id);
    const textarea = document.createElement("textarea");
    textarea.id = f.id;
    textarea.placeholder = f.placeholder;
    textarea.rows = 2;
    textarea.addEventListener("input", updateSubmitState);
    field.appendChild(label);
    field.appendChild(textarea);
    panel.appendChild(field);
    textareas.push({ key: f.label, el: textarea });
  });

  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.className = "custom-edict-submit";
  submitBtn.textContent = "颁布诏书";
  submitBtn.disabled = true;

  function updateSubmitState() {
    const hasContent = textareas.some((t) => t.el.value.trim().length > 0);
    submitBtn.disabled = !hasContent;
  }

  submitBtn.addEventListener("click", () => {
    const parts = [];
    textareas.forEach((t) => {
      const val = t.el.value.trim();
      if (val) parts.push(`【${t.key}】${val}`);
    });
    if (parts.length === 0) return;
    const combinedText = parts.join(" ");
    overlay.remove();
    onChoice("custom_edict", combinedText, "自拟诏书", null);
  });

  panel.appendChild(submitBtn);
  overlay.appendChild(panel);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const app = document.getElementById("app");
  (app || document.body).appendChild(overlay);
}
