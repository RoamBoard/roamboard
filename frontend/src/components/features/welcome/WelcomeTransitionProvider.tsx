"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion, type AnimationDefinition, type Transition, type Variants } from "motion/react";

type TransitionState = {
    entering: boolean;
    enter: (button: HTMLAnchorElement | null) => void;
};

type TransitionData = {
    phase: "covering" | "waiting";
    buttonClip: string;
    barClip: string;
    textStartTransform: string;
    textEndTransform: string;
};

type Props = {
    children: ReactNode;
};

// All durations are in seconds. Change these to adjust the animation.
const coverTransition: Transition = {
    type: "tween",
    duration: 1.35,
    times: [0, 0.48, 1],
    ease: [0.65, 0, 0.18, 1]
};

const revealTransition: Transition = {
    type: "tween",
    duration: 1,
    ease: [0.76, 0, 0.16, 1]
};

const textScrollTransition: Transition = {
    type: "tween",
    duration: 2.6,
    ease: [0.33, 0, 0.12, 1.25]
};

const enteringWords = Array.from({ length: 12 }, () => "ENTERING");
const fullScreenClip = "inset(0px 0px 0px 0px)";

function getOverlayVariants(transition: TransitionData): Variants {
    return {
        covering: {
            // Grow from the button to a wide bar, then cover the whole screen.
            clipPath: [transition.buttonClip, transition.barClip, fullScreenClip],
            transition: coverTransition
        },
        waiting: {
            clipPath: fullScreenClip,
            transition: { duration: 0 }
        },
        revealing: {
            clipPath: fullScreenClip,
            y: "-100%",
            transition: {
                clipPath: { duration: 0 },
                y: revealTransition
            }
        }
    };
}

function getOverlayPhase(transition: TransitionData | null, pathname: string) {
    if (!transition) return "idle";

    // Home must be underneath the overlay before we slide it away.
    if (transition.phase === "waiting" && pathname === "/home") {
        return "revealing";
    }

    return transition.phase;
}

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
    const [transition, setTransition] = useState<TransitionData | null>(null);
    const entering = transition !== null;
    const overlayPhase = getOverlayPhase(transition, pathname);

    useEffect(() => {
        if (!entering) return;

        // Clear the overlay if the user presses browser Back.
        function cancelEntry() {
            setTransition(null);
        }

        window.addEventListener("popstate", cancelEntry);
        return () => window.removeEventListener("popstate", cancelEntry);
    }, [entering]);

    function enter(button: HTMLAnchorElement | null) {
        if (entering) return;

        const prefersReducedMotion = reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        // Reduced-motion users go straight to Home.
        if (!button || prefersReducedMotion) {
            router.push("/home");
            return;
        }

        const buttonBounds = button.getBoundingClientRect();
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const textPadding = Number.parseFloat(getComputedStyle(button).paddingLeft);

        // Match ENTER's rectangle. inset() reads top, right, bottom, left.
        const topInset = buttonBounds.top;
        const rightInset = screenWidth - buttonBounds.right;
        const bottomInset = screenHeight - buttonBounds.bottom;
        const leftInset = buttonBounds.left;

        const textStartX = buttonBounds.left + textPadding;
        // The text row is centered, so its starting height needs an offset.
        const textStartY = buttonBounds.top + buttonBounds.height / 2 - screenHeight / 2;
        const textEndX = -screenWidth * 0.04;

        router.prefetch("/home");
        setTransition({
            phase: "covering",
            buttonClip: `inset(${topInset}px ${rightInset}px ${bottomInset}px ${leftInset}px)`,
            barClip: `inset(${screenHeight * 0.32}px 0px ${screenHeight * 0.36}px 0px)`,
            textStartTransform: `translate(${textStartX}px, ${textStartY}px)`,
            textEndTransform: `translate(${textEndX}px, 0px)`
        });
    }

    function handleAnimationComplete(completedAnimation: AnimationDefinition) {
        if (completedAnimation === "covering" && overlayPhase === "covering") {
            // The screen is black now, so Next.js can change the page behind it.
            setTransition((currentTransition) => {
                if (!currentTransition) return null;
                return { ...currentTransition, phase: "waiting" };
            });
            router.push("/home");
            return;
        }

        if (completedAnimation === "revealing") {
            setTransition(null);
        }
    }

    return (
        <WelcomeTransitionContext.Provider value={{ entering, enter }}>
            <div inert={entering} aria-busy={entering}>
                {children}
            </div>

            {transition && (
                <>
                    <p className="sr-only" role="status">
                        Entering Roamboard
                    </p>
                    <motion.div
                        className="font-body fixed inset-0 z-50 flex items-center overflow-hidden bg-black text-white [will-change:clip-path,transform]"
                        data-phase={overlayPhase}
                        aria-hidden="true"
                        initial={{ clipPath: transition.buttonClip }}
                        animate={overlayPhase}
                        variants={getOverlayVariants(transition)}
                        onAnimationComplete={handleAnimationComplete}
                    >
                        <motion.div
                            className="flex w-max flex-none gap-[2vw] text-[length:clamp(1.125rem,3.2vw,5rem)] leading-none whitespace-nowrap"
                            initial={{
                                transform: transition.textStartTransform
                            }}
                            animate={{
                                transform: transition.textEndTransform
                            }}
                            transition={textScrollTransition}
                        >
                            {enteringWords.map((word, index) => (
                                <span key={index}>{word}</span>
                            ))}
                        </motion.div>
                    </motion.div>
                </>
            )}
        </WelcomeTransitionContext.Provider>
    );
}
