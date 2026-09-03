import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  useNavigate,
  useParams,
  Link,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import {
  Heart,
  ArrowRight,
  LogIn,
  LayoutDashboard,
  Save,
  Share2,
  LockKeyhole,
  QrCode,
  Gift,
  Mail,
  ScanLine,
  Plus,
  Trash2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { TemplateRenderer } from "@memora/template-engine";
import type { TemplateDefinition } from "@memora/shared";
import { api, apiBase } from "./lib/api";
import "./styles.css";

type Template = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  price: number;
  tags: string[];
  thumbnailUrl?: string;
  previewUrl?: string;
  liveDemoUrl?: string;
  category: {
    name: string;
    slug: string;
  };
};
function Nav() {
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link className="brand" to="/">
          <span className="brand-mark">D</span> Devsphere
        </Link>
        <nav className="nav-links">
          <Link to="/templates">Templates</Link>
          <Link to="/dashboard">My Websites</Link>
          <Link to="/login" className="btn btn-primary">
            Login
          </Link>
        </nav>
      </div>
    </header>
  );
}
function Home() {
  const [templates, setTemplates] = useState<Template[]>([]);
  useEffect(() => {
    api<{ items: Template[] }>("/templates?featured=true")
      .then((x) => setTemplates(x.items))
      .catch(() => {});
  }, []);
  return (
    <>
      <Nav />
      <main>
        <section className="hero-home">
          <span className="pill">Digital gifts, made personal</span>
          <h1>
            Turn Your Memories Into Something Beautiful <span>❤️</span>
          </h1>
          <p>
            Create personalized birthday, anniversary, love, wedding and
            celebration websites in minutes — without coding.
          </p>
          <div className="actions" style={{ justifyContent: "center" }}>
            <Link className="btn btn-primary" to="/templates">
              Create Your Surprise <ArrowRight size={17} />
            </Link>
            <Link className="btn btn-soft" to="/templates">
              Explore Templates
            </Link>
          </div>
        </section>
        <div className="container">
          <section className="section">
            <div className="section-head">
              <div>
                <span className="pill">How it works</span>
                <h2>Your story. Your style. Your moment.</h2>
              </div>
            </div>
            <div className="grid">
              <InfoCard
                n="01"
                t="Choose a template"
                d="Pick an occasion and a beautiful story layout."
              />
              <InfoCard
                n="02"
                t="Make it yours"
                d="Add names, memories, photos, music and your message."
              />
              <InfoCard
                n="03"
                t="Share the surprise"
                d="Pay once, publish instantly and send your private link or QR."
              />
            </div>
          </section>
          <section className="section">
            <div className="section-head">
              <div>
                <span className="pill">Featured</span>
                <h2>Templates made to feel personal</h2>
              </div>
              <Link to="/templates">See all →</Link>
            </div>
            <div className="grid">
              {templates.map((t) => (
                <TemplateCard key={t.id} t={t} />
              ))}{" "}
            </div>
          </section>
          <section className="section">
            <div
              className="card"
              style={{ padding: 32, background: "#2b211e", color: "#fff" }}
            >
              <span className="pill">Interactive reveals</span>
              <h2 style={{ color: "#fff" }}>
                Make opening the website part of the gift.
              </h2>
              <p style={{ maxWidth: 650, color: "#ded0ca", lineHeight: 1.7 }}>
                Choose a normal link, magical QR portal, PIN lock, secret
                letter, gift-box reveal or a puzzle unlock.
              </p>
              <div className="actions">
                <span className="tag">Normal</span>
                <span className="tag">QR</span>
                <span className="tag">PIN</span>
                <span className="tag">Letter</span>
                <span className="tag">Gift Box</span>
                <span className="tag">Puzzle</span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
function InfoCard({ n, t, d }: { n: string; t: string; d: string }) {
  return (
    <div className="card" style={{ padding: 22 }}>
      <span className="pill">{n}</span>
      <h3>{t}</h3>
      <p className="muted" style={{ lineHeight: 1.6 }}>
        {d}
      </p>
    </div>
  );
}
function TemplateCard({ t }: { t: Template }) {
  return (
    <article className="card">
      <img
        src={
          t.thumbnailUrl ||
          `https://placehold.co/800x500/f1e4dc/513c34?text=${encodeURIComponent(t.name)}`
        }
        alt=""
      />
      <div className="card-body">
        <span className="muted">{t.category.name}</span>
        <h3>{t.name}</h3>
        <p className="muted">{t.description}</p>
        <div className="tags">
          {t.tags.map((x) => (
            <span className="tag" key={x}>
              {x}
            </span>
          ))}
        </div>
        <div className="actions">
          <Link className="btn btn-soft" to={`/templates/${t.slug}`}>
            Preview
          </Link>

          {t.liveDemoUrl && (
            <a
              className="btn btn-live"
              href={t.liveDemoUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Live Demo
            </a>
          )}

          <Link className="btn btn-primary" to={`/create/${t.id}`}>
            Use Template
          </Link>
        </div>
      </div>
    </article>
  );
}
function Templates() {
  const [items, setItems] = useState<Template[]>([]);
  const [q, setQ] = useState("");
  const [cats, setCats] = useState<any[]>([]);
  const [cat, setCat] = useState("");
  useEffect(() => {
    api("/categories").then((x) => setCats(x.items));
  }, []);
  useEffect(() => {
    const id = setTimeout(
      () =>
        api<{ items: Template[] }>(
          `/templates?search=${encodeURIComponent(q)}${cat ? `&category=${cat}` : ""}`,
        ).then((x) => setItems(x.items)),
      180,
    );
    return () => clearTimeout(id);
  }, [q, cat]);
  return (
    <>
      <Nav />
      <div className="container">
        <section className="section">
          <span className="pill">Template gallery</span>
          <h2>Find the feeling you want to share.</h2>
          <div className="actions" style={{ margin: "20px 0" }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search templates…"
              style={{
                flex: 1,
                minWidth: 240,
                padding: 12,
                border: "1px solid #dccbc2",
                borderRadius: 12,
              }}
            />
            {cats.map((c) => (
              <button
                key={c.slug}
                onClick={() => setCat(cat === c.slug ? "" : c.slug)}
                className="btn btn-soft"
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="grid">
            {items.map((t) => (
              <TemplateCard key={t.id} t={t} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
function TemplatePreview() {
  const { id } = useParams<{ id: string }>();
  const [t, setT] = useState<any>();
  useEffect(() => {
    if (!id) return;

    api(`/templates/${id}`)
      .then((x) => setTemplate(x.template))
      .catch((error) => {
        console.error("Failed to load template:", error);
      });
  }, [id]);
  if (!t)
    return (
      <>
        <Nav />
        <div className="container section">Loading…</div>
      </>
    );
  const schema = t.schema as TemplateDefinition;
  return (
    <>
      <Nav />
      <div className="container section">
        <div className="section-head">
          <div>
            <span className="pill">{t.category.name}</span>
            <h2>{t.name}</h2>
            <p className="muted">{t.description}</p>
          </div>
          <Link className="btn btn-primary" to={`/create/${t.id}`}>
            Use This Template
          </Link>
        </div>
        <div className="preview-frame">
          <TemplateRenderer
            template={schema}
            data={t.defaultData || {}}
            customization={{
              accent: "#9b6b5d",
              background: "#fffaf7",
              animation: "smooth",
            }}
            isPreview
          />
        </div>
      </div>
    </>
  );
}
function Auth() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  async function submit(e: any) {
    e.preventDefault();
    try {
      await api(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          name: mode === "register" ? name : undefined,
        }),
      });
      nav("/dashboard");
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <div className="login-shell">
      <div className="auth-card">
        <Link className="brand" to="/">
          <span className="brand-mark">D</span> Devsphere
        </Link>
        <h2>{mode === "login" ? "Welcome back" : "Create your Forever"}</h2>
        {err && <p style={{ color: "#a64242" }}>{err}</p>}
        <form onSubmit={submit}>
          {mode === "register" && (
            <div className="field">
              <label>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }}>
            <LogIn size={17} />
            {mode === "login" ? "Login" : "Create account"}
          </button>
        </form>
        <button
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          style={{
            marginTop: 14,
            background: "none",
            border: 0,
            color: "#725a51",
          }}
        >
          {mode === "login"
            ? "Need an account? Create one"
            : "Already have an account? Login"}
        </button>
      </div>
    </div>
  );
}
function Dashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [me, setMe] = useState<any>();
  const nav = useNavigate();
  useEffect(() => {
    Promise.all([api("/auth/me"), api("/projects")])
      .then(([m, p]) => {
        setMe(m.user);
        setProjects(p.items);
      })
      .catch(() => nav("/login"));
  }, [nav]);
  return (
    <>
      <Nav />
      <div className="container section">
        <div className="section-head">
          <div>
            <span className="pill">Your workspace</span>
            <h2>Welcome back{me?.name ? `, ${me.name}` : ""} ❤️</h2>
          </div>
          <button className="btn btn-primary" onClick={() => nav("/templates")}>
            Create a new website
          </button>
        </div>
        <div className="list">
          {projects.map((p) => (
            <div className="row-card" key={p.id}>
              <div>
                <b>{p.name}</b>
                <div className="muted">
                  {p.template.name} · {p.status}
                </div>
              </div>
              <div className="actions">
                {p.status === "DRAFT" && (
                  <button
                    className="btn btn-soft"
                    onClick={() => nav(`/edit/${p.id}`)}
                  >
                    Continue Editing
                  </button>
                )}
                {p.website && (
                  <a
                    className="btn btn-primary"
                    href={`${window.location.origin}/r/${p.website.slug}`}
                    target="_blank"
                  >
                    View Website
                  </a>
                )}
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="card" style={{ padding: 36, textAlign: "center" }}>
              <h3>Your first surprise is waiting.</h3>
              <p className="muted">Choose a template to get started.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
function MediaField({
  field,
  value,
  onChange,
  projectId,
}: {
  field: any;
  value: any;
  onChange: (v: any) => void;
  projectId?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const isMultiple = field.type === "images";
  const isSingleImage = field.type === "image";
  const isAudio = field.type === "audio";
  const isVideo = field.type === "video";

  let accept = "";

  if (isMultiple || isSingleImage) {
    accept = ".jpg,.jpeg,.jfif,.png,.webp,image/jpeg,image/png,image/webp";
  } else if (isAudio) {
    accept = ".mp3,.wav,.m4a,.mpeg,audio/mpeg,audio/wav,audio/mp4";
  } else if (isVideo) {
    accept = ".mp4,.webm,.mov,.mpeg,video/mp4,video/webm,video/quicktime";
  }

  async function upload(file: File) {
    if (!projectId) {
      setMsg("Project is not ready for upload.");
      return;
    }

    // Basic client-side validation
    if (file.size > 25 * 1024 * 1024) {
      setMsg("Max file size is 25MB");
      return;
    }

    if (
      (isMultiple || isSingleImage) &&
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setMsg("Only JPG, JPEG, PNG and WebP images are supported.");
      return;
    }

    setBusy(true);
    setMsg("Uploading…");

    try {
      const kind =
        isMultiple || isSingleImage ? "image" : isAudio ? "audio" : "video";

      const pres = await api("/media/presign", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          kind,
          mimeType: file.type,
          size: file.size,
          originalName: file.name,
        }),
      });

      const put = await fetch(pres.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!put.ok) {
        throw new Error("Upload failed");
      }

      const attached = await api("/media/attach", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          kind,
          url: pres.url,
          storageKey: pres.key,
          mimeType: file.type,
          size: file.size,
        }),
      });

      const uploadedUrl = attached?.media?.url || pres.url;

      if (!uploadedUrl) {
        throw new Error("Upload succeeded but no image URL was returned.");
      }

      // Multiple image gallery
      if (isMultiple) {
        const current = Array.isArray(value) ? value : [];

        onChange([...current, uploadedUrl]);
      } else {
        // Single image / balloon image
        onChange(uploadedUrl);
      }

      setMsg("Uploaded ✓");
    } catch (e: any) {
      console.error("Media upload error:", e);
      setMsg(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const imageValue = isSingleImage && typeof value === "string" ? value : "";

  return (
    <div className="field">
      <label>{field.label}</label>

      <input
        type="file"
        accept={accept}
        multiple={isMultiple}
        disabled={busy}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);

          if (isMultiple) {
            files.forEach((file) => {
              void upload(file);
            });
          } else if (files[0]) {
            void upload(files[0]);
          }

          e.currentTarget.value = "";
        }}
      />

      {busy && <small className="muted">Uploading…</small>}

      {msg && !busy && <small className="muted">{msg}</small>}

      {/* Single image preview */}
      {isSingleImage && imageValue && (
        <div
          style={{
            marginTop: 10,
            borderRadius: 12,
            overflow: "hidden",
            background: "#f3e6dc",
          }}
        >
          <img
            src={imageValue}
            alt="Uploaded memory"
            style={{
              width: "100%",
              height: 150,
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
      )}

      {/* Multiple image list */}
      {isMultiple && Array.isArray(value) && value.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 8,
            marginTop: 10,
          }}
        >
          {value.map((url: string, index: number) => (
            <img
              key={`${url}-${index}`}
              src={url}
              alt={`Uploaded photo ${index + 1}`}
              style={{
                width: "100%",
                height: 80,
                objectFit: "cover",
                borderRadius: 8,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: any;
  value: any;
  onChange: (v: any) => void;
}) {
  if (field.id === "movieEnabled") {
    return (
      <div className="field">
        <div className="movie-option-card">
          <div className="movie-option-header">
            <strong>Our Movie 🎬</strong>

            <span>+₹10</span>
          </div>

          <p>
            Basic website: ₹99
            <br />
            With Our Movie: ₹109
          </p>

          <label className="movie-option-toggle">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
            />

            <span>Add Our Movie section</span>
          </label>
        </div>
      </div>
    );
  }
  // -----------------------------------------
  // REPEATER / TIMELINE FIELDS
  // -----------------------------------------
  if (field.type === "repeater" || field.type === "timeline") {
    return (
      <Repeater
        field={field}
        value={value}
        onChange={onChange}
        projectId={field.projectId}
      />
    );
  }

  // -----------------------------------------
  // LONG TEXT
  // -----------------------------------------
  if (field.type === "longText") {
    return (
      <div className="field">
        <label>
          {field.label}
          {field.required ? " *" : ""}
        </label>

        <textarea
          placeholder={field.placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      </div>
    );
  }

  // -----------------------------------------
  // DATE
  // -----------------------------------------
  if (field.type === "date") {
    return (
      <div className="field">
        <label>
          {field.label}
          {field.required ? " *" : ""}
        </label>

        <input
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      </div>
    );
  }

  // -----------------------------------------
  // NUMBER
  // -----------------------------------------
  if (field.type === "number") {
    return (
      <div className="field">
        <label>
          {field.label}
          {field.required ? " *" : ""}
        </label>

        <input
          type="number"
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
          required={field.required}
        />
      </div>
    );
  }

  // -----------------------------------------
  // IMAGE / AUDIO / VIDEO
  // -----------------------------------------
  if (
    field.type === "images" ||
    field.type === "image" ||
    field.type === "audio" ||
    field.type === "video"
  ) {
    return (
      <MediaField
        field={field}
        value={value}
        onChange={onChange}
        projectId={field.projectId}
      />
    );
  }
  // -----------------------------------------
  // SELECT
  // -----------------------------------------
  if (field.type === "select") {
    return (
      <div className="field">
        <label>
          {field.label}
          {field.required ? " *" : ""}
        </label>

        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        >
          <option value="">Select {field.label}</option>

          {(field.options || []).map((option: any) => (
            <option
              key={typeof option === "string" ? option : option.value}
              value={typeof option === "string" ? option : option.value}
            >
              {typeof option === "string" ? option : option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // -----------------------------------------
  // DEFAULT TEXT
  // -----------------------------------------
  return (
    <div className="field">
      <label>
        {field.label}
        {field.required ? " *" : ""}
      </label>

      <input
        type="text"
        value={typeof value === "object" && value !== null ? "" : (value ?? "")}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      />
    </div>
  );
}
function Repeater({
  field,
  value,
  onChange,
  projectId,
}: {
  field: any;
  value: any[];
  onChange: (v: any[]) => void;
  projectId?: string;
}) {
  const items = Array.isArray(value) ? value : [];

  function addItem() {
    if (field.maxItems && items.length >= field.maxItems) {
      return;
    }

    onChange([...items, {}]);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, key: string, newValue: any) {
    onChange(
      items.map((item, i) =>
        i === index
          ? {
              ...item,
              [key]: newValue,
            }
          : item,
      ),
    );
  }

  return (
    <div className="field repeater-field">
      <label className="repeater-title">
        {field.label}
        {field.required ? " *" : ""}
      </label>

      {items.map((item, index) => (
        <div key={index} className="card repeater-item">
          <div className="repeater-item-header">
            <strong>
              {field.label} {index + 1}
            </strong>

            <button
              type="button"
              className="btn btn-soft"
              onClick={() => removeItem(index)}
            >
              <Trash2 size={15} />
              Remove
            </button>
          </div>

          {(field.itemFields || []).map((nestedField: any) => (
            <FieldEditor
              key={nestedField.id}
              field={{
                ...nestedField,
                projectId,
              }}
              value={item?.[nestedField.id]}
              onChange={(newValue) =>
                updateItem(index, nestedField.id, newValue)
              }
            />
          ))}
        </div>
      ))}

      {(!field.maxItems || items.length < field.maxItems) && (
        <button type="button" className="btn btn-soft" onClick={addItem}>
          <Plus size={15} />
          Add {field.label}
        </button>
      )}
    </div>
  );
}
function Editor() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<any>();
  const [data, setData] = useState<any>({});
  const [customization, setCustomization] = useState<any>({
    accent: "#9b6b5d",
    background: "#fffaf7",
    animation: "smooth",
  });
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState("");
  const nav = useNavigate();
  useEffect(() => {
    if (id)
      api(`/projects/${id}`).then((x) => {
        setProject(x.project);
        setData(x.project.data);
        setCustomization(x.project.customization || {});
      });
  }, [id]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (project) {
        api(`/projects/${project.id}`, {
          method: "PATCH",
          body: JSON.stringify({ data, customization }),
        })
          .then(() => setSaved("Saved just now ✓"))
          .catch(() => setSaved("Could not save"));
      }
    }, 700);
    return () => clearTimeout(t);
  }, [data, customization]);
  if (!project) return <div className="container section">Loading editor…</div>;
  const schema = project.template.schema as TemplateDefinition;
  async function finalize() {
  try {
    await api(`/projects/${project.id}/finalize`, {
      method: "POST",
    });

    nav(`/checkout/${project.id}`);
  } catch (e: any) {
    console.error("Finalize failed:", e);
    alert(e.message || "Could not finalize the project.");
  }
}
  return (
    <div className="editor">
      <aside className={`editor-panel ${open ? "open" : ""}`}>
        <div className="toolbar">
          <b>Edit your story</b>
          <button
            className="btn btn-soft drawer-toggle"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
        {schema.fields.map((f: any) => (
          <FieldEditor
            key={f.id}
            field={{ ...f, projectId: project.id }}
            value={data[f.id]}
            onChange={(v) => setData((d: any) => ({ ...d, [f.id]: v }))}
          />
        ))}
        <div className="field">
          <label>Accent</label>
          <input
            type="color"
            value={customization.accent || "#9b6b5d"}
            onChange={(e) =>
              setCustomization((x: any) => ({ ...x, accent: e.target.value }))
            }
          />
        </div>
        <div className="field">
          <label>Animation</label>
          <select
            value={customization.animation || "smooth"}
            onChange={(e) =>
              setCustomization((x: any) => ({
                ...x,
                animation: e.target.value,
              }))
            }
          >
            <option>minimal</option>
            <option>smooth</option>
          </select>
        </div>
        <button
          className="btn btn-primary"
          style={{ width: "100%" }}
          onClick={finalize}
        >
          Finalize & Continue
        </button>
        <p className="muted" style={{ fontSize: ".8rem" }}>
          {saved}
        </p>
      </aside>
      <main className="preview">
        <div className="toolbar">
          <button
            className="btn btn-soft drawer-toggle"
            onClick={() => setOpen(true)}
          >
            Edit
          </button>
          <span className="muted">Live preview</span>
        </div>
        <div className="preview-frame">
          <TemplateRenderer
            template={schema}
            data={data}
            customization={customization}
            isPreview
          />
        </div>
      </main>
    </div>
  );
}
function Create() {
  const { id } = useParams<{ id: string }>();
  const [template, setTemplate] = useState<any>();
  const [name, setName] = useState("");
  const nav = useNavigate();
  useEffect(() => {
    api(`/templates/${id}`).then((x) => setTemplate(x.template));
  }, [id]);
  async function create() {
    try {
      const p = await api("/projects", {
        method: "POST",
        body: JSON.stringify({
          templateId: id,
          name: name || template.name,
          data: template.defaultData || {},
          customization: {
            accent: "#9b6b5d",
            background: "#fffaf7",
            animation: "smooth",
          },
        }),
      });
      nav(`/edit/${p.project.id}`);
    } catch (e: any) {
      console.error("Failed to create project:", e);

      if (e.message === "Unauthorized") {
        nav("/login");
        return;
      }

      alert(e.message || "Unable to create project.");
    }
  }
  if (!template) return <div className="container section">Loading…</div>;
  return (
    <div className="container section">
      <div className="auth-card">
        <span className="pill">{template.category.name}</span>
        <h2>Start your {template.name}</h2>
        <p className="muted">
          Give this project a name, then we'll guide you through only the fields
          this template needs.
        </p>
        <div className="field">
          <label>Project name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rahul & Priya"
          />
        </div>
        <button className="btn btn-primary" onClick={create}>
          Use this template <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}
function Checkout() {
  const { id } = useParams<{ id: string }>();

  const [plans, setPlans] = useState<any[]>([]);
  const [project, setProject] = useState<any>();
  const [loading, setLoading] = useState("");
  const [checkoutError, setCheckoutError] = useState("");

  const [revealMethod, setRevealMethod] = useState<
    "NORMAL" | "QR" | "PIN" | "LETTER" | "GIFT" | "PUZZLE"
  >("NORMAL");

  const [scannerStyle, setScannerStyle] = useState<
    "CLASSIC" | "HEART" | "LOVE" | "ROMANTIC"
  >("HEART");

  const nav = useNavigate();

  /* =========================================================
     LOAD PROJECT + PRICING PLAN
     ========================================================= */

  useEffect(() => {
    if (!id) return;

    Promise.all([
      fetch(`${apiBase}/pricing`).then((r) =>
        r.ok ? r.json() : { items: [] },
      ),

      api(`/projects/${id}`),
    ])
      .then(([pricing, projectResponse]) => {
        setPlans(pricing.items || []);

        const loadedProject = projectResponse.project;

        setProject(loadedProject);

        /*
         * Restore previously selected reveal method
         * when customer comes back to checkout.
         */
        const savedMethod = String(
          loadedProject?.revealMethod ??
            loadedProject?.site?.revealMethod ??
            loadedProject?.data?.method ??
            "NORMAL",
        ).toUpperCase();

        const allowedMethods = [
          "NORMAL",
          "QR",
          "PIN",
          "LETTER",
          "GIFT",
          "PUZZLE",
        ];

        if (allowedMethods.includes(savedMethod)) {
          setRevealMethod(
            savedMethod as
              | "NORMAL"
              | "QR"
              | "PIN"
              | "LETTER"
              | "GIFT"
              | "PUZZLE",
          );
        }
      })
      .catch((e) => {
        console.error("Failed to load checkout:", e);

        setCheckoutError(e?.message || "Unable to load checkout details.");
      });
  }, [id]);

  /* =========================================================
     PROJECT OPTIONS
     ========================================================= */

  const projectData =
    (project?.data as Record<string, unknown> | undefined) || {};

  const movieEnabled = projectData.movieEnabled === true;

  /* =========================================================
     REVEAL PRICING
     ========================================================= */

  const specialRevealMethods = ["QR", "PIN", "LETTER", "GIFT", "PUZZLE"];

  const specialRevealSelected = specialRevealMethods.includes(revealMethod);

  /*
   * ₹99  = Normal
   * ₹109 = Normal + Our Movie
   * ₹119 = Any special reveal
   */

  const birthdayPrice = specialRevealSelected ? 119 : movieEnabled ? 109 : 99;

  const priceLabel = specialRevealSelected
    ? "SPECIAL REVEAL"
    : movieEnabled
      ? "OUR MOVIE"
      : "BASIC";

  const priceDescription = specialRevealSelected
    ? "Birthday website + your chosen magical reveal method."
    : movieEnabled
      ? "Birthday website + your personal movie/video."
      : "Complete interactive birthday website.";

  /* =========================================================
     DATABASE PLAN

     Only one real pricing plan is required.
     Backend calculates ₹99 / ₹109 / ₹119.
     ========================================================= */

  const birthdayPlan =
    plans.find((plan) => plan?.id && plan?.active !== false) ||
    plans.find((plan) => plan?.id) ||
    null;

  /* =========================================================
     PAYMENT
     ========================================================= */

  async function pay() {
  if (!id) {
    alert("Project not found.");
    return;
  }

  if (!birthdayPlan?.id) {
    alert("Pricing plan is not available. Run db seed and try again.");
    return;
  }

  setLoading("birthday");
  setCheckoutError("");

  try {
    const order = await api("/payments/create-order", {
      method: "POST",
      body: JSON.stringify({
        projectId: id,
        planId: birthdayPlan.id,
        revealMethod,
        scannerStyle:
          revealMethod === "QR"
            ? scannerStyle
            : null,
      }),
    });

    /*
     * Make sure Razorpay is loaded
     */
    if (!(window as any).Razorpay) {
  await new Promise<void>((resolve, reject) => {
    const src =
      "https://checkout.razorpay.com/v1/checkout.js";

    const existing = document.querySelector(
      `script[src="${src}"]`,
    ) as HTMLScriptElement | null;

    // Script already exists and Razorpay is available
    if ((window as any).Razorpay) {
      resolve();
      return;
    }

    // Script exists but is still loading
    if (existing) {
      const checkLoaded = () => {
        if ((window as any).Razorpay) {
          resolve();
        } else {
          reject(
            new Error(
              "Razorpay script loaded but Razorpay is unavailable.",
            ),
          );
        }
      };

      existing.addEventListener(
        "load",
        checkLoaded,
        { once: true },
      );

      existing.addEventListener(
        "error",
        () =>
          reject(
            new Error(
              "Unable to load Razorpay.",
            ),
          ),
        { once: true },
      );

      // Important: handle script that finished loading
      // before our listener was attached.
      setTimeout(() => {
        if ((window as any).Razorpay) {
          resolve();
        }
      }, 100);

      return;
    }

    // No script yet — create it
    const script = document.createElement("script");

    script.src = src;
    script.async = true;

    script.onload = () => {
      if ((window as any).Razorpay) {
        resolve();
      } else {
        reject(
          new Error(
            "Razorpay loaded but the SDK is unavailable.",
          ),
        );
      }
    };

    script.onerror = () => {
      reject(
        new Error(
          "Unable to load Razorpay.",
        ),
      );
    };

    document.body.appendChild(script);
  });
}

    /*
     * Razorpay checkout
     */
    const razorpay = new (window as any).Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,

      // DEVSPHERE branding
      name: "Devsphere",

      description: `Birthday Website — ₹${birthdayPrice}`,

      order_id: order.providerOrderId,

      handler: async (response: any) => {
        try {
          /*
           * Verify payment
           */
          await api("/payments/verify", {
            method: "POST",
            body: JSON.stringify({
              orderId: order.orderId,
              razorpayOrderId:
                response.razorpay_order_id,
              razorpayPaymentId:
                response.razorpay_payment_id,
              razorpaySignature:
                response.razorpay_signature,
            }),
          });

          /*
           * Publish website
           */
          const published = await api(
            `/projects/${id}/publish`,
            {
              method: "POST",
              body: JSON.stringify({}),
            },
          );

          nav(
            `/published/${id}?url=${encodeURIComponent(
              published.url,
            )}`,
          );
        } catch (error: any) {
          console.error(
            "Payment verification/publication failed:",
            error,
          );

          setCheckoutError(
            error?.message ||
              "Payment succeeded, but website publication failed.",
          );
        }
      },
    });

    razorpay.open();
  } catch (e: any) {
    console.error("Payment error:", e);

    const message =
      e?.message ||
      "Payment could not be started.";

    setCheckoutError(message);
    alert(message);
  } finally {
    setLoading("");
  }
}

  /* =========================================================
     CHECKOUT UI
     ========================================================= */

  return (
    <>
      <Nav />

      <div className="container section">
        <div className="section-head">
          <div>
            <span className="pill">Birthday Website</span>

            <h2>Your birthday package</h2>

            <p className="muted">
              Choose your reveal style and review your final price.
            </p>
          </div>
        </div>

        {/* ===================================================
            REVEAL STYLE
           =================================================== */}

        <div className="checkout-reveal-section">
          <h3>Choose how to share your surprise</h3>

          <p className="muted">
            Normal is included. Any magical reveal method makes the package
            ₹119.
          </p>

          <div className="actions">
            {[
              ["NORMAL", "Normal"],
              ["QR", "Magical Scanner"],
              ["PIN", "Code Lock"],
              ["LETTER", "Secret Letter"],
              ["GIFT", "Gift Box"],
              ["PUZZLE", "Puzzle"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`btn ${
                  revealMethod === value ? "btn-primary" : "btn-soft"
                }`}
                onClick={() =>
                  setRevealMethod(
                    value as
                      | "NORMAL"
                      | "QR"
                      | "PIN"
                      | "LETTER"
                      | "GIFT"
                      | "PUZZLE",
                  )
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ===================================================
            MAGICAL SCANNER STYLES
           =================================================== */}

        {revealMethod === "QR" && (
  <div className="scanner-style-section">

    <div className="scanner-style-heading">
      <h3>
        Choose your Magical Scanner
      </h3>

      <p className="muted">
        Choose how your birthday website link
        will appear when you share it.
      </p>
    </div>


    <div className="scanner-style-grid">

      {/* =================================================
          HEART SCANNER
         ================================================= */}

      <button
        type="button"
        className={`scanner-style-card ${
          scannerStyle === "HEART"
            ? "is-selected"
            : ""
        }`}
        onClick={() =>
          setScannerStyle("HEART")
        }
      >

        <div className="scanner-image-preview scanner-heart-preview">
          <div className="fake-heart-qr">
            <span className="qr-corner qr-corner-1" />
            <span className="qr-corner qr-corner-2" />
            <span className="qr-corner qr-corner-3" />

            <div className="qr-heart">
              ♥
            </div>
          </div>
        </div>

        <strong>
          Heart Scanner
        </strong>

        <span>
          Heart-shaped QR design
        </span>

      </button>


      {/* =================================================
          SQUARE SCANNER
         ================================================= */}

      <button
        type="button"
        className={`scanner-style-card ${
          scannerStyle === "SQUARE"
            ? "is-selected"
            : ""
        }`}
        onClick={() =>
          setScannerStyle("SQUARE")
        }
      >

        <div className="scanner-image-preview scanner-square-preview">
          <div className="fake-square-qr">

            <span className="qr-square-corner qr-sq-1" />
            <span className="qr-square-corner qr-sq-2" />
            <span className="qr-square-corner qr-sq-3" />

            <div className="qr-random-pattern">
              ▪ ▪ ▪ ▪<br />
              ▪ ▪ ▪ ▪<br />
              ▪ ▪ ▪ ▪<br />
              ▪ ▪ ▪ ▪
            </div>

          </div>
        </div>

        <strong>
          Square Scanner
        </strong>

        <span>
          Classic square QR design
        </span>

      </button>

    </div>


    <div className="scanner-style-price">

      <span>
        Magical Scanner
      </span>

      <strong>
        ₹119
      </strong>

    </div>

  </div>
)}

        {/* ===================================================
            THREE PRICE OPTIONS
           =================================================== */}

        <div className="birthday-checkout-pricing">
          {/* =========================
              ₹99
             ========================= */}

          <div
            className={`birthday-price-card ${
              birthdayPrice === 99 ? "is-selected" : ""
            }`}
          >
            <span className="birthday-price-badge">BASIC</span>

            <div className="birthday-price-icon">🎂</div>

            <h3>Birthday Website</h3>

            <p>
              Complete interactive birthday experience with all core sections.
            </p>

            <strong className="birthday-price">₹99</strong>

            <span className="birthday-price-note">Base price</span>
          </div>

          {/* =========================
              ₹109
             ========================= */}

          <div
            className={`birthday-price-card ${
              birthdayPrice === 109 ? "is-selected" : ""
            }`}
          >
            <span className="birthday-price-badge birthday-price-premium">
              + OUR MOVIE
            </span>

            <div className="birthday-price-icon">🎬</div>

            <h3>
              Birthday Website
              <br />+ Our Movie
            </h3>

            <p>Add your personal birthday movie/video.</p>

            <strong className="birthday-price">₹109</strong>

            <span className="birthday-price-note">₹99 + ₹10 movie</span>
          </div>

          {/* =========================
              ₹119
             ========================= */}

          <div
            className={`birthday-price-card birthday-price-special ${
              birthdayPrice === 119 ? "is-selected" : ""
            }`}
          >
            <span className="birthday-price-badge birthday-price-luxury">
              SPECIAL REVEAL
            </span>

            <div className="birthday-price-icon">✨</div>

            <h3>
              Birthday Website
              <br />+ Special Reveal
            </h3>

            <p>QR, Code Lock, Secret Letter, Gift Box or Puzzle.</p>

            <strong className="birthday-price">₹119</strong>

            <span className="birthday-price-note">
              Any special reveal method
            </span>
          </div>
        </div>

        {/* ===================================================
            CURRENT PACKAGE
           =================================================== */}

        <div
          className="birthday-current-checkout card"
          style={{
            marginTop: 30,
          }}
        >
          <span className="pill">{priceLabel}</span>

          <h3>Your package: ₹{birthdayPrice}</h3>

          <p className="muted">{priceDescription}</p>

          <div className="birthday-current-price">₹{birthdayPrice}</div>

          {/* MOVIE NOTE */}

          {movieEnabled && !specialRevealSelected && (
            <p className="birthday-checkout-note">
              Our Movie is enabled — ₹10 added to the ₹99 base price.
            </p>
          )}

          {/* REVEAL NOTE */}

          {specialRevealSelected && (
            <p className="birthday-checkout-note">
              {revealMethod === "QR"
                ? "Magical Scanner selected."
                : revealMethod === "PIN"
                  ? "Code Lock selected."
                  : revealMethod === "LETTER"
                    ? "Secret Letter selected."
                    : revealMethod === "GIFT"
                      ? "Gift Box selected."
                      : "Puzzle selected."}{" "}
              Your package price is ₹119.
            </p>
          )}

          {checkoutError && (
            <p className="birthday-checkout-error" role="alert">
              {checkoutError}
            </p>
          )}

          <button
            className="btn btn-primary"
            onClick={pay}
            disabled={!birthdayPlan?.id || loading === "birthday"}
          >
            {loading === "birthday"
              ? "Opening payment…"
              : birthdayPlan?.id
                ? `Pay ₹${birthdayPrice}`
                : "Run db seed to load plan"}
          </button>
        </div>
      </div>
    </>
  );
}
function Public() {
  const { slug } = useParams<{ slug: string }>();
  const [payload, setPayload] = useState<any>();
  const [unlock, setUnlock] = useState("");
  const [question, setQuestion] = useState("");
  const [gate, setGate] = useState(true);
  useEffect(() => {
    api(`/public/${slug}`).then((x) => {
      setPayload(x);
      setGate(
        x.accessRequired &&
          (x.site.revealMethod === "PIN" || x.site.revealMethod === "PUZZLE"),
      );
      if (x.site.seoTitle) document.title = x.site.seoTitle;
      if (x.site.seoDescription) {
        let m = document.querySelector(
          "meta[name=description]",
        ) as HTMLMetaElement | null;
        if (!m) {
          m = document.createElement("meta");
          m.name = "description";
          document.head.appendChild(m);
        }
        m.content = x.site.seoDescription;
      }
    });
  }, [slug]);
  if (!payload)
    return (
      <div className="reveal">
        <div className="reveal-box">Loading your surprise…</div>
      </div>
    );
  async function submit() {
    try {
      if (
        payload.site.revealMethod === "LETTER" ||
        payload.site.revealMethod === "GIFT"
      ) {
        setGate(false);
        return;
      }
      await api(`/public/${slug}/unlock`, {
        method: "POST",
        body: JSON.stringify(
          payload.site.revealMethod === "PIN"
            ? { pin: unlock }
            : { answer: unlock },
        ),
      });
      setGate(false);
    } catch (e: any) {
      setQuestion(e.message);
    }
  }
  if (gate)
    return (
      <div className="reveal">
        <div className="reveal-box">
          <Heart fill="currentColor" size={30} />
          <h1>
            {payload.site.revealMethod === "LETTER"
              ? "Someone left a letter for you…"
              : payload.site.revealMethod === "GIFT"
                ? "A little gift is waiting…"
                : payload.site.revealMethod === "PUZZLE"
                  ? "One question stands between you and the surprise…"
                  : "A Special Memory Is Waiting"}
          </h1>
          {payload.site.revealMethod === "PUZZLE" && (
            <p>
              {payload?.accessRule?.puzzleQuestion ||
                "Answer the question to unlock."}
            </p>
          )}{" "}
          {(payload.site.revealMethod === "PIN" ||
            payload.site.revealMethod === "PUZZLE") && (
            <input
              value={unlock}
              onChange={(e) => setUnlock(e.target.value)}
              placeholder={
                payload.site.revealMethod === "PIN"
                  ? "Secret PIN"
                  : "Your answer"
              }
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 12,
                border: "1px solid #6a5550",
                background: "transparent",
                color: "#fff",
              }}
            />
          )}
          <button
            className="btn btn-primary"
            style={{ marginTop: 14, background: "#fff", color: "#2b211e" }}
            onClick={submit}
          >
            {payload.site.revealMethod === "PIN"
              ? "Unlock ❤️"
              : "Open My Surprise ❤️"}
          </button>
          {question && <p style={{ color: "#ffb4a6" }}>{question}</p>}
        </div>
      </div>
    );
  return (
    <TemplateRenderer
      template={payload.template}
      data={payload.data}
      customization={payload.customization}
    />
  );
}
function RoutePublished() {
  const { id } = useParams();
  const q = new URLSearchParams(useLocation().search);
  const [method, setMethod] = useState("NORMAL");
  const [pin, setPin] = useState("");
  const [puzzleQuestion, setPuzzleQuestion] = useState("");
  const [puzzleAnswer, setPuzzleAnswer] = useState("");
  const [status, setStatus] = useState("");
  const url = q.get("url") || "";
  async function save() {
    try {
      await api(`/projects/${id}/reveal`, {
        method: "PATCH",
        body: JSON.stringify({ method, pin, puzzleQuestion, puzzleAnswer }),
      });
      setStatus("Reveal settings saved ✓");
    } catch (e: any) {
      setStatus(e.message);
    }
  }
  return (
    <>
      <Nav />
      <div className="container section">
        <div className="auth-card">
          <span className="pill">Website published</span>
          <h2>Your surprise is live 🎉</h2>
          <p className="muted">{url}</p>
          <div style={{ display: "grid", placeItems: "center", gap: 18 }}>
            {url && <QRCodeSVG value={url} size={220} />}
            <a className="btn btn-primary" href={url || "#"} target="_blank">
              Open Website
            </a>
          </div>
          <hr
            style={{
              border: 0,
              borderTop: "1px solid #eadfd8",
              margin: "28px 0",
            }}
          />
          <h3>Choose Reveal Style</h3>
          <div className="actions">
            {[
              ["NORMAL", "Normal", Share2],
              ["QR", "Magical Scanner", ScanLine],
              ["PIN", "Code Lock", LockKeyhole],
              ["LETTER", "Secret Letter", Mail],
              ["GIFT", "Gift Box", Gift],
              ["PUZZLE", "Puzzle", Heart],
            ].map(([v, label, Icon]: any) => (
              <button
                key={v}
                className={`btn ${method === v ? "btn-primary" : "btn-soft"}`}
                onClick={() => setMethod(v)}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
          {method === "PIN" && (
            <div className="field">
              <label>Secret PIN</label>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                minLength={4}
                placeholder="4+ digits"
              />
            </div>
          )}
          {method === "PUZZLE" && (
            <>
              <div className="field">
                <label>Question</label>
                <input
                  value={puzzleQuestion}
                  onChange={(e) => setPuzzleQuestion(e.target.value)}
                  placeholder="Where did we have our first date?"
                />
              </div>
              <div className="field">
                <label>Answer</label>
                <input
                  value={puzzleAnswer}
                  onChange={(e) => setPuzzleAnswer(e.target.value)}
                />
              </div>
            </>
          )}
          <button className="btn btn-primary" onClick={save}>
            Save Reveal Settings
          </button>
          {status && <p className="muted">{status}</p>}
        </div>
      </div>
    </>
  );
}
function AdminTemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const [t, setT] = useState<any>();
  const [schema, setSchema] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (id)
      api(`/templates/${id}`).then((x) => {
        setT(x.template);
        setSchema(JSON.stringify(x.template.schema, null, 2));
      });
  }, [id]);
  async function save() {
    try {
      const parsed = JSON.parse(schema);
      await api(`/admin/templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ schema: parsed }),
      });
      setMessage("Template schema saved ✓");
    } catch (e: any) {
      setMessage(e.message || "Invalid JSON");
    }
  }
  if (!t)
    return (
      <>
        <Nav />
        <div className="container section">Loading…</div>
      </>
    );
  return (
    <>
      <Nav />
      <div className="container section">
        <span className="pill">Template editor</span>
        <h2>{t.name}</h2>
        <p className="muted">
          Structured JSON editor for sections, fields and customization. This
          updates the reusable template definition; customer project data stays
          separate.
        </p>
        <div className="field">
          <label>Template Schema</label>
          <textarea
            value={schema}
            onChange={(e) => setSchema(e.target.value)}
            style={{ minHeight: 520, fontFamily: "monospace", fontSize: 13 }}
          />
        </div>
        <button className="btn btn-primary" onClick={save}>
          Save Schema
        </button>
        {message && <p className="muted">{message}</p>}
      </div>
    </>
  );
}

function Admin() {
  const [stats, setStats] = useState<any>();
  const [templates, setTemplates] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const nav = useNavigate();
  useEffect(() => {
    Promise.all([
      api("/admin/dashboard"),
      api("/admin/orders"),
      api("/templates"),
    ])
      .then(([a, o, t]) => {
        setStats(a);
        setOrders(o.items);
        setTemplates(t.items);
      })
      .catch(() => nav("/login"));
  }, [nav]);
  return (
    <>
      <Nav />
      <div className="container section">
        <span className="pill">Admin</span>
       <h2>Devsphere Control Center</h2>
        {stats && (
          <div className="stat-grid">
            <div className="stat">
              Customers
              <br />
              <b>{stats.customers}</b>
            </div>
            <div className="stat">
              Active Sites
              <br />
              <b>{stats.sites}</b>
            </div>
            <div className="stat">
              Templates
              <br />
              <b>{stats.templates}</b>
            </div>
            <div className="stat">
              Revenue
              <br />
              <b>₹{stats.revenue}</b>
            </div>
          </div>
        )}
        <section className="section">
          <div className="section-head">
            <h2>Orders</h2>
          </div>
          <div className="list">
            {orders.map((o) => (
              <div className="row-card" key={o.id}>
                <div>
                  <b>{o.project.name}</b>
                  <div className="muted">
                    {o.user.email} · {o.plan.name}
                  </div>
                </div>
                <b>
                  ₹{o.amount} · {o.status}
                </b>
              </div>
            ))}
          </div>
        </section>
        <section className="section">
          <div className="section-head">
            <h2>Templates</h2>
          </div>
          <div className="grid">
            {templates.map((t) => (
              <div key={t.id}>
                <TemplateCard t={t} />
                <Link
                  className="btn btn-soft"
                  style={{ marginTop: 8 }}
                  to={`/admin/templates/${t.id}`}
                >
                  Edit schema
                </Link>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/templates" element={<Templates />} />
      <Route path="/templates/:id" element={<TemplatePreview />} />
      <Route path="/login" element={<Auth />} />
      <Route path="/register" element={<Auth />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/admin/templates/:id" element={<AdminTemplateEditor />} />
      <Route path="/create/:id" element={<Create />} />
      <Route path="/edit/:id" element={<Editor />} />
      <Route path="/checkout/:id" element={<Checkout />} />
      <Route path="/published/:id" element={<RoutePublished />} />
      <Route path="/r/:slug" element={<Public />} />
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
