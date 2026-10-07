/* Solar Point — site configuration.
   After deploying the Apps Script web app, paste its URL into API_URL.
   Everything else is managed from the Google Sheet ("Settings" tab);
   DEFAULTS below are only used until the Sheet answers (or if it is unreachable). */
window.SP_CONFIG = {
  API_URL: "",              // e.g. https://script.google.com/macros/s/XXXX/exec
  CACHE_MINUTES: 5,
  LAT: 20.2570461,
  LNG: 85.8359635,
  PLACE_ID: "ChIJU7z_i_enGToRouunSR7a9-c",

  // Safe fallbacks. Contact details are intentionally empty until confirmed:
  // buttons that need them stay hidden and the quote form remains available.
  DEFAULTS: {
    business_name: "Solar Point",
    phone: "",
    whatsapp: "",
    email: "",
    hours: "",
    address: "Plot No-88, Lane No-6, Bapuji Nagar, Bhubaneswar 751009",
    footer_text: "Solar solutions from Bapuji Nagar, Bhubaneswar."
  },

  // Shown only when the Sheet cannot be reached AND nothing is cached.
  // Neutral wording, no claims. Real content comes from the Sheet.
  FALLBACK: {
    services: [
      { id: "s1", name: "Solar for homes", slug: "solar-for-homes", shortDescription: "Solar solutions for houses and apartments. Tell us about your roof and usage.", icon: "home" },
      { id: "s2", name: "Solar for business", slug: "solar-for-business", shortDescription: "Solutions for shops, offices and commercial premises.", icon: "building" },
      { id: "s3", name: "Inverters & batteries", slug: "inverters-batteries", shortDescription: "Ask us about inverters, batteries and backup options.", icon: "battery" },
      { id: "s4", name: "Advice & consultation", slug: "consultation", shortDescription: "Not sure where to start? Talk to the team.", icon: "chat" }
    ],
    faqs: []
  }
};
