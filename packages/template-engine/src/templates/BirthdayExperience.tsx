import React, { useEffect, useRef, useState } from "react";
import "./birthday.css";
import catImage from "./assets/cat.png";

type Memory = {
  emoji?: string;
  title?: string;
  text?: string;
  image?: string;
};

type Letter = {
  title?: string;
  text?: string;
};

type TimelineItem = {
  title?: string;
  description?: string;
};

type Track = {
  title?: string;
  artist?: string;
  audio?: string;
};

type ConstellationMemory = {
  message?: string;
};

type Gift = {
  message?: string;
  correct?: boolean;
};

type FuturePlan = {
  title?: string;
  text?: string;
};

type BirthdayData = {
  name?: string;
  senderName?: string;
  subtitle?: string;

  balloonMemories?: Memory[];

  photos?: Array<
    | string
    | {
        image?: string;
        caption?: string;
      }
  >;

  letters?: Letter[];

  tracks?: Track[];

  timeline?: TimelineItem[];

  constellationMemories?: ConstellationMemory[];

  correctGifts?: Array<{
    message?: string;
  }>;

  wrongGifts?: Array<{
    message?: string;
  }>;

  giftFinalMessage?: string;

  gameTitle?: string;
  gameInstruction?: string;
  gameReward?: string;
  gameTarget?: number;

  wishMessage?: string;

  /* OUR MOVIE */
  movieEnabled?: boolean;
  movieTitle?: string;
  movieDescription?: string;
  movieVideo?: string;

  futurePlans?: FuturePlan[];

  finalTitle?: string;
  finalMessage?: string;
};

type BirthdayExperienceProps = {
  data: Record<string, unknown>;
  props?: Record<string, unknown>;
  theme?: Record<string, unknown>;
  isPreview?: boolean;
};

