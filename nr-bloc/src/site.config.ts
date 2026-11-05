// Edit this file to change the words on the site.
export const site = {
  name: "The NR Bloc",
  // Your domain (used for share previews).
  url: "https://www.thenrbloc.com",
  tagline: "Retro gaming, gigs and venue hire in Norwich",
  description:
    "The NR Bloc is a community-run venue in Norwich: retro gaming, live gigs, weekly nights and a space you can hire.",
  intro:
    "A community-run space in Norwich. Retro consoles on free play, live music, weekly nights, and a room you can hire for whatever you've got planned.",

  // The logo in the nav bar and on the homepage. Leave as "" to use the
  // pixel-text logo, or put an image in public/images/ and set its path,
  // e.g. "/images/logo.png".
  logo: "",
  // The big homepage header image. Leave as "" for the arcade-grid
  // background, or put a photo in public/images/ and set its path,
  // e.g. "/images/hero.jpg".
  heroImage: "",

  location: "Norwich",
  email: "thenrbloc@protonmail.com",
  // Social links shown in the footer, e.g.
  // { label: "Instagram", url: "https://www.instagram.com/..." }
  links: [] as { label: string; url: string }[],

  // The three things the venue does, shown on the homepage.
  features: [
    {
      title: "Retro Gaming",
      href: "/gaming",
      text: "Classic consoles and games set up and ready to play. Pick up a pad, challenge a mate, or just come and hang out.",
    },
    {
      title: "Gigs",
      href: "/whats-on",
      text: "Live music from local and touring bands. Small room, loud nights, cheap tickets.",
    },
    {
      title: "Venue Hire",
      href: "/hire",
      text: "Hire the space for gigs, parties, tournaments, workshops, meetings or launches. Affordable rates.",
    },
  ],

  // Weekly nights, shown on the homepage and on What's On.
  regulars: [
    {
      day: "Wed",
      title: "MTG Commander Night",
      time: "5pm till late",
      text: "Weekly Magic: The Gathering Commander night. All levels welcome. Bring a deck or borrow one.",
      tags: ["Weekly", "Gaming"],
    },
    {
      day: "Thu",
      title: "DIY Night",
      time: "6pm till 8pm",
      text: "Bring a project, fix something, make something, learn something.",
      tags: ["Weekly", "Free"],
    },
    {
      day: "Fri",
      title: "Movie Night",
      time: "6pm till 9pm",
      text: "Weekly film night. Bring snacks, stay for the chat after.",
      tags: ["Weekly", "Film"],
    },
  ],

  // The Retro Gaming page.
  gaming: {
    intro: [
      "We've got retro consoles set up and ready to play. Drop in on a gaming night, bring your mates, or hire the room for a tournament or party.",
    ],
    // What's set up. Edit to match what you've actually got.
    consoles: [
      "Nintendo 64",
      "SNES",
      "Sega Mega Drive",
      "PlayStation",
      "PlayStation 2",
      "GameCube",
    ],
    points: [
      {
        title: "Free play",
        text: "No coins needed. Grab a controller and play.",
      },
      {
        title: "Multiplayer",
        text: "Couch co-op and versus classics. Bring a friend or make one.",
      },
      {
        title: "Tournaments",
        text: "Want to run a tournament? Hire the room and we'll set up the screens.",
      },
      {
        title: "Card games",
        text: "MTG Commander every Wednesday. Tables are free for other card and board games too.",
      },
    ],
  },

  // The Venue Hire page.
  hire: {
    intro: [
      "The NR Bloc is available to hire. Whether it's a gig, a birthday, a gaming tournament, a workshop or a launch night, get in touch and we'll sort it out.",
    ],
    uses: [
      { title: "Gigs", text: "Put on your own show. Bands, DJs, open mics, listening parties." },
      { title: "Parties", text: "Birthdays and celebrations, with the retro consoles on if you want them." },
      { title: "Tournaments", text: "Gaming and card game tournaments, with screens and tables set up." },
      { title: "Workshops & meetings", text: "Classes, skill shares, club meetings, rehearsals." },
      { title: "Launches & screenings", text: "Album, zine and game launches, film screenings." },
      { title: "Something else?", text: "If it's not on the list, ask. We'll probably say yes." },
    ],
    // What people need to tell you in their enquiry.
    enquiryChecklist: [
      "What you'd like to put on",
      "The date and times you want",
      "Roughly how many people",
      "Anything you need from us (screens, consoles, PA, tables)",
    ],
    note: "Rates are kept affordable for the community. Get in touch for a price.",
  },

  // The Support page.
  support: {
    intro: [
      "The NR Bloc is community-run, with no big backers. The space stays open because of ticket sales, hire, donations and the people who volunteer.",
    ],
    goFundMe: "https://gofund.me/e6928a0ce",
    bank: {
      name: "The NR Bloc",
      sortCode: "04-14-50",
      account: "67227793",
    },
    otherWays: [
      { title: "Volunteer", text: "Help set up, run the door, make tea, fix things. Turn up and ask what needs doing." },
      { title: "Donate kit", text: "Old consoles, games, controllers, cables, furniture. If you've got it, we can probably use it." },
      { title: "Spread the word", text: "Share our events and stick a flyer up." },
    ],
  },

  // House rules, shown in the footer of every page.
  houseRules: "Everyone welcome. Be sound to each other.",
};
