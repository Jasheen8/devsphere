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
import { api, apiBase, getTemplates, preloadTemplates } from "./lib/api";
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
  const [user, setUser] = React.useState<any>(null);

  React.useEffect(() => {
    api("/auth/me")
      .then((data) => {
        setUser(data.user);
      })
      .catch(() => {
        setUser(null);
      });
  }, []);

  const userInitial =
    user?.name?.trim()?.charAt(0)?.toUpperCase() ||
    user?.email?.trim()?.charAt(0)?.toUpperCase() ||
    "U";

  return (
    <nav className="site-nav">
      <div className="nav-brand">
        <span className="brand-mark">D</span>
        <span>Devsphere</span>
      </div>

      <div className="nav-links">
        <Link to="/templates" onMouseEnter={preloadTemplates}>
          Templates
        </Link>
        <Link to="/dashboard">My Websites</Link>

        {user ? (
          <Link
            to="/dashboard"
            className="nav-user"
            title={user.name || user.email}
            aria-label="Open My Websites"
          >
            {userInitial}
          </Link>
        ) : (
          <Link to="/login" className="nav-login">
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}
function Home() {
  const [templates, setTemplates] = useState<Template[]>([]);
  useEffect(() => {
    getTemplates()
      .then((items) => {
        setTemplates(items);
      })
      .catch((error) => {
        console.error("Failed to load templates:", error);
      });
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
            <Link
              className="btn btn-primary"
              to="/templates"
              onMouseEnter={preloadTemplates}
            >
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
              Live Demo 120800
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
        <BackButton label="Back" />

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
      .then((x) => setT(x.template))
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
        <BackButton label="Back to Templates" />
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
        <BackButton label="Back to Home" />
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
        <BackButton label="Back" />
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
                {(p.status === "DRAFT" || p.status === "FINALIZED") &&
                  !p.isPaid && (
                    <div className="project-actions">
                      <button
                        type="button"
                        className="delete-draft-btn"
                        onClick={async () => {
                          const confirmed = window.confirm(
                            "Delete this draft website? This action cannot be undone.",
                          );

                          if (!confirmed) return;

                          try {
                            await api(`/projects/${p.id}`, {
                              method: "DELETE",
                            });

                            setProjects((current) =>
                              current.filter((item) => item.id !== p.id),
                            );
                          } catch (error: any) {
                            alert(error.message || "Unable to delete draft.");
                          }
                        }}
                      >
                        Delete Draft
                      </button>

                      <button
                        type="button"
                        className="continue-editing-btn"
                        onClick={() => nav(`/edit/${p.id}`)}
                      >
                        Continue Editing
                      </button>
                    </div>
                  )}

                {p.status === "FINALIZED" && !p.isPaid && (
                  <button
                    className="btn btn-primary"
                    onClick={() => nav(`/checkout/${p.id}`)}
                  >
                    Complete Payment
                  </button>
                )}

                {p.status === "PUBLISHED" && p.website && (
                  <>
                    <button
                      className="btn btn-primary"
                      onClick={() => nav(`/published/${p.id}`)}
                    >
                      Manage Website
                    </button>

                    <a
                      className="btn btn-soft"
                      href={`/r/${p.website.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View Website
                    </a>

                    <button
                      className="btn btn-soft"
                      onClick={async () => {
                        const url = `${window.location.origin}/r/${p.website.slug}`;

                        try {
                          await navigator.clipboard.writeText(url);
                          alert("Website link copied ✓");
                        } catch {
                          prompt("Copy your website link:", url);
                        }
                      }}
                    >
                      Copy Link
                    </button>

                    <button
                      className="btn btn-soft"
                      onClick={async () => {
                        const url = `${window.location.origin}/r/${p.website.slug}`;

                        if (navigator.share) {
                          try {
                            await navigator.share({
                              title: p.name || "My Devsphere Website",
                              text: "Here's my special website ❤️",
                              url,
                            });
                          } catch {
                            // User cancelled share.
                          }
                        } else {
                          await navigator.clipboard.writeText(url);
                          alert("Website link copied ✓");
                        }
                      }}
                    >
                      Share
                    </button>
                  </>
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
        <div className="toolbar editor-preview-toolbar">
          <BackButton label="Back to My Websites" />
          <div className="editor-preview-actions">
            <button
              className="btn btn-soft drawer-toggle"
              onClick={() => setOpen(true)}
            >
              Edit
            </button>
            <span className="muted">Live preview</span>
          </div>
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
    if (!id) return;

    api(`/templates/${id}`)
      .then((x) => {
        console.log("Template loaded:", x.template);
        setTemplate(x.template);
      })
      .catch((error) => {
        console.error("Template loading failed:", error);
        alert(error.message || "Unable to load template.");
      });
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
      <BackButton label="Back to Templates" />
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
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [revealMethod, setRevealMethod] = useState<
    "NORMAL" | "QR" | "PIN" | "LETTER" | "GIFT" | "PUZZLE"
  >("NORMAL");

  const [scannerStyle, setScannerStyle] = useState<"HEART" | "SQUARE">("HEART");

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
  const displayPrice =
  currency === "USD"
    ? specialRevealSelected
      ? 2.99
      : movieEnabled
        ? 2.49
        : 1.99
    : birthdayPrice;
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
  scannerStyle: revealMethod === "QR" ? scannerStyle : null,
  currency,
}),
      });

      /*
       * Make sure Razorpay is loaded
       */
      if (!(window as any).Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const src = "https://checkout.razorpay.com/v1/checkout.js";

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

            existing.addEventListener("load", checkLoaded, { once: true });

            existing.addEventListener(
              "error",
              () => reject(new Error("Unable to load Razorpay.")),
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
              reject(new Error("Razorpay loaded but the SDK is unavailable."));
            }
          };

          script.onerror = () => {
            reject(new Error("Unable to load Razorpay."));
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

        description: `Birthday Website — ${
  currency === "USD" ? "$" : "₹"
}${displayPrice}`,

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
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });

            /*
             * Publish website
             */
            const published = await api(`/projects/${id}/publish`, {
              method: "POST",
              body: JSON.stringify({}),
            });

            nav(`/published/${id}?url=${encodeURIComponent(published.url)}`);
          } catch (error: any) {
            console.error("Payment verification/publication failed:", error);

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

      const message = e?.message || "Payment could not be started.";

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
        <BackButton label="Back to Editor" />
        <div className="section-head">
          <div>
            <span className="pill">Birthday Website</span>

            <h2>Your birthday package</h2>

            <p className="muted">
              Choose your reveal style and review your final price.
            </p>
          </div>
        </div>

        <div className="checkout-currency-section">
  <h3>Choose Currency</h3>

  <p className="muted">
    Select how you want to pay.
  </p>

  <div className="actions">
    <button
      type="button"
      className={`btn ${
        currency === "INR" ? "btn-primary" : "btn-soft"
      }`}
      onClick={() => setCurrency("INR")}
    >
      🇮🇳 INR ₹
    </button>

    <button
      type="button"
      className={`btn ${
        currency === "USD" ? "btn-primary" : "btn-soft"
      }`}
      onClick={() => setCurrency("USD")}
    >
      🌎 USD $
    </button>
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
              <h3>Choose your Magical Scanner</h3>

              <p className="muted">
                Choose how your birthday website link will appear when you share
                it.
              </p>
            </div>

            <div className="scanner-style-grid">
              {/* =================================================
          HEART SCANNER
         ================================================= */}

              <button
                type="button"
                className={`scanner-style-card ${
                  scannerStyle === "HEART" ? "is-selected" : ""
                }`}
                onClick={() => setScannerStyle("HEART")}
              >
                <div className="scanner-image-preview scanner-heart-preview">
                  <div className="fake-heart-qr">
                    <span className="qr-corner qr-corner-1" />
                    <span className="qr-corner qr-corner-2" />
                    <span className="qr-corner qr-corner-3" />

                    <div className="qr-heart">♥</div>
                  </div>
                </div>

                <strong>Heart Scanner</strong>

                <span>Heart-shaped QR design</span>
              </button>

              {/* =================================================
          SQUARE SCANNER
         ================================================= */}

              <button
                type="button"
                className={`scanner-style-card ${
                  scannerStyle === "SQUARE" ? "is-selected" : ""
                }`}
                onClick={() => setScannerStyle("SQUARE")}
              >
                <div className="scanner-image-preview scanner-square-preview">
                  <div className="fake-square-qr">
                    <span className="qr-square-corner qr-sq-1" />
                    <span className="qr-square-corner qr-sq-2" />
                    <span className="qr-square-corner qr-sq-3" />

                    <div className="qr-random-pattern">
                      ▪ ▪ ▪ ▪<br />
                      ▪ ▪ ▪ ▪<br />
                      ▪ ▪ ▪ ▪<br />▪ ▪ ▪ ▪
                    </div>
                  </div>
                </div>

                <strong>Square Scanner</strong>

                <span>Classic square QR design</span>
              </button>
            </div>

            <div className="scanner-style-price">
              <span>Magical Scanner</span>

              <strong>{currency === "USD" ? "$2.99" : "₹119"}</strong>
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

          <h3>Your package: {currency === "USD" ? "$" : "₹"}{displayPrice}</h3>

          <p className="muted">{priceDescription}</p>

          <div className="birthday-current-price">{currency === "USD" ? "$" : "₹"}{displayPrice}</div>

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
              Your package price is{" "}
{currency === "USD" ? "$2.99" : "₹119"}.
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
    ? `Pay ${currency === "USD" ? "$" : "₹"}${displayPrice}`
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
    if (!slug) return;

    api(`/public/${slug}`)
      .then((x) => {
        console.log("PUBLIC WEBSITE DATA:", x);

        setPayload(x);

        setGate(
          x.accessRequired &&
            (x.site.revealMethod === "PIN" || x.site.revealMethod === "PUZZLE"),
        );

        if (x.site.seoTitle) {
          document.title = x.site.seoTitle;
        }

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
      })
      .catch((error) => {
        console.error("PUBLIC WEBSITE LOAD FAILED:", error);
        setQuestion(error?.message || "Unable to load this website.");
        setGate(false);
      });
  }, [slug]);
  if (!payload) {
    return (
      <div className="reveal">
        <div className="reveal-box">
          <h2>Loading your surprise…</h2>
          {question && <p>{question}</p>}
        </div>
      </div>
    );
  }
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
  const { id } = useParams<{ id: string }>();

  const [project, setProject] = useState<any>();
  const [method, setMethod] = useState<
    "NORMAL" | "QR" | "PIN" | "LETTER" | "GIFT" | "PUZZLE"
  >("NORMAL");

  const [pin, setPin] = useState("");
  const [puzzleQuestion, setPuzzleQuestion] = useState("");
  const [puzzleAnswer, setPuzzleAnswer] = useState("");

  const [status, setStatus] = useState("");
  const [sharing, setSharing] = useState(false);

  const qrRef = React.useRef<HTMLDivElement | null>(null);

  const nav = useNavigate();

  useEffect(() => {
    if (!id) return;

    api(`/projects/${id}`)
      .then((response) => {
        const p = response.project;

        setProject(p);

        const savedMethod = String(
          p?.website?.revealMethod ?? p?.revealMethod ?? "NORMAL",
        ).toUpperCase();

        if (
          ["NORMAL", "QR", "PIN", "LETTER", "GIFT", "PUZZLE"].includes(
            savedMethod,
          )
        ) {
          setMethod(savedMethod as any);
        }
      })
      .catch((error) => {
        console.error("Failed to load published project:", error);
      });
  }, [id]);

  if (!project) {
    return (
      <>
        <Nav />

        <div className="container section">
          <BackButton label="Back to My Websites" />
          Loading your published website…
        </div>
      </>
    );
  }

  const website = project.website;

  if (!website) {
    return (
      <>
        <Nav />

        <div className="container section">
          <BackButton label="Back to My Websites" />
          <div className="card" style={{ padding: 30 }}>
            <h2>Website not published yet</h2>

            <p className="muted">
              Your payment may be complete, but the website still needs to be
              published.
            </p>
          </div>
        </div>
      </>
    );
  }

  const publicUrl = `${window.location.origin}/r/${website.slug}`;

  const projectData =
    project.data && typeof project.data === "object" ? project.data : {};

  const packagePrice =
    projectData.packagePrice ||
    (project.orders?.length
      ? project.orders[project.orders.length - 1]?.amount
      : 99);

  const scannerStyle =
    projectData.scannerStyle === "SQUARE" ? "SQUARE" : "HEART";

  const isSpecialReveal =
    packagePrice === 119 ||
    method === "QR" ||
    method === "PIN" ||
    method === "LETTER" ||
    method === "GIFT" ||
    method === "PUZZLE";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);

      setStatus("Link copied ✓");

      setTimeout(() => setStatus(""), 2200);
    } catch {
      setStatus("Could not copy. Please copy the link manually.");
    }
  }

  async function shareWebsite() {
    try {
      setSharing(true);

      if (navigator.share) {
        await navigator.share({
          title: project.name || "My Devsphere Website",
          text: "Here's a special website made for you ❤️",
          url: publicUrl,
        });

        setStatus("Shared ✓");
      } else {
        await navigator.clipboard.writeText(publicUrl);

        setStatus("Sharing isn't supported here. Link copied ✓");
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        setStatus("Unable to share right now.");
      }
    } finally {
      setSharing(false);
    }
  }

  function getQrSvgMarkup() {
    const svg = qrRef.current?.querySelector("svg");

    if (!svg) {
      throw new Error("QR code is not ready.");
    }

    return new XMLSerializer().serializeToString(svg);
  }

  function createScannerSvg() {
    const qrMarkup = getQrSvgMarkup();

    const qrDataUrl = `data:image/svg+xml;base64,${btoa(
      unescape(encodeURIComponent(qrMarkup)),
    )}`;

    const heart = scannerStyle === "HEART";

    const frameColor = heart ? "#8f3044" : "#2b211e";
    const title = heart ? "♥ Scan My Surprise ♥" : "Scan My Surprise";

    if (!heart) {
      return `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="1200"
        height="1400"
        viewBox="0 0 1200 1400"
      >
        <rect
          width="1200"
          height="1400"
          rx="70"
          fill="#fffaf7"
        />

        <text
          x="600"
          y="115"
          text-anchor="middle"
          font-family="Georgia, serif"
          font-size="54"
          fill="${frameColor}"
          font-weight="700"
        >
          ${title}
        </text>

        <image
          href="${qrDataUrl}"
          x="250"
          y="220"
          width="700"
          height="700"
          preserveAspectRatio="xMidYMid meet"
        />

        <text
          x="600"
          y="1010"
          text-anchor="middle"
          font-family="Arial, sans-serif"
          font-size="34"
          fill="#5d4b45"
        >
          Scan to open the surprise
        </text>

        <text
          x="600"
          y="1065"
          text-anchor="middle"
          font-family="Arial, sans-serif"
          font-size="24"
          fill="#8a7168"
        >
          Made with Devsphere
        </text>
      </svg>
    `;
    }

    return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1200"
      height="1400"
      viewBox="0 0 1200 1400"
    >
      <defs>
        <!-- Heart silhouette -->
        <clipPath id="heartClip">
          <path
            d="
              M600 1135
              C545 1090 135 800 135 465
              C135 275 275 150 445 150
              C520 150 575 180 600 245
              C625 180 680 150 755 150
              C925 150 1065 275 1065 465
              C1065 800 655 1090 600 1135
              Z
            "
          />
        </clipPath>
      </defs>

      <!-- Background -->
      <rect
        width="1200"
        height="1400"
        rx="70"
        fill="#fffaf7"
      />

      <!-- Heading -->
      <text
        x="600"
        y="95"
        text-anchor="middle"
        font-family="Georgia, serif"
        font-size="52"
        fill="${frameColor}"
        font-weight="700"
      >
        ${title}
      </text>

      <!-- HEART-SHAPED QR -->
      <g clip-path="url(#heartClip)">
        <image
          href="${qrDataUrl}"
          x="115"
          y="150"
          width="970"
          height="970"
          preserveAspectRatio="none"
        />
      </g>

      <!-- Heart border -->
      <path
        d="
          M600 1135
          C545 1090 135 800 135 465
          C135 275 275 150 445 150
          C520 150 575 180 600 245
          C625 180 680 150 755 150
          C925 150 1065 275 1065 465
          C1065 800 655 1090 600 1135
          Z
        "
        fill="none"
        stroke="${frameColor}"
        stroke-width="14"
      />

      <!-- Small heart decoration -->
      <text
        x="600"
        y="1210"
        text-anchor="middle"
        font-family="Georgia, serif"
        font-size="34"
        fill="${frameColor}"
      >
        Scan to open the surprise ❤️
      </text>

      <text
        x="600"
        y="1270"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-size="23"
        fill="#8a7168"
      >
        Made with Devsphere
      </text>
    </svg>
  `;
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = filename;

    document.body.appendChild(a);

    a.click();

    a.remove();

    URL.revokeObjectURL(url);
  }

  function downloadScanner() {
    try {
      const svg = createScannerSvg();

      const blob = new Blob([svg], {
        type: "image/svg+xml",
      });

      downloadBlob(blob, `${project.name || "devsphere"}-scanner.svg`);

      setStatus("Scanner downloaded ✓");

      setTimeout(() => setStatus(""), 2200);
    } catch (error: any) {
      console.error("Scanner download error:", error);

      setStatus("Could not generate scanner.");
    }
  }

  async function saveReveal() {
    try {
      await api(`/projects/${id}/reveal`, {
        method: "PATCH",
        body: JSON.stringify({
          method,
          pin,
          puzzleQuestion,
          puzzleAnswer,
          scannerStyle: method === "QR" ? scannerStyle : null,
        }),
      });

      setStatus("Reveal settings saved ✓");
    } catch (error: any) {
      setStatus(error?.message || "Unable to save reveal settings.");
    }
  }

  return (
    <>
      <Nav />

      <div className="container section">
        <BackButton label="Back to My Websites" />
        <div
          className="card"
          style={{
            padding: 32,
          }}
        >
          <span className="pill">Website Published</span>

          <h2>Your surprise is live 🎉</h2>

          <p className="muted">
            This website is now permanently saved to your Devsphere account.
          </p>

          {/* PUBLIC LINK */}

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 20,
            }}
          >
            <input
              value={publicUrl}
              readOnly
              style={{
                flex: 1,
                minWidth: 260,
                padding: 13,
                borderRadius: 12,
                border: "1px solid #dccbc2",
                background: "#fff",
              }}
            />

            <button className="btn btn-soft" onClick={copyLink}>
              Copy Link
            </button>

            <button
              className="btn btn-primary"
              onClick={shareWebsite}
              disabled={sharing}
            >
              {sharing ? "Sharing…" : "Share"}
            </button>
          </div>

          {status && (
            <p
              className="muted"
              style={{
                marginTop: 14,
              }}
            >
              {status}
            </p>
          )}

          {/* OPEN WEBSITE */}

          <div
            style={{
              marginTop: 22,
            }}
          >
            <a
              className="btn btn-primary"
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Website
            </a>
          </div>
        </div>

        {/* =====================================================
            SPECIAL REVEAL SCANNER
           ===================================================== */}

        {isSpecialReveal && (
          <div
            className="card"
            style={{
              marginTop: 24,
              padding: 32,
            }}
          >
            <span className="pill">
              {scannerStyle === "HEART" ? "HEART SCANNER" : "SQUARE SCANNER"}
            </span>

            <h2>Your Magical Scanner ✨</h2>

            <p className="muted">
              Download this scanner or take a screenshot and share it with the
              person receiving the surprise.
            </p>

            <div
              ref={qrRef}
              style={{
                display: "grid",
                placeItems: "center",
                marginTop: 24,
                padding: 28,
                borderRadius: 24,
                background: scannerStyle === "HEART" ? "#fff0f3" : "#f5eee9",
              }}
            >
              <div
                className={
                  scannerStyle === "HEART"
                    ? "heart-qr-wrapper is-heart"
                    : "heart-qr-wrapper is-square"
                }
              >
                {scannerStyle === "HEART" && (
                  <>
                    <span className="heart-qr-lobe heart-qr-lobe-left" />
                    <span className="heart-qr-lobe heart-qr-lobe-right" />
                  </>
                )}

                <div className="heart-qr-real-code">
                  <QRCodeSVG
                    value={publicUrl}
                    size={230}
                    level="H"
                    includeMargin
                    fgColor="#cf2638"
                    bgColor="#fff0f3"
                  />
                </div>
              </div>

              <strong
                style={{
                  marginTop: 14,
                  fontSize: 18,
                }}
              >
                {scannerStyle === "HEART"
                  ? "♥ Heart Scanner"
                  : "Square Scanner"}
              </strong>
            </div>

            <div
              className="actions"
              style={{
                marginTop: 22,
              }}
            >
              <button className="btn btn-primary" onClick={downloadScanner}>
                Download Scanner
              </button>

              <button
                className="btn btn-soft"
                onClick={() => {
                  setStatus("Take a screenshot of the scanner above ✓");

                  setTimeout(() => setStatus(""), 2200);
                }}
              >
                Screenshot Scanner
              </button>
            </div>

            <p
              className="muted"
              style={{
                marginTop: 16,
                fontSize: ".88rem",
              }}
            >
              Scanner style:{" "}
              <strong>{scannerStyle === "HEART" ? "Heart" : "Square"}</strong>
            </p>
          </div>
        )}

        {/* =====================================================
            REVEAL SETTINGS
           ===================================================== */}

        {isSpecialReveal && (
          <div
            className="auth-card"
            style={{
              marginTop: 24,
            }}
          >
            <span className="pill">Reveal Settings</span>

            <h3>Choose how the website opens</h3>

            <div
              className="actions"
              style={{
                marginTop: 16,
              }}
            >
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
                  className={`btn ${
                    method === value ? "btn-primary" : "btn-soft"
                  }`}
                  onClick={() => setMethod(value as any)}
                >
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

            <button className="btn btn-primary" onClick={saveReveal}>
              Save Reveal Settings
            </button>
          </div>
        )}
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
        <BackButton label="Back to Admin" />
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
        <BackButton label="Back" />
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
function BackButton({ label = "Back" }: { label?: string }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className="back-button"
      aria-label={label}
      onClick={() => {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate("/");
        }
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginBottom: 18,
        padding: "9px 13px",
        border: "1px solid #e1d2ca",
        borderRadius: 999,
        background: "rgba(255,255,255,0.72)",
        color: "#4a3d37",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        boxShadow: "0 4px 14px rgba(73, 55, 48, 0.06)",
      }}
    >
      ← {label}
    </button>
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
