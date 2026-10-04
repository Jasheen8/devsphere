import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const sections = [
  {
    id: "cutie-birthday-experience",
    type: "cutie-birthday-experience",
    enabled: true,
    props: {},
  },
];

const schema = {
  fields: [
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
  sections,
  customization: {
    colors: false,
    fonts: false,
    animations: false,
    music: false,
    backgrounds: false,
  },
};

const defaultData = {
  recipientName: "Cutie",
  greetingMessage:
    "thank you for being you — for the patience, the late-night talks, the silly inside jokes. i hope today feels as gentle and special as you’ve always made my days feel.",
  letterMessage:
    "there’s no card big enough for everything i’d like to say, so i made you a little garden — with a song, our pictures, and a few of my favourite wishes for the year ahead.\n\nthank you for the small and unseen things — the way you check in, the jokes only we get, the quiet patience when i’m being too much. i noticed. i still notice.\n\ni hope today you feel celebrated. i hope you eat something delicious that you didn’t have to make, and someone tells you you’re loved (you are). most of all, i hope this year ahead feels — for one whole trip around the sun — exactly the way you’ve always made me feel: completely, completely loved.",
  senderName: "Your Friend",
};

async function main() {
  const birthday = await db.category.findUniqueOrThrow({
    where: { slug: "birthday" },
  });

  await db.template.upsert({
    where: { slug: "cutie-birthday" },
    update: {
      name: "Cutie Birthday",
      description:
        "A sweet, interactive birthday story with a gift, candles and a personal letter. Free to create and share.",
      categoryId: birthday.id,
      price: 0,
      thumbnailUrl: "/images/cutie-pink.png",
      tags: ["birthday", "free", "interactive", "letter"],
      featured: true,
      premium: false,
      isFree: true,
      published: true,
      schema,
      defaultData,
      sections,
    },
    create: {
      slug: "cutie-birthday",
      name: "Cutie Birthday",
      description:
        "A sweet, interactive birthday story with a gift, candles and a personal letter. Free to create and share.",
      categoryId: birthday.id,
      price: 0,
      thumbnailUrl: "/images/cutie-pink.png",
      tags: ["birthday", "free", "interactive", "letter"],
      featured: true,
      premium: false,
      isFree: true,
      published: true,
      schema,
      defaultData,
      sections,
    },
  });

  console.log("Cutie Birthday template is available in the catalog.");
}

main()
  .catch((error) => {
    console.error("Cutie Birthday template seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