export function BirthdayExperience({
  data,
  isPreview = false,
}: BirthdayExperienceProps) {
  const birthday = data as BirthdayData;



  /* =========================================================
     GENERAL STATE
     ========================================================= */

  const [showIntro, setShowIntro] = useState(true);
  const [closingIntro, setClosingIntro] = useState(false);

  /* =========================================================
     MEMORY BALLOONS
     ========================================================= */

  const [activeMemory, setActiveMemory] = useState<number | null>(null);

  /* =========================================================
     LETTERS
     ========================================================= */

  const [openLetter, setOpenLetter] = useState<number | null>(null);

  const [typedLetter, setTypedLetter] = useState("");

  /* =========================================================
     GALLERY
     ========================================================= */

  const [activePhoto, setActivePhoto] = useState<number | null>(null);

  /* =========================================================
     MUSIC
     ========================================================= */

  const [currentTrack, setCurrentTrack] = useState(0);

  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  /* =========================================================
     TIMELINE
     ========================================================= */

  const [activeTimeline, setActiveTimeline] = useState<number | null>(null);

  const [timelineProgress, setTimelineProgress] = useState(0);

  const [currentTimelineStep, setCurrentTimelineStep] =
  useState(0);

  /* =========================================================
     CONSTELLATION
     ========================================================= */

  const [activeStar, setActiveStar] = useState<number | null>(null);

  /* =========================================================
     MYSTERY GIFTS
     ========================================================= */

  const [openedGifts, setOpenedGifts] = useState<number[]>([]);

  const [giftFinalOpen, setGiftFinalOpen] = useState(false);

  const [displayGifts, setDisplayGifts] = useState<Gift[]>([]);

  const [gameRunning, setGameRunning] = useState(false);

  const [gameScore, setGameScore] = useState(0);

  const [gameRound, setGameRound] = useState(0);

  const [gameFailed, setGameFailed] = useState(false);

  const [gameSuccess, setGameSuccess] = useState(false);

  const [fallingItems, setFallingItems] = useState<
    Array<{
      id: number;
      emoji: string;
      correct: boolean;
      left: number;
      duration: number;
      delay: number;
      size: number;
      rotation: number;
    }>
  >([]);

  const [blownCandles, setBlownCandles] = useState<number[]>([]);

  const [wishRevealed, setWishRevealed] = useState(false);

  const [unlockName, setUnlockName] = useState("");
  const [surpriseUnlocked, setSurpriseUnlocked] = useState(false);

  const [unlockError, setUnlockError] = useState("");

  const [activeFuturePlan, setActiveFuturePlan] = useState<number | null>(null);

  const gameTimerRef = useRef<number | null>(null);

  const spawnedHeartCount = useRef(0);

  const gameSpawnTimer = useRef<number | null>(null);

  /* =========================================================
     REFS
     ========================================================= */

  const carouselRef = useRef<HTMLDivElement | null>(null);

  const carouselRotation = useRef(0);

  const dragging = useRef(false);

  const lastX = useRef(0);

  const resumeTimer = useRef<number | null>(null);

  const timelineRef = useRef<HTMLElement | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* =========================================================
     BASIC DATA
     ========================================================= */

  const name = birthday.name || "PRINCESS";

  const introLines = (
    birthday.subtitle ||
    "Someone special has arrived...\nLoading memories...\nCollecting smiles...\nPreparing surprises...\nHAPPY BIRTHDAY"
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const introTitle =
    introLines.length > 0
      ? introLines[introLines.length - 1]
      : "HAPPY BIRTHDAY";

  const introMessages = introLines.length > 1 ? introLines.slice(0, -1) : [];

  const memories = birthday.balloonMemories ?? [];

  const photos = birthday.photos ?? [];

  const galleryItems = photos.map((photo) => {
    if (typeof photo === "string") {
      return {
        image: photo,
        caption: "",
      };
    }

    return {
      image: photo.image ?? "",
      caption: photo.caption ?? "",
    };
  });

  const letters = birthday.letters ?? [];

  const tracks = birthday.tracks ?? [];

  const timeline = birthday.timeline ?? [];

  const constellationMemories = birthday.constellationMemories ?? [];

  const correctGifts = birthday.correctGifts ?? [];

  const wrongGifts = birthday.wrongGifts ?? [];

  const gameEmojis = [
    { emoji: "❤️", correct: true },
    { emoji: "💖", correct: true },
    { emoji: "💗", correct: true },
    { emoji: "💘", correct: true },
    { emoji: "💕", correct: true },
    { emoji: "💞", correct: true },
    { emoji: "💝", correct: true },

    { emoji: "🧸", correct: false },
    { emoji: "🎀", correct: false },
    { emoji: "✨", correct: false },
    { emoji: "🌷", correct: false },
    { emoji: "🍓", correct: false },
  ];

  const gameTarget = Math.max(1, Number(birthday.gameTarget ?? 20));

  const totalCandles = 5;

  const futurePlans = birthday.futurePlans ?? [];

  /* =========================================================
     MUSIC PLAYER
     ========================================================= */

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !tracks.length) {
      return;
    }

    const track = tracks[currentTrack];

    if (!track?.audio) {
      return;
    }

    audio.src = track.audio;

    audio.load();
  }, [currentTrack, tracks]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !tracks.length) {
      return;
    }

    if (isMusicPlaying) {
      audio.play().catch(() => {
        setIsMusicPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [isMusicPlaying, tracks]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !tracks.length) {
      return;
    }

    function handleEnded() {
      setCurrentTrack((current) => {
        if (tracks.length <= 1) {
          return 0;
        }

        return (current + 1) % tracks.length;
      });

      setIsMusicPlaying(true);
    }

    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("ended", handleEnded);
    };
  }, [tracks.length]);

  function toggleMusic() {
    const audio = audioRef.current;

    if (!audio || !tracks.length) {
      return;
    }

    if (isMusicPlaying) {
      audio.pause();
      setIsMusicPlaying(false);
      return;
    }

    audio
      .play()
      .then(() => {
        setIsMusicPlaying(true);
      })
      .catch(() => {
        setIsMusicPlaying(false);
      });
  }

  function playTrack(index: number) {
    if (!tracks.length) {
      return;
    }

    const safeIndex = (index + tracks.length) % tracks.length;

    setCurrentTrack(safeIndex);

    setIsMusicPlaying(true);
  }

  function previousTrack() {
    playTrack(currentTrack - 1);
  }

  function nextTrack() {
    playTrack(currentTrack + 1);
  }

  /* =========================================================
     AUTOPLAY MUSIC ON PUBLIC WEBSITE
     ========================================================= */

  useEffect(() => {
    if (isPreview || tracks.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      const audio = audioRef.current;

      if (!audio || !tracks[0]?.audio) {
        return;
      }

      audio.src = tracks[0].audio;

      audio.load();

      audio
        .play()
        .then(() => {
          setIsMusicPlaying(true);
        })
        .catch(() => {
          setIsMusicPlaying(false);
        });
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isPreview, tracks]);

  /* =========================================================
     GALLERY ROTATION
     ========================================================= */

  useEffect(() => {
    const carousel = carouselRef.current;

    if (!carousel || galleryItems.length === 0) {
      return;
    }

    let frame = 0;

    const animate = () => {
      if (!dragging.current) {
        carouselRotation.current -= 0.16;
      }

      carousel.style.transform = `rotateY(${carouselRotation.current}deg)`;

      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);

      if (resumeTimer.current !== null) {
        window.clearTimeout(resumeTimer.current);
      }
    };
  }, [galleryItems.length]);

  function startCarouselDrag(clientX: number) {
    dragging.current = true;

    lastX.current = clientX;

    const carousel = carouselRef.current;

    if (carousel) {
      carousel.style.cursor = "grabbing";
    }

    if (resumeTimer.current !== null) {
      window.clearTimeout(resumeTimer.current);
    }
  }

  function moveCarouselDrag(clientX: number) {
    if (!dragging.current) {
      return;
    }

    const delta = clientX - lastX.current;

    carouselRotation.current += delta * 0.18;

    lastX.current = clientX;
  }

  function endCarouselDrag() {
    if (!dragging.current) {
      return;
    }

    dragging.current = false;

    const carousel = carouselRef.current;

    if (carousel) {
      carousel.style.cursor = "grab";
    }

    resumeTimer.current = window.setTimeout(() => {
      // Rotation resumes naturally.
    }, 1500);
  }

  /* =========================================================
     LETTER TYPING
     ========================================================= */

  useEffect(() => {
    if (openLetter === null) {
      setTypedLetter("");
      return;
    }

    const text = letters[openLetter]?.text ?? "";

    let index = 0;

    setTypedLetter("");

    const timer = window.setInterval(() => {
      index += 1;

      setTypedLetter(text.slice(0, index));

      if (index >= text.length) {
        window.clearInterval(timer);
      }
    }, 22);

    return () => {
      window.clearInterval(timer);
    };
  }, [openLetter, openLetter !== null ? letters[openLetter]?.text : ""]);

  /* =========================================================
     TIMELINE SCROLL
     ========================================================= */

  useEffect(() => {
    const section = timelineRef.current;

    if (!section) {
      return;
    }
    const timelineSection = section;

    /*
     * In the editor, .preview has its own scrollbar.
     * On the real/public website, the window is the scroller.
     */
    const previewScroller = section.closest(".preview") as HTMLElement | null;

    const scrollContainer =
      isPreview && previewScroller ? previewScroller : null;

    function updateTimeline() {
      const rect = timelineSection.getBoundingClientRect();

      const viewportHeight = scrollContainer
        ? scrollContainer.clientHeight
        : window.innerHeight;

      const sectionTop = scrollContainer
        ? rect.top - scrollContainer.getBoundingClientRect().top
        : rect.top;

      const total =
  timelineSection.offsetHeight + viewportHeight;

      const passed = viewportHeight - sectionTop;

      const progress = Math.max(0, Math.min(1, passed / total));

      setTimelineProgress(progress);

      const step =
  timeline.length <= 1
    ? 0
    : Math.min(
        timeline.length - 1,
        Math.round(
          progress *
            (timeline.length - 1),
        ),
      );

setCurrentTimelineStep(step);
    }

    updateTimeline();

    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", updateTimeline, {
        passive: true,
      });

      scrollContainer.addEventListener("resize", updateTimeline);
    } else {
      window.addEventListener("scroll", updateTimeline, { passive: true });

      window.addEventListener("resize", updateTimeline);
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", updateTimeline);

        scrollContainer.removeEventListener("resize", updateTimeline);
      } else {
        window.removeEventListener("scroll", updateTimeline);

        window.removeEventListener("resize", updateTimeline);
      }
    };
  }, [isPreview]);
  /* =========================================================
     MYSTERY GIFT DATA
     ========================================================= */

  const giftSource: Gift[] = [
    ...correctGifts.map((gift) => ({
      message: gift.message ?? "",
      correct: true,
    })),

    ...wrongGifts.map((gift) => ({
      message: gift.message ?? "",
      correct: false,
    })),
  ];

  /* =========================================================
     SHUFFLE GIFTS
     ========================================================= */

  useEffect(() => {
    const shuffled = [...giftSource];

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    setDisplayGifts(shuffled);

    // Reset the hunt whenever
    // the editor changes gift data.
    setOpenedGifts([]);

    setGiftFinalOpen(false);
  }, [JSON.stringify(correctGifts), JSON.stringify(wrongGifts)]);

  /* =========================================================
     GIFT COUNTERS
     ========================================================= */

  const totalCorrectGifts = displayGifts.filter(
    (gift) => gift.correct === true,
  ).length;

  const foundCorrectGifts = openedGifts.filter(
    (index) => displayGifts[index]?.correct === true,
  ).length;

  /* =========================================================
     OPEN GIFT
     ========================================================= */

  function openGift(index: number) {
    if (openedGifts.includes(index)) {
      return;
    }

    if (!displayGifts[index]) {
      return;
    }

    setOpenedGifts((current) => [...current, index]);
  }

  /* =========================================================
     FINAL GIFT SCREEN
     ========================================================= */

  function closeGiftFinal() {
    setGiftFinalOpen(false);
  }

  useEffect(() => {
    if (totalCorrectGifts > 0 && foundCorrectGifts === totalCorrectGifts) {
      const timer = window.setTimeout(() => {
        setGiftFinalOpen(true);
      }, 700);

      return () => {
        window.clearTimeout(timer);
      };
    }

    setGiftFinalOpen(false);
  }, [foundCorrectGifts, totalCorrectGifts]);

  const MAX_ACTIVE_ITEMS = 12;

  const HEARTS_TO_SPAWN = Math.max(30, gameTarget);

  function generateGameItem() {
    const heartEmojis = ["❤️", "💖", "💗", "💘", "💕", "💞", "💝"];

    const decoyEmojis = ["🧸", "🎀", "✨", "🌷", "🍓", "🌸", "⭐", "🦋", "🎁"];

    const heartsRemaining = HEARTS_TO_SPAWN - spawnedHeartCount.current;

    // Give hearts a high chance of appearing,
    // but continue mixing in decoys.
    const makeHeart = heartsRemaining > 0 && Math.random() < 0.68;

    if (makeHeart) {
      spawnedHeartCount.current += 1;

      const emoji = heartEmojis[Math.floor(Math.random() * heartEmojis.length)];

      return {
        id: Date.now() + Math.random(),

        emoji,

        correct: true,

        left: 3 + Math.random() * 92,

        duration: 4.5 + Math.random() * 2.5,

        delay: 0,

        size: 2.1 + Math.random() * 1.4,

        rotation: -20 + Math.random() * 40,
      };
    }

    const emoji = decoyEmojis[Math.floor(Math.random() * decoyEmojis.length)];

    return {
      id: Date.now() + Math.random(),

      emoji,

      correct: false,

      left: 3 + Math.random() * 92,

      duration: 4.5 + Math.random() * 2.5,

      delay: 0,

      size: 2.1 + Math.random() * 1.4,

      rotation: -20 + Math.random() * 40,
    };
  }

  function startHeartGame() {
    if (gameTimerRef.current !== null) {
      window.clearTimeout(gameTimerRef.current);
    }

    if (gameSpawnTimer.current !== null) {
      window.clearInterval(gameSpawnTimer.current);
    }

    setGameScore(0);
    setGameFailed(false);
    setGameSuccess(false);
    setGameRunning(true);
    setFallingItems([]);

    spawnedHeartCount.current = 0;

    setGameRound((value) => value + 1);

    /*
     * Continuously spawn falling items.
     * Only a limited number stay
     * visible simultaneously.
     */
    gameSpawnTimer.current = window.setInterval(() => {
      setFallingItems((current) => {
        if (current.length >= MAX_ACTIVE_ITEMS) {
          return current;
        }

        return [...current, generateGameItem()];
      });
    }, 350);

    /*
     * End the round after 25 seconds.
     */
    gameTimerRef.current = window.setTimeout(() => {
      if (gameSpawnTimer.current !== null) {
        window.clearInterval(gameSpawnTimer.current);
      }

      setGameRunning(false);

      setFallingItems((current) => current);

      setGameFailed(true);
    }, 25000);
  }

  function catchGameItem(itemId: number) {
    if (!gameRunning) {
      return;
    }

    const item = fallingItems.find((value) => value.id === itemId);

    if (!item) {
      return;
    }

    setFallingItems((items) => items.filter((value) => value.id !== itemId));

    if (!item.correct) {
      return;
    }

    setGameScore((score) => {
      const nextScore = score + 1;

      if (nextScore >= gameTarget) {
        setGameRunning(false);
        setGameSuccess(true);

        if (gameTimerRef.current !== null) {
          window.clearTimeout(gameTimerRef.current);
        }
      }

      return nextScore;
    });
  }

  function retryHeartGame() {
    setGameFailed(false);
    setGameSuccess(false);
    setGameScore(0);

    startHeartGame();
  }

  function blowCandle(index: number) {
    if (blownCandles.includes(index)) {
      return;
    }

    const nextBlown = [...blownCandles, index];

    setBlownCandles(nextBlown);

    if (nextBlown.length === totalCandles) {
      window.setTimeout(() => {
        setWishRevealed(true);
      }, 500);
    }
  }

  function normalizeUnlockName(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function unlockSurprise() {
  const enteredName = normalizeUnlockName(unlockName);
  const correctName = normalizeUnlockName(birthday.name || "");

  if (!enteredName) {
    setUnlockError("Type the name first ❤️");
    return;
  }

  if (enteredName === correctName) {
    setUnlockError("");
    setSurpriseUnlocked(true);
    return;
  }

  setUnlockError("Hmm... that's not the name I'm looking for 💕");
}

  useEffect(() => {
    return () => {
      if (gameTimerRef.current !== null) {
        window.clearTimeout(gameTimerRef.current);
      }

      if (gameSpawnTimer.current !== null) {
        window.clearInterval(gameSpawnTimer.current);
      }
    };
  }, []);
  useEffect(() => {
    if (!gameRunning) {
      return;
    }

    const cleanup = window.setInterval(() => {
      setFallingItems((current) =>
        current.slice(Math.max(0, current.length - 12)),
      );
    }, 9000);

    return () => {
      window.clearInterval(cleanup);
    };
  }, [gameRunning]);

  /* =========================================================
     CINEMATIC INTRO
     ========================================================= */

  useEffect(() => {
    if (isPreview) {
      setShowIntro(true);
      setClosingIntro(false);
      return;
    }

    const closeTimer = window.setTimeout(() => {
      setClosingIntro(true);
    }, 5800);

    const removeTimer = window.setTimeout(() => {
      setShowIntro(false);
    }, 7000);

    return () => {
      window.clearTimeout(closeTimer);

      window.clearTimeout(removeTimer);
    };
  }, [isPreview]);

  /* =========================================================
     PAGE
     ========================================================= */

  return (
    <div
      className={`birthday-experience ${isPreview ? "is-editor-preview" : ""}`}
    >
      {/* ======================================================
          CINEMATIC INTRO
         ====================================================== */}

      {showIntro && (
        <section
          className={`birthday-cinematic-intro ${
            closingIntro ? "is-closing" : ""
          }`}
        >
          <div className="birthday-stars" />

          <div className="birthday-cinematic-overlay" />

          <div className="birthday-cinematic-content">
            {introMessages.map((line, index) => (
              <p key={`${line}-${index}`} className="birthday-typewriter-line">
                {line}
              </p>
            ))}

            <h1 className="birthday-welcome-title">
              {introTitle}
              {", "}
              {name.toUpperCase()}

              <span className="birthday-welcome-heart">❤️</span>
            </h1>
          </div>
        </section>
      )}

      {/* ======================================================
          MAIN BIRTHDAY WEBSITE
         ====================================================== */}

      <main className="birthday-template">
        {/* ====================================================
            MEMORY BALLOONS
           ==================================================== */}

        <section className="birthday-memories">
          <div className="birthday-memory-heading">
            <h2>Memory Balloons</h2>

            <p>Click each balloon to reveal a hidden memory ❤️</p>
          </div>

          <div className="birthday-balloons">
            {memories.slice(0, 5).map((memory, index) => (
              <button
                key={index}
                type="button"
                className={`birthday-balloon balloon-${index + 1}`}
                onClick={() => setActiveMemory(index)}
                aria-label={memory.title || `Open memory ${index + 1}`}
              >
                <span className="birthday-balloon-shape">
                  <span className="birthday-balloon-highlight" />

                  <span className="birthday-balloon-emoji">
                    {memory.emoji ?? "❤️"}
                  </span>
                </span>

                <span className="birthday-balloon-string" />
              </button>
            ))}
          </div>

          {/* MEMORY REVEAL */}

          {activeMemory !== null && memories[activeMemory] && (
            <div className="birthday-memory-overlay">
              <article className="birthday-memory-reveal">
                <button
                  type="button"
                  className="birthday-memory-close"
                  onClick={() => setActiveMemory(null)}
                  aria-label="Close memory"
                >
                  ×
                </button>

                <div className="birthday-memory-photo">
                  {memories[activeMemory].image ? (
                    <img
                      src={memories[activeMemory].image}
                      alt={memories[activeMemory].title || "Birthday memory"}
                    />
                  ) : (
                    <div className="birthday-memory-photo-empty">
                      {memories[activeMemory].emoji ?? "❤️"}
                    </div>
                  )}
                </div>

                <div className="birthday-memory-content">
                  <div className="birthday-memory-icon">
                    {memories[activeMemory].emoji ?? "❤️"}
                  </div>

                  <h3>
                    {memories[activeMemory].title || "A beautiful memory"}
                  </h3>

                  <p>
                    {memories[activeMemory].text ||
                      "A special memory waiting to be remembered forever."}
                  </p>
                </div>
              </article>
            </div>
          )}
        </section>

        {/* ====================================================
            3D MEMORY GALLERY
           ==================================================== */}

        <section className="birthday-gallery">
          <div className="birthday-gallery-heading">
            <h2>Our Gallery</h2>

            <p>Drag to explore our memories ✨</p>
          </div>

          {galleryItems.some((item) => item.image) ? (
            <>
              <div
                className="birthday-carousel-wrapper"
                onMouseDown={(e) => startCarouselDrag(e.clientX)}
                onMouseMove={(e) => moveCarouselDrag(e.clientX)}
                onMouseUp={endCarouselDrag}
                onMouseLeave={endCarouselDrag}
                onTouchStart={(e) => startCarouselDrag(e.touches[0].clientX)}
                onTouchMove={(e) => moveCarouselDrag(e.touches[0].clientX)}
                onTouchEnd={endCarouselDrag}
              >
                <div ref={carouselRef} className="birthday-carousel-3d">
                  {galleryItems.map((item, index) => {
                    if (!item.image) {
                      return null;
                    }

                    const visibleItems = galleryItems.filter(
                      (galleryItem) => galleryItem.image,
                    );

                    const visibleIndex = visibleItems.findIndex(
                      (galleryItem) => galleryItem === item,
                    );

                    const count = visibleItems.length;

                    const angle = count > 0 ? (360 / count) * visibleIndex : 0;

                    const radius = window.innerWidth < 768 ? 180 : 320;

                    return (
                      <button
                        key={`${item.image}-${index}`}
                        type="button"
                        className="birthday-carousel-item"
                        style={{
                          transform: `rotateY(${angle}deg) translateZ(${radius}px) translate(-50%, -50%)`,
                        }}
                        onClick={() => {
                          if (!dragging.current) {
                            setActivePhoto(index);
                          }
                        }}
                      >
                        <div className="birthday-polaroid">
                          <div className="birthday-polaroid-img">
                            <img
                              src={item.image}
                              alt={item.caption || `Memory ${index + 1}`}
                              draggable={false}
                              loading="lazy"
                            />
                          </div>

                          <span className="birthday-polaroid-label">
                            {item.caption || `Memory ${index + 1}`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="birthday-carousel-caption">
                Drag to explore your memories
              </p>

              {/* PHOTO MODAL */}

              {activePhoto !== null && galleryItems[activePhoto]?.image && (
                <div
                  className="birthday-photo-modal"
                  role="dialog"
                  aria-modal="true"
                  onClick={() => setActivePhoto(null)}
                >
                  <div
                    className="birthday-photo-modal-card"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="birthday-photo-modal-close"
                      onClick={() => setActivePhoto(null)}
                      aria-label="Close photo"
                    >
                      ×
                    </button>

                    <div className="birthday-photo-modal-image">
                      <img
                        src={galleryItems[activePhoto].image}
                        alt={
                          galleryItems[activePhoto].caption ||
                          `Memory ${activePhoto + 1}`
                        }
                      />
                    </div>

                    <div className="birthday-photo-modal-content">
                      <span>Memory {activePhoto + 1}</span>

                      <h3>
                        {galleryItems[activePhoto].caption ||
                          `Memory ${activePhoto + 1}`}
                      </h3>

                      <p>A moment worth keeping forever ❤️</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="birthday-gallery-empty">
              <span>📸</span>

              <p>Add your memories from the editor to fill this gallery.</p>
            </div>
          )}
        </section>

        {/* ====================================================
            LOVE LETTERS
           ==================================================== */}

        <section className="birthday-letters">
          <div className="birthday-letters-heading">
            <h2>Letters For You</h2>

            <p>Click an envelope to open ❤️</p>
          </div>

          {letters.length > 0 ? (
            <div className="birthday-envelopes-container">
              {letters.map((letter, index) => (
                <button
                  key={index}
                  type="button"
                  className={`birthday-envelope birthday-envelope-${
                    (index % 5) + 1
                  }`}
                  onClick={() => setOpenLetter(index)}
                  aria-label={letter.title || `Open letter ${index + 1}`}
                >
                  <span className="birthday-envelope-body">
                    <span className="birthday-envelope-flap" />

                    <span className="birthday-envelope-seal">♥</span>

                    <span className="birthday-envelope-label">
                      {letter.title || "A Letter For You"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="birthday-empty">Add letters from the editor.</p>
          )}

          {/* LETTER MODAL */}

          {openLetter !== null && letters[openLetter] && (
            <div
              className="birthday-letter-modal"
              role="dialog"
              aria-modal="true"
              onClick={() => setOpenLetter(null)}
            >
              <article
                className="birthday-letter-paper"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="birthday-letter-close"
                  onClick={() => setOpenLetter(null)}
                  aria-label="Close letter"
                >
                  ×
                </button>

                <div className="birthday-letter-ribbon">
                  <span>♥</span>
                </div>

                <div className="birthday-letter-inner">
                  <p className="birthday-letter-title">
                    {letters[openLetter].title || "A Letter For You"}
                  </p>

                  <div className="birthday-letter-content" aria-live="polite">
                    {typedLetter}

                    {typedLetter.length <
                      (letters[openLetter].text ?? "").length && (
                      <span className="birthday-letter-cursor">|</span>
                    )}
                  </div>
                </div>
              </article>
            </div>
          )}
        </section>

        {/* ====================================================
            MUSIC PLAYER
           ==================================================== */}

        {tracks.length > 0 && (
          <section className="birthday-music">
            <div className="birthday-music-player">
              <div
                className={`birthday-vinyl ${
                  isMusicPlaying ? "is-spinning" : ""
                }`}
              >
                <div className="birthday-vinyl-inner" />
                <div className="birthday-vinyl-center" />
              </div>

              <div className="birthday-music-info">
                <h2>{tracks[currentTrack]?.title || "Birthday Serenade"}</h2>

                <p>{tracks[currentTrack]?.artist || "A melody just for you"}</p>

                <div className="birthday-music-controls">
                  <button
                    type="button"
                    className="birthday-music-btn"
                    onClick={previousTrack}
                    aria-label="Previous song"
                  >
                    ⏮
                  </button>

                  <button
                    type="button"
                    className="birthday-music-btn birthday-music-play"
                    onClick={toggleMusic}
                    aria-label={isMusicPlaying ? "Pause music" : "Play music"}
                  >
                    {isMusicPlaying ? "⏸" : "▶"}
                  </button>

                  <button
                    type="button"
                    className="birthday-music-btn"
                    onClick={nextTrack}
                    aria-label="Next song"
                  >
                    ⏭
                  </button>
                </div>

                <div
                  className={`birthday-equalizer ${
                    isMusicPlaying ? "" : "is-paused"
                  }`}
                  aria-hidden="true"
                >
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>

              <div className="birthday-playlist">
                {tracks.slice(0, 3).map((track, index) => (
                  <button
                    key={`${track.title}-${index}`}
                    type="button"
                    className={`birthday-playlist-item ${
                      currentTrack === index ? "is-active" : ""
                    }`}
                    onClick={() => playTrack(index)}
                  >
                    <span className="birthday-track-number">{index + 1}</span>

                    <span className="birthday-track-details">
                      <strong>{track.title || `Track ${index + 1}`}</strong>

                      {track.artist && <em>{track.artist}</em>}
                    </span>

                    <span className="birthday-track-state">
                      {currentTrack === index && isMusicPlaying ? "♪" : "›"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="birthday-floating-notes" aria-hidden="true">
              <span>♪</span>
              <span>♫</span>
              <span>♩</span>
              <span>♬</span>
              <span>♪</span>
              <span>♫</span>
              <span>♬</span>
              <span>♩</span>
            </div>

            <audio
              ref={audioRef}
              preload="auto"
              onPlay={() => setIsMusicPlaying(true)}
              onPause={() => setIsMusicPlaying(false)}
            />
          </section>
        )}

        {/* ====================================================
            OUR STORY
           ==================================================== */}

        {timeline.length > 0 && (
          <section ref={timelineRef} className="birthday-timeline">
            <div className="birthday-timeline-heading">
              <h2>Our Story</h2>

              <p>A journey worth remembering ✨</p>
            </div>

            <div className="birthday-timeline-wrapper">
              <div className="birthday-timeline-line">
                <div
                  className="birthday-timeline-progress"
                  style={{
                    height: `${timelineProgress * 100}%`,
                  }}
                />
              </div>

              <div
                className="birthday-timeline-arrow"
                style={{
                  top: `${Math.min(96, Math.max(4, timelineProgress * 100))}%`,
                }}
              >
                ↓
              </div>

              <div className="birthday-timeline-items">
                {timeline.map((item, index) => {
                  const isOpen = activeTimeline === index;

                  const storyProgress =
                    timeline.length > 1 ? index / (timeline.length - 1) : 0;

                  const isReached =
  index <= currentTimelineStep;

                  return (
                    <article
                      key={index}
                      className={`birthday-timeline-story ${
  index % 2 === 0
    ? "timeline-left"
    : "timeline-right"
} ${
  isReached
    ? "is-reached"
    : ""
} ${
  currentTimelineStep === index
    ? "is-current"
    : ""
} ${
  isOpen
    ? "is-open"
    : ""
}`}
                    >
                      <button
                        type="button"
                        className="birthday-timeline-dot"
                        onClick={() => setActiveTimeline(isOpen ? null : index)}
                        aria-expanded={isOpen}
                        aria-label={`Open ${
                          item.title || `story ${index + 1}`
                        }`}
                      >
                        <span />
                      </button>

                      <button
                        type="button"
                        className="birthday-timeline-card"
                        onClick={() => setActiveTimeline(isOpen ? null : index)}
                        aria-expanded={isOpen}
                      >
                        <span className="birthday-timeline-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>

                        <h3>{item.title || "A Beautiful Moment"}</h3>

                        <span className="birthday-timeline-toggle">
                          {isOpen ? "−" : "+"}
                        </span>

                        {isOpen && (
                          <div className="birthday-timeline-story-text">
                            <p>
                              {item.description ||
                                "Write the story behind this moment."}
                            </p>
                          </div>
                        )}
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ====================================================
            CONSTELLATION
           ==================================================== */}

        {constellationMemories.length > 0 && (
          <section className="birthday-constellation">
            <div className="birthday-constellation-heading">
              <h2>Our Constellation</h2>

              <p>Click the stars to unlock little memories ⭐</p>
            </div>

            <div className="birthday-constellation-sky">
              <svg
                className="birthday-constellation-lines"
                viewBox="0 0 1000 600"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <line x1="120" y1="170" x2="280" y2="95" />

                <line x1="280" y1="95" x2="470" y2="180" />

                <line x1="470" y1="180" x2="640" y2="90" />

                <line x1="640" y1="90" x2="830" y2="190" />

                <line x1="470" y1="180" x2="430" y2="350" />

                <line x1="430" y1="350" x2="650" y2="420" />

                <line x1="650" y1="420" x2="830" y2="330" />

                <line x1="280" y1="95" x2="220" y2="290" />

                <line x1="220" y1="290" x2="430" y2="350" />
              </svg>

              {constellationMemories.slice(0, 9).map((memory, index) => {
                const positions = [
                  {
                    left: "12%",
                    top: "28%",
                  },
                  {
                    left: "28%",
                    top: "12%",
                  },
                  {
                    left: "47%",
                    top: "30%",
                  },
                  {
                    left: "64%",
                    top: "12%",
                  },
                  {
                    left: "83%",
                    top: "31%",
                  },
                  {
                    left: "43%",
                    top: "58%",
                  },
                  {
                    left: "65%",
                    top: "70%",
                  },
                  {
                    left: "83%",
                    top: "55%",
                  },
                  {
                    left: "22%",
                    top: "48%",
                  },
                ];

                const position = positions[index];

                const isActive = activeStar === index;

                return (
                  <button
                    key={index}
                    type="button"
                    className={`birthday-constellation-star ${
                      isActive ? "is-active" : ""
                    }`}
                    style={{
                      left: position.left,
                      top: position.top,
                    }}
                    onClick={() => setActiveStar(isActive ? null : index)}
                    aria-label={memory.message || `Star ${index + 1}`}
                    aria-expanded={isActive}
                  >
                    <span className="birthday-star-glow" />

                    <span className="birthday-star-core" />
                  </button>
                );
              })}

              <span
                className="birthday-constellation-mini-star"
                style={{
                  left: "8%",
                  top: "70%",
                }}
              >
                ✦
              </span>

              <span
                className="birthday-constellation-mini-star"
                style={{
                  left: "54%",
                  top: "12%",
                }}
              >
                ✦
              </span>

              <span
                className="birthday-constellation-mini-star"
                style={{
                  left: "92%",
                  top: "72%",
                }}
              >
                ✦
              </span>

              <span
                className="birthday-constellation-mini-star"
                style={{
                  left: "35%",
                  top: "78%",
                }}
              >
                ✦
              </span>
            </div>

            {/* STAR MESSAGE */}

            {activeStar !== null && constellationMemories[activeStar] && (
              <div
                className="birthday-star-message-overlay"
                role="dialog"
                aria-modal="true"
                onClick={() => setActiveStar(null)}
              >
                <article
                  className="birthday-star-message"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="birthday-star-message-close"
                    onClick={() => setActiveStar(null)}
                    aria-label="Close star memory"
                  >
                    ×
                  </button>

                  <div className="birthday-star-message-icon">★</div>

                  <p>A little memory from the stars</p>

                  <h3>
                    {constellationMemories[activeStar].message ||
                      "A beautiful memory written in the stars."}
                  </h3>
                </article>
              </div>
            )}
          </section>
        )}

        {/* ====================================================
            MYSTERY GIFTS
           ==================================================== */}

        {displayGifts.length > 0 && (
          <section className="birthday-gifts">
            <div className="birthday-gifts-heading">
              <h2>Mystery Gifts</h2>

              <p>Find the special gifts meant just for you 🎁</p>
            </div>

            <div className="birthday-gift-progress">
              <strong>{foundCorrectGifts}</strong>

              <span> / {totalCorrectGifts} gifts found</span>
            </div>

            <div className="birthday-gifts-area">
              {displayGifts.map((gift, index) => {
                const opened = openedGifts.includes(index);

                const total = displayGifts.length;

                const columns = Math.min(
                  5,
                  Math.max(2, Math.ceil(Math.sqrt(total))),
                );

                const row = Math.floor(index / columns);

                const column = index % columns;

                const rows = Math.ceil(total / columns);

                const left = `${((column + 0.5) / columns) * 100}%`;

                const top =
                  rows === 1
                    ? "45%"
                    : `${20 + (row / Math.max(rows - 1, 1)) * 55}%`;

                return (
                  <button
                    key={`${gift.message}-${index}`}
                    type="button"
                    className={`birthday-mystery-gift ${
                      opened ? "is-opened" : ""
                    }`}
                    style={{
                      left,
                      top,
                    }}
                    onClick={() => openGift(index)}
                    disabled={opened}
                    aria-label={
                      opened ? "Opened gift" : `Mystery gift ${index + 1}`
                    }
                  >
                    <span className="birthday-gift-box">
                      <span className="birthday-gift-lid" />

                      <span className="birthday-gift-body">
                        <span>🎁</span>
                      </span>
                    </span>

                    {opened && (
                      <span
                        className={`birthday-gift-result ${
                          gift.correct ? "is-correct" : "is-wrong"
                        }`}
                      >
                        {gift.message ||
                          (gift.correct
                            ? "You found the right one! ❤️"
                            : "Not this one 😭")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="birthday-gift-hint">
              {foundCorrectGifts < totalCorrectGifts
                ? "Keep searching... ✨"
                : "You found them all ❤️"}
            </p>

            {/* FINAL SURPRISE */}

            {giftFinalOpen && (
              <div
                className="birthday-gift-final-overlay"
                role="dialog"
                aria-modal="true"
                onClick={closeGiftFinal}
              >
                <article
                  className="birthday-gift-final-card"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="birthday-gift-final-close"
                    onClick={closeGiftFinal}
                    aria-label="Close surprise"
                  >
                    ×
                  </button>

                  <div className="birthday-gift-final-icon">🎁</div>

                  <h2>You Found Them All ❤️</h2>

                  <p className="birthday-gift-final-message">
                    {birthday.giftFinalMessage ||
                      "Happy Birthday! Thank you for existing. I love you ❤️"}
                  </p>
                </article>
              </div>
            )}
          </section>
        )}

        {/* ====================================================
            MINI GAME
           ==================================================== */}

        {birthday.gameTitle && (
          <section className="birthday-game">
            <div className="birthday-game-heading">
              <h2>{birthday.gameTitle || "Catch My Heart ❤️"}</h2>

              <p>
                {birthday.gameInstruction ||
                  "Catch the falling hearts before time runs out."}
              </p>
            </div>

            {!gameRunning && !gameFailed && !gameSuccess && (
              <div className="birthday-game-start-card">
                <div className="birthday-game-heart-icon">❤️</div>

                <h3>Catch My Heart</h3>

                <p>
                  Catch <strong>{gameTarget}</strong> hearts to unlock a little
                  surprise.
                </p>

                <button
                  type="button"
                  className="birthday-game-start-btn"
                  onClick={startHeartGame}
                >
                  Start ❤️
                </button>
              </div>
            )}

            {(gameRunning || gameScore > 0) && (
              <div className="birthday-game-score">
                <span>Hearts Caught</span>

                <strong>
                  {gameScore}
                  <small>/{gameTarget}</small>
                </strong>
              </div>
            )}

            {gameRunning && (
              <div key={gameRound} className="birthday-game-area">
                {fallingItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="birthday-falling-heart"
                    style={{
                      left: `${item.left}%`,
                      animationDuration: `${item.duration}s`,
                      animationDelay: `${item.delay}s`,
                      fontSize: `${item.size}rem`,
                      transform: `rotate(${item.rotation}deg)`,
                    }}
                    onAnimationEnd={() => {
                      setFallingItems((current) =>
                        current.filter((value) => value.id !== item.id),
                      );
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();

                      catchGameItem(item.id);
                    }}
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
            )}

            {gameFailed && (
              <div
                className="birthday-game-overlay"
                role="dialog"
                aria-modal="true"
              >
                <div className="birthday-game-result-card">
                  <div className="birthday-game-result-icon">🥺💖</div>

                  <h3>Almost there...</h3>

                  <p>
                    You caught <strong>{gameScore}</strong> out of{" "}
                    <strong>{gameTarget}</strong> hearts.
                  </p>

                  <p>Want to try once again? 💕</p>

                  <button
                    type="button"
                    className="birthday-game-retry-btn"
                    onClick={retryHeartGame}
                  >
                    Try Again ❤️
                  </button>
                </div>
              </div>
            )}

            {gameSuccess && (
              <div
                className="birthday-game-overlay"
                role="dialog"
                aria-modal="true"
              >
                <div className="birthday-game-result-card">
                  <button
                    type="button"
                    className="birthday-game-close"
                    onClick={() => setGameSuccess(false)}
                    aria-label="Close surprise"
                  >
                    ×
                  </button>

                  <div className="birthday-game-result-icon">💖</div>

                  <h3>You Caught My Heart ❤️</h3>

                  <p>
                    {birthday.gameReward ||
                      "You found all the love I was hiding for you."}
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ====================================================
    MAKE A WISH
   ==================================================== */}

        <section className="birthday-wish">
          <div className="birthday-wish-heading">
            <p className="birthday-wish-eyebrow">A little birthday magic</p>

            <h2>Happy Birthday, {name} ❤️</h2>

            <p>Make a wish and Click On every candle to blow out ✨</p>
          </div>

          <div className="birthday-vintage-cake-scene">
            {/* Cake shadow */}

            <div className="birthday-cake-shadow" />

            {/* Cake */}

            <div className="birthday-vintage-cake">
              {/* Candles */}

              <div className="birthday-candles">
                {Array.from({ length: totalCandles }, (_, index) => {
                  const blown = blownCandles.includes(index);

                  return (
                    <button
                      key={index}
                      type="button"
                      className={`birthday-candle ${blown ? "is-blown" : ""}`}
                      onClick={() => blowCandle(index)}
                      aria-label={
                        blown
                          ? `Candle ${index + 1} blown out`
                          : `Blow out candle ${index + 1}`
                      }
                    >
                      <span className="birthday-candle-stick" />

                      {!blown && (
                        <span className="birthday-candle-flame">
                          <span className="birthday-candle-flame-inner" />
                        </span>
                      )}

                      {blown && (
                        <span className="birthday-candle-smoke">
                          <i />
                          <i />
                          <i />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Top frosting */}

              <div className="birthday-cake-top">
                <div className="birthday-cake-cream">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>

              {/* Middle cake */}

              <div className="birthday-cake-layer birthday-cake-layer-top">
                <span className="birthday-cake-decoration" />
                <span className="birthday-cake-decoration" />
                <span className="birthday-cake-decoration" />
              </div>

              {/* Lower cake */}

              <div className="birthday-cake-layer birthday-cake-layer-bottom">
                <span className="birthday-cake-decoration" />
                <span className="birthday-cake-decoration" />
                <span className="birthday-cake-decoration" />
                <span className="birthday-cake-decoration" />
              </div>

              {/* Cake plate */}

              <div className="birthday-cake-plate" />
            </div>
          </div>

          <p className="birthday-candle-hint">
            {wishRevealed
              ? "Wish granted ✨"
              : `${totalCandles - blownCandles.length} candles remaining`}
          </p>

          {/* ==================================================
      WISH REVEAL
     ================================================== */}

          {wishRevealed && (
            <div className="birthday-wish-reveal">
              <div className="birthday-wish-sparkle">✨</div>

              <h3>Your Wish ❤️</h3>

              <p>
                {birthday.wishMessage ||
                  "May every beautiful dream in your heart come true."}
              </p>
            </div>
          )}
        </section>

        {/* ====================================================
    OUR MOVIE
   ==================================================== */}

{birthday.movieEnabled &&
  birthday.movieVideo && (
    <section className="birthday-movie">

      <div className="birthday-movie-heading">

        <p>
          A little piece of us
        </p>

        <h2>
          {birthday.movieTitle ||
            "Our Movie 🎬"}
        </h2>

        <span>
          {birthday.movieDescription ||
            "A little movie made from our beautiful memories ❤️"}
        </span>

      </div>


      <div className="birthday-movie-frame">

        <video
          controls
          playsInline
          preload="metadata"
          src={
            birthday.movieVideo
          }
        />

      </div>


      <p className="birthday-movie-hint">
        Sit back and relive the memories ❤️
      </p>

    </section>
)}

        {/* ====================================================
    ONE LAST SURPRISE + FUTURE PLANS
   ==================================================== */}

        <section className="birthday-last-surprise">
          {!surpriseUnlocked ? (
            <div className="birthday-unlock-screen">
              <div className="birthday-cat-wrap">
                <img
                  src={catImage}
                  alt="Cute cat"
                  className="birthday-unlock-cat"
                />
              </div>

              <p className="birthday-unlock-eyebrow">One Last Surprise</p>

              <h2>A little secret is waiting for you ❤️</h2>

              <p className="birthday-unlock-instruction">
                Type your name to unlock the surprise.
              </p>

              <div className="birthday-name-unlock">
                <input
                  value={unlockName}
                  onChange={(e) => {
                    setUnlockName(e.target.value);
                    setUnlockError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      unlockSurprise();
                    }
                  }}
                  placeholder="Type your name..."
                  autoComplete="off"
                />

                <button type="button" onClick={unlockSurprise}>
                  Unlock Surprise ❤️
                </button>
              </div>

              {unlockError && (
                <p className="birthday-unlock-error">{unlockError}</p>
              )}
            </div>
          ) : (
            <>
              {/* ==========================================
          UNLOCKED SURPRISE
         ========================================== */}

              <div className="birthday-unlocked-surprise">
                <div className="birthday-unlocked-cat-wrap">
                  <img
                    src={catImage}
                    alt="Cute cat"
                    className="birthday-unlocked-cat"
                  />
                </div>

                <p className="birthday-unlock-eyebrow">You found it ✨</p>

                <h2>{birthday.finalTitle || "One Last Surprise"}</h2>

                <p className="birthday-final-message">
                  {birthday.finalMessage ||
                    "You are one of the most beautiful parts of my life. ❤️"}
                </p>

                {birthday.senderName && (
                  <span className="birthday-final-sender">
                    With love,
                    <br />
                    {birthday.senderName}
                  </span>
                )}
              </div>

              {/* ==========================================
          FUTURE PLANS
         ========================================== */}

              {futurePlans.length > 0 && (
                <section className="birthday-future-plans">
                  <div className="birthday-future-heading">
                    <p>And this is only the beginning...</p>

                    <h2>Our Future Plans</h2>

                    <span>Three little dreams for us ❤️</span>
                  </div>

                  <div className="birthday-future-grid">
                    {futurePlans.slice(0, 3).map((plan, index) => {
                      const isOpen = activeFuturePlan === index;

                      return (
                        <button
                          key={index}
                          type="button"
                          className={`birthday-future-card ${
                            isOpen ? "is-open" : ""
                          }`}
                          onClick={() =>
                            setActiveFuturePlan(isOpen ? null : index)
                          }
                          aria-expanded={isOpen}
                        >
                          <span className="birthday-future-number">
                            {String(index + 1).padStart(2, "0")}
                          </span>

                          <span className="birthday-future-icon">
                            {index === 0 ? "🌙" : index === 1 ? "✈️" : "🏡"}
                          </span>

                          <span className="birthday-future-card-title">
                            {plan.title || `Dream ${index + 1}`}
                          </span>

                          <span className="birthday-future-toggle">
                            {isOpen ? "−" : "+"}
                          </span>

                          {isOpen && (
                            <span className="birthday-future-inner">
                              {plan.text ||
                                "A beautiful future memory waiting for us."}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
