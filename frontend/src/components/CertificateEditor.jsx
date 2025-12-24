import React, { useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import api from "../api";

const BACKEND_BASE = api.defaults.baseURL;

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function measureTextWidth(text, fontSize, fontFamily = "Arial") {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = `${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

function fitFontToWidth(text, initialSize, boxWidth, fontFamily = "Arial", padding = 8) {
  let size = initialSize;
  let i = 0;
  while (i < 80) {
    const w = measureTextWidth(text, size, fontFamily);
    if (w <= Math.max(4, boxWidth - padding)) break;
    size = Math.max(4, size - Math.max(1, size * 0.06));
    i++;
  }
  return size;
}

export default function CertificateEditor() {
  const [templateUrl, setTemplateUrl] = useState(null);
  const [imgNatural, setImgNatural] = useState({ w: 1000, h: 600 });
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);

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
      if (res.data?.url) {
        setTemplateUrl(`${BACKEND_BASE}${res.data.url}`);
      } else {
        setTemplateUrl(null);
      }
    } catch (err) {
      console.error("Template load error", err);
      setTemplateUrl(null);
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
    const c = containerRef.current;
    if (!c) return setScale(1);
    const maxW = Math.max(200, c.clientWidth - 20);
    setScale(Math.min(1, maxW / nw));
  }

  useEffect(() => {
    const onResize = () => computeScale();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function updatePlaceholder(id, patch) {
    setPlaceholders((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function addPlaceholder() {
    const id = uid();
    const w = Math.round(imgNatural.w * 0.5);
    const h = Math.round(imgNatural.h * 0.08);
    setPlaceholders((p) => [
      ...p,
      {
        id,
        label: `field_${p.length + 1}`,
        x: Math.round((imgNatural.w - w) / 2),
        y: Math.round((imgNatural.h - h) / 2),
        width: w,
        height: h,
        fontSize: Math.round(h * 0.6),
        font: "Roboto-Bold.ttf",
        color: "#000000",
      },
    ]);
    setSelected(id);
  }

  async function uploadTemplateFile(file) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await api.post("/upload-template", fd);
      if (res.data?.url) {
        setTemplateUrl(`${BACKEND_BASE}${res.data.url}`);
      } else {
        await loadTemplate();
      }
      alert("Template uploaded");
    } catch {
      alert("Template upload failed");
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

  async function saveLayout() {
    if (!placeholders.length) return alert("No placeholders");
    const payload = {};
    placeholders.forEach((p) => {
      payload[p.label] = {
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
        font_size: p.fontSize,
        font: p.font,
        color: p.color,
      };
    });
    await api.post("/set-placeholders", { placeholders: payload });
    alert("Layout saved");
  }

  async function previewRow() {
    const res = await api.post("/preview", new FormData(), { responseType: "blob" });
    setPreviewSrc(URL.createObjectURL(res.data));
  }

  async function generateAll() {
    const fd = new FormData();
    fd.append("folder_name", folderName || `job_${Date.now()}`);
    const res = await api.post("/generate", fd);
    if (res.data?.zip) {
      window.open(`${BACKEND_BASE}/download/${res.data.zip}`, "_blank");
    }
  }

  return (
    <div className="editor-root">
      <div className="toolbar">
        <label className="btn">
          Upload Template
          <input type="file" hidden onChange={(e) => uploadTemplateFile(e.target.files[0])} />
        </label>
        <label className="btn">
          Upload Excel
          <input type="file" hidden onChange={(e) => uploadExcelFile(e.target.files[0])} />
        </label>
        <button className="btn" onClick={addPlaceholder}>Add Placeholder</button>
        <button className="btn" onClick={saveLayout}>Save Layout</button>
        <button className="btn" onClick={previewRow}>Preview Row 1</button>
        <input value={folderName} onChange={(e) => setFolderName(e.target.value)} />
        <button className="btn" onClick={generateAll}>Generate PDFs</button>
      </div>

      <div ref={containerRef} className="canvas-wrap">
        {templateUrl && <img src={templateUrl} alt="template" />}
      </div>
    </div>
  );
}
