/* SAT Studio pricing. This is the one place prices and free limits live:
   the Billing page, the paywalls and the landing page (/welcome) all read it.
   Prices are in Uzbek so'm. To change a price, edit it here and push. */
window.SAT_PLANS = {
  currency: "so'm",
  /* Launch offer. While `founding` is true each plan shows `price` with `list` crossed out.
     When the first 100 students have paid, set founding to false and the app charges `list`. */
  founding: true,
  foundingNote: "Founding price for our first 100 students",
  plans: [
    { code: "m1", months: 1, name: "1 month", price: 49000, list: 69000, blurb: "Try Pro before a test date." },
    { code: "m3", months: 3, name: "90-Day Pass", price: 99000, list: 149000, best: true, blurb: "Covers the whole 90-Day Course." },
    { code: "m6", months: 6, name: "6 months", price: 179000, list: 249000, blurb: "For two test dates and a retake." },
  ],
  /* Money-back promise shown on the Billing page. Set to 0 to remove it. */
  guaranteeDays: 7,
  /* What a free account gets. */
  free: {
    full: ["pt1", "pt2", "rw1", "rw2"], // full tests open to everyone (retakes allowed)
    sat: ["sat1"],                      // Full SAT in Bluebook format
    drillsPerDay: 3,                    // "Redo my mistakes" never counts
    courseWeeks: 1,                     // weeks of Month 1 of the 90-Day Course
    aiPerDay: 10,                       // keep equal to FREE_DAILY_AI_LIMIT in Vercel (default 10)
    bookFree: true,                     // Book tests stay free and uncounted
  },
  pro: { aiPerDay: 150 },               // keep equal to DAILY_AI_LIMIT in Vercel (default 150)
};
