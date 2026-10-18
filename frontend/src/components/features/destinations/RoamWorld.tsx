"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { createRoamAmbientScheduler, type RoamMoment } from "@/lib/roam-ambient";

import { roamLandmarks } from "@/lib/roam-landmarks";
import { Drawing, type Study } from "./landmarks/Drawing";
import { loadLandmark } from "./landmarks/collection";

function WorldMoment({ moment }: { moment: RoamMoment }) {
    const [study, setStudy] = useState<Study>();
    const reference = roamLandmarks.find((item) => item.id === moment.landmark)!;
    useEffect(() => {
        const pending = { active: true };
        void loadLandmark(moment.landmark)
            .then((drawing) => {
                if (pending.active) setStudy(drawing);
            })
            .catch(() => {
                // Decoration is optional; a chunk failure must never disrupt search.
            });
        return () => {
            pending.active = false;
        };
    }, [moment.landmark]);
    return (
        <motion.div
            className={`roam-world-moment roam-world-${moment.region} roam-world-${reference.silhouette} roam-world-${moment.framing} ${study?.viewBox ? "roam-world-wide" : ""}`}
            style={{ "--roam-scale": moment.scale } as CSSProperties}
            data-roam-moment={moment.landmark}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.8 + moment.scale * 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
            {study && <Drawing study={study} drawSeconds={moment.drawSeconds} />}
        </motion.div>
    );
}

export default function RoamWorld({
    focused,
    typing,
    leaving,
    reduced
}: {
    focused: boolean;
    typing: boolean;
    leaving: boolean;
    reduced: boolean;
}) {
    const [scheduler] = useState(createRoamAmbientScheduler);
    const moments = useSyncExternalStore(scheduler.subscribe, scheduler.getSnapshot, scheduler.getSnapshot);
    const [visible, setVisible] = useState(true);
    useEffect(() => {
        // Narrow windows share mobile's two separated upper/lower artwork regions.
        const mobile = window.matchMedia("(max-width: 1279px)");
        const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => {
            setVisible(!document.hidden);
            scheduler.setState({
                focused,
                typing,
                transitioning: leaving,
                reducedMotion: reduced || motionPreference.matches,
                hidden: document.hidden,
                mobile: mobile.matches,
                compact: window.innerHeight < (window.innerWidth < 768 ? 740 : 620)
            });
        };
        update();
        document.addEventListener("visibilitychange", update);
        window.addEventListener("resize", update);
        mobile.addEventListener("change", update);
        motionPreference.addEventListener("change", update);
        return () => {
            document.removeEventListener("visibilitychange", update);
            window.removeEventListener("resize", update);
            mobile.removeEventListener("change", update);
            motionPreference.removeEventListener("change", update);
            scheduler.dispose();
        };
    }, [scheduler, focused, typing, leaving, reduced]);
    // Selection/visibility changes remove the whole layer, including pending exits.
    if (leaving || reduced || !visible) return null;
    return (
        <motion.div
            aria-hidden="true"
            className={`roam-world text-muted-foreground`}
            animate={{ opacity: typing ? 0.38 : 0.7 }}
            transition={{ duration: 0.8 }}
        >
            <AnimatePresence>
                {moments.map((moment) => (
                    <WorldMoment key={moment.id} moment={moment} />
                ))}
            </AnimatePresence>
        </motion.div>
    );
}
