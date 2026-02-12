import type { AppMeta } from "@calcom/types/App";

import _package from "./package.json";

export const metadata = {
  name: "Cal Studio",
  description: _package.description,
  installed: true,
  type: "cal_studio_video",
  variant: "conferencing",
  url: "https://studio.cal.com",
  categories: ["conferencing"],
  logo: "icon.svg",
  publisher: "Cal.com",
  category: "conferencing",
  slug: "cal-studio",
  title: "Cal Studio",
  isGlobal: true,
  email: "help@cal.com",
  appData: {
    location: {
      linkType: "dynamic",
      type: "integrations:cal-studio",
      label: "Cal Studio",
    },
  },
  key: {},
  dirName: "calstudio",
  concurrentMeetings: true,
  isOAuth: false,
} as AppMeta;

export default metadata;
