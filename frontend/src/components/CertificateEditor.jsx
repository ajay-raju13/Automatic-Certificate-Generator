import React, { useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import api from "../api";
import "./CertificateEditor.css";

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

  // State
  const [placeholders, setPlaceholders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [previewSrc, setPreviewSrc] = useState(null);
  const [folderName, setFolderName] = useState("");
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [filenameField, setFilenameField] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Gallery State
  const [generatedFiles, setGeneratedFiles] = useState([]);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);

  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Walkthrough State
  const [showWalkthrough, setShowWalkthrough] = useState(true);
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    { target: ".upload-template-btn", title: "1. Upload Template", desc: "Start by uploading your certificate design (PNG or JPG)." },
    { target: ".upload-excel-btn", title: "2. Upload Data", desc: "Upload the Excel file (.xlsx) containing names and details." },
    { target: ".add-placeholder-btn", title: "3. Add Fields", desc: "Create text boxes for names, dates, or other variables." },
    { target: ".canvas-panel", title: "4. Customize", desc: "Drag and resize placeholders on the certificate image." },
    { target: ".config-panel", title: "5. Configure", desc: "Map Excel columns to placeholders and adjust fonts/colors." },
    { target: ".generate-btn", title: "6. Generate", desc: "Click here to create all your PDF certificates instantly." },
    { target: ".btn-danger", title: "7. Clear Cache", desc: "If you encounter issues or want to start fresh, clear the cache." },
  ];

  useEffect(() => {
    const skipeed = localStorage.getItem("walkthrough_skipped");
    if (skipeed) setShowWalkthrough(false);
  }, []);

  const handleNextStep = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep(prev => prev + 1);
    } else {
      setShowWalkthrough(false);
      localStorage.setItem("walkthrough_skipped", "true");
    }
  };

  const handleSkip = () => {
    setShowWalkthrough(false);
    localStorage.setItem("walkthrough_skipped", "true");
  };

  const [highlightStyle, setHighlightStyle] = useState({});

  useEffect(() => {
    if (!showWalkthrough) return;
    // Small delay to ensure render
    const timer = setTimeout(() => {
      const step = steps[activeStep];
      if (!step) return;
      const el = document.querySelector(step.target);
      if (el) {
        const rect = el.getBoundingClientRect();
        setHighlightStyle({
          top: rect.top + window.scrollY - 5,
          left: rect.left + window.scrollX - 5,
          width: rect.width + 10,
          height: rect.height + 10
        });
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [activeStep, showWalkthrough]);

  const fontOptions = [
    "BrittanySignature.ttf",
    "GoogleSans-Bold.ttf",
    "GoogleSans.ttf",
    "GoogleSans_17pt-Bold.ttf",
    "GoogleSans_17pt-Regular.ttf",
    "Montserrat-SemiBold.ttf",
    "Oswald-Bold.ttf",
    "Oswald-Regular.ttf",
    "Oswald-VariableFont_wght.ttf",
    "RoyalBrand-Regular.otf",
    "RusticRoadway.otf",
    "times new roman.ttf",
    "WhisperingSignature.ttf",
  ];

  useEffect(() => {
    loadTemplate();
  }, []);

  async function loadTemplate() {
    try {
      const res = await api.get("/template");
      if (res.data?.url) {
        setTemplateUrl(`${res.data.url}?t=${Date.now()}`);
      } else {
        setTemplateUrl(null);
      }
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
    // Remove padding subtraction to use full width
    const maxW = container.clientWidth;
    // Allow scaling up (remove Math.min(1, ...)) so it fits the container width
    const s = maxW / nw;
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
      columns: [],
      separator: " ",
      bold: false,
      italic: false,
      underline: false,
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
        columns: p.columns && p.columns.length > 0 ? p.columns : undefined,
        separator: p.separator || " ",
        label: p.label,
        bold: p.bold || false,
        italic: p.italic || false,
        underline: p.underline || false,
      };
    }
    try {
      const res = await api.post("/set-placeholders", {
        placeholders: dict,
        default_font: "Roboto-Regular.ttf",
        filename_field: filenameField,
      });
      if (res.data?.status === "ok") alert("Layout saved");
      else alert("Saved response: " + JSON.stringify(res.data));
    } catch (err) {
      console.error(err);
      alert("Error saving layout: " + err.message);
    }
  }

  async function uploadTemplateFile(file) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      setIsLoading(true);
      await api.post("/upload-template", fd);
      await loadTemplate();
      // Clear legacy previews to avoid confusion
      setPreviewSrc(null);
      setGeneratedFiles([]);
      setCurrentJobId(null);
      setPreviewFile(null);
      alert("Template uploaded");
    } catch {
      alert("Upload failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function uploadExcelFile(file) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      setIsLoading(true);
      await api.post("/upload-excel", fd);
      await fetchExcelHeaders();
      alert("Excel uploaded");
    } catch {
      alert("Excel upload failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchExcelHeaders() {
    try {
      const res = await api.get("/excel-headers");
      setExcelHeaders(res.data?.headers || []);
    } catch (err) {
      console.error("Error fetching headers", err);
    }
  }

  async function previewRow(index = 0) {
    try {
      setIsLoading(true);
      const fd = new FormData();
      fd.append("row_index", index);
      const res = await api.post("/preview", fd, { responseType: "blob" });
      setPreviewSrc(URL.createObjectURL(res.data));
      setShowPreviewModal(true); // Open modal on success
    } catch (err) {
      console.error(err);
      alert("Preview failed: " + err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function clearCache() {
    if (!confirm("Are you sure you want to clear cache and restart? This will reset the application.")) return;
    try {
      setIsLoading(true);
      const res = await api.post("/storage-cleanup");
      const stats = res.data?.cleanup_stats || {};
      alert(`System Cleared! Deleted: ${stats.old_zips || 0} zips, ${stats.temp_files || 0} temp files. The page will now reload.`);

      // Clear local storage walkthrough flag to truly reset if desired? 
      // User said "fresh start", usually implies state. 
      // If we want a FULL fresh start including walkthrough:
      // localStorage.removeItem("walkthrough_skipped"); 

      // For now, just reload to reset React state.
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Cleanup failed: " + err.message);
      setIsLoading(false);
    }
  }

  async function generateAll() {
    try {
      setIsLoading(true);
      const fd = new FormData();
      fd.append("folder_name", folderName || `job_${Date.now()}`);
      const res = await api.post("/generate", fd);
      if (res.data?.zip) {
        alert(`Generated ${res.data.count} certificates`);

        // Save files for gallery view
        if (res.data.files && res.data.job_id) {
          setGeneratedFiles(res.data.files);
          setCurrentJobId(res.data.job_id);
          if (res.data.files.length > 0) {
            setPreviewFile(res.data.files[0]);
          }
        }

        // Trigger automatic download
        const downloadUrl = `${api.defaults.baseURL}/download/${res.data.zip}`;
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = res.data.zip;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert("Generate response: " + JSON.stringify(res.data));
      }
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.detail) {
        alert("Generate failed: " + err.response.data.detail);
      } else {
        alert("Generate failed: " + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }

  function displayLeftTop(p) {
    return { left: Math.round(p.x * scale), top: Math.round(p.y * scale) };
  }

  function displaySize(p) {
    return { width: Math.round(p.width * scale), height: Math.round(p.height * scale) };
  }

  const selectedPlaceholder = placeholders.find((p) => p.id === selected);

  return (
    <div className="editor-root">
      {/* Preview Modal */}
      {showPreviewModal && previewSrc && (
        <div className="modal-overlay" onClick={() => setShowPreviewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Preview Row 1</span>
              <button className="modal-close" onClick={() => setShowPreviewModal(false)}>&times;</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={previewSrc} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
            </div>
          </div>
        </div>
      )}

      {/* Walkthrough Overlay */}
      {showWalkthrough && (
        <>
          <div className="walkthrough-overlay" />
          <div className="highlight-ring" style={highlightStyle} />
          <div className="walkthrough-modal">
            <div className="step-indicator">
              {steps.map((_, i) => (
                <div key={i} className={`step-dot ${i === activeStep ? "active" : ""}`} />
              ))}
            </div>
            <h3 className="walkthrough-title">{steps[activeStep].title}</h3>
            <p className="walkthrough-desc">{steps[activeStep].desc}</p>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem" }}>
              <button className="btn-modern btn-secondary" onClick={handleSkip}>Skip Tour</button>
              <button className="btn-modern btn-primary" onClick={handleNextStep}>
                {activeStep === steps.length - 1 ? "Finish" : "Next Step"}
              </button>
            </div>
          </div>
        </>
      )}

      <header className="app-header">
        <h1 className="app-title">Certificate Studio</h1>
        <div className="app-subtitle">Professional Bulk Certificate Generator</div>
      </header>

      <div className="toolbar-card">
        <label className="btn-modern btn-primary upload-template-btn" style={{ opacity: isLoading ? 0.6 : 1 }}>
          <span role="img" aria-label="upload">📄</span> Upload Template
          <input type="file" accept=".png,.jpg,.jpeg" style={{ display: "none" }} disabled={isLoading}
            onChange={(e) => uploadTemplateFile(e.target.files[0])} />
        </label>

        <label className="btn-modern btn-secondary upload-excel-btn" style={{ opacity: isLoading ? 0.6 : 1 }}>
          <span role="img" aria-label="excel">📊</span> Upload Excel
          <input type="file" accept=".xlsx,.xls" style={{ display: "none" }} disabled={isLoading}
            onChange={(e) => uploadExcelFile(e.target.files[0])} />
        </label>

        <button className="btn-modern btn-secondary add-placeholder-btn" onClick={addPlaceholder} disabled={isLoading}>
          + Add Field
        </button>
        <button className="btn-modern btn-secondary" onClick={() => selected ? deletePlaceholder(selected) : alert("Select one")} disabled={isLoading}>
          Delete Selected
        </button>
        <button className="btn-modern btn-secondary" onClick={saveLayout} disabled={isLoading}>
          Save Layout
        </button>
        <button className="btn-modern btn-secondary" onClick={() => previewRow(0)} disabled={isLoading}>
          Preview Row 1
        </button>

        <div style={{ width: '1px', height: '24px', background: '#e5e7eb', margin: '0 8px' }}></div>

        <input
          className="modern-input"
          placeholder="Job Name (optional)"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          disabled={isLoading}
          style={{ width: '150px' }}
        />
        <button className="btn-modern btn-success generate-btn" onClick={generateAll} disabled={isLoading}>
          {isLoading ? "Processing..." : "✨ Generate PDFs"}
        </button>
        <button className="btn-modern btn-danger" onClick={clearCache} disabled={isLoading}>
          Clear Cache & Restart System
        </button>

        {generatedFiles.length > 0 && (
          <button
            className="btn-modern btn-success"
            onClick={() => {
              document.getElementById("gallery-section")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Preview Results &darr;
          </button>
        )}
      </div>

      <div className="editor-area">
        {/* Left Panel: Canvas */}
        <div className="canvas-panel" ref={containerRef}>
          <div className="canvas-wrap">
            {templateUrl ? (
              <img src={templateUrl} alt="template" style={{ width: imgNatural.w * scale, height: imgNatural.h * scale, boxShadow: "0 0 20px rgba(0,0,0,0.1)" }} />
            ) : (
              <div className="no-template">
                <div style={{ fontSize: "3rem", opacity: 0.2 }}>🖼️</div>
                <div>Upload a template image to begin</div>
              </div>
            )}

            <div className="overlay" style={{ width: imgNatural.w * scale, height: imgNatural.h * scale }}>
              {placeholders.map((p) => {
                const pos = displayLeftTop(p);
                const sz = displaySize(p);
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
                        background: selected === p.id ? "rgba(79, 70, 229, 0.1)" : "transparent",
                        border: selected === p.id ? "2px solid #4f46e5" : "1px dashed rgba(0,0,0,0.2)",
                        boxSizing: "border-box",
                        padding: 4,
                        textAlign: "center",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        borderRadius: "4px"
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

        {/* Right Panel: Config */}
        <div className="properties-panel config-panel">
          <div className="panel-title">Configuration</div>

          <div className="control-group">
            <label className="control-label">Output Filename</label>
            <select className="modern-select" value={filenameField} onChange={(e) => setFilenameField(e.target.value)}>
              <option value="">Use Row Number (Default)</option>
              {excelHeaders.map((header) => (
                <option key={header} value={header}>{header}</option>
              ))}
            </select>
          </div>

          <div className="panel-title" style={{ marginTop: '2rem' }}>Fields</div>
          {placeholders.length === 0 && <div className="no-template" style={{ fontSize: '0.9rem' }}>No fields added yet.</div>}

          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {placeholders.map((p) => (
              <div key={p.id} className={"ph-item " + (selected === p.id ? "selected" : "")} onClick={() => setSelected(p.id)}>
                <div className="control-group">
                  <input className="modern-input" value={p.label} onChange={(e) => updatePlaceholder(p.id, { label: e.target.value })} placeholder="Label Name" style={{ fontWeight: 600 }} />
                </div>

                <div className="control-group">
                  <label className="control-label">Map Excel Column</label>
                  <select className="modern-select" onChange={(e) => {
                    if (e.target.value) {
                      const newColumns = [...(p.columns || [])];
                      if (!newColumns.includes(e.target.value)) {
                        newColumns.push(e.target.value);
                        updatePlaceholder(p.id, { columns: newColumns });
                      }
                      e.target.value = "";
                    }
                  }}>
                    <option value="">+ Add Data Column...</option>
                    {excelHeaders.map((header) => (
                      <option key={header} value={header} disabled={p.columns && p.columns.includes(header)}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>

                {p.columns && p.columns.length > 0 && (
                  <div className="control-group">
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {p.columns.map((col, idx) => (
                        <div key={idx} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "6px 10px", background: "#f3f4f6", borderRadius: "6px", fontSize: "0.85rem"
                        }}>
                          <span>{col}</span>
                          <button onClick={(e) => {
                            e.stopPropagation();
                            const newColumns = p.columns.filter((_, i) => i !== idx);
                            updatePlaceholder(p.id, { columns: newColumns });
                          }}
                            style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "16px" }}
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {p.columns && p.columns.length > 1 && (
                  <div className="control-group">
                    <label className="control-label">Separator</label>
                    <input className="modern-input" type="text" value={p.separator || ""} onChange={(e) => updatePlaceholder(p.id, { separator: e.target.value })} placeholder="e.g. space, comma" />
                  </div>
                )}

                <div className="control-group">
                  <label className="control-label">Typography</label>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                    <button onClick={() => updatePlaceholder(p.id, { bold: !p.bold })}
                      className={`btn-modern ${p.bold ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 12px' }}>B</button>
                    <button onClick={() => updatePlaceholder(p.id, { italic: !p.italic })}
                      className={`btn-modern ${p.italic ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 12px', fontStyle: 'italic' }}>I</button>
                    <button onClick={() => updatePlaceholder(p.id, { underline: !p.underline })}
                      className={`btn-modern ${p.underline ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 12px', textDecoration: 'underline' }}>U</button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: "8px" }}>
                    <select className="modern-select" value={p.font} onChange={(e) => updatePlaceholder(p.id, { font: e.target.value })}>
                      {fontOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <input className="modern-input" type="number" value={p.fontSize} onChange={(e) => updatePlaceholder(p.id, { fontSize: Math.max(6, Number(e.target.value)) })} />
                  </div>
                  <div style={{ marginTop: "8px" }}>
                    <input type="color" value={p.color} onChange={(e) => updatePlaceholder(p.id, { color: e.target.value })} style={{ width: "100%", height: "32px", cursor: "pointer", border: "1px solid #d1d5db", borderRadius: "4px" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Gallery Slideshow */}
      {generatedFiles.length > 0 && currentJobId && (
        <div id="gallery-section" style={{ marginTop: "2rem", padding: "2rem", background: "white", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <h3 className="panel-title">Generated Certificates ({generatedFiles.length})</h3>

          <div style={{ display: "flex", flexDirection: "column", height: "75vh", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "1rem",
              background: "#f9fafb",
              borderBottom: "1px solid #e5e7eb"
            }}>
              <button
                className="btn-modern btn-secondary"
                disabled={!previewFile || generatedFiles.indexOf(previewFile) <= 0}
                onClick={() => {
                  const idx = generatedFiles.indexOf(previewFile);
                  if (idx > 0) setPreviewFile(generatedFiles[idx - 1]);
                }}
              >
                &larr; Previous
              </button>

              <span style={{ fontWeight: 600, color: "#374151" }}>
                {previewFile} ({generatedFiles.indexOf(previewFile) + 1} / {generatedFiles.length})
              </span>

              <button
                className="btn-modern btn-secondary"
                disabled={!previewFile || generatedFiles.indexOf(previewFile) >= generatedFiles.length - 1}
                onClick={() => {
                  const idx = generatedFiles.indexOf(previewFile);
                  if (idx < generatedFiles.length - 1) setPreviewFile(generatedFiles[idx + 1]);
                }}
              >
                Next &rarr;
              </button>
            </div>

            <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#374151" }}>
              {previewFile ? (
                <iframe
                  src={`${api.defaults.baseURL}/outputs/${currentJobId}/${previewFile}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                  style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                  title="PDF Preview"
                />
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "white" }}>
                  Select a file to preview
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
