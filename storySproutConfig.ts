export interface StorySproutStyle {
  name: string;
  slug: string;
  description: string;
  emoji: string;
}

export interface StorySproutTheme {
  name: string;
  slug: string;
  description: string;
  emoji: string;
}

export const styles: StorySproutStyle[] = [
  {
    name: "Whimsical Rhyme",
    slug: "whimsical-rhyme",
    description: "A bouncy, rhyming story full of wordplay and rhythm",
    emoji: "✨",
  },
  {
    name: "Calm Bedtime",
    slug: "calm-bedtime",
    description: "A soft, gentle story perfect for winding down",
    emoji: "🌙",
  },
  {
    name: "Silly & Goofy",
    slug: "silly-goofy",
    description: "A laugh-out-loud adventure with absurd surprises",
    emoji: "🤪",
  },
];

export const themes: StorySproutTheme[] = [
  {
    name: "Penguins",
    slug: "penguins",
    description: "Waddle into an icy adventure",
    emoji: "🐧",
  },
  {
    name: "Jungle",
    slug: "jungle",
    description: "Explore the wild leafy canopy",
    emoji: "🌴",
  },
  {
    name: "Space",
    slug: "space",
    description: "Blast off among the stars",
    emoji: "🚀",
  },
  {
    name: "Friendship",
    slug: "friendship",
    description: "A tale of making new friends",
    emoji: "🤝",
  },
  {
    name: "Farm",
    slug: "farm",
    description: "Visit the barnyard animals",
    emoji: "🐄",
  },
  {
    name: "Ocean",
    slug: "ocean",
    description: "Dive into the deep blue sea",
    emoji: "🌊",
  },
];
