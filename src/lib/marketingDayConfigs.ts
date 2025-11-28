export type YesNoField = { key: string; label: string; section: string };
export type NumericField = { key: string; label: string; min?: number };
export type TextField = { key: string; label: string; placeholder?: string };

export type DayName = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";

export type DayConfig = {
  day: DayName;
  yesNoFields: YesNoField[];
  numericFields?: NumericField[];
  textFields?: TextField[];
};

const whatsappCore: YesNoField[] = [
  { key: "waPostedStatus", label: "Posted WhatsApp Status updates", section: "WhatsApp" },
  { key: "waSavedContacts", label: "Saved new contacts", section: "WhatsApp" },
  { key: "waRespondedAll", label: "Responded to all messages", section: "WhatsApp" },
];

const stockChecklist: YesNoField = { key: "stockEnoughFastMovers", label: "Stock enough for fast movers", section: "Stock checklist" };

const igFbYtPosts: YesNoField[] = [
  { key: "igFbYtPosted2VideosEach", label: "Posted 2 videos on IG / FB / YT", section: "Instagram / Facebook / YouTube" },
  { key: "igFbYtRepliedAll", label: "Replied to all comments & DMs", section: "Instagram / Facebook / YouTube" },
];

const tikTokReplies: YesNoField = { key: "tiktokRepliedAll", label: "Replied to all TikTok comments & DMs", section: "TikTok" };

export const marketingDayConfigs: DayConfig[] = [
  {
    day: "Monday",
    yesNoFields: [
      { key: "tiktokPosted2Videos", label: "Posted 2 TikTok videos", section: "TikTok" },
      tikTokReplies,
      ...igFbYtPosts,
    ],
  },
  {
    day: "Tuesday",
    yesNoFields: [...whatsappCore, stockChecklist],
    numericFields: [
      { key: "liveSessionsCount", label: "Live sessions hosted", min: 0 },
      { key: "liveSessionsEstimatedViewers", label: "How many people viewed live session(s)", min: 0 },
      { key: "liveSessionDurationMinutes", label: "Live session duration (minutes)", min: 0 },
    ],
    textFields: [{ key: "liveSessionPlatform", label: "Platform used for live session", placeholder: "TikTok / IG / FB / YT" }],
  },
  {
    day: "Wednesday",
    yesNoFields: [
      { key: "waPosted10Statuses", label: "Posted 10 WhatsApp Status updates", section: "WhatsApp" },
      { key: "waSaved10Contacts", label: "Saved 10 contacts", section: "WhatsApp" },
      { key: "waRespondedAll", label: "Responded to all WhatsApp messages", section: "WhatsApp" },
      { key: "shot4ProductVideos", label: "Shot 4 product videos", section: "TikTok" },
      tikTokReplies,
      ...igFbYtPosts,
      stockChecklist,
    ],
  },
  {
    day: "Thursday",
    yesNoFields: [
      { key: "tiktokPosted4ExplanatoryVideos", label: "Posted 4 explanatory TikTok videos", section: "TikTok" },
      tikTokReplies,
      ...igFbYtPosts,
      ...whatsappCore,
      stockChecklist,
    ],
    numericFields: [
      { key: "liveSessionsCount", label: "Live sessions hosted", min: 0 },
      { key: "liveSessionsEstimatedViewers", label: "Estimated viewers across live(s)", min: 0 },
    ],
    textFields: [{ key: "liveSessionPlatform", label: "Platform used for live session", placeholder: "TikTok / IG / FB / YT" }],
  },
  {
    day: "Friday",
    yesNoFields: [
      { key: "shopCleaned", label: "Shop cleaned", section: "Shop neatness" },
      { key: "shopWellArranged", label: "Shop well arranged", section: "Shop neatness" },
      { key: "displayWellLabeled", label: "Display well labeled", section: "Shop neatness" },
      ...whatsappCore,
      stockChecklist,
    ],
    numericFields: [
      { key: "liveSessionsCount", label: "Live sessions hosted", min: 0 },
      { key: "liveSessionsEstimatedViewers", label: "Live viewers", min: 0 },
      { key: "liveSessionDurationMinutes", label: "Live session duration (minutes)", min: 0 },
    ],
    textFields: [{ key: "liveSessionPlatform", label: "Platform used for live session", placeholder: "TikTok / IG / FB / YT" }],
  },
  {
    day: "Saturday",
    yesNoFields: [
      { key: "tiktokPosted2Videos", label: "Posted 2 TikTok videos", section: "TikTok" },
      tikTokReplies,
      ...igFbYtPosts,
      ...whatsappCore,
      stockChecklist,
      { key: "shopCleaned", label: "Shop cleaned", section: "Shop neatness" },
      { key: "shopWellArranged", label: "Shop well arranged", section: "Shop neatness" },
      { key: "displayWellLabeled", label: "Display well labeled", section: "Shop neatness" },
    ],
    numericFields: [
      { key: "liveSessionsCount", label: "Live sessions hosted", min: 0 },
      { key: "liveSessionsEstimatedViewers", label: "Live viewers", min: 0 },
    ],
    textFields: [
      { key: "weeklyComment", label: "Weekly comment or complaints", placeholder: "Summarize any complaints or highlights" },
    ],
  },
];

export const marketingFieldTypes = marketingDayConfigs.reduce((acc, cfg) => {
  cfg.yesNoFields.forEach((f) => {
    acc[f.key] = "yesno";
  });
  (cfg.numericFields || []).forEach((f) => {
    acc[f.key] = "numeric";
  });
  (cfg.textFields || []).forEach((f) => {
    acc[f.key] = "text";
  });
  return acc;
}, {} as Record<string, "yesno" | "numeric" | "text">);

export const marketingFieldKeys = Object.keys(marketingFieldTypes);
