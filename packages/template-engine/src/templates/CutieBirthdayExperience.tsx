import { useEffect, useRef, useState } from "react";
import cutieGrey from "./assets/cutie-grey.png";
import cutiePink from "./assets/cutie-pink.png";
import "./cutie-birthday.css";

type CutieBirthdayData = {
  recipientName?: string;
  greetingMessage?: string;
  letterMessage?: string;
  senderName?: string;
};

type CutieBirthdayExperienceProps = {
  data: Record<string, unknown>;
};

const sceneLabels = ["Greeting", "Envelope", "Cake", "Message", "Letter", "Ending"];

export function CutieBirthdayExperience({
  data,
}: CutieBirthdayExperienceProps) {
  const birthday = data as CutieBirthdayData;
  const recipientName = birthday.recipientName?.trim() || "Cutie";
  const senderName = birthday.senderName?.trim() || "Your Friend";
  const letterParagraphs = (
    birthday.letterMessage ||
    "there’s no card big enough for everything i’d like to say, so i made you a little garden — with a song, our pictures, and a few of my favourite wishes for the year ahead.\n\nthank you for the small and unseen things — the way you check in, the jokes only we get, the quiet patience when i’m being too much. i noticed. i still notice.\n\ni hope today you feel celebrated. i hope you eat something delicious that you didn’t have to make, and someone tells you you’re loved (you are). most of all, i hope this year ahead feels — for one whole trip around the sun — exactly the way you’ve always made me feel: completely, completely loved."
  )
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const [currentScene, setCurrentScene] = useState(0);
  const [envelopeOpen, setEnvelopeOpen] = useState(false);
  const [litCandles, setLitCandles] = useState([false, false, false]);
  const [candlesOut, setCandlesOut] = useState(false);
  const confettiLayer = useRef<HTMLDivElement>(null);
  const heartsLayer = useRef<HTMLDivElement>(null);
  const nextSceneTimer = useRef<number | null>(null);

  function burstConfetti(count = 42) {
    const layer = confettiLayer.current;
    if (!layer) return;
    const colors = ["#e989a8", "#c8b6e8", "#f4b18e", "#ffd9a8", "#ffffff"];

    for (let i = 0; i < count; i += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.top = `${-5 - Math.random() * 8}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.width = `${5 + Math.random() * 5}px`;
      piece.style.height = `${8 + Math.random() * 8}px`;
      piece.style.setProperty("--dx", `${-90 + Math.random() * 180}px`);
      piece.style.animationDuration = `${2.8 + Math.random() * 2.4}s`;
      piece.style.animationDelay = `${Math.random() * 0.4}s`;
      piece.style.transform = `rotate(${Math.random() * 180}deg)`;
      layer.appendChild(piece);
      piece.addEventListener("animationend", () => piece.remove(), { once: true });
    }
  }

  function burstHearts(count = 12) {
    const layer = heartsLayer.current;
    if (!layer) return;

    for (let i = 0; i < count; i += 1) {
      const heart = document.createElement("span");
      heart.className = "floating-heart";
      heart.textContent = i % 3 === 0 ? "♡" : "♥";
      heart.style.left = `${30 + Math.random() * 40}%`;
      heart.style.top = `${45 + Math.random() * 12}%`;
      heart.style.animationDelay = `${Math.random() * 0.35}s`;
      heart.style.fontSize = `${13 + Math.random() * 14}px`;
      layer.appendChild(heart);
      heart.addEventListener("animationend", () => heart.remove(), { once: true });
    }
  }

  function celebrate() {
    burstConfetti(58);
    burstHearts(16);
  }

  useEffect(() => {
    burstConfetti(24);
    return () => {
      if (nextSceneTimer.current !== null) {
        window.clearTimeout(nextSceneTimer.current);
      }
    };
  }, []);

  function lightCandle(index: number) {
    if (litCandles[index] || candlesOut) return;

    const nextCandles = litCandles.map((isLit, candleIndex) =>
      candleIndex === index ? true : isLit,
    );
    setLitCandles(nextCandles);

    if (nextCandles.every(Boolean)) {
      celebrate();
    }
  }

  function blowCandles() {
    setCandlesOut(true);
    celebrate();
    nextSceneTimer.current = window.setTimeout(() => setCurrentScene(3), 1100);
  }

  function openEnvelope() {
    if (envelopeOpen) return;
    setEnvelopeOpen(true);
    burstHearts(7);
    nextSceneTimer.current = window.setTimeout(() => setCurrentScene(2), 900);
  }

  function resetStory() {
    if (nextSceneTimer.current !== null) {
      window.clearTimeout(nextSceneTimer.current);
      nextSceneTimer.current = null;
    }
    setCurrentScene(0);
    setEnvelopeOpen(false);
    setLitCandles([false, false, false]);
    setCandlesOut(false);
    confettiLayer.current?.replaceChildren();
    heartsLayer.current?.replaceChildren();
  }

  const remainingCandles = 3 - litCandles.filter(Boolean).length;
  const candleHint = candlesOut
    ? "wish made ♡"
    : remainingCandles === 0
      ? "make a wish ♡"
      : remainingCandles === 1
        ? "one more little flame ♡"
        : `just ${remainingCandles} more candles to light`;

  return (
    <div className="cutie-birthday">
      <main id="app" aria-live="polite">
        <div className="ambient ambient-a" />
        <div className="ambient ambient-b" />
        <div id="confetti" aria-hidden="true" ref={confettiLayer} />
        <div id="hearts" aria-hidden="true" ref={heartsLayer} />

        <nav className="story-dots" aria-label="Birthday story scenes">
          {sceneLabels.map((label, index) => (
            <button
              key={label}
              type="button"
              className={`story-dot ${currentScene === index ? "is-active" : ""}`}
              aria-label={`Go to ${label.toLowerCase()}`}
              aria-current={currentScene === index ? "step" : undefined}
              onClick={() => setCurrentScene(index)}
            />
          ))}
        </nav>

        <span className="site-watermark">@devsphere</span>

        <section
          className={`scene scene-hero ${currentScene === 0 ? "is-active" : ""}`}
          aria-hidden={currentScene !== 0}
        >
          <div className="scene-inner hero-inner">
            <div className="pill"><span>♡</span> A GIFT IS WAITING</div>
            <h1>Happy Birthday {recipientName}</h1>
            <p className="script">someone made you something ♡</p>
            <div className="mascot-wrap mascot-bob" aria-hidden="true">
              <span className="soft-orbit" />
              <img className="mascot mascot-pink" src={cutiePink} alt="" />
            </div>
            <button className="primary-btn" type="button" onClick={() => setCurrentScene(1)}>
              <span>🎁</span> OPEN YOUR GIFT
            </button>
          </div>
          <div className="corner-flower flower tl" />
          <div className="corner-flower flower tr" />
          <div className="corner-flower flower bl" />
          <div className="corner-flower flower br" />
        </section>

        <section
          className={`scene scene-envelope ${currentScene === 1 ? "is-active" : ""}`}
          aria-hidden={currentScene !== 1}
        >
          <div className="scene-inner envelope-inner">
            <div className="pill"><span>♡</span> A BIRTHDAY SURPRISE</div>
            <h2>a little something for you</h2>
            <p className="script">happy birthday ♡</p>
            <div className="mascot-wrap gray-float" aria-hidden="true">
              <img className="mascot mascot-grey" src={cutieGrey} alt="" />
            </div>
            <button
              className={`envelope ${envelopeOpen ? "is-open" : ""}`}
              type="button"
              aria-label="Open the birthday envelope"
              onClick={openEnvelope}
            >
              <span className="envelope-letter">♡</span>
              <span className="envelope-flap" />
              <span className="seal">♡</span>
              <span className="envelope-hint">tap to open</span>
            </button>
          </div>
        </section>

        <section
          className={`scene scene-cake ${currentScene === 2 ? "is-active" : ""}`}
          aria-hidden={currentScene !== 2}
        >
          <div className="scene-inner cake-inner">
            <div className="pill"><span>♡</span> MAKE A WISH</div>
            <h2>light the candles</h2>
            <div className="cake-stage">
              <div className="sparkle sparkle-a">✦</div>
              <div className="sparkle sparkle-b">✦</div>
              <div className="cake" aria-label="Three tier birthday cake">
                <div className="candles">
                  {litCandles.map((isLit, index) => (
                    <button
                      key={index}
                      className={`candle ${isLit ? "is-lit" : ""} ${candlesOut ? "is-out" : ""}`}
                      type="button"
                      aria-label={`${candlesOut ? "Candle" : isLit ? "Lit candle" : "Light candle"} ${index + 1}`}
                      aria-pressed={isLit}
                      onClick={() => lightCandle(index)}
                    >
                      <span className="wick" />
                      <span className="flame" />
                    </button>
                  ))}
                </div>
                <div className="tier tier-top"><i /><i /><i /></div>
                <div className="tier tier-middle"><i /><i /><i /></div>
                <div className="tier tier-bottom"><i /><i /><i /></div>
                <div className="cake-plate" />
              </div>
            </div>
            <div className="candle-controls">
              {litCandles.map((isLit, index) => (
                <button
                  key={index}
                  className="outline-btn"
                  type="button"
                  aria-pressed={isLit}
                  onClick={() => lightCandle(index)}
                >
                  ✧ CANDLE {index + 1}
                </button>
              ))}
            </div>
            <p className="script small-script">{candleHint}</p>
            {remainingCandles === 0 && !candlesOut && (
              <button className="wish-btn" type="button" onClick={blowCandles}>
                make a wish ♡ · blow out
              </button>
            )}
          </div>
        </section>

        <section
          className={`scene scene-message ${currentScene === 3 ? "is-active" : ""}`}
          aria-hidden={currentScene !== 3}
        >
          <div className="scene-inner message-inner">
            <article className="message-card">
              <div className="card-flowers flower flower-card-left" />
              <div className="card-flowers flower flower-card-right" />
              <div className="card-character">
                <img src={cutieGrey} alt="Cute birthday character" />
              </div>
              <div className="message-card-copy">
                <h2>happy birthday ♡</h2>
                <p>
                  {birthday.greetingMessage ||
                    "thank you for being you — for the patience, the late-night talks, the silly inside jokes. i hope today feels as gentle and special as you’ve always made my days feel."}
                </p>
                <button className="primary-btn" type="button" onClick={() => setCurrentScene(4)}>
                  READ MY LETTER →
                </button>
              </div>
            </article>
          </div>
        </section>

        <section
          className={`scene scene-letter ${currentScene === 4 ? "is-active" : ""}`}
          aria-hidden={currentScene !== 4}
        >
          <div className="scene-inner letter-inner">
            <div className="pill"><span>♡</span> A BIRTHDAY LETTER</div>
            <article className="letter-paper">
              <div className="paper-flower paper-flower-left" />
              <div className="paper-flower paper-flower-right" />
              <div className="portrait-ring">
                <img src={cutiePink} alt="Cute birthday character" />
              </div>
              <p className="eyebrow">♡ A LETTER, JUST FOR YOU ♡</p>
              <h2>Dearest {recipientName},</h2>
              <div className="divider"><span>✿</span><i /><span>✿</span></div>
              <div className="letter-body">
                {letterParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              </div>
              <div className="letter-signature">
                <div className="heart-rule"><span>♡</span><i /></div>
                <p className="script">with all my love,</p>
                <p className="signature">— {senderName.toUpperCase()}</p>
              </div>
            </article>
            <p className="footer-love">WITH LOVE · {senderName.toUpperCase()}</p>
            <button className="primary-btn restart-btn" type="button" onClick={resetStory}>
              ↻ START AGAIN
            </button>
            <p className="creator-credit">Created with <span>Devsphere</span></p>
            <a
              className="instagram-link"
              href="https://www.instagram.com/devsphere.in/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram: @devsphere.in"
            >
              <svg className="instagram-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="17.7" cy="6.4" r="1.1" fill="currentColor" />
              </svg>
              <span>@devsphere.in</span>
            </a>
            <a
              className="create-own-link"
              href="https://devsphere-s97l.onrender.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Create your own ↗
            </a>
          </div>
        </section>

        <section
          className={`scene scene-final ${currentScene === 5 ? "is-active" : ""}`}
          aria-hidden={currentScene !== 5}
        >
          <div className="scene-inner final-inner">
            <div className="final-glow" />
            <div className="mini-heart">♡</div>
            <h2>the end of the little story ♡</h2>
            <p className="script">until the next birthday adventure...</p>
            <p className="footer-love">WITH LOVE · {senderName.toUpperCase()}</p>
            <button className="primary-btn" type="button" onClick={resetStory}>
              ↻ START AGAIN
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
