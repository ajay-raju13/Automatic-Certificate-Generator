import React, { useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import api from "../api";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function measureTextWidth(text, fontSize, fontFamily = "Arial") {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = `${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

// Fit font to width (frontend visual). Returns fitted font size.
function fitFontToWidth(text, initialSize, boxWidth, fontFamily = "Arial", padding = 8) {
  let size = initialSize;
  const maxIter = 80;
  let i = 0;
  while (i < maxIter) {
    const w = measureTextWidth(text, size, fontFamily);
    if (w <= Math.max(4, boxWidth - padding)) break;
    size = Math.max(4, Math.floor(size - Math.max(1, size * 0.06)));
    i++;
  }
  return size;
}

export default function CertificateEditor() {
  const [templateUrl, setTemplateUrl] = useState(null);
  const [imgNatural, setImgNatural] = useState({ w: 1000, h: 600 });
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);

  // placeholders: {id,label,x,y,width,height,fontSize,font,color}
  const [placeholders, setPlaceholders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [previewSrc, setPreviewSrc] = useState(null);
  const [folderName, setFolderName] = useState("");

  const fontOptions = [
    "Roboto-Bold.ttf",
    "Roboto-Regular.ttf",
    "Roboto-Italic.ttf",
    "Roboto-Medium.ttf",
  ];

  useEffect(() => {
    loadTemplate();
  }, []);

  async function loadTemplate() {
    try {
      const res = await api.get("/template");
      setTemplateUrl(res.data?.url || null);
    } catch (err) {
      console.error("Template load error", err);
    }
  }

  useEffect(() => {
    if (!templateUrl) return;
    const img = new Image();
    img.src = templateUrl;
    img.onload = () => {
      setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
      computeScale(img.naturalWidth);
    };
  }, [templateUrl]);

  function computeScale(nw = imgNatural.w) {
    const container = containerRef.current;
    if (!container) return setScale(1);
    const maxW = Math.max(200, container.clientWidth - 20);
    const s = Math.min(1, maxW / nw);
    setScale(s);
  }

  useEffect(() => {
    const onResize = () => computeScale();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function updatePlaceholder(id, patch) {
    setPlaceholders((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function addPlaceholder() {
    const id = uid();
    const defaultW = Math.max(120, Math.round(imgNatural.w * 0.5));
    const defaultH = Math.max(36, Math.round(imgNatural.h * 0.08));
    const ph = {
      id,
      label: `field_${placeholders.length + 1}`,
      x: Math.round((imgNatural.w - defaultW) / 2),
      y: Math.round((imgNatural.h - defaultH) / 2),
      width: defaultW,
      height: defaultH,
      fontSize: Math.min(48, Math.round(defaultH * 0.6)),
      font: "Roboto-Bold.ttf",
      color: "#000000",
    };
    setPlaceholders((prev) => [...prev, ph]);
    setSelected(id);
  }

  function deletePlaceholder(id) {
    setPlaceholders((p) => p.filter((x) => x.id !== id));
    setSelected(null);
  }

  async function saveLayout() {
    if (!placeholders.length) {
      alert("No placeholders to save");
      return;
    }
    const dict = {};
    for (const p of placeholders) {
      dict[p.label] = {
        x: Math.round(p.x),
        y: Math.round(p.y),
        width: Math.round(p.width),
        height: Math.round(p.height),
        font_size: Math.round(p.fontSize),
        font: p.font,
        color: p.color,
      };
    }
    try {
      const res = await api.post("/set-placeholders", {
        placeholders: dict,
        default_font: "Roboto-Regular.ttf",
      });
      if (res.data?.status === "ok") alert("Layout saved");
      else alert("Saved response: " + JSON.stringify(res.data));
    } catch (err) {
      console.error(err);
      alert("Error saving layout");
    }
  }

  async function uploadTemplateFile(file) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post("/upload-template", fd);
      await loadTemplate();
      alert("Template uploaded");
    } catch {
      alert("Upload failed");
    }
  }

  async function uploadExcelFile(file) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post("/upload-excel", fd);
      alert("Excel uploaded");
    } catch {
      alert("Excel upload failed");
    }
  }

  async function previewRow(index = 0) {
    try {
      const fd = new FormData();
      fd.append("row_index", index);
      const res = await api.post("/preview", fd, { responseType: "blob" });
      setPreviewSrc(URL.createObjectURL(res.data));
    } catch (err) {
      console.error(err);
      alert("Preview failed");
    }
  }

  async function generateAll() {
    try {
      const fd = new FormData();
      fd.append("folder_name", folderName || `job_${Date.now()}`);
      const res = await api.post("/generate", fd);
      if (res.data?.zip) {
        window.open(`${api.defaults.baseURL}/download/${res.data.zip}`, "_blank");
      } else {
        alert("Generate response: " + JSON.stringify(res.data));
      }
    } catch (err) {
      console.error(err);
      alert("Generate failed");
    }
  }

  // Display helpers
  function displayLeftTop(p) {
    return { left: Math.round(p.x * scale), top: Math.round(p.y * scale) };
  }
  function displaySize(p) {
    return { width: Math.round(p.width * scale), height: Math.round(p.height * scale) };
  }

  return (
    <div className="editor-root">
      <div style={{ border: "1px solid #eee", padding: 10, marginBottom: 10, background: "#fafafa" }}>
        <strong>How the app works</strong>
        <ol>
          <li>Upload a template image (png or jpg).</li>
          <li>Upload an Excel file with column headers matching placeholder names.</li>
          <li>Press Add Placeholder to add a box. Drag to move it.</li>
          <li>Drag the corners of the box to resize width and height.</li>
          <li>Text is single-line; font auto-fits to box width and is centered vertically.</li>
          <li>Rename a placeholder to match Excel header exactly, then Save Layout.</li>
          <li>Preview row 1 and Generate to create a folder of PDFs and a ZIP download.</li>
        </ol>
      </div>

      <div className="toolbar">
        <label className="btn">
          Upload Template
          <input type="file" accept=".png,.jpg,.jpeg" style={{ display: "none" }}
            onChange={(e) => uploadTemplateFile(e.target.files[0])} />
        </label>

        <label className="btn">
          Upload Excel
          <input type="file" accept=".xlsx,.xls" style={{ display: "none" }}
            onChange={(e) => uploadExcelFile(e.target.files[0])} />
        </label>

        <button className="btn" onClick={addPlaceholder}>Add Placeholder</button>
        <button className="btn" onClick={() => selected ? deletePlaceholder(selected) : alert("Select one")}>Delete Selected</button>
        <button className="btn" onClick={saveLayout}>Save Layout</button>
        <button className="btn" onClick={() => previewRow(0)}>Preview Row 1</button>

        <input placeholder="folder name (optional)" value={folderName} onChange={(e) => setFolderName(e.target.value)} />
        <button className="btn" onClick={generateAll}>Generate PDFs</button>
      </div>

      <div className="editor-area">
        <div className="left-panel" ref={containerRef}>
          <div className="canvas-wrap">
            {templateUrl ? (
              <img src={templateUrl} alt="template" style={{ width: imgNatural.w * scale, height: imgNatural.h * scale }} />
            ) : (
              <div className="no-template">No template uploaded</div>
            )}

            <div className="overlay" style={{ width: imgNatural.w * scale, height: imgNatural.h * scale }}>
              {placeholders.map((p) => {
                const pos = displayLeftTop(p);
                const sz = displaySize(p);
                // display font fits to width
                const displayFontSize = fitFontToWidth(p.label, Math.round(p.fontSize * scale), sz.width, "Arial", 8);
                return (
                  <Rnd
                    key={p.id}
                    bounds="parent"
                    size={{ width: sz.width, height: sz.height }}
                    position={{ x: pos.left, y: pos.top }}
                    onDragStop={(e, d) => {
                      updatePlaceholder(p.id, { x: Math.round(d.x / scale), y: Math.round(d.y / scale) });
                    }}
                    onResizeStop={(e, direction, ref, delta, position) => {
                      const newW = Math.round(ref.offsetWidth / scale);
                      const newH = Math.round(ref.offsetHeight / scale);
                      updatePlaceholder(p.id, {
                        width: newW,
                        height: newH,
                        x: Math.round(position.x / scale),
                        y: Math.round(position.y / scale),
                        fontSize: Math.round(Math.max(6, newH * 0.6)),
                      });
                    }}
                    enableResizing={{
                      top: true, right: true, bottom: true, left: true,
                      topRight: true, bottomRight: true, bottomLeft: true, topLeft: true
                    }}
                  >
                    <div
                      onClick={(ev) => { ev.stopPropagation(); setSelected(p.id); }}
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: displayFontSize,
                        color: p.color,
                        background: selected === p.id ? "rgba(255,255,255,0.6)" : "transparent",
                        border: selected === p.id ? "1px dashed #666" : "1px dashed rgba(0,0,0,0.08)",
                        boxSizing: "border-box",
                        padding: 4,
                        textAlign: "center",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.label}
                    </div>
                  </Rnd>
                );
              })}
            </div>
          </div>
        </div>

        <div className="right-panel">
          <h3>Placeholders</h3>
          {placeholders.length === 0 && <div>No placeholders yet</div>}
          {placeholders.map((p) => (
            <div key={p.id} className={"ph-item " + (selected === p.id ? "selected" : "")} onClick={() => setSelected(p.id)}>
              <input value={p.label} onChange={(e) => updatePlaceholder(p.id, { label: e.target.value })} />
              <div className="small-row">
                <label>Font</label>
                <select value={p.font} onChange={(e) => updatePlaceholder(p.id, { font: e.target.value })}>
                  {fontOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div className="small-row">
                <label>Font size</label>
                <input type="number" value={p.fontSize} onChange={(e) => updatePlaceholder(p.id, { fontSize: Math.max(6, Number(e.target.value)) })} />
                <label>Color</label>
                <input type="color" value={p.color} onChange={(e) => updatePlaceholder(p.id, { color: e.target.value })} />
              </div>

              <div className="small-row">
                <label>Pos</label>
                <span className="muted">x:{Math.round(p.x)} y:{Math.round(p.y)}</span>
              </div>

              <div className="small-row">
                <label>Size</label>
                <span className="muted">w:{Math.round(p.width)} h:{Math.round(p.height)}</span>
              </div>
            </div>
          ))}

          <h3>Preview</h3>
          {previewSrc && <img src={previewSrc} alt="preview" style={{ width: "100%" }} />}
        </div>
      </div>
    </div>
  );
}
