import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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

  // =========================================================
  // TEMPLATES
  // =========================================================

  const templates: TemplateSeed[] = [
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
      tags: ["birthday", "cinematic", "interactive", "memories", "premium"],
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
    // ANNIVERSARY
    // =======================================================

    {
      slug: "anniversary-romantic-01",
      name: "Romantic Journey",
      description: "A cinematic story for anniversaries.",
      cat: anniversary,
      price: 490,
      tags: ["romantic", "journey", "cinematic"],
      featured: true,

      data: {
        name: "Aarav",
        partnerName: "Meera",
        subtitle: "Together is our favorite place.",

        timeline: [
          {
            date: "12 June 2024",
            title: "The First Hello",
            description: "A simple beginning that became everything.",
          },
        ],

        photos: [],

        letter: "Write from your heart.",

        finalMessage: "To be continued…",
      },
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

  // =========================================================
  // TEMPLATE UPSERT
  // =========================================================

  for (const t of templates) {
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

    premium:
      t.price >= 799,

    liveDemoUrl:
      t.liveDemoUrl ?? null,

    schema,

    defaultData:
      t.data,

    sections:
      templateSections,

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

    premium:
      t.price >= 799,

    liveDemoUrl:
      t.liveDemoUrl ?? null,

    categoryId:
      t.cat.id,

    schema,

    defaultData:
      t.data,

    sections:
      templateSections,
  },
});
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
          expirationDays:
            slug === "basic" ? 30 : slug === "premium" ? 365 : null,
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
          expirationDays:
            slug === "basic" ? 30 : slug === "premium" ? 365 : null,
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
