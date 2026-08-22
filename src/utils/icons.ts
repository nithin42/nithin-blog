export type IconName =
  "sparkles" | "shield" | "chip" | "code" | "device" | "flow" | "key";

/** SVG path data for the small line-icon set used across topic UI. */
export const ICON_PATHS: Record<IconName, string> = {
  sparkles:
    "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16 2.286 6.857L21 12l-6.714 2.143L12 21l-2.286-6.857L3 12l6.714-2.143L12 3Z",
  shield: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z",
  chip: "M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 7h10v10H7V7Z",
  code: "m8 8-4 4 4 4m8-8 4 4-4 4m-2-11-4 14",
  device:
    "M9 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 15h2",
  flow: "M5 6h6M5 12h14M5 18h9M17 4l3 2-3 2M20 16l-3 2 3 2",
  key: "M15 4a5 5 0 1 0-4.6 6.9L4 17.3V20h2.7l1-1v-2h2v-2h2l1.3-1.3A5 5 0 0 0 15 4Zm1.5 3.5h.01",
};
