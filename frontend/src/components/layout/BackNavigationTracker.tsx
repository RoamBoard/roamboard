"use client";

import { useEffect } from "react";
import { installBackNavigation, notifyBackNavigation } from "@/lib/back-navigation";

// Keep a predecessor on each browser entry, including after refresh and forward/back.
export default function BackNavigationTracker() {
    useEffect(() => installBackNavigation(window.history, window.location, notifyBackNavigation), []);
    return null;
}
