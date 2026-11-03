import React, { useEffect, useMemo, useRef, useState } from "react";
import "./my-hero-magazine.css";

const TOTAL_PAGES = 15;
const ASSET_ROOT = "/templates/my-hero-magazine/assets/source/";
const c = (names: string) =>
  names
    .split(/\s+/)
    .filter(Boolean)
    .map((name) => `mh-${name}`)
    .join(" ");

function Lines({ value }: { value: string }) {
  return <>{value.split(/\r?\n/).map((line, index) => <React.Fragment key={index}>{index > 0 && <br />}{line}</React.Fragment>)}</>;
}

function Photo({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return <img className={className ? c(className) : undefined} src={src} alt={alt} draggable={false} />;
}

function MagazineClosingPage({
  data,
  showWatermark,
}: {
  data: Record<string, unknown>;
  showWatermark: boolean;
}) {
  const recipientName = String(data.recipientName || "Your Hero");
  const senderName = String(data.senderName || "Someone who loves you");
  const closingTitle = String(data.closingTitle || "MY FAVOURITE PERSON.");
  const finalMessage = String(
    data.finalMessage ||
      "Thank you for filling ordinary days with your laugh, your kindness, and all the little moments I want to keep. I hope this year brings you as much happiness as you bring to everyone around you.",
  );
  const uploadedPhotos = Array.isArray(data.magazinePhotos)
    ? data.magazinePhotos.filter((photo): photo is string => typeof photo === "string" && photo.length > 0).slice(0, 6)
    : [];
  const fallbackPhotos = [
    "cover-couple.jpeg",
    "darling-couple.jpeg",
    "memories-cycling.jpeg",
    "moment-background.jpeg",
    "grateful-top.jpeg",
    "memories-karting.jpeg",
  ].map((file) => `${ASSET_ROOT}${file}`);
  const photos = uploadedPhotos.length ? uploadedPhotos : fallbackPhotos;

  return (
    <section className={c("closing-page")} aria-label={`Final magazine page for ${recipientName}`}>
      <div className={c("closing-kicker")}>A BIRTHDAY EDITION · MADE FOR YOU</div>
      <div className={c("closing-rule")} />
      <p className={c("closing-recipient")}>FOR {recipientName}</p>
      <h1>{closingTitle}</h1>
      <div className={c(`closing-gallery photo-count-${photos.length}`)}>
        {photos.map((photo, index) => <img key={`${photo}-${index}`} src={photo} alt={`Magazine memory ${index + 1}`} loading="lazy" />)}
      </div>
      <p className={c("closing-message")}>{finalMessage}</p>
      <p className={c("closing-signature")}>With love, <span>{senderName}</span></p>
      {showWatermark && (
        <div className={c("watermark")}>
          <span>MADE WITH LOVE ON</span>
          <a href="https://instagram.com/devsphere.in" target="_blank" rel="noreferrer">DEVSPHERE · @devsphere.in</a>
          <a href="/templates">CREATE YOUR OWN</a>
        </div>
      )}
    </section>
  );
}

type MagazinePageContent = { layout: string; content: React.ReactNode };

export function MyHeroMagazineExperience({
  data,
  theme,
  isPreview = false,
}: {
  data: Record<string, unknown>;
  props?: Record<string, unknown>;
  theme?: Record<string, unknown>;
  isPreview?: boolean;
}) {
  const readerRef = useRef<HTMLDivElement>(null);
  const pageShellRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{ x: number; y: number; id: number } | null>(null);
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const removeWatermark = isPreview
    ? theme?.removeWatermark === true
    : theme?.removeWatermarkPaid === true;
  const showWatermark = !removeWatermark;
  const uploadedStoryPhotos = Array.isArray(data.storyPhotos)
    ? data.storyPhotos.filter((photo): photo is string => typeof photo === "string" && photo.length > 0).slice(0, 40)
    : [];
  const text = (key: string, fallback: string) => {
    const value = data[key];
    return typeof value === "string" && value.trim() ? value : fallback;
  };
  const asset = (file: string) => `${ASSET_ROOT}${file}`;
  const photo = (slot: number, file: string) => uploadedStoryPhotos[slot] || asset(file);
  const renderLines = (key: string, fallback: string) => <Lines value={text(key, fallback)} />;

  const coverNames = text("coverNames", "Anjali & Karan").split("&");
  const firstCoverName = coverNames[0]?.trim() || "Anjali";
  const secondCoverName = coverNames.slice(1).join("&").trim();

  const originalPages: MagazinePageContent[] = [
    {
      layout: "cover",
      content: <>
        <Photo className="page-image cover-photo" src={photo(0, "cover-couple.jpeg")} alt="A couple embracing with a bouquet of white flowers" />
        <div className={c("cover-masthead")}>{text("coverMasthead", "MY HERO")}</div>
        <div className={c("cover-script")}>{text("coverScript", "forever")}</div>
        <div className={c("cover-edition")}>{text("coverEdition", "Birthday Edition")}</div>
        <div className={c("cover-promises")}>
          <p>{renderLines("coverPromiseOne", "AS LONG AS I’M\nWITH YOU")}</p>
          <p>{renderLines("coverPromiseTwo", "I’VE GOT A SMILE\nON MY FACE")}</p>
          <p>{renderLines("coverPromiseThree", "YOU’RE MY\nTODAY,\nTOMORROW &\nFOREVER")}</p>
        </div>
        <div className={c("cover-featuring")}>{text("coverFeaturing", "featuring")}</div>
        <div className={c("cover-names")}><span>{firstCoverName}{secondCoverName ? " &" : ""}</span><br />{secondCoverName}</div>
      </>,
    },
    {
      layout: "fav-human",
      content: <>
        <div className={c("who-title")}>{renderLines("favoriteQuestion", "Who’s\nthat\nboy?")}</div>
        <Photo className="fav-portrait" src={photo(1, "fav-human.jpeg")} alt="A smiling portrait" />
        <div className={c("fav-caption")}>{renderLines("favoriteCaption", "MY FAV\nHUMAN.")}</div>
      </>,
    },
    {
      layout: "love-letter",
      content: <>
        <div className={c("letter-oval")} />
        <div className={c("letter-heading")}>{text("letterHeading", "LOVE LETTER")}</div>
        <svg className={c("letter-bow")} viewBox="0 0 240 104" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M119 42C92 9 39 10 22 27 5 44 26 65 56 59c23-4 39-12 63-17 24 5 40 13 63 17 30 6 51-15 34-32-17-17-70-18-97 15Z" />
            <path d="M119 42c-12 15-34 25-58 31-16 4-30 16-42 30 8-2 15-6 19-11-1 8-2 13-5 18 22-15 34-33 45-43 17-7 30-13 41-25Z" />
            <path d="M121 42c12 15 34 25 58 31 16 4 30 16 42 30-8-2-15-6-19-11 1 8 2 13 5 18-22-15-34-33-45-43-17-7-30-13-41-25Z" />
            <circle cx="120" cy="42" r="6" fill="#f1eee7" />
          </g>
        </svg>
        <div className={c("letter-dear")}>{text("letterSalutation", "Dear Karan,")}</div>
        <p className={c("letter-copy")}>{renderLines("loveLetter", "I don’t think I say it enough, but having you in\nmy life is one of my favourite things.\nSomewhere between our silly conversations,\nrandom laughs, little arguments, and all the\nordinary moments, you became someone who\nfeels like home.\nI love the way you make me laugh when I don’t\nfeel like smiling, the way you listen to the little\nthings, and the way simply having you around\ncan make an ordinary day feel a little better.\nYou’re not perfect, and neither am I—and\nmaybe that’s what makes us so special.\nThank you for being my person, my comfort,\nmy favourite notification, and the one I can\nalways count on. If I had to choose all over\nagain, I’d still choose you.\nHappy Boyfriend’s Day to the man who has my\nheart.\nAlways yours.")}</p>
      </>,
    },
    {
      layout: "you-me-mosaic",
      content: <div className={c("mosaic-grid")}>
        <Photo src={photo(2, "collage-bouquet.jpeg")} alt="A couple embracing with flowers" />
        <Photo src={photo(3, "collage-flowers.jpeg")} alt="A person holding a bouquet" />
        <Photo src={photo(4, "collage-hug.jpeg")} alt="A close shared moment" />
        <Photo src={photo(5, "collage-cat.jpeg")} alt="A quiet moment with a cat" />
        <Photo className="you-me-type" src={asset("you-and-me-type.jpeg")} alt="You and me" />
        <Photo src={photo(6, "collage-profile.jpeg")} alt="A portrait outdoors" />
        <Photo src={photo(7, "collage-carousel.jpeg")} alt="A moment together on a carousel" />
        <Photo src={photo(8, "collage-guitar.jpeg")} alt="A person playing guitar" />
        <Photo src={photo(9, "collage-couple.jpeg")} alt="A couple looking at one another" />
      </div>,
    },
    {
      layout: "mine-yours",
      content: <>
        <Photo className="mine-photo mine-selfie" src={photo(10, "mine-selfie.jpeg")} alt="A close candid moment together" />
        <Photo className="mine-photo mine-night" src={photo(11, "mine-night.jpeg")} alt="A night-time moment together" />
        <Photo className="mine-photo mine-car" src={photo(12, "mine-car.jpeg")} alt="A moment in the car" />
        <div className={c("mine-words")}>MINE.<br />YOURS.<br />FOREVER.</div>
        <Photo className="mine-photo mine-formal" src={photo(13, "mine-formal.jpeg")} alt="A dressed-up couple" />
        <Photo className="mine-photo mine-kittens" src={photo(14, "mine-kittens.jpeg")} alt="Two kittens" />
        <Photo className="mine-photo mine-street" src={photo(15, "mine-street.jpeg")} alt="A night out together" />
        <Photo className="mine-photo mine-masks" src={photo(16, "mine-masks.jpeg")} alt="Matching face masks" />
        <Photo className="mine-photo mine-helmets" src={photo(17, "mine-helmets.jpeg")} alt="Motorbike helmets" />
      </>,
    },
    {
      layout: "ten-things things-one",
      content: <>
        <div className={c("portrait-frame")}><Photo src={photo(18, "things-portrait.jpeg")} alt="A portrait at a restaurant" /></div>
        <Photo className="tape tape-six" src={asset("washi-tape-horizontal.png")} alt="" />
        <div className={c("things-heading")}><span>10 THINGS</span><span>I LOVE</span><span>ABOUT</span><span>YOU</span></div>
        <Photo className="metal-number num-one" src={asset("number-1.png")} alt="1" />
        <p className={c("thing-copy thing-1")}>{renderLines("thing1", "I love the way you make even\nordinary days feel special.")}</p>
        <Photo className="metal-number num-two" src={asset("number-2.png")} alt="2" />
        <p className={c("thing-copy thing-2")}>{renderLines("thing2", "I love your smile because it\ninstantly brightens my day.")}</p>
        <Photo className="metal-number num-three" src={asset("number-3.png")} alt="3" />
        <p className={c("thing-copy thing-3")}>{renderLines("thing3", "I love the way you care for\neveryone around you.")}</p>
        <Photo className="metal-number num-four" src={asset("number-4.png")} alt="4" />
        <p className={c("thing-copy thing-4")}>{renderLines("thing4", "I love how safe, comfortable,\nand loved I feel with you.")}</p>
      </>,
    },
    {
      layout: "ten-things things-two",
      content: <>
        <Photo className="metal-number num-five" src={asset("number-5.png")} alt="5" />
        <p className={c("thing-copy thing-5")}>{renderLines("thing5", "I love your laugh\n—it never fails\nto make me smile.")}</p>
        <p className={c("thing-copy thing-6")}>{renderLines("thing6", "I love how you\nalways support and\nbelieve in me.")}</p>
        <Photo className="metal-number num-six" src={asset("number-6.png")} alt="6" />
        <div className={c("carousel-frame")}><Photo src={photo(19, "things-carousel.jpeg")} alt="A moment together on a carousel" /></div>
        <Photo className="tape tape-seven" src={asset("things-tape-horizontal.png")} alt="" />
        <Photo className="metal-number num-seven" src={asset("number-7.png")} alt="7" />
        <p className={c("thing-copy thing-7")}>{renderLines("thing7", "Our little moments we share that\nbecome my fav memories.")}</p>
        <p className={c("thing-copy thing-8")}>{renderLines("thing8", "I love that I can always be myself\nwhen I’m with you.")}</p>
        <Photo className="metal-number num-eight" src={asset("number-8.png")} alt="8" />
        <Photo className="metal-number num-nine" src={asset("number-9.png")} alt="9" />
        <p className={c("thing-copy thing-9")}>{renderLines("thing9", "I love the dreams and future\nwe’re building together.")}</p>
        <Photo className="metal-number num-one-ten" src={asset("number-1.png")} alt="1" />
        <Photo className="metal-number num-zero-ten" src={asset("number-0.png")} alt="0" />
        <p className={c("thing-copy thing-10")}>{renderLines("thing10", "Most of all, I love you exactly\nas you are, today and always.")}</p>
      </>,
    },
    {
      layout: "mine-cover",
      content: <>
        <div className={c("date-line")}>{text("mineCoverDate", "OCTOBER 2026")}</div>
        <div className={c("date-rule")} />
        <Photo src={photo(20, "mine-cover-reprise.jpeg")} alt="A couple embracing with a bouquet" />
        <div className={c("mine-cover-title")}>{text("mineCoverTitle", "MINE")}</div>
        <div className={c("mine-cover-subtitle")}>{text("mineCoverSubtitle", "N O W  &  A L W A Y S")}</div>
        <p className={c("mine-cover-note")}>{renderLines("mineCoverNote", "You make ordinary moments special.\nAnd every memory worth keeping.")}</p>
      </>,
    },
    {
      layout: "you-are-moment",
      content: <>
        <Photo className="moment-background" src={photo(21, "moment-background.jpeg")} alt="A warm restaurant scene" />
        <div className={c("polaroid-card")}>
          <Photo className="tape tape-moment-top" src={asset("torn-tape-horizontal.png")} alt="" />
          <div className={c("moment-grid")}>
            <Photo src={photo(22, "moment-white-shirt.jpeg")} alt="A person in a white shirt" />
            <Photo src={photo(23, "moment-flowers.jpeg")} alt="A bouquet of flowers" />
            <Photo src={photo(24, "moment-cat.jpeg")} alt="A quiet moment with a cat" />
            <Photo src={photo(25, "moment-plate.jpeg")} alt="A restaurant table" />
          </div>
          <div className={c("moment-caption")}>{text("momentCaption", "Y O U  A R E  T H E  M O M E N T.")}</div>
          <Photo className="tape tape-moment-bottom" src={asset("torn-tape-horizontal.png")} alt="" />
        </div>
      </>,
    },
    {
      layout: "darling",
      content: <>
        <div className={c("boyfriend-edition")}>{text("boyfriendEdition", "BOYFRIEND’S DAY EDITION")}</div>
        <Photo src={photo(26, "darling-couple.jpeg")} alt="A couple looking at each other" />
        <div className={c("darling-top darling-left")}>{renderLines("darlingLeft", "My forever\ncrush")}</div>
        <div className={c("darling-top darling-center")}>{text("darlingCenter", "You & I")}</div>
        <div className={c("darling-top darling-right")}>{renderLines("darlingRight", "2021-\nforever")}</div>
        <div className={c("darling-word")}>{text("darlingTitle", "DARLING")}</div>
      </>,
    },
    {
      layout: "forever-grateful",
      content: <>
        <Photo className="grateful-banner" src={photo(27, "grateful-top.jpeg")} alt="A tender moment together" />
        <div className={c("grateful-script")}>{text("gratefulTitle", "Forever Grateful")}</div>
        <p className={c("grateful-copy")}>{renderLines("gratefulCopy", "Forever grateful for the love we’ve found in each other, for every\nlaugh, every little moment, and every memory we’ve created\ntogether. Life feels a little brighter with you by my side, and I\nwouldn’t trade our story for anything. Here’s to everything we’ve\nbeen, everything we are, and all the beautiful moments still to come.")}</p>
        <Photo className="grateful-large" src={photo(28, "grateful-helmets.jpeg")} alt="A shared motorbike ride" />
        <Photo className="grateful-right grateful-top-right" src={photo(29, "grateful-jersey.jpeg")} alt="A playful moment outside" />
        <Photo className="grateful-right grateful-mid-right" src={photo(30, "grateful-masks.jpeg")} alt="A playful matching moment" />
        <Photo className="grateful-right grateful-bottom-right" src={photo(31, "grateful-shy.jpeg")} alt="A sweet candid moment" />
      </>,
    },
    {
      layout: "amour",
      content: <>
        <div className={c("amour-header")}><span />{text("amourHeader", "CHOOSING YOU, ALWAYS")}<span /></div>
        <div className={c("amour-title")}>{text("amourTitle", "AMOUR")}</div>
        <div className={c("amour-taglines")}>{renderLines("amourTaglines", "MY FAVOURITE KIND OF FOREVER.\nFOREVER THANKFUL FOR YOU.")}</div>
        <Photo src={photo(32, "amour-costume.jpeg")} alt="A person wearing a green monster hoodie" />
        <p className={c("amour-caption")}>{renderLines("amourCaption", "Forever grateful for the person who makes ordinary days feel\nspecial. Thank you for being my comfort, my happiness, and my\nfavourite part of so many memories. Whatever the future holds, I\nhope it has plenty of moments with you.")}</p>
      </>,
    },
    {
      layout: "precious-moments",
      content: <>
        <Photo className="memory-photo memory-top-left" src={photo(33, "memory-top-left.jpeg")} alt="A close candid portrait" />
        <Photo className="memory-photo memory-top-right" src={photo(34, "memory-top-right.jpeg")} alt="A restaurant portrait" />
        <Photo className="memory-photo memory-bottom-left" src={photo(35, "memory-bottom-left.jpeg")} alt="A smiling portrait" />
        <Photo className="memory-photo memory-bottom-right" src={photo(36, "memory-bottom-right.jpeg")} alt="A relaxed portrait" />
        <Photo className="memory-tear memory-tear-vertical" src={asset("memory-torn-paper.png")} alt="" />
        <Photo className="memory-tear memory-tear-horizontal" src={asset("memory-torn-paper.png")} alt="" />
        <Photo className="memory-note" src={asset("memory-sticky-note.png")} alt="Collecting precious moments" />
      </>,
    },
    {
      layout: "memories-together",
      content: <>
        <div className={c("memory-strip strip-one")}><Photo src={photo(37, "memories-cycling.jpeg")} alt="Riding bicycles together" /><span>{text("memoryStripOne", "m e m o r i e s")}</span></div>
        <div className={c("memory-strip strip-two")}><Photo src={photo(38, "memories-snow.jpeg")} alt="A snowy day together" /><span>{text("memoryStripTwo", "t o g e t h e r")}</span></div>
        <div className={c("memory-strip strip-three")}><Photo src={photo(39, "memories-karting.jpeg")} alt="Go-karting together" /><span>{text("memoryStripThree", "y o u & m e")}</span></div>
      </>,
    },
  ];

  const pages: MagazinePageContent[] = useMemo(() => [
    ...originalPages,
    {
      layout: "magazine-finale",
      content: <MagazineClosingPage data={data} showWatermark={showWatermark} />,
    },
  ], [data, showWatermark]);

  const goTo = (requestedPage: number, nextDirection: number) => {
    const bounded = Math.max(0, Math.min(TOTAL_PAGES - 1, requestedPage));
    if (bounded === page) return;
    setDirection(nextDirection);
    setPage(bounded);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(target.tagName))) return;
      if (event.key === "ArrowRight" || event.key === "PageDown" || (event.key === " " && !(target instanceof HTMLButtonElement))) {
        event.preventDefault();
        goTo(page + 1, 1);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goTo(page - 1, -1);
      } else if (event.key === "Home") {
        event.preventDefault();
        goTo(0, -1);
      } else if (event.key === "End") {
        event.preventDefault();
        goTo(TOTAL_PAGES - 1, 1);
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        void toggleFullscreen();
      }
    };
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [page]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await readerRef.current?.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      // Fullscreen is optional; page navigation remains available.
    }
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    pointerStart.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStart.current || pointerStart.current.id !== event.pointerId) return;
    const dx = event.clientX - pointerStart.current.x;
    const dy = event.clientY - pointerStart.current.y;
    pointerStart.current = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.25) goTo(page + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  };

  const progress = ((page + 1) / TOTAL_PAGES) * 100;
  const pageLabel = String(page + 1).padStart(2, "0");

  return (
    <div id="my-hero-magazine-reader" className={c(`reader ${isPreview ? "is-preview" : ""}`)} ref={readerRef}>
      <header className={c("reader-top")} aria-label="Magazine controls">
        <div className={c("page-count")} aria-live="polite">{pageLabel} <span>/</span> {String(TOTAL_PAGES).padStart(2, "0")}</div>
        <button className={c("icon-button fullscreen-button")} type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
          {isFullscreen ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v5H3M16 3v5h5M3 16h5v5M21 16h-5v5" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" /></svg>}
        </button>
      </header>

      <section className={c("stage")} aria-label="Magazine pages">
        <div className={c("page-shell")} ref={pageShellRef} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { pointerStart.current = null; }}>
          {pages.map((content, index) => {
            const active = index === page;
            const classes = ["mag-page", content.layout, active ? "active" : "", active && direction < 0 ? "turn-back" : ""].filter(Boolean).join(" ");
            return <article key={index} className={c(classes)} hidden={!active} aria-label={`Page ${index + 1}`} aria-hidden={!active}>{content.content}</article>;
          })}
        </div>
      </section>

      <footer className={c("reader-bottom")}>
        <button className={c("nav-button")} type="button" aria-label="Previous page" title="Previous page" disabled={page === 0} onClick={() => goTo(page - 1, -1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div className={c("progress-wrap")}>
          <div className={c("progress-track")} role="progressbar" aria-label="Magazine reading progress" aria-valuemin={1} aria-valuemax={TOTAL_PAGES} aria-valuenow={page + 1}><span style={{ width: `${progress}%` }} /></div>
          <nav className={c("page-dots")} aria-label="Choose a page">
            {pages.map((_, index) => <button key={index} type="button" className={c(`page-dot ${index === page ? "active" : ""}`)} aria-label={`Go to page ${index + 1}`} aria-current={index === page ? "page" : undefined} onClick={() => goTo(index, index < page ? -1 : 1)} />)}
          </nav>
        </div>
        <button className={c("nav-button")} type="button" aria-label="Next page" title="Next page" disabled={page === TOTAL_PAGES - 1} onClick={() => goTo(page + 1, 1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </footer>
      <div className={c("sr-only")} aria-live="polite">Page {page + 1} of {TOTAL_PAGES}</div>
    </div>
  );
}
