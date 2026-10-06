"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion, type Variants } from "motion/react";

type TransitionState = {
    entering: boolean;
    enter: (button: HTMLAnchorElement | null) => void;
};

type Entry = {
    phase: "covering" | "waiting";
    clipPath: string;
    viewportWidth: number;
    viewportHeight: number;
    textX: number;
    textY: number;
};

type Props = {
    children: ReactNode;
};

const fullScreenClip = "inset(0px 0px 0px 0px)";

const takeoverVariants: Variants = {
    covering: (entry: Entry) => ({
        clipPath: [
            entry.clipPath,
            `inset(${entry.viewportHeight * 0.32}px 0px ${entry.viewportHeight * 0.36}px 0px)`,
            fullScreenClip
        ],
        transition: {
            type: "tween",
            duration: 1.35,
            times: [0, 0.48, 1],
            ease: [0.65, 0, 0.18, 1]
        }
    }),
    waiting: {
        clipPath: fullScreenClip,
        transition: { duration: 0 }
    },
    revealing: {
        clipPath: fullScreenClip,
        y: "-100%",
        transition: {
            clipPath: { duration: 0 },
            y: {
                type: "tween",
                duration: 1,
                ease: [0.76, 0, 0.16, 1]
            }
        }
    }
};

const WelcomeTransitionContext = createContext<TransitionState | null>(null);

export function useWelcomeTransition() {
    const transition = useContext(WelcomeTransitionContext);
    if (!transition) {
        throw new Error("Welcome entry needs WelcomeTransitionProvider.");
    }
    return transition;
}

export default function WelcomeTransitionProvider({ children }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const reducedMotion = useReducedMotion();
    const [entry, setEntry] = useState<Entry | null>(null);
    const entering = entry !== null;

    // Home has committed before its reveal starts. The root layout keeps this
    // overlay mounted while Next.js replaces the Welcome page underneath it.
    const stage =
        entry?.phase === "waiting" && pathname === "/home"
            ? "revealing"
            : entry?.phase;

    useEffect(() => {
        if (!entering) return;

        // Browser Back can interrupt either half of the transition.
        function cancelEntry() {
            setEntry(null);
        }

        window.addEventListener("popstate", cancelEntry);
        return () => window.removeEventListener("popstate", cancelEntry);
    }, [entering]);

    function enter(button: HTMLAnchorElement | null) {
        if (entering) return;

        if (
            !button ||
            reducedMotion ||
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
            router.push("/home");
            return;
        }

        // Measure ENTER so the overlay starts at the same position at any size.
        // Pixel insets let Motion interpolate all four edges without CSS calc().
        const bounds = button.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = Number.parseFloat(getComputedStyle(button).paddingLeft);

        router.prefetch("/home");
        setEntry({
            phase: "covering",
            clipPath: `inset(${bounds.top}px ${viewportWidth - bounds.right}px ${viewportHeight - bounds.bottom}px ${bounds.left}px)`,
            viewportWidth,
            viewportHeight,
            textX: bounds.left + padding,
            textY: bounds.top + bounds.height / 2 - viewportHeight / 2
        });
    }

    return (
        <WelcomeTransitionContext.Provider value={{ entering, enter }}>
            <div inert={entering} aria-busy={entering}>
                {children}
            </div>

            {entry && (
                <>
                    <p className="sr-only" role="status">
                        Entering Roamboard
                    </p>
                    <motion.div
                        className="font-body fixed inset-0 z-50 flex items-center overflow-hidden bg-black text-white [will-change:clip-path,transform]"
                        data-phase={stage}
                        aria-hidden="true"
                        initial={{ clipPath: entry.clipPath }}
                        animate={stage}
                        custom={entry}
                        variants={takeoverVariants}
                        onAnimationComplete={(definition) => {
                            if (
                                definition === "covering" &&
                                stage === "covering"
                            ) {
                                setEntry((current) =>
                                    current
                                        ? { ...current, phase: "waiting" }
                                        : null
                                );
                                router.push("/home");
                            } else if (definition === "revealing") {
                                setEntry(null);
                            }
                        }}
                    >
                        <motion.div
                            className="flex w-max flex-none gap-[2vw] text-[length:clamp(1.125rem,3.2vw,5rem)] leading-none whitespace-nowrap"
                            initial={{
                                transform: `translate(${entry.textX}px, ${entry.textY}px)`
                            }}
                            animate={{
                                transform: `translate(${-entry.viewportWidth * 0.04}px, 0px)`
                            }}
                            transition={{
                                type: "tween",
                                duration: 2.6,
                                ease: [0.33, 0, 0.12, 1.25]
                            }}
                        >
                            {Array.from({ length: 12 }, (_, index) => (
                                <span key={index}>ENTERING</span>
                            ))}
                        </motion.div>
                    </motion.div>
                </>
            )}
        </WelcomeTransitionContext.Provider>
    );
}
