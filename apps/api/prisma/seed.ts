import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { bloomDefaultReasons } from "./bloom-default-reasons";

const db = new PrismaClient();

type TemplateSeed = {
  slug: string;
  name: string;
  description: string;

  thumbnailUrl?: string;

  cat: {
    id: string;
    slug: string;
  };

  price: number;

  tags: string[];

  featured?: boolean;

  isFree?: boolean;

  liveDemoUrl?: string;

  data: Record<string, unknown>;

  schema?: Record<string, unknown>;

  sections?: Array<Record<string, unknown>>;
};

const demoSchema = (
  fields: Array<Record<string, unknown>>,
  sections: Array<Record<string, unknown>>,
) => ({
  fields,
  sections,
  customization: {
    colors: true,
    fonts: true,
    animations: true,
    music: true,
    backgrounds: true,
  },
});

async function main() {
  // =========================================================
  // CATEGORIES
  // =========================================================

  const cats = [
    ["birthday", "Birthday", "Celebrate another beautiful chapter.", "🎂"],
    ["anniversary", "Anniversary", "Make the years feel unforgettable.", "❤️"],
    ["couple", "Couple", "Stories made for two.", "💌"],
    ["proposal", "Proposal", "Ask the question in a magical way.", "💍"],
    ["wedding", "Wedding", "Beautiful stories for your big day.", "💐"],
    ["raksha-bandhan", "Raksha Bandhan", "A thread, a bond, a lifetime.", "🧵"],
    [
      "graduation",
      "Graduation",
      "Celebrate the journey and what comes next.",
      "🎓",
    ],
    ["baby", "Baby", "Little moments, big love.", "🍼"],
    ["festivals", "Festivals", "Share the feeling of celebration.", "✨"],
  ];

  for (let i = 0; i < cats.length; i++) {
    const [slug, name, description, icon] = cats[i];

    await db.category.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        name,
        description,
        icon,
        sortOrder: i,
      },
    });
  }

  // =========================================================
  // CATEGORY REFERENCES
  // =========================================================

  const anniversary = await db.category.findUniqueOrThrow({
    where: { slug: "anniversary" },
  });

  const birthday = await db.category.findUniqueOrThrow({
    where: { slug: "birthday" },
  });

  const couple = await db.category.findUniqueOrThrow({
    where: { slug: "couple" },
  });

  const wedding = await db.category.findUniqueOrThrow({
    where: { slug: "wedding" },
  });

  const festivals = await db.category.findUniqueOrThrow({
    where: { slug: "festivals" },
  });

  // =========================================================
  // GENERIC FIELD SCHEMA
  // =========================================================

  const fields = (kind: string): Array<Record<string, unknown>> => {
    if (kind === "anniversary") {
      return [
        {
          id: "name",
          type: "text",
          label: "Your Name",
          required: true,
        },
        {
          id: "partnerName",
          type: "text",
          label: "Partner Name",
          required: true,
        },
        {
          id: "subtitle",
          type: "text",
          label: "Subtitle",
        },
        {
          id: "relationshipDate",
          type: "date",
          label: "Together Since",
          required: true,
        },
        {
          id: "timeline",
          type: "timeline",
          label: "Journey",
          itemFields: [
            {
              id: "date",
              type: "text",
              label: "Date",
            },
            {
              id: "title",
              type: "text",
              label: "Title",
            },
            {
              id: "description",
              type: "longText",
              label: "Description",
            },
            {
              id: "image",
              type: "image",
              label: "Image",
            },
          ],
        },
        {
          id: "photos",
          type: "images",
          label: "Photos",
        },
        {
          id: "letterTitle",
          type: "text",
          label: "Letter Title",
        },
        {
          id: "letter",
          type: "longText",
          label: "Love Letter",
        },
        {
          id: "countdownDate",
          type: "date",
          label: "Countdown Date",
        },
        {
          id: "finalTitle",
          type: "text",
          label: "Final Title",
        },
        {
          id: "finalMessage",
          type: "longText",
          label: "Final Message",
        },
      ];
    }

    return [
      {
        id: "name",
        type: "text",
        label: "Name",
        required: true,
      },
      {
        id: "subtitle",
        type: "text",
        label: "Subtitle",
      },
      {
        id: "photos",
        type: "images",
        label: "Photos",
      },
      {
        id: "letter",
        type: "longText",
        label: "Message",
      },
      {
        id: "finalMessage",
        type: "longText",
        label: "Final Message",
      },
    ];
  };

  // =========================================================
  // GENERIC SECTIONS
  // =========================================================

  const sections: Array<Record<string, unknown>> = [
    {
      id: "hero",
      type: "hero",
      enabled: true,
      props: {
        eyebrow: "A little piece of our story",
      },
    },
    {
      id: "intro",
      type: "intro",
      enabled: true,
      props: {},
    },
    {
      id: "timeline",
      type: "timeline",
      enabled: true,
      props: {},
    },
    {
      id: "gallery",
      type: "gallery",
      enabled: true,
      props: {},
    },
    {
      id: "letter",
      type: "letter",
      enabled: true,
      props: {},
    },
    {
      id: "countdown",
      type: "countdown",
      enabled: true,
      props: {},
    },
    {
      id: "final",
      type: "final",
      enabled: true,
      props: {},
    },
  ];

  // =========================================================
  // BIRTHDAY ROYAL MEMORY - CUSTOM FIELDS
  // =========================================================

  const birthdayRoyalFields: Array<Record<string, unknown>> = [
    {
      id: "name",
      type: "text",
      label: "Birthday Person's Name",
      required: true,
      placeholder: "e.g. Kanishka",
    },

    {
      id: "senderName",
      type: "text",
      label: "Your Name",
      required: false,
      placeholder: "e.g. Your Name",
    },

    {
      id: "subtitle",
      type: "longText",
      label: "Birthday Introduction",
      required: false,
      placeholder: "Line 1\nLine 2\nLine 3\nLine 4\nHAPPY BIRTHDAY",
    },

    // -------------------------------------------------------
    // MEMORY BALLOONS
    // -------------------------------------------------------

    {
      id: "balloonMemories",
      type: "repeater",
      label: "Memory Balloons",
      required: false,

      itemFields: [
        {
          id: "emoji",
          type: "text",
          label: "Emoji",
          placeholder: "🧸",
        },
        {
          id: "title",
          type: "text",
          label: "Memory Title",
          placeholder: "A soft memory wrapped in love.",
        },
        {
          id: "text",
          type: "longText",
          label: "Memory Text",
        },
        {
          id: "image",
          type: "image",
          label: "Memory Image",
        },
      ],
    },

    // -------------------------------------------------------
    // GALLERY
    // -------------------------------------------------------

    {
      id: "photos",
      type: "repeater",
      label: "Gallery Photos",
      required: false,

      itemFields: [
        {
          id: "image",
          type: "image",
          label: "Photo",
          required: true,
        },
        {
          id: "caption",
          type: "text",
          label: "Caption",
          required: false,
          placeholder: "Write something about this memory...",
        },
      ],
    },

    // -------------------------------------------------------
    // LETTERS
    // -------------------------------------------------------

    {
      id: "letters",
      type: "repeater",
      label: "Letters",
      required: false,

      itemFields: [
        {
          id: "title",
          type: "text",
          label: "Letter Title",
        },
        {
          id: "text",
          type: "longText",
          label: "Letter",
        },
      ],
    },

    // -------------------------------------------------------
    // MUSIC
    // -------------------------------------------------------

    {
      id: "tracks",
      type: "repeater",
      label: "Music Playlist",
      required: false,
      maxItems: 3,

      itemFields: [
        {
          id: "title",
          type: "text",
          label: "Song Title",
        },
        {
          id: "artist",
          type: "text",
          label: "Artist",
        },
        {
          id: "audio",
          type: "audio",
          label: "Audio File",
        },
      ],
    },

    // -------------------------------------------------------
    // TIMELINE
    // -------------------------------------------------------

    {
      id: "timeline",
      type: "repeater",
      label: "Our Story",
      required: false,

      itemFields: [
        {
          id: "title",
          type: "text",
          label: "Heading",
          required: true,
          placeholder: "First Meeting",
        },
        {
          id: "description",
          type: "longText",
          label: "Inner Text",
          required: true,
          placeholder: "Tell the story behind this moment...",
        },
      ],
    },
    // -------------------------------------------------------
    // CONSTELLATION MEMORIES
    // -------------------------------------------------------

    {
      id: "constellationMemories",
      type: "repeater",
      label: "Constellation Stars",
      required: false,

      itemFields: [
        {
          id: "message",
          type: "longText",
          label: "Star Message / Memory",
          required: true,
          placeholder: "Write a small memory hidden inside this star...",
        },
      ],
    },

    // -------------------------------------------------------
    // MYSTERY GIFTS
    // -------------------------------------------------------

    {
      id: "correctGifts",
      type: "repeater",
      label: "Correct Gifts",
      required: false,
      maxItems: 10,

      itemFields: [
        {
          id: "message",
          type: "text",
          label: "Correct Gift Message",
          required: true,
          placeholder: "Best wishes ❤️",
        },
      ],
    },

    {
      id: "wrongGifts",
      type: "repeater",
      label: "Wrong Gifts",
      required: false,
      maxItems: 10,

      itemFields: [
        {
          id: "message",
          type: "text",
          label: "Wrong Gift Message",
          required: true,
          placeholder: "Common babe 😭",
        },
      ],
    },

    {
      id: "giftFinalMessage",
      type: "longText",
      label: "Final Gift Surprise Message",
      required: false,
      placeholder: "Happy Birthday! Thank you for existing. I love you ❤️",
    },
    // -------------------------------------------------------
    // MINI GAME
    // -------------------------------------------------------

    {
      id: "gameTitle",
      type: "text",
      label: "Game Title",
      required: false,
      placeholder: "Catch My Heart ❤️",
    },

    {
      id: "gameInstruction",
      type: "longText",
      label: "Game Instruction",
      required: false,
      placeholder: "Catch the falling hearts to unlock a surprise.",
    },

    {
      id: "gameTarget",
      type: "number",
      label: "Hearts To Catch",
      required: false,
      placeholder: "20",
    },

    {
      id: "gameReward",
      type: "longText",
      label: "Game Surprise Message",
      required: false,
      placeholder: "You caught my heart ❤️ I love you!",
    },

    // -------------------------------------------------------
    // CAKE / WISH
    // -------------------------------------------------------

    {
      id: "wishMessage",
      type: "longText",
      label: "Birthday Wish Reveal",
      required: false,
    },

    {
      id: "movieEnabled",
      type: "checkbox",
      label: "Add Our Movie Section",
      required: false,
    },

    {
      id: "movieTitle",
      type: "text",
      label: "Movie Title",
      required: false,
      placeholder: "Our Movie 🎬",
    },

    {
      id: "movieDescription",
      type: "longText",
      label: "Movie Description",
      required: false,
      placeholder: "A little movie made from our beautiful memories ❤️",
    },

    {
      id: "movieVideo",
      type: "video",
      label: "Our Movie Video",
      required: false,
    },

    // -------------------------------------------------------
    // FUTURE PLANS
    // -------------------------------------------------------

    {
      id: "futurePlans",
      type: "repeater",
      label: "Future Plans",
      required: false,
      maxItems: 3,

      itemFields: [
        {
          id: "title",
          type: "text",
          label: "Plan Heading",
          required: true,
        },
        {
          id: "text",
          type: "longText",
          label: "Plan Inner Text",
          required: true,
        },
      ],
    },

    // -------------------------------------------------------
    // FINAL MESSAGE
    // -------------------------------------------------------
  ];

  // =========================================================
  // BIRTHDAY ROYAL MEMORY - CUSTOM SECTIONS
  // =========================================================

  const birthdayRoyalSections: Array<Record<string, unknown>> = [
    {
      id: "birthday-experience",
      type: "birthday-experience",
      enabled: true,
      props: {},
    },
  ];

  const cutieBirthdaySections: Array<Record<string, unknown>> = [
    {
      id: "cutie-birthday-experience",
      type: "cutie-birthday-experience",
      enabled: true,
      props: {},
    },
  ];

  const bloomTextField = (
    id: string,
    label: string,
    type = "text",
    placeholder?: string,
  ): Record<string, unknown> => ({ id, label, type, placeholder });
  const bloomRepeaterField = (
    id: string,
    label: string,
    itemFields: Array<Record<string, unknown>>,
    maxItems?: number,
  ): Record<string, unknown> => ({
    id,
    label,
    type: "repeater",
    itemFields,
    ...(maxItems ? { maxItems } : {}),
  });

  const bloomAnniversaryFields: Array<Record<string, unknown>> = [
    bloomTextField("name", "Partner's name", "text", "e.g. Meera"),
    bloomTextField("senderName", "Your name", "text", "e.g. Aarav"),
    bloomTextField("passcodeTitle", "Passcode page title", "text", "Happy Anniversary {name} ♡"),
    bloomTextField("passcodeMessage", "Passcode page message"),
    bloomTextField("passcodeError", "Passcode error message"),
    { id: "passcodeCode", type: "text", label: "6-digit passcode", placeholder: "250626", maxLength: 6 },
    bloomTextField("bloomTransitionMessage", "Bloom transition message"),
    bloomTextField("anniversaryNumber", "Anniversary number", "text", "1"),
    bloomTextField("anniversarySuffix", "Anniversary suffix", "text", "st"),
    bloomTextField("anniversaryLabel", "Anniversary title", "text", "Anniversary"),
    bloomTextField("relationshipDate", "Your relationship start date", "date"),
    bloomTextField("heroDate", "Date shown on the cover", "text", "25 · JUNE · 2026"),
    bloomTextField("introTitle", "Welcome page title"),
    bloomTextField("introMessage", "Welcome page message", "longText"),
    bloomTextField("introButton", "Welcome button label"),
    bloomTextField("introLoadingMessage", "Loading screen message"),
    bloomTextField("heroEyebrow", "Cover eyebrow"),
    bloomTextField("heroSubtitle", "Cover message", "longText"),
    bloomTextField("heroFooter", "Cover footer"),
    bloomTextField("timelineEyebrow", "Timeline eyebrow"),
    bloomTextField("timelineTitle", "Timeline title"),
    bloomTextField("timelineSubtitle", "Timeline subtitle", "longText"),
    bloomRepeaterField("timeline", "Timeline memories", [
      bloomTextField("year", "Date or year"),
      bloomTextField("title", "Memory title"),
      bloomTextField("text", "Memory message", "longText"),
      bloomTextField("image", "Memory photo", "image"),
    ], 20),
    bloomTextField("yearsEyebrow", "Years-together eyebrow"),
    bloomTextField("yearsTitle", "Years-together heading"),
    bloomTextField("daysCounterLabel", "Days counter label"),
    bloomTextField("hoursCounterLabel", "Hours counter label"),
    bloomTextField("minutesCounterLabel", "Minutes counter label"),
    bloomTextField("memoriesCounterLabel", "Memories counter label"),
    bloomTextField("statsEyebrow", "Stats eyebrow"),
    bloomTextField("statsTitle", "Stats title"),
    bloomRepeaterField("stats", "Love stats", [
      bloomTextField("icon", "Icon or emoji"),
      bloomTextField("value", "Stat value"),
      bloomTextField("label", "Stat label"),
    ], 8),
    bloomTextField("galleryEyebrow", "Photo gallery eyebrow"),
    bloomTextField("galleryTitle", "Photo gallery title"),
    bloomRepeaterField("photos", "Photo gallery", [
      bloomTextField("image", "Photo", "image"),
      bloomTextField("caption", "Photo caption"),
    ], 30),
    bloomTextField("lettersEyebrow", "Letters eyebrow"),
    bloomTextField("lettersTitle", "Letters title"),
    bloomRepeaterField("letters", "Love letters", [
      bloomTextField("title", "Letter title"),
      bloomTextField("text", "Letter message", "longText"),
    ], 12),
    bloomTextField("reasonsEyebrow", "Memory jar eyebrow"),
    bloomTextField("reasonsTitle", "Memory jar title"),
    bloomTextField("reasonsCountLabel", "Memory jar count label"),
    bloomRepeaterField("reasons", "Reasons I love you", [
      bloomTextField("text", "Reason", "longText"),
    ], 100),
    bloomTextField("cakeEyebrow", "Cake section eyebrow"),
    bloomTextField("cakeTitle", "Cake section title"),
    bloomTextField("cakeHint", "Cake section instruction"),
    bloomTextField("cakeMessage", "Cake wish message", "longText"),
    bloomTextField("musicEyebrow", "Music section eyebrow"),
    bloomTextField("musicTitle", "Music section title"),
    bloomRepeaterField("tracks", "Music playlist", [
      bloomTextField("title", "Song title"),
      bloomTextField("artist", "Artist"),
      bloomTextField("audio", "Audio file", "audio"),
    ], 8),
    bloomTextField("rotatingEyebrow", "Rotating gallery eyebrow"),
    bloomTextField("rotatingTitle", "Rotating gallery title"),
    bloomTextField("rotatingHint", "Rotating gallery instruction"),
    bloomRepeaterField("rotatingPhotos", "Rotating gallery photos", [
      bloomTextField("image", "Photo", "image"),
    ], 8),
    { id: "movieEnabled", type: "checkbox", label: "Add movie section (+₹10)" },
    bloomTextField("movieEyebrow", "Movie section eyebrow"),
    bloomTextField("movieTitle", "Movie section title"),
    bloomTextField("movieDescription", "Movie section message", "longText"),
    bloomTextField("movieTicket", "Movie ticket label"),
    bloomTextField("moviePoster", "Movie poster", "image"),
    bloomTextField("movieVideo", "Movie video", "video"),
    bloomTextField("scratchEyebrow", "Scratch reveal eyebrow"),
    bloomTextField("scratchTitle", "Scratch reveal title"),
    bloomTextField("scratchInstruction", "Scratch reveal instruction", "longText"),
    bloomTextField("scratchCoverLabel", "Scratch cover text"),
    bloomTextField("scratchImage", "Scratch reveal photo", "image"),
    bloomTextField("scratchRewardTitle", "Scratch reveal heading"),
    bloomTextField("scratchMessage", "Scratch reveal message", "longText"),
    bloomTextField("puzzleEyebrow", "Photo puzzle eyebrow"),
    bloomTextField("puzzleTitle", "Photo puzzle title"),
    bloomTextField("puzzleInstruction", "Photo puzzle instruction", "longText"),
    bloomTextField("puzzleImage", "Photo puzzle image", "image"),
    bloomTextField("puzzleSolvedMessage", "Photo puzzle solved message"),
    bloomTextField("countdownEyebrow", "Countdown eyebrow"),
    bloomTextField("countdownTitle", "Countdown title"),
    bloomTextField("countdownDaysLabel", "Countdown days label"),
    bloomTextField("countdownHoursLabel", "Countdown hours label"),
    bloomTextField("countdownMinutesLabel", "Countdown minutes label"),
    bloomTextField("countdownSecondsLabel", "Countdown seconds label"),
    bloomTextField("finalEyebrow", "Final page eyebrow"),
    bloomTextField("finalTitle", "Final page title"),
    bloomTextField("finalPlaceholder", "Final page input placeholder"),
    bloomTextField("finalButton", "Final page button label"),
    bloomTextField("finalError", "Final page hint"),
    bloomTextField("futureTitle", "Future plans heading"),
    bloomTextField("futureEyebrow", "Future plans eyebrow"),
    bloomRepeaterField("futurePlans", "Future plans", [
      bloomTextField("title", "Plan title"),
      bloomTextField("text", "Plan message", "longText"),
    ], 12),
    bloomTextField("closingMessage", "Closing message", "longText"),
    bloomTextField("closingSignature", "Closing signature", "text", "Leave blank to use your name"),
    bloomTextField("footerMessage", "Footer message"),
    bloomTextField("replayButtonLabel", "Replay button label"),
  ];

  const bloomAnniversarySections: Array<Record<string, unknown>> = [
    { id: "bloom-anniversary-experience", type: "bloom-anniversary-experience", enabled: true, props: {} },
  ];

  const navratriTextField = (
    id: string,
    label: string,
    type = "text",
    placeholder?: string,
  ): Record<string, unknown> => ({ id, label, type, placeholder });
  const navratriRepeaterField = (
    id: string,
    label: string,
    itemFields: Array<Record<string, unknown>>,
    maxItems: number,
  ): Record<string, unknown> => ({ id, label, type: "repeater", itemFields, maxItems });
  const navratriFields: Array<Record<string, unknown>> = [
    { id: "coverHeading", type: "sectionHeading", label: "Cover and names" },
    navratriTextField("hostName", "Your name", "text", "e.g. Aarav"),
    navratriTextField("guestName", "Your partner's name", "text", "e.g. Mira"),
    navratriTextField("welcomeEyebrow", "Cover eyebrow"),
    navratriTextField("welcomeKicker", "Cover kicker"),
    navratriTextField("welcomeTitle", "Cover title"),
    navratriTextField("welcomeSubtitle", "Cover message", "longText"),
    navratriTextField("beginButtonLabel", "Open-story button"),
    navratriTextField("welcomeFooter", "Cover footer"),

    { id: "storyHeading", type: "sectionHeading", label: "Story page" },
    { id: "showStory", type: "checkbox", label: "Show story page" },
    navratriTextField("storyEyebrow", "Story eyebrow"),
    navratriTextField("storyTitleLead", "Story title, first line"),
    navratriTextField("storyTitleEmphasis", "Story title, emphasized lines", "longText"),
    navratriTextField("storySubtitle", "Story message", "longText"),
    navratriTextField("storyNote", "Story note"),
    navratriTextField("storyButtonLabel", "Story button"),

    { id: "mapHeading", type: "sectionHeading", label: "Garba map" },
    { id: "showMap", type: "checkbox", label: "Show Garba map" },
    navratriTextField("mapEyebrow", "Map eyebrow"),
    navratriTextField("mapTitle", "Map title", "longText"),
    navratriTextField("mapSubtitle", "Map instructions", "longText"),
    navratriRepeaterField("mapStops", "Map stops", [
      navratriTextField("name", "Stop name"),
      navratriTextField("dialogue", "Dialogue", "longText"),
    ], 5),

    { id: "paniHeading", type: "sectionHeading", label: "Pani puri story" },
    { id: "showPani", type: "checkbox", label: "Show pani puri page" },
    navratriTextField("paniEyebrow", "Pani puri eyebrow"),
    navratriTextField("paniTitle", "Pani puri title", "longText"),
    navratriTextField("paniSubtitle", "Pani puri description", "longText"),
    navratriTextField("paniResultLabel", "Pani puri count label"),
    navratriTextField("puriButtonLabel", "Pani puri button"),
    navratriRepeaterField("paniScenes", "Pani puri scenes", [
      navratriTextField("image", "Scene image", "image"),
      navratriTextField("caption", "Scene caption", "longText"),
    ], 8),

    { id: "danceHeading", type: "sectionHeading", label: "Garba dance" },
    { id: "showDance", type: "checkbox", label: "Show dance page" },
    navratriTextField("danceEyebrow", "Dance eyebrow"),
    navratriTextField("danceTitle", "Dance title"),
    navratriTextField("danceSubtitle", "Dance description", "longText"),
    navratriTextField("dholButtonLabel", "Dhol button"),
    navratriRepeaterField("danceSteps", "Dance steps", [
      navratriTextField("title", "Step name"),
      navratriTextField("caption", "Step caption", "longText"),
      navratriTextField("image", "Dance illustration", "image"),
    ], 12),

    { id: "memoriesHeading", type: "sectionHeading", label: "Photos and video" },
    { id: "showPhotos", type: "checkbox", label: "Show memories page" },
    navratriTextField("photosEyebrow", "Memories eyebrow"),
    navratriTextField("photosTitle", "Memories title", "longText"),
    navratriTextField("photosSubtitle", "Memories description", "longText"),
    navratriTextField("photoTapHint", "Photo instruction"),
    navratriTextField("photoPreviousLabel", "Previous-photo button"),
    navratriTextField("photoNextLabel", "Next-photo button"),
    navratriRepeaterField("photos", "Memory photos", [
      navratriTextField("image", "Photo", "image"),
      navratriTextField("caption", "Photo caption"),
    ], 30),
    navratriTextField("videoTitle", "Video heading"),
    navratriTextField("video", "Optional video", "video"),

    { id: "passHeading", type: "sectionHeading", label: "Garba pass and RSVP" },
    { id: "showProposal", type: "checkbox", label: "Show RSVP and pass page" },
    navratriTextField("proposalEyebrow", "RSVP eyebrow"),
    navratriTextField("proposalHeading", "RSVP heading", "longText"),
    navratriTextField("yesButtonLabel", "Yes button"),
    navratriTextField("noButtonLabel", "No button"),
    navratriTextField("proposalNote", "RSVP note", "longText"),
    navratriTextField("ticketTitle", "Pass title"),
    navratriTextField("ticketHeader", "Pass header"),
    navratriTextField("ticketAdmit", "Pass admission label"),
    navratriTextField("ticketDateLabel", "Date row label"),
    navratriTextField("ticketTimeLabel", "Time row label"),
    navratriTextField("ticketVenueLabel", "Venue row label"),
    navratriTextField("ticketDressLabel", "Dress-code row label"),
    navratriTextField("ticketGuestLabel", "Guest row label"),
    navratriTextField("eventDate", "Event date"),
    navratriTextField("eventTime", "Event time"),
    navratriTextField("venue", "Venue"),
    navratriTextField("dressCode", "What to wear"),
    navratriTextField("ticketFoot", "Pass footer", "longText"),

    { id: "finaleHeading", type: "sectionHeading", label: "Finale and sharing" },
    navratriTextField("finalEyebrow", "Finale eyebrow"),
    navratriTextField("finalTitle", "Finale title", "longText"),
    navratriTextField("finalCopy", "Finale message", "longText"),
    navratriTextField("signature", "Closing signature"),
    navratriTextField("replayButtonLabel", "Replay button"),
    navratriTextField("shareButtonLabel", "Share button"),
    navratriTextField("shareMessage", "Share message", "longText"),
    navratriTextField("whatsapp", "Optional WhatsApp number", "text", "Country code and digits"),

    { id: "musicHeading", type: "sectionHeading", label: "Music playlist" },
    navratriRepeaterField("playlist", "Playlist tracks", [
      navratriTextField("title", "Track title"),
      navratriTextField("artist", "Artist"),
      navratriTextField("audio", "Audio file", "audio"),
    ], 8),
  ];
  const navratriSections: Array<Record<string, unknown>> = [
    { id: "navratri-partner-invite", type: "navratri-partner-invite", enabled: true, props: {} },
  ];
  const navratriAsset = (file: string) => `/templates/navratri-partner-invite/assets/${file}`;
  const navratriDanceSteps = [
    ["Do Tali", "One clap, one smile… let's begin!"],
    ["Tran Tali", "Now two claps, just like that!"],
    ["Dodhiya (6-step)", "Step right, step left — don't lose the beat."],
    ["Chapti & Spin", "A little spin, and look at that skirt fly!"],
    ["Single Strike", "Sticks up! Catch the rhythm."],
    ["Double Clash", "Clack-clack! Perfect timing."],
    ["The Circle Walk", "Round and round we go together."],
    ["Low Bend & Tap", "Low bend, little tap, big grin."],
    ["Back-to-Back", "Back-to-back, still in sync."],
    ["Joyous Finale", "That's our grand finale!"],
  ].map(([title, caption], index) => ({
    title,
    caption,
    image: navratriAsset(`dance-${index + 1}.webp`),
  }));
  const navratriDefaultData: Record<string, unknown> = {
    hostName: "Aarav", guestName: "Mira", welcomeEyebrow: "✦ A little Navratri surprise ✦",
    welcomeKicker: "HAPPY", welcomeTitle: "NAVRATRI",
    welcomeSubtitle: "Nine nights, a thousand lights, and one little adventure waiting for us.",
    beginButtonLabel: "Open our Navratri story", welcomeFooter: "Made with a little extra sparkle · 2026",
    showStory: true, storyEyebrow: "A Navratri special", storyTitleLead: "You, this Navratri,",
    storyTitleEmphasis: "there's something\nI have to tell you…",
    storySubtitle: "The dhol is playing, the lights are up and the whole city is dancing. And all I can think about is you.",
    storyNote: "Follow the map, there's a question at the end ✦", storyButtonLabel: "Let's go to the garba",
    showMap: true, mapEyebrow: "Tonight's map", mapTitle: "Garba night,\ntogether",
    mapSubtitle: "Tap each pin and we'll wander there together.",
    mapStops: [
      { name: "Main Gate", dialogue: "Ready, {guest}? The lights are calling us!" },
      { name: "Bangle Stall", dialogue: "Ooh, bangles first! Help me pick a colour to match my chaniya choli." },
      { name: "Pani Puri Bhaiya", dialogue: "That pani puri stall smells incredible. One plate? Maybe five." },
      { name: "Dhol Stage", dialogue: "I can hear the dhol! Promise you'll dance every round with me." },
      { name: "Photo Booth", dialogue: "One photo here, then? I want to remember this night forever." },
    ],
    showPani: true, paniEyebrow: "Snack break", paniTitle: "The pani puri\nchallenge",
    paniSubtitle: "One leaf bowl of pani puri, two very happy people.", paniResultLabel: "pani puris shared",
    puriButtonLabel: "One more, bhaiya! 🥣",
    paniScenes: [
      ["Bhaiya, one plate please!", 1], ["Look, he made it extra crispy!", 2],
      ["One for you, one for me.", 3], ["The cat took that one!", 4],
      ["Okay, this one is definitely mine.", 5], ["The free one is all yours, jaan.", 6],
    ].map(([caption, number]) => ({ image: navratriAsset(`pani-scene-${number}.webp`), caption })),
    showDance: true, danceEyebrow: "After the chaat", danceTitle: "Garba time",
    danceSubtitle: "You play the dhol. I'll dance. Every beat brings a new move.",
    dholButtonLabel: "🥁 Play the dhol", danceSteps: navratriDanceSteps,
    showPhotos: true, photosEyebrow: "Our memories", photosTitle: "Little moments,\nbig smiles",
    photosSubtitle: "Tap the photo or slide through our favourite Garba memories.",
    photoTapHint: "✧ Tap the photo for the next one ✧", photoPreviousLabel: "← Previous",
    photoNextLabel: "Next memory →",
    photos: navratriDanceSteps.map((step, index) => ({
      image: navratriAsset(`dance-${index + 1}.webp`), caption: [
        "The first clap", "Two claps, same rhythm", "Finding our footwork", "A spin worth keeping",
        "Dandiya sparks", "Clack-clack chemistry", "Around in a circle", "A low bend and a laugh",
        "Back-to-back buddies", "Our joyous finale",
      ][index],
    })),
    videoTitle: "A little movie of us", video: "",
    showProposal: true, proposalEyebrow: "The last pin", proposalHeading: "Will you be my\nGarba partner?",
    yesButtonLabel: "Yes! 💗", noButtonLabel: "No 💌", proposalNote: "One more thing before the night begins…",
    ticketTitle: "Navami", ticketHeader: "✦ GARBA PASS", ticketAdmit: "ADMIT TWO",
    ticketDateLabel: "Date", ticketTimeLabel: "Time", ticketVenueLabel: "Where",
    ticketDressLabel: "Wear", ticketGuestLabel: "For",
    eventDate: "Tuesday, 20 October", eventTime: "8 pm onwards",
    venue: "At the main gate", dressCode: "Your brightest chaniya choli",
    ticketFoot: "Keep this pass close. The dhol is waiting for us ✦",
    finalEyebrow: "Our little forever", finalTitle: "Every Navratri,\nwith you",
    finalCopy: "And the one after that,\nand the one after that.",
    signature: "Love, someone who knows 💛", replayButtonLabel: "↻ Watch it again",
    shareButtonLabel: "Share our pass", shareMessage: "Nine nights. A thousand lights. One person I want beside me.",
    whatsapp: "", playlist: [{ title: "Garba", artist: "", audio: navratriAsset("garba.mp3") }],
  };

  // =========================================================
  // TEMPLATES
  // =========================================================

  const weddingInvitationSections: Array<Record<string, unknown>> = [
    { id: "wedding-hero", type: "hero", enabled: true, props: { eyebrow: "Together with their families" } },
    { id: "wedding-intro", type: "intro", enabled: true, props: {} },
    { id: "wedding-timeline", type: "timeline", enabled: true, props: {} },
    { id: "wedding-gallery", type: "gallery", enabled: true, props: {} },
    { id: "wedding-letter", type: "letter", enabled: true, props: {} },
    { id: "wedding-countdown", type: "countdown", enabled: true, props: {} },
    { id: "wedding-final", type: "final", enabled: true, props: {} },
  ];

  const weddingInvitationFields: Array<Record<string, unknown>> = [
    { id: "name", type: "text", label: "Couple's names", required: true },
    { id: "subtitle", type: "text", label: "Invitation subtitle" },
    { id: "partnerName", type: "text", label: "Intro heading" },
    { id: "intro", type: "longText", label: "Invitation message" },
    {
      id: "timeline",
      type: "timeline",
      label: "Wedding events",
      itemFields: [
        { id: "date", type: "text", label: "Date and time" },
        { id: "title", type: "text", label: "Event name" },
        { id: "description", type: "longText", label: "Event details" },
        { id: "image", type: "image", label: "Event photo" },
      ],
    },
    { id: "photos", type: "images", label: "Photo gallery" },
    { id: "letterTitle", type: "text", label: "Closing heading" },
    { id: "letter", type: "longText", label: "A note for your guests" },
    { id: "countdownTitle", type: "text", label: "Countdown heading" },
    { id: "countdownDate", type: "date", label: "Wedding date" },
    { id: "finalTitle", type: "text", label: "Final heading" },
    { id: "finalMessage", type: "longText", label: "Final message" },
  ];

  const templates: TemplateSeed[] = [
    {
      slug: "cutie-birthday",
      name: "Cutie Birthday",
      thumbnailUrl: "/images/cutie-pink.png",
      description:
        "A sweet, interactive birthday story with a gift, candles and a personal letter. Free to create and share.",
      cat: birthday,
      price: 0,
      isFree: true,
      tags: ["birthday", "free", "interactive", "letter"],
      featured: true,
      data: {
        recipientName: "Cutie",
        greetingMessage:
          "thank you for being you — for the patience, the late-night talks, the silly inside jokes. i hope today feels as gentle and special as you’ve always made my days feel.",
        letterMessage:
          "there’s no card big enough for everything i’d like to say, so i made you a little garden — with a song, our pictures, and a few of my favourite wishes for the year ahead.\n\nthank you for the small and unseen things — the way you check in, the jokes only we get, the quiet patience when i’m being too much. i noticed. i still notice.\n\ni hope today you feel celebrated. i hope you eat something delicious that you didn’t have to make, and someone tells you you’re loved (you are). most of all, i hope this year ahead feels — for one whole trip around the sun — exactly the way you’ve always made me feel: completely, completely loved.",
        senderName: "Your Friend",
      },
      schema: demoSchema(
        [
          {
            id: "recipientName",
            type: "text",
            label: "Birthday person's name",
            required: true,
            placeholder: "e.g. Sam",
          },
          {
            id: "greetingMessage",
            type: "longText",
            label: "Birthday message",
            required: true,
            placeholder: "Write a short birthday message...",
          },
          {
            id: "letterMessage",
            type: "longText",
            label: "Letter",
            required: true,
            placeholder: "Write your letter. Leave a blank line between paragraphs.",
          },
          {
            id: "senderName",
            type: "text",
            label: "Your name",
            required: false,
            placeholder: "e.g. Alex",
          },
        ],
        cutieBirthdaySections,
      ),
      sections: cutieBirthdaySections,
    },

    // =======================================================
    // BIRTHDAY - ROYAL MEMORY
    // =======================================================

    {
      slug: "birthday-royal-memory",
      name: "Royal Memory Birthday",
      thumbnailUrl: "/images/royal-birthday.jpg",
      description:
        "A cinematic birthday experience filled with memories, letters, music and interactive surprises.",
      cat: birthday,
      price: 99,
      tags: ["birthday", "cinematic", "interactive", "memories", "premium",],
      featured: true,

      liveDemoUrl: "https://birthdaydemoweb.netlify.app/",

      data: {
        name: "Ananya",
        senderName: "Someone Special",

        subtitle:
          "Someone special has arrived...\nLoading memories...\nCollecting smiles...\nPreparing surprises...\nHAPPY BIRTHDAY",

        balloonMemories: [
          {
            emoji: "🧸",
            title: "A soft memory wrapped in love.",
            text: "One of those moments I never want to forget.",
            image: "",
          },
          {
            emoji: "🎀",
            title: "The day your smile became my favourite view.",
            text: "Some memories simply stay forever.",
            image: "",
          },
          {
            emoji: "💞",
            title: "Our sweetest little memory together.",
            text: "A tiny moment that means everything.",
            image: "",
          },
          {
            emoji: "✨",
            title: "Cute, cozy, and unforgettable.",
            text: "A little moment worth keeping forever.",
            image: "",
          },
          {
            emoji: "🌷",
            title: "My favourite person.",
            text: "Some people make ordinary days beautiful.",
            image: "",
          },
        ],

        photos: [
          {
            image: "",
            caption: "Happy Birthday to my favourite person",
          },
          {
            image: "",
            caption: "Every memory with you is a treasure",
          },
          {
            image: "",
            caption: "Counting the smiles you've given me",
          },
          {
            image: "",
            caption: "You make every day magical",
          },
          {
            image: "",
            caption: "A world more beautiful because you're in it",
          },
        ],

        galleryStories: [],

        letters: [
          {
            title: "A Little Letter For You",
            text: "Write a beautiful birthday letter here.",
          },
          {
            title: "One More Thing",
            text: "There is always something more to say.",
          },
        ],

        tracks: [],

        timeline: [
          {
            title: "First Meeting",
            description:
              "The day our story quietly began. I still remember every little detail of that moment.",
          },
          {
            title: "The First Memory",
            description:
              "One beautiful moment that became a memory I never want to lose.",
          },
          {
            title: "The Special Day",
            description:
              "Another chapter of our story that made everything feel even more special.",
          },
          {
            title: "Today",
            description:
              "And here we are today, creating more memories together.",
          },
        ],

        constellationMemories: [
          {
            message:
              "The day our story began. A tiny moment that became something unforgettable.",
          },
          {
            message:
              "One of my favourite memories — still shining as brightly as that day.",
          },
          {
            message: "A smile I never want to forget.",
          },
          {
            message:
              "A moment that made everything feel a little more magical.",
          },
          {
            message: "Some memories never fade. They simply become stars.",
          },
          {
            message: "Another beautiful chapter in our story.",
          },
          {
            message: "A little moment that means so much.",
          },
          {
            message: "And somehow, every memory keeps leading back to you.",
          },
          {
            message: "Today, and every day after — still writing our story.",
          },
        ],

        gifts: [
          {
            title: "A Little Surprise",
            text: "Something special is waiting for you.",
          },
          {
            title: "Another Memory",
            text: "A memory worth keeping forever.",
          },
          {
            title: "One More",
            text: "Because one surprise is never enough.",
          },
        ],

        gameTitle: "Catch My Heart",

        gameInstruction: "Collect 20 hearts to unlock a secret ❤️",

        gameTarget: 20,

        gameReward:
          "You make every ordinary moment feel magical. Thank you for being you. ❤️",

        wishMessage: "May all your dreams come true today and every day ❤️",

        futurePlans: [
          {
            title: "Dream One",
            text: "A beautiful plan for the future.",
          },
          {
            title: "Dream Two",
            text: "Another memory waiting to happen.",
          },
          {
            title: "Dream Three",
            text: "Many more moments together.",
          },
        ],

        finalTitle: "One Last Surprise",

        finalMessage: "Happy Birthday ❤️ May all your dreams come true.",
      },

      schema: demoSchema(birthdayRoyalFields, birthdayRoyalSections),

      sections: birthdayRoyalSections,
    },

    // =======================================================
    // ANNIVERSARY BLOOM: full editable story template, INR base ₹449.
    {
      slug: "anniversary-romantic-01",
      name: "Anniversary Bloom",
      description: "A cinematic, interactive anniversary story you can personalize and share.",
      cat: anniversary,
      price: 449,
      tags: ["romantic", "journey", "cinematic", "anniversary"],
      featured: true,
      thumbnailUrl: "/images/anniversary.png",
      liveDemoUrl: "https://anniversarydemo.vercel.app/",
      data: {
        name: "Vansh",
        senderName: "My Love",
        passcodeTitle: "Happy Anniversary {name} ♡",
        passcodeMessage: "A love only we know the code to",
        passcodeError: "Try again, my love ♡",
        passcodeCode: "250626",
        bloomTransitionMessage: "Our story begins...",
        anniversaryNumber: "1",
        anniversarySuffix: "st",
        anniversaryLabel: "Anniversary",
        relationshipDate: "2025-06-25",
        heroDate: "25 · JUNE · 2026",
        introTitle: "Hello Beautiful",
        introMessage: "I made something only for you. Every scroll contains another memory.\nTake your time.",
        introButton: "Bloom Our Story",
        introLoadingMessage: "Loading our memories...",
        heroEyebrow: "Happy",
        heroSubtitle: "My Love",
        heroFooter: "Forever",
        timelineEyebrow: "The Journey",
        timelineTitle: "Our Timeline",
        timelineSubtitle: "2025 to today, and always",
        timeline: [
          { year: "2025", title: "The First Hello", text: "A conversation that was supposed to be short turned into hours. Something in me already knew.", image: "/templates/anniversary-bloom/images/i1.jpg" },
          { year: "2025", title: "First Meet", text: "A conversation that was supposed to be short turned into hours. Something in me already knew.", image: "/templates/anniversary-bloom/images/i5.jpg" },
          { year: "2025", title: "Falling Deeper", text: "Every ordinary day started feeling like an adventure, simply because you were in it.", image: "/templates/anniversary-bloom/images/i2.jpg" },
          { year: "2025", title: "Proposal", text: "Every ordinary day started feeling like an adventure, simply because you were in it.", image: "/templates/anniversary-bloom/images/i6.jpg" },
          { year: "2025", title: "First Trip", text: "We learned each other fully — the good mornings, the hard days, and everything between.", image: "/templates/anniversary-bloom/images/i8.jpg" },
          { year: "2025", title: "Relationship", text: "Every ordinary day started feeling like an adventure, simply because you were in it.", image: "/templates/anniversary-bloom/images/i7.jpg" },
          { year: "2025", title: "Building Us", text: "We learned each other fully — the good mornings, the hard days, and everything between.", image: "/templates/anniversary-bloom/images/i3.jpg" },
          { year: "2025", title: "Engagement", text: "We learned each other fully — the good mornings, the hard days, and everything between.", image: "/templates/anniversary-bloom/images/i9.jpg" },
          { year: "2025", title: "Marriage", text: "We learned each other fully — the good mornings, the hard days, and everything between.", image: "/templates/anniversary-bloom/images/i10.jpg" },
          { year: "2026", title: "Anniversary", text: "We learned each other fully — the good mornings, the hard days, and everything between.", image: "/templates/anniversary-bloom/images/i11.jpg" },
          { year: "2026", title: "Today", text: "Still here. Still us. Still choosing this love, again and again.", image: "/templates/anniversary-bloom/images/i4.jpg" },
          { year: "2026", title: "To Be Continued", text: "We learned each other fully — the good mornings, the hard days, and everything between.", image: "/templates/anniversary-bloom/images/i12.jpg" },
        ],
        yearsEyebrow: "Since 25 June 2025",
        yearsTitle: "1 Years of Us",
        daysCounterLabel: "Days",
        hoursCounterLabel: "Hours",
        minutesCounterLabel: "Minutes",
        memoriesCounterLabel: "Memories",
        statsEyebrow: "Little Numbers, Big Love",
        statsTitle: "Love Stats",
        stats: [
          { icon: "📷", value: "842", label: "Photos" },
          { icon: "📅", value: "1095", label: "Dates" },
          { icon: "🤗", value: "∞", label: "Hugs" },
          { icon: "😂", value: "3,650+", label: "Laughs" },
          { icon: "🏆", value: "12", label: "Arguments Won" },
          { icon: "🕊️", value: "27", label: "Arguments Lost" },
          { icon: "❤️", value: "Always You", label: "Favorite Person" },
        ],
        galleryEyebrow: "Our Little Universe",
        galleryTitle: "Pinterest Gallery",
        photos: [
          { image: "/templates/anniversary-bloom/images/i13.jpg", caption: "That golden evening" },
          { image: "/templates/anniversary-bloom/images/i14.jpg", caption: "Us, always" },
          { image: "/templates/anniversary-bloom/images/i15.jpg", caption: "Coffee & you" },
          { image: "/templates/anniversary-bloom/images/i8.jpg", caption: "Our first trip" },
          { image: "/templates/anniversary-bloom/images/i17.jpg", caption: "Laughing too hard" },
          { image: "/templates/anniversary-bloom/images/i18.jpg", caption: "Rainy day walk" },
          { image: "/templates/anniversary-bloom/images/i19.jpg", caption: "Home is you" },
          { image: "/templates/anniversary-bloom/images/i20.jpg", caption: "Midnight talks" },
          { image: "/templates/anniversary-bloom/images/i21.jpg", caption: "That little cafe" },
          { image: "/templates/anniversary-bloom/images/i22.jpg", caption: "Forever kind of love" },
          { image: "/templates/anniversary-bloom/images/i23.jpg", caption: "Just us" },
          { image: "/templates/anniversary-bloom/images/i24.jpg", caption: "Sunset chasers" },
        ],
        lettersEyebrow: "Words From The Heart",
        lettersTitle: "Letters To You",
        letters: [
          { title: "To My Best Friend", text: "From the very first day, you felt like home. Thank you for every laugh, every quiet moment, and every \"I love you\" that still makes my heart skip. one years in, and I fall for you a little more each morning." },
          { title: "To My Forever", text: "I used to wonder what forever meant until I met you. Now I know — it means choosing you, again and again, on the easy days and the hard ones. You are my favorite person and my favorite place." },
          { title: "To My Future", text: "There is so much more ahead of us — more cities, more mornings, more inside jokes. Whatever comes, I only want to face it with you beside me. Here is to everything we have not lived yet." },
        ],
        reasonsEyebrow: "100 Reasons",
        reasonsTitle: "Memory Jar",
        reasonsCountLabel: "reasons left to discover",
        reasons: bloomDefaultReasons.map((text) => ({ text })),
        cakeEyebrow: "Make A Wish",
        cakeTitle: "Our Cake",
        cakeHint: "Tap each candle to light it",
        cakeMessage: "Happy Anniversary",
        musicEyebrow: "Our Soundtrack",
        musicTitle: "Music For Us",
        tracks: [
          { title: "Jab Tak", artist: "Armaan Malik", audio: "/templates/anniversary-bloom/music/jabtak.mpeg" },
          { title: "Sitare", artist: "King", audio: "/templates/anniversary-bloom/music/sitare.mpeg" },
          { title: "Perfect", artist: "Ed Sheeran", audio: "/templates/anniversary-bloom/music/perfect.mpeg" },
        ],
        rotatingEyebrow: "Spin Through Us",
        rotatingTitle: "Rotating Gallery",
        rotatingHint: "Drag to rotate",
        rotatingPhotos: [
          { image: "/templates/anniversary-bloom/images/i1.jpg" },
          { image: "/templates/anniversary-bloom/images/i2.jpg" },
          { image: "/templates/anniversary-bloom/images/i3.jpg" },
          { image: "/templates/anniversary-bloom/images/i4.jpg" },
          { image: "/templates/anniversary-bloom/images/i5.jpg" },
          { image: "/templates/anniversary-bloom/images/i6.jpg" },
          { image: "/templates/anniversary-bloom/images/i7.jpg" },
          { image: "/templates/anniversary-bloom/images/i8.jpg" },
        ],
        movieEnabled: false,
        movieEyebrow: "Movie Night",
        movieTitle: "A Film About Us",
        movieDescription: "Every love story deserves the biggest screen.",
        movieTicket: "Movie night · Reserved for two · Forever",
        moviePoster: "/templates/anniversary-bloom/images/i1.jpg",
        movieVideo: "/templates/anniversary-bloom/videos/movie.mp4",
        scratchEyebrow: "One More Surprise",
        scratchTitle: "Scratch To Reveal",
        scratchInstruction: "Scratch away the golden foil to reveal your surprise ❤️",
        scratchCoverLabel: "Scratch to reveal",
        scratchImage: "/templates/anniversary-bloom/images/i1.jpg",
        scratchRewardTitle: "I Love You Forever ❤️",
        scratchMessage: "Thank you for making every day feel magical.",
        puzzleEyebrow: "One Last Challenge",
        puzzleTitle: "Complete Our Memory",
        puzzleInstruction: "Rearrange the pieces to reveal our favorite photo ❤️",
        puzzleImage: "/templates/anniversary-bloom/images/i2.jpg",
        puzzleSolvedMessage: "❤️ You completed our memory ❤️",
        countdownEyebrow: "What's Next",
        countdownTitle: "Countdown To Our Next Anniversary",
        countdownDaysLabel: "Days",
        countdownHoursLabel: "Hours",
        countdownMinutesLabel: "Minutes",
        countdownSecondsLabel: "Seconds",
        finalEyebrow: "One Last Lock",
        finalTitle: "Only You Can Unlock It",
        finalPlaceholder: "Type your name…",
        finalButton: "Unlock",
        finalError: "That's not quite it, try again ♡",
        futureTitle: "Future Plans",
        futureEyebrow: "Our Future",
        futurePlans: [
          { title: "Travel Together", text: "Every country a new page in our story — mountains, oceans, and cities waiting to know our footsteps." },
          { title: "Dream Home", text: "A little home filled with warm light, our favorite books, and a kitchen that always smells like Sunday mornings." },
          { title: "Forever Together", text: "Growing old on the same porch, still choosing each other, still laughing at the same silly jokes." },
        ],
        closingMessage: "Thank you\nfor choosing me\nevery single day.",
        closingSignature: "",
        footerMessage: "@_devsphere__",
      },
      schema: demoSchema(bloomAnniversaryFields, bloomAnniversarySections),
      sections: bloomAnniversarySections,
    },

    {
      slug: "navratri-partner-invite",
      name: "Navratri Partner Invite",
      description:
        "A richly illustrated Garba-night story with an interactive map, pani puri challenge, dance steps, memories, RSVP pass and soundtrack.",
      cat: festivals,
      price: 101,
      tags: ["navratri", "garba", "festival", "interactive", "music"],
      featured: true,
      thumbnailUrl: "/templates/navratri-partner-invite/assets/cover-reference.png",
      liveDemoUrl: "https://navratri-garba.vercel.app/",
      data: navratriDefaultData,
      schema: {
        fields: navratriFields,
        sections: navratriSections,
        customization: {},
      },
      sections: navratriSections,
    },

    {
      slug: "wedding-invitation",
      name: "Wedding Invitation",
      thumbnailUrl: "/images/invitation.png",
      description:
        "A personal wedding invitation with your story, event details, photos and a countdown to the big day.",
      cat: wedding,
      price: 999,
      tags: ["wedding", "invitation", "celebration"],
      featured: true,
      data: {
        name: "Alex & Sam",
        subtitle: "Together with their families, they invite you to celebrate.",
        partnerName: "Join us for our wedding",
        intro:
          "Your presence would make our celebration even more special. We can't wait to share this day with you.",
        timeline: [
          {
            date: "June 20, 2027 · 5:00 PM",
            title: "Wedding Ceremony",
            description: "Join us as we begin our next chapter together.",
            image: "",
          },
          {
            date: "June 20, 2027 · 7:00 PM",
            title: "Dinner & Celebration",
            description: "Stay for dinner, music and a night of celebration.",
            image: "",
          },
        ],
        photos: [],
        letterTitle: "With love",
        letter: "Thank you for being part of our story. We hope to celebrate with you.",
        countdownTitle: "Counting down to our day",
        countdownDate: "2027-06-20",
        finalTitle: "We can't wait to see you",
        finalMessage: "Save the date and celebrate with us!",
      },
      schema: demoSchema(weddingInvitationFields, weddingInvitationSections),
      sections: weddingInvitationSections,
    },

    {
      slug: "anniversary-editorial-02",
      name: "Timeless Editorial",
      description: "Minimal, elegant and photo-forward.",
      cat: anniversary,
      price: 490,
      tags: ["elegant", "minimal"],

      data: {
        name: "Aarav",
        partnerName: "Meera",
        subtitle: "Two hearts, one story.",
        photos: [],
      },
    },

    {
      slug: "anniversary-dreamy-03",
      name: "Dreamy Memories",
      description: "Soft colors and gentle motion.",
      cat: anniversary,
      price: 799,
      tags: ["dreamy", "soft"],

      data: {
        name: "Aarav",
        partnerName: "Meera",
        subtitle: "Every little memory matters.",
        photos: [],
      },
    },

    // =======================================================
    // BIRTHDAY - EXISTING TEMPLATES
    // =======================================================

    {
      slug: "birthday-confetti-01",
      name: "Confetti Celebration",
      description: "Bright, joyful and playful.",
      cat: birthday,
      price: 299,
      tags: ["fun", "birthday"],

      data: {
        name: "Ananya",
        subtitle: "Today is all about you.",
        photos: [],
        letter: "Happy Birthday!",
      },
    },

    {
      slug: "birthday-elegant-02",
      name: "Elegant Birthday",
      description: "A polished birthday keepsake.",
      cat: birthday,
      price: 490,
      tags: ["elegant"],

      data: {
        name: "Ananya",
        subtitle: "A beautiful new chapter.",
        photos: [],
      },
    },

    {
      slug: "birthday-story-03",
      name: "Birthday Story",
      description: "Tell the story behind the smiles.",
      cat: birthday,
      price: 490,
      tags: ["story", "memories"],

      data: {
        name: "Ananya",
        subtitle: "Another year, another adventure.",
        photos: [],
      },
    },

    // =======================================================
    // COUPLE
    // =======================================================

    {
      slug: "couple-love-story-01",
      name: "Love Story",
      description: "A romantic long-form story.",
      cat: couple,
      price: 490,
      tags: ["love", "story"],

      data: {
        name: "Aarav",
        partnerName: "Meera",
        subtitle: "Our little universe.",
        photos: [],
      },
    },

    {
      slug: "couple-long-distance-02",
      name: "Miles Apart, Hearts Close",
      description: "Designed for long-distance love.",
      cat: couple,
      price: 799,
      tags: ["long-distance", "romantic"],

      data: {
        name: "Aarav",
        partnerName: "Meera",
        subtitle: "Distance never changed us.",
        photos: [],
      },
    },

    {
      slug: "couple-polaroid-03",
      name: "Polaroid Memories",
      description: "A playful gallery-led keepsake.",
      cat: couple,
      price: 490,
      tags: ["gallery", "polaroid"],

      data: {
        name: "Aarav",
        partnerName: "Meera",
        subtitle: "Frames from our story.",
        photos: [],
      },
    },
  ];

  const bloomOnly = process.argv.includes("--bloom-only");
  const navratriOnly = process.argv.includes("--navratri-only");
  const weddingOnly = process.argv.includes("--wedding-only");
  const templatesToSeed = bloomOnly
    ? templates.filter((template) => template.slug === "anniversary-romantic-01")
    : navratriOnly
      ? templates.filter((template) => template.slug === "navratri-partner-invite")
      : weddingOnly
        ? templates.filter((template) => template.slug === "wedding-invitation")
        : templates;

  // =========================================================
  // TEMPLATE UPSERT
  // =========================================================

  for (const t of templatesToSeed) {
    const templateFields =
      t.schema?.fields && Array.isArray(t.schema.fields)
        ? (t.schema.fields as Array<Record<string, unknown>>)
        : fields(t.cat.slug);

    const templateSections = t.sections ?? sections;

    const schema = t.schema ?? demoSchema(templateFields, templateSections);

    await db.template.upsert({
  where: {
    slug: t.slug,
  },

  update: {
    name: t.name,

    description:
      t.description,

    thumbnailUrl:
      t.thumbnailUrl ?? null,

    price:
      t.price,

    tags:
      t.tags,

    featured:
      t.featured ?? false,

    isFree:
      t.isFree ?? false,

    premium:
      t.price >= 799,

    liveDemoUrl:
      t.liveDemoUrl ?? null,

    schema: schema as any,

    defaultData:
      t.data as any,

    sections:
      templateSections as any,

    published:
      true,
  },

  create: {
    slug:
      t.slug,

    name:
      t.name,

    description:
      t.description,

    thumbnailUrl:
      t.thumbnailUrl ?? null,

    price:
      t.price,

    tags:
      t.tags,

    featured:
      t.featured ?? false,

    isFree:
      t.isFree ?? false,

    premium:
      t.price >= 799,

    liveDemoUrl:
      t.liveDemoUrl ?? null,

    categoryId:
      t.cat.id,

    schema: schema as any,

    defaultData:
      t.data as any,

    sections:
      templateSections as any,
  },
});
  }

  if (bloomOnly) {
    console.log("Anniversary Bloom template seed complete");
    return;
  }

  if (navratriOnly) {
    console.log("Navratri Partner Invite template seed complete");
    return;
  }

  if (weddingOnly) {
    console.log("Wedding Invitation template seed complete");
    return;
  }

  // =========================================================
  // PRICING PLANS
  // =========================================================

  const plans = [
    ["basic", "Basic", 299, "Simple digital gift experience"],
    ["premium", "Premium", 490, "Full customization + richer reveals"],
    ["luxury", "Luxury", 799, "Premium effects and maximum limits"],
  ];

  for (let i = 0; i < plans.length; i++) {
    const [slug, name, price, description] = plans[i];

    await db.pricingPlan.upsert({
      where: {
        slug: String(slug),
      },

      update: {
        price: Number(price),
        description: String(description),
        sortOrder: i,

        features: ["Responsive website", "Public link", "QR"],

        limits: {
          photos: 20,
          video: true,
        },
      },

      create: {
        slug: String(slug),
        name: String(name),
        price: Number(price),
        description: String(description),
        sortOrder: i,

        features: ["Responsive website", "Public link", "QR"],

        limits: {
          photos: 20,
          video: true,
        },
      },
    });
  }

  // =========================================================
  // ADMIN USER
  // =========================================================

  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";

  const adminPassword = process.env.ADMIN_PASSWORD || "change-me";

  const hash = await bcrypt.hash(adminPassword, 12);

  await db.user.upsert({
    where: {
      email: adminEmail,
    },

    update: {
      passwordHash: hash,
      role: "SUPER_ADMIN",
      verifiedAt: new Date(),
    },

    create: {
      email: adminEmail,
      passwordHash: hash,
      name: "Devsphere Admin",
      role: "SUPER_ADMIN",
      verifiedAt: new Date(),
    },
  });

  // =========================================================
  // APP SETTINGS
  // =========================================================

  await db.appSetting.upsert({
    where: {
      key: "brand",
    },

    update: {
      value: {
        name: "Devsphere",
        tagline: "Turn Your Memories Into Something Beautiful.",
      },
    },

    create: {
      key: "brand",
      value: {
        name: "Devsphere",
        tagline: "Turn Your Memories Into Something Beautiful.",
      },
    },
  });

  console.log("Seed complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
