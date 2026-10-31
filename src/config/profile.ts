// Your search profile. Edit freely.
export const PROFILE = {
  yearsMin: 3, yearsMax: 5,
  salaryLpaMin: 10, salaryLpaMax: 15,
  titleKeywords: /front[\s-]?end|react|next\.?js|wordpress|web developer|ui developer|elementor|html|css|web designer/i,
  excludeTitle: /\bintern(ship)?\b|unpaid|trainee/i,
  skills: {
    "html": /\bhtml5?\b/i, "css": /\bcss3?\b|tailwind|sass|scss/i, "javascript": /javascript|\bjs\b|es6/i,
    "react": /\breact(\.js|js)?\b/i, "next.js": /next\.?js/i, "typescript": /typescript/i,
    "wordpress": /wordpress/i, "elementor": /elementor/i, "divi": /\bdivi\b/i,
    "responsive": /responsive/i, "seo": /\bseo\b|rank math/i, "git": /\bgit(hub)?\b/i,
  } as Record<string, RegExp>,
  adzunaQueries: ["frontend developer", "react developer", "wordpress developer", "next.js developer", "web developer"],
  adzunaWhere: ["Bangalore", ""], // "" = all India
  jsearchQueries: ["frontend developer in Bangalore, India", "react developer remote India", "wordpress developer India"],
  jobicyTags: ["react", "frontend", "wordpress"],
  remotiveQueries: ["frontend", "react"],
  maxAgeDays: 30,
};
