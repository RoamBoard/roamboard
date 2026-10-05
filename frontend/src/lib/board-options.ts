import type { PinCategory } from "@/types/board-creator";

export const pinCategories: Array<{ value: PinCategory; label: string }> = [
  { value: "landmark", label: "Landmark / POI" },
  { value: "culture", label: "Culture" },
  { value: "museum", label: "Museum" },
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Café" },
  { value: "bar", label: "Bar" },
  { value: "shopping", label: "Shopping" },
  { value: "park", label: "Park" },
  { value: "nature", label: "Nature" },
  { value: "hike", label: "Hike" },
  { value: "beach", label: "Beach" },
  { value: "neighborhood", label: "Neighborhood" },
  { value: "city", label: "City / town" },
  { value: "address", label: "Address" },
  { value: "stay", label: "Stay" },
  { value: "transit", label: "Transit" },
  { value: "event", label: "Event" },
  { value: "activity", label: "Activity" },
  { value: "other", label: "Other" },
];

export const tagSuggestions = [
  "tokyo", "japan", "kyoto", "new york", "paris", "london", "rome", "seoul", "bangkok",
  "stockholm", "copenhagen", "lisbon", "barcelona", "amsterdam", "berlin", "sydney", "singapore",
  "itinerary", "food", "city", "walking", "hike", "nature", "rural", "restaurant",
  "coffee", "museum", "architecture", "art", "nightlife", "shopping", "beach", "mountains",
  "road trip", "family", "solo", "weekend", "budget", "luxury", "hidden gems", "photography",
  "history", "culture", "local life", "train travel", "sustainable", "accessible", "temples", "markets",
  "street food", "fine dining", "day trip", "backpacking", "scenic", "waterfront", "islands", "wildlife",
];

export const vibeSuggestions = [
  { label: "Nature", icon: "🌿" }, { label: "Romantic", icon: "♥" },
  { label: "Hidden gems", icon: "✦" }, { label: "Solo travel", icon: "◉" },
  { label: "Hiking", icon: "⛰" }, { label: "Shopping", icon: "◇" },
  { label: "Foodie", icon: "◌" }, { label: "Nightlife", icon: "☾" },
  { label: "Culture", icon: "◈" }, { label: "History", icon: "⌛" },
  { label: "Architecture", icon: "△" }, { label: "Art", icon: "▣" },
  { label: "Wellness", icon: "○" }, { label: "Adventure", icon: "↗" },
  { label: "Beach", icon: "☀" }, { label: "Mountains", icon: "▲" },
  { label: "Road trip", icon: "→" }, { label: "Luxury", icon: "◆" },
  { label: "Budget", icon: "●" }, { label: "Family", icon: "⌂" },
  { label: "Friends", icon: "∞" }, { label: "Photography", icon: "□" },
  { label: "Local life", icon: "∴" }, { label: "Slow travel", icon: "∼" },
  { label: "Weekend", icon: "◫" }, { label: "City break", icon: "▦" },
  { label: "Rural", icon: "⌃" }, { label: "Winter", icon: "❄" },
  { label: "Summer", icon: "☀" }, { label: "Sustainable", icon: "♲" },
  { label: "Accessible", icon: "◎" }, { label: "Music", icon: "♫" },
  { label: "Festivals", icon: "✧" },
];

export function categoryFromMapboxType(type: string): PinCategory {
  if (type === "place") return "city";
  if (["locality", "neighborhood", "district", "region", "country"].includes(type)) return "neighborhood";
  if (["postcode", "street", "block", "address", "secondary_address"].includes(type)) return "address";
  return "landmark";
}
